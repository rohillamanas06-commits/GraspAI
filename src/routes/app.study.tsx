import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_BASE, getAccessToken } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, SkipForward, Upload, Download, Pencil } from "lucide-react";
import { CoffeeLoading } from "@/components/ui/coffee-loading";
import { useAuth } from "@/lib/auth";
import { BuyCreditsModal } from "@/components/BuyCreditsModal";

export const Route = createFileRoute("/app/study")({
  head: () => ({ meta: [{ title: "Study Agent — GraspAI" }] }),
  component: StudyPage,
});

interface Topic { subject: string; name: string; difficulty?: string; subtopics: { name: string; weightage?: string }[] }
interface DayPlan { day: number; date: string; topics: string[]; estimated_hours: number; is_revision: boolean }
interface Flashcard { topic: string; question: string; answer: string; difficulty: string; next_review_day: number }

type Feedback = "too_easy" | "too_hard" | "skip";

function StudyPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("grasp_active_session") : null
  );
  const [tab, setTab] = useState("upload");
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    if (sessionId) localStorage.setItem("grasp_active_session", sessionId);
  }, [sessionId]);

  // session list for picker
  const { data: dash } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<any>("/api/dashboard"),
  });

  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    if (dash?.sessions && !initialCheckDone) {
      if (sessionId && !dash.sessions.some((s: any) => s.session_id === sessionId)) {
        setSessionId(null);
        localStorage.removeItem("grasp_active_session");
      }
      setInitialCheckDone(true);
    }
  }, [dash, sessionId, initialCheckDone]);

  const activeSession = dash?.sessions?.find((s: any) => s.session_id === sessionId);
  const phases = activeSession?.phases || {};

  return (
    <div className="w-full space-y-4 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">Study Agent</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Upload a syllabus, generate a plan, brew flashcards, give feedback, export.
          </p>
        </div>
        {dash?.sessions?.length > 0 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Active session</Label>
            <select
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={sessionId ?? ""}
              onChange={(e) => setSessionId(e.target.value || null)}
            >
              <option value="">New</option>
              {dash.sessions.map((s: any) => (
                <option key={s.session_id} value={s.session_id}>{s.session_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="upload" className="flex-1 text-xs sm:text-sm">1. Syllabus</TabsTrigger>
          <TabsTrigger value="plan" disabled={!sessionId} className="flex-1 text-xs sm:text-sm">2. Plan</TabsTrigger>
          <TabsTrigger value="cards" disabled={!phases.plan_generated} className="flex-1 text-xs sm:text-sm">3. Cards</TabsTrigger>
          <TabsTrigger value="adapt" disabled={!phases.flashcards_generated} className="flex-1 text-xs sm:text-sm">4. Adapt</TabsTrigger>
          <TabsTrigger value="export" disabled={!phases.flashcards_generated} className="flex-1 text-xs sm:text-sm">5. Export</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-6">
          {sessionId ? (
            <Card>
              <CardHeader><CardTitle className="text-base font-medium">Syllabus extracted</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">A syllabus PDF has already been processed for this session.</p>
                
                <div className="space-y-2 border-t border-border pt-4 mt-2">
                  <Label>Update session name</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="e.g. Midterms" 
                      id={`session-name-${sessionId}`}
                      defaultValue="" 
                    />
                    <Button 
                      variant="outline" 
                      disabled={renaming}
                      onClick={async () => {
                        const el = document.getElementById(`session-name-${sessionId}`) as HTMLInputElement;
                        if (!el || !el.value) return toast.error("Enter a name first");
                        setRenaming(true);
                        try {
                          await api(`/api/sessions/${sessionId}/name`, {
                            method: "PUT",
                            body: { session_name: el.value }
                          });
                          toast.success("Session renamed successfully!");
                          qc.invalidateQueries({ queryKey: ["dashboard"] });
                        } catch (e: any) {
                          toast.error(e.message);
                        } finally {
                          setRenaming(false);
                        }
                      }}
                    >
                      {renaming ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>

                <Button onClick={() => setTab("plan")} className="w-full mt-4">Continue to Plan</Button>
              </CardContent>
            </Card>
          ) : (
            <UploadSyllabus
              onCreated={(sid) => {
                setSessionId(sid);
                qc.invalidateQueries({ queryKey: ["dashboard"] });
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="plan" className="mt-6">
          {sessionId && <PlanPanel sessionId={sessionId} onDone={() => setTab("cards")} />}
        </TabsContent>

        <TabsContent value="cards" className="mt-6">
          {sessionId && <FlashcardsPanel sessionId={sessionId} onDone={() => setTab("adapt")} />}
        </TabsContent>

        <TabsContent value="adapt" className="mt-6">
          {sessionId && <AdaptPanel sessionId={sessionId} onDone={() => setTab("export")} />}
        </TabsContent>

        <TabsContent value="export" className="mt-6">
          {sessionId && (
            <ExportPanel
              sessionId={sessionId}
              onOpenSession={() => navigate({ to: "/app/sessions/$sessionId", params: { sessionId } })}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ───── Upload ───── */
function UploadSyllabus({ onCreated }: { onCreated: (sid: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { refresh, user } = useAuth();
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);

  const submit = async () => {
    if (!file) return toast.error("Choose a PDF first");
    const fd = new FormData();
    fd.append("file", file);
    setLoading(true);
    try {
      const url = name ? `/api/syllabus/upload?session_name=${encodeURIComponent(name)}` : "/api/syllabus/upload";
      const r = await api<any>(url, { method: "POST", body: fd, isForm: true });
      toast.success(`Extracted ${r.total_topics} topics`);
      onCreated(r.session_id);
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base font-medium">Upload your syllabus PDF</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Session name (optional)</Label>
          <Input placeholder="e.g. Spring midterm" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>PDF file</Label>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/40 p-8 text-sm text-muted-foreground transition hover:bg-muted">
            <Upload className="h-4 w-4" />
            <span>{file ? file.name : "Click to choose a PDF"}</span>
            <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <Button 
          onClick={() => (user?.credits === 0 ? setIsBuyModalOpen(true) : submit())} 
          disabled={(user?.credits !== 0 && !file) || loading} 
          className="w-full"
          variant={user?.credits === 0 ? "secondary" : "default"}
        >
          {user?.credits === 0 ? "Credits finished (Buy more)" : loading ? "Extracting topics…" : "Upload & extract (Costs 1 Credit)"}
        </Button>
      </CardContent>
      <BuyCreditsModal 
        isOpen={isBuyModalOpen} 
        onClose={() => setIsBuyModalOpen(false)} 
        onSuccess={() => refresh()} 
        currentCredits={user?.credits || 0} 
      />
    </Card>
  );
}

/* ───── Plan ───── */
function PlanPanel({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const [examDate, setExamDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [hours, setHours] = useState(2);
  const [weak, setWeak] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const { data: topicsData } = useQuery({
    queryKey: ["topics", sessionId],
    queryFn: () => api<{ topics: Topic[] }>(`/api/syllabus/${sessionId}/topics`),
  });
  const { data: sessionData } = useQuery<any>({
    queryKey: ["session", sessionId],
    queryFn: () => api<any>(`/api/session/${sessionId}`).catch(() => null),
  });
  const { data: planData, refetch, isLoading: isPlanLoading } = useQuery<{ plan: DayPlan[] } | null>({
    queryKey: ["plan", sessionId],
    queryFn: () => api<{ plan: DayPlan[] }>(`/api/plan/${sessionId}`).catch(() => null),
  });

  const generate = async () => {
    if (!examDate) return toast.error("Pick an exam date");

    const minD = new Date();
    minD.setDate(minD.getDate() + 2);
    const y = minD.getFullYear();
    const m = String(minD.getMonth() + 1).padStart(2, '0');
    const d = String(minD.getDate()).padStart(2, '0');
    const minStr = `${y}-${m}-${d}`;
    if (examDate < minStr) {
      setExamDate(minStr);
      return toast.error("Exam date must be at least 2 days in the future.");
    }

    setLoading(true);
    try {
      await api("/api/plan/generate", {
        method: "POST",
        body: {
          session_id: sessionId,
          exam_date: examDate,
          daily_hours: hours,
          weak_subjects: weak ? weak.split(",").map((s) => s.trim()).filter(Boolean) : [],
        },
      });
      toast.success("Study plan generated");
      await refetch();
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base font-medium">Plan settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Exam date (Min 2 days ahead)</Label>
            <Input
              type="date"
              min={(() => {
                const minD = new Date();
                minD.setDate(minD.getDate() + 2);
                const y = minD.getFullYear();
                const m = String(minD.getMonth() + 1).padStart(2, '0');
                const d = String(minD.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
              })()}
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              onBlur={(e) => {
                const minD = new Date();
                minD.setDate(minD.getDate() + 2);
                const y = minD.getFullYear();
                const m = String(minD.getMonth() + 1).padStart(2, '0');
                const d = String(minD.getDate()).padStart(2, '0');
                const minStr = `${y}-${m}-${d}`;
                if (e.target.value < minStr) {
                  setExamDate(minStr);
                  toast.error("Exam date must be at least 2 days in the future.");
                }
              }}
            />
          </div>
          <div className="space-y-2"><Label>Daily study hours</Label><Input type="number" min={1} max={16} value={hours} onChange={(e) => setHours(Number(e.target.value))} /></div>
          <div className="space-y-2"><Label>Weak subjects (comma-separated)</Label><Input value={weak} onChange={(e) => setWeak(e.target.value)} placeholder="e.g. Calculus, OS" /></div>
          <Button onClick={generate} disabled={loading} className="w-full">{loading ? "Planning…" : planData?.plan ? "Regenerate plan" : "Generate plan"}</Button>

          {planData?.plan && (
            <Button onClick={onDone} variant="secondary" className="w-full mt-2">Continue to flashcards</Button>
          )}

          <div className="border-t border-border pt-4 mt-2 text-xs text-muted-foreground">
            {topicsData?.topics.length ?? 0} topics extracted
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base font-medium">Schedule</CardTitle></CardHeader>
        <CardContent>
          {loading || isPlanLoading ? (
            <div className="py-12">
              <CoffeeLoading text="Brewing your perfect study schedule..." />
            </div>
          ) : !planData?.plan ? (
            <p className="text-sm text-muted-foreground">No plan yet. Set your exam date and generate one.</p>
          ) : (
            <ol className="space-y-2 max-h-[28rem] overflow-auto pr-2">
              {planData.plan.map((d) => (
                <li key={d.day} className="rounded-md border border-border bg-card/60 p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Day {d.day} · {d.date}</span>
                    <span>{d.estimated_hours}h{d.is_revision && " · revision"}</span>
                  </div>
                  <div className="mt-1 text-sm text-foreground">{d.topics.join(" · ")}</div>
                </li>
              ))}
              {planData.plan.length > 0 && (
                <li className="rounded-md border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center justify-between text-xs text-primary font-medium">
                    <span>Exam Day · {
                      sessionData?.exam_date || (() => {
                        const lastDay = planData.plan[planData.plan.length - 1];
                        const d = new Date(lastDay.date);
                        d.setDate(d.getDate() + 1);
                        return d.toISOString().split('T')[0];
                      })()
                    }</span>
                    <span>Good luck!</span>
                  </div>
                </li>
              )}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ───── Flashcards ───── */
function FlashcardsPanel({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const [cardsPerTopic, setCardsPerTopic] = useState(3);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`feedback_saved_${sessionId}`) === "true";
    }
    return false;
  });

  useEffect(() => {
    setFeedbackSaved(localStorage.getItem(`feedback_saved_${sessionId}`) === "true");
  }, [sessionId]);

  const { data, refetch, isLoading: isCardsLoading } = useQuery<{ cards: Flashcard[] } | null>({
    queryKey: ["cards", sessionId],
    queryFn: () => api<{ cards: Flashcard[] }>(`/api/flashcards/${sessionId}`).catch(() => null),
  });

  const { data: existingFeedback } = useQuery<any>({
    queryKey: ["feedback", sessionId],
    queryFn: () => api<any>(`/api/feedback/${sessionId}`).catch(() => null),
  });

  useEffect(() => {
    if (existingFeedback?.by_topic) {
      const fbMap: Record<string, Feedback> = {};
      Object.values(existingFeedback.by_topic).forEach((tData: any) => {
        tData.cards.forEach((c: any) => {
          fbMap[c.question] = c.feedback;
        });
      });
      setFeedback((prev) => {
        if (Object.keys(prev).length === 0) return fbMap;
        return prev;
      });
    }
  }, [existingFeedback]);

  const generate = async () => {
    let count = Math.max(3, Math.min(15, Math.floor(cardsPerTopic || 7)));
    setCardsPerTopic(count);
    setLoading(true);
    try {
      await api("/api/flashcards/generate", { method: "POST", body: { session_id: sessionId, cards_per_topic: count } });
      toast.success("Flashcards ready");
      setFeedback({});
      setFeedbackSaved(false);
      localStorage.removeItem(`feedback_saved_${sessionId}`);
      await refetch();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const submitFeedback = async () => {
    if (!data?.cards) return;
    const items = data.cards
      .map((c) => ({ c, fb: feedback[c.question] }))
      .filter((x) => x.fb)
      .map(({ c, fb }) => ({ topic: c.topic, question: c.question, answer: c.answer, difficulty: c.difficulty, feedback: fb }));
    if (items.length === 0) return toast.error("Rate at least one card");
    setSubmitting(true);
    try {
      await api("/api/flashcards/feedback", { method: "POST", body: { session_id: sessionId, cards: items } });
      toast.success(`Saved ${items.length} ratings`);
      setFeedbackSaved(true);
      localStorage.setItem(`feedback_saved_${sessionId}`, "true");
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <CardTitle className="text-base font-medium">Flashcards (min 3)</CardTitle>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Cards per topic</Label>
              <Input
                type="number"
                min={3}
                max={15}
                value={cardsPerTopic}
                onChange={(e) => setCardsPerTopic(Number(e.target.value))}
                onBlur={(e) => {
                  const val = Number(e.target.value);
                  if (val < 3) setCardsPerTopic(3);
                  if (val > 15) setCardsPerTopic(15);
                }}
                className="w-24"
              />
            </div>
            <Button onClick={generate} disabled={loading}>{loading ? "Brewing…" : data?.cards ? "Regenerate" : "Generate"}</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || isCardsLoading ? (
          <div className="py-12">
            <CoffeeLoading text="Brewing your flashcards..." />
          </div>
        ) : !data?.cards ? (
          <p className="text-sm text-muted-foreground">No flashcards yet.</p>
        ) : feedbackSaved ? (
          <div className="flex flex-col items-center justify-center space-y-4 rounded-md border border-dashed border-border py-12 text-center relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setFeedbackSaved(false);
                localStorage.removeItem(`feedback_saved_${sessionId}`);
              }}
            >
              <Pencil className="h-3 w-3 mr-1" /> Edit feedback
            </Button>
            <p className="text-sm text-muted-foreground">You have already saved feedback for these flashcards.<br />Click 'Regenerate' at the top to brew a new set.</p>
            <Button onClick={onDone} variant="outline">
              Continue to Adapt Plan
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.cards.map((c, i) => {
                const key = c.question;
                const fb = feedback[key];
                const open = revealed[key];
                return (
                  <div key={i} className="rounded-md border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="text-[10px]">{c.topic}</Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">{c.difficulty}</Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium text-foreground">{c.question}</p>
                    {open ? (
                      <p className="mt-2 text-sm text-muted-foreground">{c.answer}</p>
                    ) : (
                      <button
                        className="mt-2 text-xs text-primary underline-offset-4 hover:underline"
                        onClick={() => setRevealed((r) => ({ ...r, [key]: true }))}
                      >
                        Reveal answer
                      </button>
                    )}
                    <div className="mt-3 flex gap-2">
                      {(["too_easy", "too_hard", "skip"] as Feedback[]).map((f) => {
                        const active = fb === f;
                        const Icon = f === "too_easy" ? Check : f === "too_hard" ? X : SkipForward;
                        return (
                          <button
                            key={f}
                            onClick={() => setFeedback((cur) => ({ ...cur, [key]: f }))}
                            className={`flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs transition ${active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted"
                              }`}
                          >
                            <Icon className="h-3 w-3" />
                            {f === "too_easy" ? "Easy" : f === "too_hard" ? "Hard" : "Skip"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <Button
              onClick={submitFeedback}
              disabled={submitting || Object.keys(feedback).length === 0}
              className="w-full"
            >
              {submitting ? "Saving…" : Object.keys(feedback).length === 0 ? "Rate at least one card to continue" : "Save feedback & continue"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ───── Adapt ───── */
function AdaptPanel({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const qc = useQueryClient();

  const { data: sessionData, isLoading: isSessionLoading } = useQuery<any>({
    queryKey: ["session", sessionId],
    queryFn: () => api<any>(`/api/session/${sessionId}`).catch(() => null),
  });

  const { data: planData, isLoading: isPlanLoading } = useQuery<any>({
    queryKey: ["plan", sessionId],
    queryFn: () => api<any>(`/api/plan/${sessionId}`).catch(() => null),
  });

  const adapt = async () => {
    setLoading(true);
    try {
      const r = await api<any>("/api/plan/adapt", { method: "POST", body: { session_id: sessionId } });
      setResult(r);
      toast.success(`Plan v${r.plan_version} generated`);
      qc.invalidateQueries({ queryKey: ["plan", sessionId] });
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const isAdapted = result || (sessionData?.plan_version > 1);
  const displayPlan = result?.plan || planData?.plan;
  const version = result?.plan_version || sessionData?.plan_version;
  const summary = result?.changes_summary;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2">
          Adapt plan to your feedback
          <span className="text-sm font-normal text-muted-foreground">(optional)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isSessionLoading || isPlanLoading ? (
          <div className="py-12">
            <CoffeeLoading text="Loading your adapted plan..." />
          </div>
        ) : !isAdapted ? (
          <>
            <p className="text-sm text-muted-foreground">
              The agent reads all your flashcard feedback and rewrites your plan — more days for hard topics, compress easy ones, dedicated re-study days for skipped topics.
            </p>
            <div className="flex gap-3 mt-4">
              <Button onClick={adapt} disabled={loading} className="w-full">
                {loading ? "Rewriting plan…" : "Adapt plan"}
              </Button>
              <Button variant="secondary" onClick={onDone} disabled={loading} className="w-full">
                Skip to export
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="rounded-md border border-border bg-card/60 p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <p className="text-sm text-foreground font-medium">Your plan has been adapted.</p>
              </div>
              {summary && <p className="mb-4 text-sm text-muted-foreground">{summary}</p>}
              <div className="flex justify-center gap-3 mt-4">
                <Button variant="outline" onClick={adapt} disabled={loading}>
                  {loading ? "Rewriting plan…" : "Re-adapt plan"}
                </Button>
                <Button onClick={onDone}>Continue to export</Button>
              </div>
            </div>

            {displayPlan && (
              <div>
                <h3 className="text-sm font-medium mb-3">Adapted Schedule</h3>
                <ol className="space-y-2 max-h-[28rem] overflow-auto pr-2">
                  {displayPlan.map((d: any) => (
                    <li key={d.day} className="rounded-md border border-border bg-card/60 p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Day {d.day} · {d.date}</span>
                        <span>{d.estimated_hours}h{d.is_revision && " · revision"}</span>
                      </div>
                      <div className="mt-1 text-sm text-foreground">{d.topics.join(" · ")}</div>
                    </li>
                  ))}
                  {displayPlan.length > 0 && (
                    <li className="rounded-md border border-primary/30 bg-primary/5 p-3">
                      <div className="flex items-center justify-between text-xs text-primary font-medium">
                        <span>Exam Day · {
                          sessionData?.exam_date || (() => {
                            const lastDay = displayPlan[displayPlan.length - 1];
                            const d = new Date(lastDay.date);
                            d.setDate(d.getDate() + 1);
                            return d.toISOString().split('T')[0];
                          })()
                        }</span>
                        <span>Good luck!</span>
                      </div>
                    </li>
                  )}
                </ol>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ───── Export ───── */
function ExportPanel({ sessionId, onOpenSession }: { sessionId: string; onOpenSession: () => void }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  
  const download = async (kind: "anki" | "html" | "zip") => {
    setDownloading(kind);
    try {
      const res = await fetch(`${API_BASE}/api/export/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `graspai-${sessionId}.${kind === "anki" ? "apkg" : kind === "zip" ? "zip" : "html"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e.message); } finally { setDownloading(null); }
  };

  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
      {(["anki", "html", "zip"] as const).map((k) => (
        <Card key={k}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <span className="capitalize">{k === "html" ? "Printable Guide" : k} export</span>
              {k === "html" && <Badge className="px-1.5 py-0 text-[10px] tracking-wide text-primary-foreground">Recommended</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => download(k)} disabled={!!downloading} variant="secondary" className="w-full">
              {downloading === k ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
                  Generating…
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Download .{k === "anki" ? "apkg" : k}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ))}
      <Card className="md:col-span-3">
        <CardContent className="flex items-center justify-between py-4">
          <span className="text-sm text-muted-foreground">See deep analytics for this session</span>
          <Button onClick={onOpenSession}>Open session</Button>
        </CardContent>
      </Card>
    </div>
  );
}
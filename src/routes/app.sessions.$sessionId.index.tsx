import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

export const Route = createFileRoute("/app/sessions/$sessionId/")({
  head: () => ({ meta: [{ title: "Session — GraspAI" }] }),
  component: SessionPage,
});

function SessionPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["session-dash", sessionId],
    queryFn: () => api<any>(`/api/dashboard/session/${sessionId}`),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading session…</div>;
  if (error) return <div className="p-8 text-destructive">Could not load session.</div>;
  if (!data) return null;

  const onDelete = async () => {
    if (!confirm("Delete this session permanently?")) return;
    try {
      await api(`/api/session/${sessionId}`, { method: "DELETE" });
      toast.success("Session deleted");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      navigate({ to: "/app/dashboard" });
    } catch (e: any) { toast.error(e.message); }
  };

  const srs = data.srs_distribution || { easy: 0, medium: 0, hard: 0 };
  const fb = data.feedback_distribution || { too_easy: 0, too_hard: 0, skip: 0 };

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">{data.session_name || `Session ${sessionId.slice(-6)}`}</h1>
          {data.exam_date && (
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Exam {data.exam_date}{typeof data.days_remaining === "number" && ` · ${data.days_remaining} days remaining`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="sm:size-default" onClick={() => navigate({ to: '/app/sessions/$sessionId/past-papers', params: { sessionId } })}>
            Past Papers
          </Button>
          <Button variant="outline" size="sm" className="sm:size-default" onClick={onDelete}>Delete session</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">SRS distribution</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(srs).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="capitalize text-muted-foreground">{k}</span>
                <span className="font-medium">{v as number}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Feedback breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(fb).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="capitalize text-muted-foreground">{k.replace("_", " ")}</span>
                <span className="font-medium">{v as number}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Plan</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span>v{data.plan_version || 1}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Days</span><span>{data.plan_days ?? 0}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base font-medium">Topics</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data.topics || []).map((t: any) => (
              <div key={t.name} className="rounded-md border border-border bg-card/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-foreground">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.subject} · {t.cards} cards · {t.feedback_count} rated</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{t.difficulty}</Badge>
                    {t.mastered && <Badge>Mastered</Badge>}
                  </div>
                </div>
                {typeof t.confidence === "number" && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Confidence</span><span className="text-foreground">{t.confidence}%</span>
                    </div>
                    <Progress value={t.confidence} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
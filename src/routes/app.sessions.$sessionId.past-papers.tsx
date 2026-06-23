import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, FileQuestion, RefreshCw, ChevronDown, ChevronUp, Trash2, Coffee } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { BuyCreditsModal } from "@/components/BuyCreditsModal";

export const Route = createFileRoute("/app/sessions/$sessionId/past-papers")({
  head: () => ({ meta: [{ title: "AI Past Papers — GraspAI" }] }),
  component: PastPapersPage,
});

interface GeneratedQuestion {
  exam_label: string;
  topic: string;
  question: string;
  answer: string;
}

function PastPapersPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [examType, setExamType] = useState("NEET");
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const { refresh, user } = useAuth();
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);

  const { data: pastPapers, isLoading: isLoadingPapers } = useQuery({
    queryKey: ["past-papers", sessionId],
    queryFn: () => api<{ questions: GeneratedQuestion[] }>(`/api/sessions/${sessionId}/past-papers`),
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await api(`/api/sessions/${sessionId}/generate-past-papers`, {
        method: "POST",
        body: { exam_type: examType }
      });
      toast.success("Past papers generated successfully!");
      await qc.invalidateQueries({ queryKey: ["past-papers", sessionId] });
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to generate past papers.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to delete these past papers? You will be able to select a new exam and generate again.")) return;
    try {
      await api(`/api/sessions/${sessionId}/past-papers`, {
        method: "DELETE"
      });
      toast.success("Past papers reset successfully.");
      await qc.invalidateQueries({ queryKey: ["past-papers", sessionId] });
    } catch (e: any) {
      toast.error(e.message || "Failed to reset past papers.");
    }
  };

  const hasQuestions = pastPapers && pastPapers.questions.length > 0;

  return (
    <div className="w-full space-y-8 px-6 py-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/app/sessions/$sessionId" params={{ sessionId }}><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Past Papers</h1>
          <p className="text-muted-foreground text-sm">Generate realistic past paper questions for your syllabus.</p>
        </div>
      </div>

      {isLoadingPapers ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="relative">
            <Coffee className="h-16 w-16 text-primary/80 animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold">Brewing your past papers...</h2>
          <p className="text-muted-foreground text-sm">Please wait while we craft your mock exam questions.</p>
        </div>
      ) : !hasQuestions ? (
        <Card>
          <CardHeader>
            <CardTitle>Generate Questions</CardTitle>
            <p className="text-sm text-muted-foreground">Select your target exam to generate authentic mock questions tailored to your syllabus.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 w-fit">
              <label className="text-sm font-medium">Select Target Exam</label>
              <Select value={examType} onValueChange={setExamType} disabled={isGenerating || isLoadingPapers}>
                <SelectTrigger className="w-[140px] bg-background">
                  <SelectValue placeholder="Select Exam" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEET">NEET</SelectItem>
                  <SelectItem value="JEE Main">JEE Main</SelectItem>
                  <SelectItem value="JEE Advanced">JEE Advanced</SelectItem>
                  <SelectItem value="GATE">GATE</SelectItem>
                  <SelectItem value="CAT">CAT</SelectItem>
                  <SelectItem value="UPSC">UPSC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Button 
                onClick={() => (user?.credits === 0 ? setIsBuyModalOpen(true) : handleGenerate())} 
                disabled={(user?.credits !== 0 && (isGenerating || isLoadingPapers))}
                variant={user?.credits === 0 ? "secondary" : "default"}
              >
                {user?.credits === 0 ? "Credits finished (Buy more)" : isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : "Generate Questions (Costs 1 Credit)"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Generated Questions</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                if (user?.credits === 0) {
                  setIsBuyModalOpen(true);
                  return;
                }
                if (confirm("This will overwrite your existing questions and cost 1 credit. Continue?")) {
                  handleGenerate();
                }
              }} disabled={isGenerating}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                {user?.credits === 0 ? "Credits finished" : "Regenerate"}
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={handleReset} disabled={isGenerating} title="Reset Past Papers">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {pastPapers.questions.map((q, idx) => (
              <Card key={idx} className="overflow-hidden">
                <CardHeader className="bg-muted/30 pb-4">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary border-transparent">
                          {q.exam_label}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">{q.topic}</span>
                      </div>
                      <p className="font-medium text-sm leading-relaxed mt-2">{q.question}</p>
                    </div>
                  </div>
                </CardHeader>
                <div
                  className="bg-card px-6 py-3 border-t cursor-pointer hover:bg-muted/10 transition-colors flex justify-between items-center text-sm font-medium text-muted-foreground"
                  onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
                >
                  View Answer
                  {expandedIndex === idx ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
                {expandedIndex === idx && (
                  <CardContent className="pt-4 bg-muted/10 border-t">
                    <div className="text-sm whitespace-pre-wrap">{q.answer}</div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
      <BuyCreditsModal 
        isOpen={isBuyModalOpen} 
        onClose={() => setIsBuyModalOpen(false)} 
        onSuccess={() => refresh()} 
        currentCredits={user?.credits || 0} 
      />
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { ArrowLeft, Check, X, SkipForward, Volume2, VolumeX, Coffee } from "lucide-react";

export const Route = createFileRoute("/app/sessions/$sessionId/review")({
  head: () => ({ meta: [{ title: "Review — GraspAI" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackQueue, setFeedbackQueue] = useState<any[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["review-queue", sessionId],
    queryFn: () => api<any>(`/api/flashcards/review-queue/${sessionId}`),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground flex justify-center items-center h-[50vh]">Loading due cards…</div>;
  if (error || !data) return <div className="p-8 text-destructive flex justify-center items-center h-[50vh]">Could not load review queue.</div>;

  const dueCards = data.cards || [];

  if (currentIndex >= dueCards.length) {
    return (
      <div className="w-full space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-10 h-[calc(100vh-8rem)] flex flex-col">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/app/sessions/$sessionId', params: { sessionId } })}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">Review Mode</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">Focus and rate your recall honestly.</p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="relative">
            <Coffee className="h-16 w-16 text-primary/80" />
          </div>
          <h2 className="text-xl font-semibold">You're all caught up!</h2>
          <p className="text-muted-foreground text-sm max-w-sm">You have reviewed all due cards for this session. Take a break and grab a coffee!</p>
        </div>
      </div>
    );
  }

  const currentCard = dueCards[currentIndex];

  const handleRate = (rating: "too_easy" | "too_hard" | "skip") => {
    window.speechSynthesis.cancel();
    setPlaying(false);
    
    // Save to backend immediately in the background
    api("/api/flashcards/feedback", { 
      method: "POST", 
      body: { 
        session_id: sessionId, 
        cards: [{
          topic: currentCard.topic,
          question: currentCard.question,
          answer: currentCard.answer,
          difficulty: currentCard.difficulty,
          feedback: rating
        }]
      } 
    }).catch(e => console.error("Failed to save rating", e));

    setRevealed(false);
    setCurrentIndex(i => i + 1);
  };

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-10 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/app/sessions/$sessionId', params: { sessionId } })}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">Review Mode</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Focus and rate your recall honestly.</p>
          </div>
        </div>
        <div className="text-xs sm:text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Card {currentIndex + 1} of {dueCards.length}
        </div>
      </div>

      <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500 w-full min-h-0 mt-2 sm:mt-6">
        <Card className="min-h-[250px] max-h-full flex flex-col shadow-lg border-border bg-card overflow-hidden">
          <CardContent className="flex-1 p-6 sm:p-8 flex flex-col relative overflow-y-auto">
            
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex gap-2 items-center">
                <Badge variant="secondary" className="text-[10px] sm:text-xs">{currentCard.topic}</Badge>
                <Badge variant="outline" className="text-[10px] sm:text-xs capitalize">{currentCard.difficulty}</Badge>
              </div>
              <button onClick={() => {
                window.speechSynthesis.cancel();
                if (playing) { setPlaying(false); return; }
                const ut = new SpeechSynthesisUtterance(revealed ? currentCard.answer : currentCard.question);
                ut.onend = () => setPlaying(false);
                window.speechSynthesis.speak(ut);
                setPlaying(true);
              }} className="text-muted-foreground hover:text-foreground">
                {playing ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>

            <p className="mt-2 text-sm sm:text-base font-medium text-foreground">
              {currentCard.question}
            </p>

            {revealed ? (
              <p className="mt-4 text-sm sm:text-base text-muted-foreground">
                {currentCard.answer}
              </p>
            ) : (
              <div className="mt-auto pt-6">
                <Button className="w-full h-10 text-sm" onClick={() => setRevealed(true)}>
                  Reveal answer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {revealed && (
          <div className="flex gap-2 mt-4 shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Button variant="outline" className="flex-1 h-12 flex items-center justify-center gap-2 border-border text-muted-foreground hover:bg-muted transition" onClick={() => handleRate("too_hard")}>
              <X className="h-4 w-4 shrink-0" />
              <span>Hard</span>
            </Button>
            <Button variant="outline" className="flex-1 h-12 flex items-center justify-center gap-2 border-border text-muted-foreground hover:bg-muted transition" onClick={() => handleRate("skip")}>
              <SkipForward className="h-4 w-4 shrink-0" />
              <span>Skip</span>
            </Button>
            <Button variant="outline" className="flex-1 h-12 flex items-center justify-center gap-2 border-border text-muted-foreground hover:bg-muted transition" onClick={() => handleRate("too_easy")}>
              <Check className="h-4 w-4 shrink-0" />
              <span>Easy</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

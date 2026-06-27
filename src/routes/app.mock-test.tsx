import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";

import { Mic, MicOff, CheckCircle2, XCircle, BrainCircuit, Volume2, RotateCcw, Headset, Coffee } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/mock-test")({
  head: () => ({ meta: [{ title: "Mock Test — GraspAI" }] }),
  component: MockTestPage,
});

function MockTestPage() {
  const [sessionId, setSessionId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("grasp_active_session") : null
  );

  const { data: dash } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<any>("/api/dashboard"),
  });

  useEffect(() => {
    if (sessionId) localStorage.setItem("grasp_active_session", sessionId);
  }, [sessionId]);

  const activeSession = dash?.sessions?.find((s: any) => s.session_id === sessionId);

  const [mockState, setMockState] = useState<any>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    api<{ state: any }>("/api/mock-test/state").then(res => {
      if (res.state) {
        setMockState(res.state);
      }
      setIsLoaded(true);
    }).catch(err => {
      console.error(err);
      setIsLoaded(true);
    });
  }, []);

  const saveMockState = (newState: any) => {
    setMockState(newState);
    api("/api/mock-test/state", { method: "POST", body: { state: newState } }).catch(console.error);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-5rem)] space-y-4 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-10 w-full">
      <div className="shrink-0 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">Mock Test</h1>
          <p className="hidden mt-1 text-xs text-muted-foreground sm:block sm:text-sm">
            Evaluate your readiness with Viva mode and automated Multiple-Choice Questions.
          </p>
        </div>
        {dash?.sessions?.length > 0 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Active session:</Label>
            <select
              className="rounded-md border border-input bg-background px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm"
              value={sessionId ?? ""}
              onChange={(e) => setSessionId(e.target.value || null)}
            >
              <option value="">Select a session...</option>
              {dash.sessions.map((s: any) => (
                <option key={s.session_id} value={s.session_id}>{s.session_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!sessionId ? (
        <Card className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Coffee className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
          <h3 className="text-lg font-medium">Select a blend to start</h3>
          <p className="text-sm text-muted-foreground mt-1">Choose an active study session from the menu to brew up a mock test.</p>
        </Card>
      ) : !isLoaded ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-4 min-h-0">
          <div className="relative">
            <Coffee className="h-16 w-16 text-primary/80 animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold">Brewing your tests...</h2>
          <p className="text-muted-foreground text-sm">Please wait while we prepare your mock test environment.</p>
        </div>
      ) : (
        <Tabs defaultValue="viva" className="flex flex-1 flex-col min-h-0">
          <TabsList className="shrink-0 flex w-full overflow-x-auto">
            <TabsTrigger value="viva" className="flex-1 text-xs sm:text-sm">Viva Mode</TabsTrigger>
            <TabsTrigger value="mcq" className="flex-1 text-xs sm:text-sm">MCQ Test</TabsTrigger>
          </TabsList>

          <TabsContent value="viva" className="flex-1 flex flex-col min-h-0 mt-3 sm:mt-6 pb-4">
            <VivaPanel
              sessionId={sessionId}
              vivaState={mockState[sessionId]?.viva || {}}
              updateVivaState={(updates: any) => {
                const currentSessionState = mockState[sessionId] || {};
                saveMockState({ ...mockState, [sessionId]: { ...currentSessionState, viva: { ...currentSessionState.viva, ...updates } } });
              }}
            />
          </TabsContent>

          <TabsContent value="mcq" className="flex-1 flex flex-col min-h-0 mt-3 sm:mt-6 pb-4">
            <MCQPanel
              sessionId={sessionId}
              mcqState={mockState[sessionId]?.mcq || {}}
              updateMcqState={(updates: any) => {
                const currentSessionState = mockState[sessionId] || {};
                saveMockState({ ...mockState, [sessionId]: { ...currentSessionState, mcq: { ...currentSessionState.mcq, ...updates } } });
              }}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

const speakText = (text: string) => {
  window.speechSynthesis.cancel();
  const ut = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(ut);
};

// --- VIVA PANEL ---
function VivaPanel({ sessionId, vivaState, updateVivaState }: { sessionId: string, vivaState: any, updateVivaState: (updates: any) => void }) {
  const { refresh } = useAuth();

  const question = vivaState.question || null;
  const transcript = vivaState.transcript || "";
  const feedback = vivaState.feedback || null;

  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startViva = async () => {
    setLoading(true);
    updateVivaState({ question: null, transcript: "", feedback: null });
    try {
      const res = await api<any>("/api/mock-test/viva/generate", {
        method: "POST",
        body: { session_id: sessionId }
      });
      updateVivaState({ question: res.question });
      toast.success("Viva Exam started successfully!");
      speakText(res.question);
    } catch (e: any) {
      toast.error(e.message || "Failed to start Viva.");
    } finally {
      setLoading(false);
    }
  };

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in your browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setListening(true);
      updateVivaState({ transcript: "" }); // reset previous answer
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        updateVivaState({ transcript: transcript + " " + finalTranscript });
      }
    };

    recognition.onerror = (e: any) => {
      console.error(e);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const submitAnswer = async () => {
    if (!transcript.trim() || !question) return;
    setLoading(true);
    try {
      const res = await api<any>("/api/mock-test/viva/evaluate", {
        method: "POST",
        body: { session_id: sessionId, question, answer: transcript }
      });
      updateVivaState({
        feedback: { score: res.score, text: res.feedback },
        question: res.next_question,
        transcript: ""
      });
      speakText(`You scored ${res.score} out of 10. ${res.feedback}. Here is your next question. ${res.next_question}`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Evaluation failed.");
    } finally {
      setLoading(false);
    }
  };

  const readQuestion = () => {
    if (question) speakText(question);
  }

  if (loading) {
    return (
      <Card className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-4 min-h-0">
        <div className="relative">
          <Coffee className="h-16 w-16 text-primary/80 animate-pulse" />
        </div>
        <h2 className="text-xl font-semibold">Examiner is thinking...</h2>
        <p className="text-muted-foreground text-sm">Please wait while the AI generates your next question.</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col flex-1">
      {question && (
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle className="text-base">Voice-Based Examiner</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => { window.speechSynthesis.cancel(); updateVivaState({ question: null, transcript: "", feedback: null }); }} title="Restart Viva Exam" className="text-muted-foreground hover:bg-muted">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </CardHeader>
      )}
      <CardContent className="flex flex-col flex-1 items-center justify-center p-6 space-y-8 text-center overflow-auto pt-6">
        {!question ? (
          <div className="space-y-4">
            <div className="mx-auto mb-4 text-primary/60">
              <Headset className="h-12 w-12 mx-auto" />
            </div>
            <p className="text-muted-foreground">The AI examiner will ask you a question aloud. Use your microphone to answer.</p>
            <Button onClick={startViva}>Start Viva Exam (1 Credit)</Button>
          </div>
        ) : (
          <div className="w-full flex flex-col space-y-6">
            {feedback && (
              <div className="w-full bg-muted/50 border border-border p-4 rounded-md text-left">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-lg">Score: {feedback.score}/10</span>
                </div>
                <p className="text-sm text-muted-foreground">{feedback.text}</p>
              </div>
            )}

            <div className="w-full border-b border-border pb-4 flex items-start gap-4 justify-between">
              <h4 className="text-lg font-medium flex-1 text-left">{question}</h4>
              <Button variant="outline" size="icon" onClick={readQuestion} title="Read question aloud" className="shrink-0 mt-0.5">
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="w-full flex flex-col items-center gap-4">
              <button
                onClick={toggleListening}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${listening ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-primary hover:bg-primary/90'}`}
              >
                {listening ? <MicOff className="h-5 w-5 text-white" /> : <Mic className="h-5 w-5 text-primary-foreground" />}
              </button>
              <p className="text-xs text-muted-foreground">{listening ? "Listening... Click to stop" : "Click to speak your answer"}</p>
            </div>

            <div className="w-full min-h-[80px] bg-muted/30 border border-dashed border-border rounded-md p-4 text-left">
              <p className="text-sm text-muted-foreground">{transcript || "Your transcribed answer will appear here..."}</p>
            </div>

            <Button onClick={submitAnswer} disabled={!transcript.trim()} className="w-full sm:w-auto">Submit Answer (1 Credit)</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


// --- MCQ PANEL ---
function MCQPanel({ sessionId, mcqState, updateMcqState }: { sessionId: string, mcqState: any, updateMcqState: (updates: any) => void }) {
  const { refresh } = useAuth();

  const questions = mcqState.questions || null;
  const answers = mcqState.answers || {};
  const submitted = mcqState.submitted || false;
  const score = mcqState.score || 0;

  const [loading, setLoading] = useState(false);

  const generateMCQ = async () => {
    setLoading(true);
    updateMcqState({ questions: null, answers: {}, submitted: false, score: 0 });
    try {
      const res = await api<any>("/api/mock-test/mcq/generate", {
        method: "POST",
        body: { session_id: sessionId, num_questions: 10 }
      });
      updateMcqState({ questions: res.questions });
      toast.success("Mock Test generated successfully!");
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to generate MCQ test.");
    } finally {
      setLoading(false);
    }
  };

  const submitTest = () => {
    if (!questions) return;
    let correct = 0;
    questions.forEach((q: any, i: number) => {
      if (answers[i] === q.correct_answer) correct++;
    });
    updateMcqState({ score: correct, submitted: true });
    toast.success("Mock Test submitted successfully!");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const readQuestionAloud = (q: any, i: number) => {
    const text = `Question ${i + 1}: ${q.question}. ${q.options.map((opt: string, idx: number) => `Option ${String.fromCharCode(65 + idx)}: ${opt}`).join(". ")}`;
    speakText(text);
  };

  if (loading) {
    return (
      <Card className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-4 min-h-0">
        <div className="relative">
          <Coffee className="h-16 w-16 text-primary/80 animate-pulse" />
        </div>
        <h2 className="text-xl font-semibold">Crafting your test...</h2>
        <p className="text-muted-foreground text-sm">Please wait while we brew your multiple-choice questions.</p>
      </Card>
    );
  }

  if (!questions) {
    return (
      <Card className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="mx-auto mb-4 text-primary/60">
          <BrainCircuit className="h-12 w-12 mx-auto" />
        </div>
        <p className="text-muted-foreground">Generate a 10-question automated mock test to evaluate your readiness.</p>
        <Button onClick={generateMCQ}>Generate Mock Test (1 Credit)</Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col flex-1">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
        <CardTitle className="text-base">Voice-Based Examiner</CardTitle>
        <div className="flex items-center gap-4">
          {submitted && (
            <div className="font-bold text-lg text-primary">
              Score: {score} / {questions.length}
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={() => { window.speechSynthesis.cancel(); updateMcqState({ questions: null, answers: {}, submitted: false, score: 0 }); }} title="Restart MCQ Test" className="text-muted-foreground hover:bg-muted">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-4 sm:p-6 space-y-8">
        {questions.map((q: any, i: number) => (
          <div key={i} className="space-y-4">
            <div className="w-full flex items-start gap-4 justify-between">
              <h4 className="text-lg font-medium flex-1 text-left">
                {i + 1}. {q.question}
              </h4>
              <Button variant="outline" size="icon" onClick={() => readQuestionAloud(q, i)} title="Read question and options aloud" className="shrink-0 mt-0.5">
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-2 pl-4">
              {q.options.map((opt: string, optIdx: number) => {
                const isSelected = answers[i] === opt;
                const isCorrect = opt === q.correct_answer;

                let btnStyle = "border-border text-foreground hover:bg-muted";
                if (submitted) {
                  if (isCorrect) btnStyle = "border-green-500 bg-green-500/20 text-green-400 font-medium";
                  else if (isSelected && !isCorrect) btnStyle = "border-red-500 bg-red-500/20 text-red-400 font-medium";
                  else btnStyle = "border-border opacity-50 text-foreground";
                } else if (isSelected) {
                  btnStyle = "border-primary bg-primary/10 text-foreground font-medium";
                }

                return (
                  <button
                    key={optIdx}
                    disabled={submitted}
                    onClick={() => updateMcqState({ answers: { ...answers, [i]: opt } })}
                    className={`text-left px-4 py-3 rounded-md border text-sm transition-colors ${btnStyle}`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{opt}</span>
                      {submitted && isCorrect && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                      {submitted && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
            {submitted && (
              <div className="mt-2 pl-4 text-xs sm:text-sm text-muted-foreground bg-muted/30 p-3 rounded-md border border-dashed">
                <span className="font-semibold block mb-1">Explanation:</span>
                {q.explanation}
              </div>
            )}
          </div>
        ))}

        <div className="pt-6 border-t border-border flex justify-between">
          <Button variant="outline" onClick={generateMCQ}>Start New Test (1 Credit)</Button>
          {!submitted && (
            <Button onClick={submitTest} disabled={Object.keys(answers).length < questions.length}>
              Submit Test
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

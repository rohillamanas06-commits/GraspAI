import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TutorMindMap } from "@/components/TutorMindMap";
import { TutorYouTube } from "@/components/TutorYouTube";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Paperclip, Send, X, Bot, User, Trash2, Coffee, Mic, Copy, Check, Volume2, VolumeX, Image as ImageIcon, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/tutor")({
  head: () => ({ meta: [{ title: "AI Tutor — GraspAI" }] }),
  component: TutorPage,
});

interface Message {
  role: "user" | "assistant";
  content: string;
  files?: string[];
}

function TutorPage() {
  const { user, refresh } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [tutorState, setTutorState] = useState<any>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    api<{ state: any }>("/api/tutor/state").then(res => {
      if (res.state) {
        setTutorState(res.state);
        if (res.state.chat) setMessages(res.state.chat);
      }
      setIsLoaded(true);
    }).catch(err => {
      console.error(err);
      setIsLoaded(true);
    });
  }, []);

  const saveTutorState = (newState: any) => {
    setTutorState(newState);
    api("/api/tutor/state", { method: "POST", body: { state: newState } }).catch(console.error);
  };
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded) return;
    saveTutorState({ ...tutorState, chat: messages });
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoaded]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (files.length + selected.length > 5) return toast.error("Max 5 files allowed (Total 100MB)");

    const MAX_TOTAL_MB = 100;
    const totalSize = [...files, ...selected].reduce((acc, file) => acc + file.size, 0);
    if (totalSize > MAX_TOTAL_MB * 1024 * 1024) {
      toast.error(`Total file size exceeds the ${MAX_TOTAL_MB}MB limit.`);
      return;
    }

    if (selected.some(f => f.type.startsWith("image/"))) {
      toast.info("Image detected. Switching to Gemini.");
    }

    setFiles(prev => [...prev, ...selected]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev ? prev + " " + transcript : transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() && files.length === 0) return;

    const fileNames = files.map(f => f.name);
    const newMsg: Message = {
      role: "user",
      content: input,
      ...(fileNames.length > 0 && { files: fileNames })
    };
    const historyToPass = [...messages];

    setMessages(prev => [...prev, newMsg]);
    setInput("");
    setLoading(true);

    const fd = new FormData();
    fd.append("model_choice", "groq");
    fd.append("history", JSON.stringify(historyToPass));
    fd.append("message", input);
    files.forEach(f => fd.append("files", f));

    setFiles([]); // Clear files after attaching them

    try {
      const r = await api<{ response: string; fallback?: boolean }>("/api/tutor/chat", {
        method: "POST",
        body: fd,
        isForm: true
      });

      if (r.fallback) {
        toast.info("Gemini not available, switched to Groq");
      }

      setMessages(prev => [...prev, { role: "assistant", content: r.response }]);
    } catch (err: any) {
      toast.error(err.message || "Failed to get response");
    } finally {
      setLoading(false);
      refresh().catch(console.error);
    }
  };

  const clearChat = () => {
    if (confirm("Are you sure you want to clear the chat history?")) {
      setMessages([]);
      localStorage.removeItem("grasp_tutor_history");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-5rem)] space-y-4 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-10 w-full">
      <div className="shrink-0 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">AI Tutor</h1>
          <p className="hidden mt-1 text-xs text-muted-foreground sm:block sm:text-sm">
            Ask study questions, get help with specific topics, or upload materials for explanation.
          </p>
        </div>
      </div>

      {isLoaded ? (
        <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3 mb-4 shrink-0">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="mindmap">Mind Map</TabsTrigger>
            <TabsTrigger value="youtube">YouTube</TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="flex-1 m-0 flex flex-col min-h-0">
            <Card className="flex flex-col flex-1 min-h-0 overflow-hidden border-border bg-card mt-0">
              <CardContent className="flex flex-col flex-1 p-0 overflow-hidden relative">

                {/* Chat Feed */}
                <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4 flex flex-col">
                  {messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-60 min-h-0">
                      <Coffee className="h-12 w-12 mb-4" />
                      <p className="text-sm font-medium">Your Study Barista is ready!</p>
                      <p className="text-xs mt-1">Ask me anything, or upload a document/image for a fresh brew of knowledge.</p>
                    </div>
                  ) : (
                    messages.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        {msg.role === "assistant" && (
                          <div className="h-8 w-8 shrink-0 rounded-full bg-primary/20 text-primary flex items-center justify-center mt-1">
                            <Coffee className="h-4 w-4" />
                          </div>
                        )}
                        <div className={`max-w-[85%] sm:max-w-[75%] flex flex-col gap-1`}>
                          <div className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted/50 text-foreground border border-border rounded-tl-sm"
                            }`}>
                            {msg.files && msg.files.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {msg.files.map((f, idx) => {
                                  const isImage = f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg');
                                  const Icon = isImage ? ImageIcon : FileText;
                                  return (
                                    <div key={idx} className="flex items-center gap-1.5 bg-black/10 rounded-md px-2.5 py-1.5 text-xs font-medium border border-black/5 shadow-sm">
                                      <Icon className="h-3.5 w-3.5 opacity-70" />
                                      <span className="truncate max-w-[180px] text-current">{f}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {msg.content}
                          </div>
                          {msg.role === "assistant" && (
                            <div className="flex items-center gap-2 pl-2 text-muted-foreground">
                              <button onClick={() => {
                                navigator.clipboard.writeText(msg.content);
                                setCopiedIdx(i);
                                setTimeout(() => setCopiedIdx(null), 2000);
                              }} className="hover:text-foreground p-1 transition" title="Copy text">
                                {copiedIdx === i ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                              <button onClick={() => {
                                if (playingIdx === i) {
                                  window.speechSynthesis.cancel();
                                  setPlayingIdx(null);
                                } else {
                                  window.speechSynthesis.cancel();
                                  const ut = new SpeechSynthesisUtterance(msg.content);
                                  ut.onend = () => setPlayingIdx(null);
                                  window.speechSynthesis.speak(ut);
                                  setPlayingIdx(i);
                                }
                              }} className="hover:text-foreground p-1 transition" title="Read Aloud">
                                {playingIdx === i ? <VolumeX className="h-3.5 w-3.5 text-primary" /> : <Volume2 className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          )}
                        </div>
                        {msg.role === "user" && (
                          <div className="h-8 w-8 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center mt-1">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {loading && (
                    <div className="flex gap-3 justify-start">
                      <div className="h-8 w-8 shrink-0 rounded-full bg-primary/20 text-primary flex items-center justify-center mt-1">
                        <Coffee className="h-4 w-4 animate-pulse" />
                      </div>
                      <div className="bg-muted/50 text-muted-foreground border border-border rounded-2xl rounded-tl-sm px-4 py-3 text-sm flex items-center gap-1">
                        <span className="animate-bounce">●</span>
                        <span className="animate-bounce delay-100">●</span>
                        <span className="animate-bounce delay-200">●</span>
                      </div>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>

                {/* Input Area */}
                <div className="shrink-0 border-t border-border mx-4 sm:mx-6 mb-4 sm:mb-6 pt-2 flex flex-col gap-2">
                  {files.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-1 bg-muted/50 border border-border rounded-md px-2 py-1.5 text-[10px] sm:text-xs">
                          <span className="truncate max-w-[120px] text-muted-foreground">{f.name}</span>
                          <button onClick={() => removeFile(i)} type="button" className="text-muted-foreground hover:text-foreground">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <form onSubmit={sendMessage} className="flex items-center gap-2">
                    {messages.length > 0 && (
                      <Button type="button" variant="outline" onClick={clearChat} title="Clear chat" className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border-border bg-muted/30 transition">
                        <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      </Button>
                    )}
                    <label className="shrink-0 flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-md border border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition">
                      <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
                      <input type="file" multiple accept=".pdf,.txt,.doc,.docx,image/png,image/jpeg,image/jpg" className="hidden" onChange={handleFileChange} />
                    </label>

                    <Input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder="Ask your tutor something..."
                      className="flex-1 h-10 sm:h-12 bg-muted/20 border-border"
                      disabled={loading}
                    />

                    <Button type="button" variant="outline" onClick={startListening} disabled={loading || isListening} className={`h-10 w-10 sm:h-12 sm:w-12 shrink-0 p-0 text-muted-foreground hover:text-foreground border-border bg-muted/30 ${isListening ? "animate-pulse text-red-500" : ""}`}>
                      <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>

                    <Button type="submit" disabled={loading || (!input.trim() && files.length === 0)} className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 p-0">
                      <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  </form>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">
                    Each message costs 1 credit.
                  </div>
                </div>

              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="mindmap" className="flex-1 m-0 flex flex-col min-h-0">
            <TutorMindMap initialState={tutorState.mindmap} onSave={(mm) => saveTutorState({ ...tutorState, mindmap: mm })} />
          </TabsContent>
          <TabsContent value="youtube" className="flex-1 m-0 flex flex-col min-h-0">
            <TutorYouTube initialState={tutorState.youtube} onSave={(yt) => saveTutorState({ ...tutorState, youtube: yt })} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-4 min-h-0">
          <div className="relative">
            <Coffee className="h-16 w-16 text-primary/80 animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold">Brewing your AI Tutor...</h2>
          <p className="text-muted-foreground text-sm">Please wait while we prepare your personalized study environment.</p>
        </div>
      )}
    </div>
  );
}

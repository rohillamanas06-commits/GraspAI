import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useEffect, useState } from "react";
import { LogIn, LayoutDashboard, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GraspAI" },
      { name: "description", content: "Adaptive study plans and flashcards from your syllabus." },
      { property: "og:title", content: "GraspAI" },
      { property: "og:description", content: "Adaptive study plans and flashcards from your syllabus." },
    ],
  }),
  component: Index,
});

/* ------------------------------------------------------------------ */
/*  Feature data — used in the editorial sections below the video     */
/* ------------------------------------------------------------------ */
const pillars = [
  {
    num: "01",
    title: "Study Agent",
    lead: "Your syllabus, decoded.",
    body: "Upload any syllabus PDF and our AI instantly extracts every topic, subtopic and weightage. It then generates a day-by-day study plan calibrated to your exam date — revision days included.",
  },
  {
    num: "02",
    title: "AI Tutor",
    lead: "Ask anything, anytime.",
    body: "A conversational tutor that explains concepts at your level, generates mind-maps, finds relevant YouTube lectures, and remembers your entire chat history across sessions.",
  },
  {
    num: "03",
    title: "Smart Flashcards",
    lead: "Retention, optimized.",
    body: "Flashcards are auto-generated from your syllabus and scheduled with spaced repetition. Mark them easy, hard, or skip — the algorithm adapts in real time to keep you in the zone.",
  },
  {
    num: "04",
    title: "Past Papers",
    lead: "Practice under pressure.",
    body: "Generate full mock exams from your syllabus with configurable difficulty. Review AI-graded answers with detailed explanations and track improvement over time.",
  },
  {
    num: "05",
    title: "Voice Viva",
    lead: "Practice out loud.",
    body: "Simulate real-world oral exams with our AI examiner. Answer questions verbally and receive instant feedback on your tone, accuracy, and confidence.",
  },
  {
    num: "06",
    title: "Dynamic MCQ Tests",
    lead: "Test your knowledge.",
    body: "Generate multiple-choice quizzes directly from your syllabus. Track your progress, identify weak points, and master concepts through targeted testing.",
  },
  {
    num: "07",
    title: "Browser Extension",
    lead: "Capture knowledge anywhere.",
    body: "Highlight text on any website or online textbook and instantly turn it into GraspAI flashcards with a single click. Learning doesn't stop at your syllabus.",
  },
];

const stats = [
  { value: "4-in-1", label: "AI study toolkit" },
  { value: "< 30s", label: "Syllabus to study plan" },
  { value: "∞", label: "Adaptive flashcards" },
  { value: "24/7", label: "AI tutor on demand" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
function Index() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = 0.5;
    // fade-in the below-fold content after mount
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mocha flex min-h-screen w-full flex-col bg-background text-foreground">
      {/* ── Hero video — completely clean, no overlay text ──────── */}
      <main className="relative min-h-screen w-full overflow-hidden shrink-0">
        <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between bg-black/90 backdrop-blur-md px-4 py-3 sm:px-10 sm:py-4 border-b border-white/10">
          <span className="font-serif text-sm tracking-[0.18em] text-white sm:text-lg">GRASP AI</span>
          {user ? (
            <Link
              to="/app/dashboard"
              className="group inline-flex items-center gap-1.5 text-white/90 transition hover:text-white sm:gap-2"
            >
              <LayoutDashboard className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2} />
              <span className="font-serif text-xs tracking-wide sm:text-base">Dashboard</span>
            </Link>
          ) : (
            <Link
              to="/auth/login"
              className="group inline-flex items-center gap-1.5 text-white/90 transition hover:text-white sm:gap-2"
            >
              <LogIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2} />
              <span className="font-serif text-xs tracking-wide sm:text-base">Sign In</span>
            </Link>
          )}
        </nav>
        <video
          ref={videoRef}
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
          autoPlay
          loop
          muted
          playsInline
          onCanPlay={(e) => { e.currentTarget.playbackRate = 0.7; }}
          className="absolute inset-0 h-full w-full object-cover object-bottom contrast-110"
        />
        <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle,transparent_60%,rgba(0,0,0,0.5)_120%)]" />
      </main>

      {/* ── Below-fold content — always mocha ───────────────────── */}
      <div
        className="transition-opacity duration-700"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {/* ── Refined Perspectives Quote Banner ─────────────────── */}
        <section className="bg-[#e9ded1] border-y border-border/50 text-foreground">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 sm:py-6">
            <div className="flex flex-col md:flex-row items-center justify-center gap-3 sm:gap-6">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60 shrink-0 hidden md:block">
                Refined Perspectives
              </span>
              <div className="hidden md:block h-4 border-l border-foreground/20"></div>
              <div className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-2 sm:gap-4">
                <p className="font-serif text-base sm:text-lg italic text-foreground/90 leading-snug">
                  "An investment in knowledge pays the best interest."
                </p>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-foreground shrink-0 opacity-80">
                  — Benjamin Franklin
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Editorial feature rows ────────────────────────────── */}
        <section className="bg-card">
          {pillars.map((p, i) => (
            <div key={p.num} className="border-t border-border">
              <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
                <div
                  className={`flex flex-col gap-8 sm:gap-16 ${i % 2 === 0
                    ? "lg:flex-row"
                    : "lg:flex-row-reverse"
                    } lg:items-start`}
                >
                  {/* left / right — big number + title */}
                  <div className="lg:w-2/5 flex flex-col">
                    <span className="font-serif italic text-6xl sm:text-8xl font-extralight text-primary/20 leading-none select-none">
                      {p.num}
                    </span>
                    <h3 className="mt-3 text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
                      {p.title}
                    </h3>
                    <p className="mt-2 font-serif text-lg sm:text-xl italic text-muted-foreground">
                      {p.lead}
                    </p>
                  </div>

                  {/* right / left — description */}
                  <div className="lg:w-3/5 lg:pt-12">
                    <p className="text-base sm:text-lg text-foreground/80 leading-relaxed">
                      {p.body}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>






      </div>

      <Footer />
    </div>
  );
}

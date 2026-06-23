import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useEffect, useState } from "react";
import { LogIn, LayoutDashboard, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/lib/auth";

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

function Index() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = 0.7;
  }, []);
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <nav className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-black px-6 py-4 sm:px-10">
        <span className="font-serif text-lg tracking-[0.18em] text-white">GRASP AI</span>
        {user ? (
          <Link
            to="/app/dashboard"
            className="group inline-flex items-center gap-2 text-white/90 transition hover:text-white"
          >
            <LayoutDashboard className="h-4 w-4" strokeWidth={2} />
            <span className="font-serif text-base tracking-wide">Dashboard</span>
          </Link>
        ) : (
          <Link
            to="/auth/login"
            className="group inline-flex items-center gap-2 text-white/90 transition hover:text-white"
          >
            <LogIn className="h-4 w-4" strokeWidth={2} />
            <span className="font-serif text-base tracking-wide">Sign In</span>
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
        onCanPlay={(e) => {
          e.currentTarget.playbackRate = 0.7;
        }}
        className="absolute inset-0 h-full w-full object-cover object-bottom contrast-110"
      />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle,transparent_60%,rgba(0,0,0,0.5)_120%)]" />
    </div>
  );
}

import { Outlet, createFileRoute, Link } from "@tanstack/react-router";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/_legal")({
  component: LegalLayout,
});

function LegalLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-black">
      <nav className="flex items-center justify-between border-b border-white/10 px-6 py-4 sm:px-10 shrink-0">
        <Link to="/" className="font-serif text-lg tracking-[0.18em] text-white">GRASP AI</Link>
      </nav>
      <main className="flex-1 text-white/90 p-8 md:p-20">
        <div className="max-w-3xl mx-auto space-y-6">
          <Link to="/" className="inline-flex items-center text-sm text-white/50 hover:text-white transition mb-6">
            &larr; Back to Home
          </Link>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coffee } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { BuyCreditsModal } from "@/components/BuyCreditsModal";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/lib/auth";
import { CoffeeLoading } from "@/components/ui/coffee-loading";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <CoffeeLoading text="Loading your space..." />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-border bg-background/70 px-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="text-sm text-muted-foreground">GraspAI</div>
            </div>

            <button
              onClick={() => setIsBuyModalOpen(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              <Coffee className="h-4 w-4" />
              <span>{user?.credits}</span>
            </button>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>

      {user && (
        <BuyCreditsModal
          isOpen={isBuyModalOpen}
          onClose={() => setIsBuyModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            refresh();
          }}
          currentCredits={user.credits}
        />
      )}
    </SidebarProvider>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Flame, Layers, BookOpenCheck, Medal } from "lucide-react";

export const Route = createFileRoute("/app/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — GraspAI" }] }),
  component: LeaderboardPage,
});

interface LeaderboardUser {
  rank: number;
  name: string;
  score: number;
  streak: number;
  sessions: number;
  cards_reviewed: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardUser[];
}

function LeaderboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api<LeaderboardData>("/api/leaderboard"),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading ranks...</div>;
  if (error) return <div className="p-8 text-destructive">Could not load leaderboard.</div>;
  if (!data) return null;

  return (
    <div className="flex flex-col space-y-4 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-10 w-full">
      <div className="shrink-0 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">Global Leaderboard</h1>
          <p className="hidden mt-1 text-xs text-muted-foreground sm:block sm:text-sm">
            Rankings are based on your Grasp Score (Consistency + Activity).
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {data.leaderboard.map((user) => {
          let rankColor = "text-foreground/60 font-bold";
          let badgeColor = "bg-secondary text-secondary-foreground";
          let cardStyle = "border-border/50";
          let medalColor = "";

          if (user.rank === 1) {
            cardStyle = "border-primary/40 shadow-sm";
            medalColor = "text-primary fill-primary/20";
          }
          else if (user.rank === 2) {
            cardStyle = "border-primary/20 shadow-sm";
            medalColor = "text-primary/70 fill-primary/10";
          }
          else if (user.rank === 3) {
            cardStyle = "border-primary/10 shadow-sm";
            medalColor = "text-primary/40 fill-primary/5";
          }

          return (
            <div key={user.rank}>
              {user.rank === 4 && (
                <div className="pt-6 pb-2 pl-2">
                  <h3 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">The Rest of the Pack</h3>
                  <div className="h-px bg-border mt-3 w-full" />
                </div>
              )}
              <Card className={`transition-all duration-300 hover:-translate-y-1 hover:shadow-md mt-4 first:mt-0 ${cardStyle}`}>
                <CardContent className="flex items-center gap-4 py-4 sm:gap-6">
                  <div className={`shrink-0 w-8 sm:w-12 text-center text-2xl sm:text-4xl font-bold tracking-tighter ${rankColor}`}>
                    {user.rank}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base sm:text-lg">{user.name}</h3>
                      {user.rank <= 3 && <Medal className={`h-4 w-4 ${medalColor}`} />}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:text-sm">
                      <div className="flex items-center gap-1.5" title="Streak Days">
                        <Flame className="h-3.5 w-3.5" />
                        <span>{user.streak}</span>
                      </div>
                      <div className="flex items-center gap-1.5" title="Sessions Created">
                        <Layers className="h-3.5 w-3.5" />
                        <span>{user.sessions}</span>
                      </div>
                      <div className="flex items-center gap-1.5" title="Cards Reviewed">
                        <BookOpenCheck className="h-3.5 w-3.5" />
                        <span>{user.cards_reviewed}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold sm:text-sm ${badgeColor}`}>
                      {user.score.toLocaleString()} <span className="hidden sm:inline ml-1 font-medium opacity-80">pts</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}

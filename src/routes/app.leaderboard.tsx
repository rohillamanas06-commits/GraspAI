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
    <div className="flex flex-col gap-4 p-4 sm:gap-8 sm:p-8 w-full pb-8">
      <div className="flex-none">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Global Leaderboard</h1>
        <p className="text-muted-foreground mt-1">Rankings are based on your Grasp Score (Consistency + Activity).</p>
      </div>

      <div className="space-y-4">
        {data.leaderboard.map((user) => {
          let rankColor = "text-muted-foreground/50";
          let badgeColor = "bg-secondary text-secondary-foreground";
          let cardStyle = "";
          
          if (user.rank === 1) { 
            rankColor = "text-primary font-black"; 
            badgeColor = "bg-primary/10 text-primary border border-primary/20"; 
            cardStyle = "border-primary/40 shadow-sm";
          }
          else if (user.rank === 2) { 
            rankColor = "text-primary/70 font-black"; 
            badgeColor = "bg-primary/10 text-primary border border-primary/20"; 
            cardStyle = "border-primary/20 shadow-sm";
          }
          else if (user.rank === 3) { 
            rankColor = "text-primary/40 font-black"; 
            badgeColor = "bg-primary/10 text-primary border border-primary/20"; 
            cardStyle = "border-primary/10 shadow-sm";
          }

          return (
            <Card key={user.rank} className={`transition-all ${cardStyle}`}>
              <CardContent className="flex items-center gap-4 py-4 sm:gap-6">
                <div className={`shrink-0 w-8 sm:w-12 text-center text-2xl sm:text-4xl font-bold tracking-tighter ${rankColor}`}>
                  {user.rank}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base sm:text-lg">{user.name}</h3>
                    {user.rank <= 3 && <Medal className="h-4 w-4 text-primary/80" />}
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
          );
        })}
      </div>
    </div>
  );
}

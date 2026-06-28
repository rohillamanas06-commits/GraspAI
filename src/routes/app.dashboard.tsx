import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Flame, BookOpenCheck, Layers, CalendarDays, Coffee, Coins } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — GraspAI" }] }),
  component: DashboardPage,
});

interface DashboardData {
  user: { full_name: string | null; email: string; streak_days: number; member_since: string; credits: number };
  aggregate: { total_sessions: number; total_cards: number; total_topics_mastered: number; cards_this_week: number; streak_days: number };
  velocity_chart: { date: string; cards: number }[];
  radar_chart: { subject: string; score: number; fullMark: number }[];
  sessions: Array<{
    session_id: string;
    session_name: string;
    created_at: string;
    exam_date: string | null;
    plan_version: number;
    phases: Record<string, boolean>;
    stats: { total_topics: number; total_cards: number; topics_reviewed: number; topics_mastered: number; cards_with_feedback: number; plan_days: number };
    predicted_readiness: number | null;
  }>;
}

function DashboardPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<DashboardData>("/api/dashboard"),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Brewing your insights…</div>;
  if (error) return <div className="p-8 text-destructive">Could not load dashboard.</div>;
  if (!data) return null;

  const maxV = Math.max(1, ...data.velocity_chart.map((v) => v.cards));

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:gap-3 sm:text-3xl">
            Time to brew some knowledge{data.user.full_name ? `, ${data.user.full_name.split(" ")[0]}` : ""}.
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Member since {data.user.member_since}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat icon={<Flame className="h-4 w-4" />} label="Streak" value={`${data.aggregate.streak_days} days`} />
        <Stat icon={<Layers className="h-4 w-4" />} label="Sessions" value={data.aggregate.total_sessions} />
        <Stat icon={<BookOpenCheck className="h-4 w-4" />} label="Cards reviewed (7d)" value={data.aggregate.cards_this_week} />
        <Stat icon={<CalendarDays className="h-4 w-4" />} label="Topics mastered" value={data.aggregate.total_topics_mastered} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base font-medium">Study velocity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5 h-48 sm:gap-3 sm:h-56 mt-2">
              {data.velocity_chart.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center justify-end h-full gap-2">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t-md bg-primary/80 transition-all"
                      style={{ height: `${(d.cards / maxV) * 100}%`, minHeight: 4 }}
                      title={`${d.cards} cards`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">Topic Mastery</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              The closer to the edge, the stronger your mastery.
            </p>
          </CardHeader>
          <CardContent className="h-48 sm:h-56 mt-2">
            {data.radar_chart && data.radar_chart.length >= 3 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="55%" data={data.radar_chart}>
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--color-foreground)", fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Mastery" dataKey="score" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.5} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <p className="text-sm">Not enough data.</p>
                <p className="text-xs">Review cards from at least 3 topics to unlock!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium tracking-tight">Your sessions</h2>
        {data.sessions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <Coffee className="h-12 w-12 text-muted-foreground/40" strokeWidth={1.5} />
              <div className="space-y-1">

                <p className="text-sm">You haven't started any study sessions yet.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            {data.sessions.map((s) => (
              <Link
                key={s.session_id}
                to="/app/sessions/$sessionId"
                params={{ sessionId: s.session_id }}
                className="group"
              >
                <Card className="transition-all hover:border-primary/40 hover:shadow-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-base font-medium">{s.session_name}</CardTitle>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-secondary-foreground">
                        v{s.plan_version}
                      </span>
                    </div>
                    {s.exam_date && (
                      <p className="text-xs text-muted-foreground">Exam: {s.exam_date}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div><div className="text-foreground text-sm font-medium">{s.stats.total_topics}</div>topics</div>
                      <div><div className="text-foreground text-sm font-medium">{s.stats.total_cards}</div>cards</div>
                      <div><div className="text-foreground text-sm font-medium">{s.stats.topics_mastered}</div>mastered</div>
                    </div>
                    {s.predicted_readiness !== null && (
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Predicted readiness</span>
                          <span className="text-foreground">{s.predicted_readiness}%</span>
                        </div>
                        <Progress value={s.predicted_readiness} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          {icon}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold text-foreground">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
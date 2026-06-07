import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download } from "lucide-react";
import { Navbar } from "@/components/qv/Navbar";
import { Footer } from "@/components/qv/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics — QuizVerse" }] }),
  component: AnalyticsPage,
});

type QRow = { id: string; title: string; quiz_code: string; status: string };
type PerQuiz = { quiz: QRow; players: number; avg: number; topScore: number };

function AnalyticsPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [stats, setStats] = useState({ totalQuizzes: 0, active: 0, questions: 0, participants: 0, avgScore: 0 });
  const [perQuiz, setPerQuiz] = useState<PerQuiz[]>([]);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) { navigate({ to: "/login" }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (!(roles ?? []).some((r) => r.role === "admin")) {
        toast.error("Admin access required"); navigate({ to: "/" }); return;
      }
      setAuthChecked(true);
    })();
  }, [navigate]);

  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      const [qs, qc, pcAll, qparts] = await Promise.all([
        supabase.from("quizzes").select("id, title, quiz_code, status"),
        supabase.from("questions").select("id", { count: "exact", head: true }),
        supabase.from("participants").select("id", { count: "exact", head: true }),
        supabase.from("quiz_participants").select("quiz_id, score"),
      ]);
      const quizzes = (qs.data ?? []) as QRow[];
      const active = quizzes.filter((q) => q.status === "live" || q.status === "waiting").length;
      const allScores = (qparts.data ?? []) as { quiz_id: string; score: number }[];
      const avg = allScores.length ? Math.round(allScores.reduce((a, b) => a + b.score, 0) / allScores.length) : 0;

      const grouped = new Map<string, number[]>();
      allScores.forEach((s) => {
        if (!grouped.has(s.quiz_id)) grouped.set(s.quiz_id, []);
        grouped.get(s.quiz_id)!.push(s.score);
      });
      const per = quizzes.map((q) => {
        const arr = grouped.get(q.id) ?? [];
        const arrAvg = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
        const top = arr.length ? Math.max(...arr) : 0;
        return { quiz: q, players: arr.length, avg: arrAvg, topScore: top };
      }).sort((a, b) => b.players - a.players);
      setPerQuiz(per);
      setStats({
        totalQuizzes: quizzes.length, active,
        questions: qc.count ?? 0, participants: pcAll.count ?? 0, avgScore: avg,
      });
    })();
  }, [authChecked]);

  const exportCSV = () => {
    if (perQuiz.length === 0) return toast.error("No data to export");
    const headers = ["Quiz Title", "Quiz Code", "Status", "Players", "Avg Score", "Top Score"];
    const rows = perQuiz.map((p) => [
      `"${p.quiz.title.replace(/"/g, '""')}"`,
      p.quiz.quiz_code,
      p.quiz.status,
      p.players,
      p.avg,
      p.topScore,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quizverse-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!authChecked) return <div className="min-h-screen mesh-gradient flex items-center justify-center"><p className="font-mono text-foreground/60 text-sm">Loading…</p></div>;

  return (
    <div className="min-h-screen mesh-gradient">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-16">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-primary mb-6">
          <ArrowLeft className="size-4" /> Back to Admin
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-primary mb-2">Analytics</p>
            <h1 className="font-display text-4xl md:text-5xl tracking-tight">Platform Overview</h1>
          </div>
          <Button variant="outline" onClick={exportCSV} disabled={perQuiz.length === 0}>
            <Download className="size-4" /> Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
          <Stat label="Total Quizzes" value={stats.totalQuizzes} />
          <Stat label="Active" value={stats.active} />
          <Stat label="Questions" value={stats.questions} />
          <Stat label="Participants" value={stats.participants} />
          <Stat label="Avg Score" value={stats.avgScore} />
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-2xl mb-4">Per-quiz participation</h2>
          {perQuiz.length === 0 ? (
            <p className="text-foreground/50 text-sm">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {perQuiz.map((p) => (
                <Link key={p.quiz.id} to="/manage/$quizId" params={{ quizId: p.quiz.id }}
                  className="flex items-center justify-between p-3 rounded-lg bg-foreground/5 border border-border hover:border-primary/40 transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.quiz.title}</p>
                    <p className="text-xs text-foreground/50 font-mono">{p.quiz.quiz_code} · {p.quiz.status}</p>
                  </div>
                  <div className="text-right shrink-0 ml-4 space-y-0.5">
                    <p className="font-display text-xl text-primary">{p.players} <span className="text-xs font-mono text-foreground/50">players</span></p>
                    <p className="text-[10px] font-mono text-foreground/50">avg {p.avg} · top {p.topScore}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs font-mono uppercase tracking-widest text-foreground/50 mb-2">{label}</p>
      <p className="font-display text-3xl md:text-4xl text-primary">{value}</p>
    </div>
  );
}

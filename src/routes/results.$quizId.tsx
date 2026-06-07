import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/results/$quizId")({
  head: () => ({ meta: [{ title: "Quiz Results — QuizVerse" }] }),
  component: ResultsPage,
});

type Row = { id: string; display_name: string; score: number; correct_count: number; incorrect_count: number; user_id: string };

function ResultsPage() {
  const { quizId } = useParams({ from: "/results/$quizId" });
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [totalQs, setTotalQs] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id ?? null;
      if (!uid) { navigate({ to: "/login" }); return; }
      setUserId(uid);
      const [q, p, qq] = await Promise.all([
        supabase.from("quizzes").select("title").eq("id", quizId).maybeSingle(),
        supabase.from("quiz_participants").select("id, display_name, score, correct_count, incorrect_count, user_id")
          .eq("quiz_id", quizId).order("score", { ascending: false }),
        supabase.from("quiz_questions").select("id", { count: "exact", head: true }).eq("quiz_id", quizId),
      ]);
      if (q.data) setQuizTitle(q.data.title);
      setRows((p.data ?? []) as Row[]);
      setTotalQs(qq.count ?? 0);
    })();
  }, [quizId, navigate]);

  const me = rows.find((r) => r.user_id === userId);
  const myRank = me ? rows.findIndex((r) => r.user_id === userId) + 1 : null;
  const pct = me && totalQs ? Math.round((me.correct_count / totalQs) * 100) : 0;

  return (
    <div className="min-h-screen mesh-gradient px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-primary mb-2">Quiz Complete</p>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight">{quizTitle}</h1>
        </div>

        {me && (
          <div className="glass rounded-3xl p-6 sm:p-8 mb-6 text-center">
            <Trophy className="size-12 mx-auto text-accent mb-3" />
            <p className="font-mono text-xs uppercase tracking-widest text-foreground/50">Your final rank</p>
            <p className="font-display text-6xl text-primary my-2">#{myRank}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <Stat label="Score" value={me.score} />
              <Stat label="Correct" value={me.correct_count} />
              <Stat label="Incorrect" value={me.incorrect_count} />
              <Stat label="Accuracy" value={`${pct}%`} />
            </div>
          </div>
        )}

        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-2xl mb-4">Leaderboard</h2>
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.id} className={`flex items-center gap-3 p-3 rounded-lg border ${r.user_id === userId ? "bg-primary/10 border-primary/30" : "bg-foreground/5 border-border"}`}>
                <span className="font-display text-xl w-8 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.display_name}{r.user_id === userId ? " (you)" : ""}</p>
                  <p className="text-xs text-foreground/50 font-mono">✓ {r.correct_count} · ✗ {r.incorrect_count}</p>
                </div>
                <span className="font-display text-2xl text-primary">{r.score}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="text-center mt-8">
          <Link to="/" className="text-sm text-primary hover:underline font-medium">Back to home</Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-foreground/5 border border-border p-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-foreground/50">{label}</p>
      <p className="font-display text-2xl mt-1">{value}</p>
    </div>
  );
}
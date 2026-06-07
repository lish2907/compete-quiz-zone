import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Trophy, CircleCheck as CheckCircle2, Circle as XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OPTIONS, type OptionKey, type QuizStatus } from "@/lib/quiz-utils";

export const Route = createFileRoute("/quiz/$code")({
  head: () => ({ meta: [{ title: "Live Quiz — QuizVerse" }] }),
  component: LiveQuiz,
});

type Quiz = {
  id: string;
  title: string;
  quiz_code: string;
  status: QuizStatus;
  duration: number;
  current_question_index: number;
};

type QuestionData = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
};

type Linked = {
  id: string;
  question_id: string;
  order_index: number;
  points: number;
  question: QuestionData;
};

type Leader = { id: string; display_name: string; score: number; user_id: string };

const SECONDS_PER_Q = 20;

function LiveQuiz() {
  const { code } = useParams({ from: "/quiz/$code" });
  const navigate = useNavigate();

  const [userId, setUserId] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Linked[]>([]);
  const [leaderboard, setLeaderboard] = useState<Leader[]>([]);
  // Set of quiz_questions.id values the user has already answered this session
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState<OptionKey | null>(null);
  const [lastResult, setLastResult] = useState<{ correct: boolean; points: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_Q);

  // Track which quiz_question.id was last shown so we reset per-question state
  const lastQuestionIdRef = useRef<string | null>(null);

  // Auth + initial data load
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) {
        navigate({ to: "/login" });
        return;
      }
      setUserId(uid);

      const { data: q, error: qErr } = await supabase
        .from("quizzes")
        .select("id, title, quiz_code, status, duration, current_question_index")
        .eq("quiz_code", code)
        .maybeSingle();

      if (qErr || !q) {
        toast.error("Quiz not found");
        navigate({ to: "/join" });
        return;
      }
      setQuiz(q as Quiz);

      if (q.status === "ended") {
        navigate({ to: "/results/$quizId", params: { quizId: q.id } });
        return;
      }

      // Ensure participant row exists (idempotent)
      const { data: participantProfile } = await supabase
        .from("participants")
        .select("full_name")
        .eq("user_id", uid)
        .maybeSingle();
      const displayName =
        participantProfile?.full_name || s.session?.user.email?.split("@")[0] || "Player";

      await supabase.from("quiz_participants").upsert(
        { quiz_id: q.id, user_id: uid, display_name: displayName },
        { onConflict: "quiz_id,user_id", ignoreDuplicates: true },
      );

      // Load questions
      const { data: qs } = await supabase
        .from("quiz_questions")
        .select(
          "id, question_id, order_index, points, question:questions(id, question, option_a, option_b, option_c, option_d)",
        )
        .eq("quiz_id", q.id)
        .order("order_index");
      const linkedQs = (qs ?? []) as unknown as Linked[];
      setQuestions(linkedQs);

      // Load already-answered question IDs
      const { data: ans } = await supabase
        .from("quiz_answers")
        .select("question_id")
        .eq("quiz_id", q.id)
        .eq("user_id", uid);

      if (ans && linkedQs.length > 0) {
        const answeredQids = new Set(ans.map((a) => a.question_id));
        const answeredLinkedIds = new Set(
          linkedQs.filter((l) => answeredQids.has(l.question_id)).map((l) => l.id),
        );
        setAnsweredIds(answeredLinkedIds);
      }
    })();
  }, [code, navigate]);

  const refreshLeaderboard = useCallback(async () => {
    if (!quiz) return;
    const { data } = await supabase
      .from("quiz_participants")
      .select("id, display_name, score, user_id")
      .eq("quiz_id", quiz.id)
      .order("score", { ascending: false })
      .limit(10);
    setLeaderboard((data ?? []) as Leader[]);
  }, [quiz]);

  useEffect(() => {
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  // Realtime subscriptions
  useEffect(() => {
    if (!quiz) return;

    const ch = supabase
      .channel(`live-quiz-${quiz.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quizzes", filter: `id=eq.${quiz.id}` },
        (payload) => {
          setQuiz((prev) => (prev ? { ...prev, ...(payload.new as Partial<Quiz>) } : prev));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quiz_participants",
          filter: `quiz_id=eq.${quiz.id}`,
        },
        () => refreshLeaderboard(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [quiz?.id, refreshLeaderboard]);

  // Current question derived from quiz state
  const currentQ = useMemo(() => {
    if (!quiz) return null;
    return questions[quiz.current_question_index] ?? null;
  }, [questions, quiz?.current_question_index]);

  // Reset per-question UI state when question index changes
  useEffect(() => {
    if (!currentQ) return;
    if (lastQuestionIdRef.current !== currentQ.id) {
      lastQuestionIdRef.current = currentQ.id;
      setPicking(null);
      setLastResult(null);
      setTimeLeft(SECONDS_PER_Q);
    }
  }, [currentQ?.id]);

  // Countdown timer — only runs when live and not yet answered
  useEffect(() => {
    if (!quiz || quiz.status !== "live" || !currentQ) return;
    if (answeredIds.has(currentQ.id)) return;
    if (timeLeft <= 0) return;

    const t = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [quiz?.status, currentQ?.id, timeLeft, answeredIds]);

  // Navigate to results when quiz ends
  useEffect(() => {
    if (quiz?.status === "ended") {
      navigate({ to: "/results/$quizId", params: { quizId: quiz.id } });
    }
  }, [quiz?.status, quiz?.id, navigate]);

  const submit = async (opt: OptionKey) => {
    if (!quiz || !currentQ || picking || answeredIds.has(currentQ.id)) return;
    setPicking(opt);

    try {
      const { data, error } = await supabase.rpc("submit_quiz_answer", {
        _quiz_id: quiz.id,
        _question_id: currentQ.question_id,
        _selected: opt,
      });

      if (error) {
        // Duplicate submission — treat as already answered
        if (error.code === "23505" || error.message.toLowerCase().includes("duplicate")) {
          setAnsweredIds((s) => new Set(s).add(currentQ.id));
        } else {
          toast.error(error.message);
          setPicking(null);
        }
        return;
      }

      const r = data as { is_correct: boolean; points: number };
      setLastResult({ correct: r.is_correct, points: r.points });
      setAnsweredIds((s) => new Set(s).add(currentQ.id));
      refreshLeaderboard();
    } catch (err) {
      toast.error("Failed to submit answer. Please try again.");
      setPicking(null);
    }
  };

  if (!quiz) {
    return (
      <div className="min-h-screen mesh-gradient flex items-center justify-center">
        <p className="font-mono text-foreground/60 text-sm">Loading quiz…</p>
      </div>
    );
  }

  if (quiz.status === "draft" || quiz.status === "waiting") {
    return (
      <div className="min-h-screen mesh-gradient flex items-center justify-center px-6">
        <div className="glass rounded-3xl p-8 max-w-md w-full text-center">
          <div className="size-16 mx-auto rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mb-4">
            <div className="size-8 rounded-full bg-primary animate-pulse" />
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-primary mb-2">
            {quiz.quiz_code}
          </p>
          <h1 className="font-display text-3xl mb-2">{quiz.title}</h1>
          <p className="text-foreground/60 text-sm mb-4">Waiting for the host to start…</p>
          <p className="text-xs text-foreground/40 font-mono">
            {leaderboard.length} player{leaderboard.length === 1 ? "" : "s"} in lobby
          </p>
        </div>
      </div>
    );
  }

  if (quiz.status === "paused") {
    return (
      <div className="min-h-screen mesh-gradient flex items-center justify-center px-6">
        <div className="glass rounded-3xl p-8 max-w-md w-full text-center">
          <h1 className="font-display text-3xl mb-2">Quiz Paused</h1>
          <p className="text-foreground/60 text-sm">The host paused the quiz. Hold tight.</p>
        </div>
      </div>
    );
  }

  if (!currentQ) {
    return (
      <div className="min-h-screen mesh-gradient flex items-center justify-center px-6">
        <div className="glass rounded-3xl p-8 max-w-md w-full text-center">
          <h1 className="font-display text-3xl mb-2">All done!</h1>
          <p className="text-foreground/60 text-sm">Waiting for the host to end the quiz…</p>
        </div>
      </div>
    );
  }

  const answered = answeredIds.has(currentQ.id);
  const timerPct = (timeLeft / SECONDS_PER_Q) * 100;
  const timerColor =
    timeLeft > 10 ? "bg-primary" : timeLeft > 5 ? "bg-accent" : "bg-destructive";

  return (
    <div className="min-h-screen mesh-gradient px-4 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-primary">
              {quiz.quiz_code}
            </p>
            <h1 className="font-display text-xl tracking-tight">{quiz.title}</h1>
          </div>
          <div
            className={`flex items-center gap-2 text-sm font-mono font-bold ${
              timeLeft <= 5
                ? "text-destructive"
                : timeLeft <= 10
                  ? "text-accent"
                  : "text-foreground/70"
            }`}
          >
            <Clock className="size-4" />
            {timeLeft}s
          </div>
        </div>

        {/* Timer bar */}
        <div className="h-1.5 w-full bg-foreground/10 rounded-full mb-6 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${timerColor}`}
            style={{ width: `${timerPct}%` }}
          />
        </div>

        {/* Question card */}
        <div className="glass rounded-3xl p-6 sm:p-8 mb-6">
          <p className="font-mono text-xs uppercase tracking-widest text-foreground/50 mb-3">
            Question {quiz.current_question_index + 1} of {questions.length}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl tracking-tight mb-6">
            {currentQ.question.question}
          </h2>

          <div className="grid sm:grid-cols-2 gap-3">
            {OPTIONS.map((o) => {
              const key = `option_${o.toLowerCase()}` as keyof QuestionData;
              const text = currentQ.question[key] as string;
              const isPicked = picking === o;
              const disabled = answered || timeLeft <= 0;

              return (
                <button
                  key={o}
                  disabled={disabled}
                  onClick={() => submit(o)}
                  className={`text-left p-4 rounded-2xl border-2 transition-all ${
                    isPicked
                      ? lastResult?.correct
                        ? "border-primary bg-primary/15"
                        : "border-destructive bg-destructive/15"
                      : disabled
                        ? "border-border bg-foreground/5 opacity-50 cursor-not-allowed"
                        : "border-border bg-foreground/5 hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="font-display text-xl text-primary w-8">{o}</span>
                    <span className="text-sm sm:text-base flex-1">{text}</span>
                    {isPicked &&
                      (lastResult?.correct ? (
                        <CheckCircle2 className="shrink-0 text-primary" />
                      ) : (
                        <XCircle className="shrink-0 text-destructive" />
                      ))}
                  </div>
                </button>
              );
            })}
          </div>

          {answered && lastResult && (
            <p
              className={`mt-4 text-sm font-mono ${lastResult.correct ? "text-primary" : "text-destructive"}`}
            >
              {lastResult.correct ? `+${lastResult.points} points!` : "Better luck next time."}{" "}
              Waiting for next question…
            </p>
          )}
          {!answered && timeLeft <= 0 && (
            <p className="mt-4 text-sm font-mono text-foreground/50">
              Time's up. Waiting for next question…
            </p>
          )}
        </div>

        {/* Leaderboard */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="size-4 text-accent" />
            <p className="font-mono text-xs uppercase tracking-widest text-foreground/50">
              Leaderboard
            </p>
          </div>
          <ol className="space-y-1">
            {leaderboard.map((p, i) => (
              <li
                key={p.id}
                className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                  p.user_id === userId ? "bg-primary/10" : ""
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-foreground/50 w-5">{i + 1}.</span>
                  <span className="truncate">
                    {p.display_name}
                    {p.user_id === userId ? " (you)" : ""}
                  </span>
                </span>
                <span className="font-display text-primary">{p.score}</span>
              </li>
            ))}
            {leaderboard.length === 0 && (
              <li className="text-xs text-foreground/40 font-mono text-center py-2">
                No scores yet
              </li>
            )}
          </ol>
        </div>
      </div>
    </div>
  );
}

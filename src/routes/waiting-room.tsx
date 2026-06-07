import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProgressSteps } from "@/components/qv/ProgressSteps";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/waiting-room")({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Waiting Room — QuizVerse" },
      { name: "description", content: "Waiting for the host to start the quiz." },
    ],
  }),
  component: WaitingRoomPage,
});

function WaitingRoomPage() {
  const navigate = useNavigate();
  const { code } = Route.useSearch();
  const [quizId, setQuizId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState<string>("");
  const [playerCount, setPlayerCount] = useState(0);
  const [quizStatus, setQuizStatus] = useState<string>("waiting");

  // Initial load + auth check
  useEffect(() => {
    if (!code) return;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate({ to: "/login" });
        return;
      }

      const { data: quiz } = await supabase
        .from("quizzes")
        .select("id, status, title")
        .eq("quiz_code", code)
        .maybeSingle();

      if (!quiz) return;

      setQuizId(quiz.id);
      setQuizTitle(quiz.title);
      setQuizStatus(quiz.status);

      // If already live, skip waiting room immediately
      if (quiz.status === "live" || quiz.status === "paused") {
        navigate({ to: "/quiz/$code", params: { code } });
        return;
      }

      // Load participant count
      const { count } = await supabase
        .from("quiz_participants")
        .select("id", { count: "exact", head: true })
        .eq("quiz_id", quiz.id);
      setPlayerCount(count ?? 0);
    })();
  }, [code, navigate]);

  // Realtime: quiz status changes + participant count
  useEffect(() => {
    if (!quizId || !code) return;

    const quizChannel = supabase
      .channel(`waiting-quiz-${quizId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quizzes", filter: `id=eq.${quizId}` },
        (payload) => {
          const newStatus = (payload.new as { status?: string }).status;
          if (newStatus) setQuizStatus(newStatus);
          if (newStatus === "live" || newStatus === "paused") {
            navigate({ to: "/quiz/$code", params: { code } });
          }
        },
      )
      .subscribe();

    const participantsChannel = supabase
      .channel(`waiting-participants-${quizId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_participants", filter: `quiz_id=eq.${quizId}` },
        async () => {
          const { count } = await supabase
            .from("quiz_participants")
            .select("id", { count: "exact", head: true })
            .eq("quiz_id", quizId);
          setPlayerCount(count ?? 0);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(quizChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [quizId, code, navigate]);

  const statusLabel: Record<string, string> = {
    draft: "Quiz not yet open",
    waiting: "Waiting for host…",
    live: "Starting…",
    paused: "Starting…",
    ended: "Quiz has ended",
  };

  return (
    <div className="min-h-screen mesh-gradient flex items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="absolute -z-10 top-1/3 left-1/4 size-96 bg-primary/20 blur-[120px] rounded-full" />
      <div className="absolute -z-10 bottom-1/4 right-1/4 size-96 bg-secondary/20 blur-[120px] rounded-full" />
      <div className="w-full max-w-lg">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center font-bold text-primary-foreground">
            Q
          </div>
          <span className="font-display text-2xl tracking-wider">QUIZVERSE</span>
        </Link>
        <div className="glass rounded-3xl p-8 shadow-2xl animate-fade-in text-center">
          <ProgressSteps current={2} />
          <div className="size-20 mx-auto rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mb-6">
            <div className="size-10 rounded-full bg-primary animate-pulse" />
          </div>
          <h1 className="font-display text-4xl tracking-tight mb-2">You're in!</h1>
          {quizTitle && (
            <p className="font-display text-xl text-primary mb-2">{quizTitle}</p>
          )}
          <p className="text-foreground/60 text-sm mb-4">
            {code ? (
              <>
                Joined quiz <span className="font-mono text-primary">{code}</span>.{" "}
              </>
            ) : null}
            Hang tight — the host will start the quiz soon.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs font-mono uppercase tracking-widest text-foreground/40">
            <span>{statusLabel[quizStatus] ?? "Waiting for host…"}</span>
            {playerCount > 0 && (
              <>
                <span>·</span>
                <span>
                  {playerCount} player{playerCount === 1 ? "" : "s"} joined
                </span>
              </>
            )}
          </div>
          {!code && (
            <div className="mt-6">
              <Link to="/join" className="text-sm text-primary hover:underline">
                Enter a quiz code →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

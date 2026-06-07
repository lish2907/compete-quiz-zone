import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthShell, AuthButton } from "@/components/qv/AuthShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Join Quiz — QuizVerse" },
      { name: "description", content: "Enter a quiz code to join a live QuizVerse session." },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const navigate = useNavigate();
  const { code: initial } = Route.useSearch();
  const [code, setCode] = useState(initial ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) navigate({ to: "/login" });
    })();
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    try {
      // 1. Look up the quiz
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .select("id, status, quiz_code")
        .eq("quiz_code", trimmed)
        .maybeSingle();

      if (quizError) {
        toast.error(quizError.message);
        return;
      }
      if (!quiz) {
        toast.error("Quiz code not found");
        return;
      }
      if (quiz.status === "ended") {
        toast.error("This quiz has already ended");
        return;
      }

      // 2. Get current user session
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid) {
        navigate({ to: "/login" });
        return;
      }

      // 3. Get display name from participants table
      const { data: participant } = await supabase
        .from("participants")
        .select("full_name")
        .eq("user_id", uid)
        .maybeSingle();

      const displayName =
        participant?.full_name ||
        sessionData.session?.user.email?.split("@")[0] ||
        "Player";

      // 4. Upsert into quiz_participants
      const { error: upsertError } = await supabase.from("quiz_participants").upsert(
        { quiz_id: quiz.id, user_id: uid, display_name: displayName },
        { onConflict: "quiz_id,user_id", ignoreDuplicates: true },
      );

      if (upsertError) {
        // Log but don't block navigation — participant row may already exist
        console.warn("quiz_participants upsert:", upsertError.message);
      }

      // 5. Navigate based on quiz status
      if (quiz.status === "live" || quiz.status === "paused") {
        navigate({ to: "/quiz/$code", params: { code: trimmed } });
      } else {
        navigate({ to: "/waiting-room", search: { code: trimmed } });
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Join a quiz"
      subtitle="Enter the code your host shared with you to drop into the lobby."
      footer={
        <>
          Hosting instead?{" "}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Log in as admin
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <label className="block mb-4">
          <span className="block text-xs font-mono uppercase tracking-widest text-foreground/50 mb-2">
            Quiz code
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="QV-XXXXXX"
            required
            className="w-full bg-foreground/5 border border-border rounded-xl px-4 py-4 font-mono text-2xl tracking-[0.3em] uppercase text-center text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-primary/50 focus:bg-foreground/10 transition-colors"
          />
        </label>
        <AuthButton type="submit" disabled={loading}>
          {loading ? "Checking…" : "Enter Lobby"}
        </AuthButton>
      </form>
    </AuthShell>
  );
}

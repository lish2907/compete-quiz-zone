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
    const { data, error } = await supabase.from("quizzes")
      .select("id, status, quiz_code").eq("quiz_code", trimmed).maybeSingle();
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("Quiz code not found");
    if (data.status === "ended") return toast.error("This quiz has ended");
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (uid) {
      const { data: p } = await supabase.from("participants").select("full_name").eq("user_id", uid).maybeSingle();
      const name = p?.full_name || s.session?.user.email?.split("@")[0] || "Player";
      await supabase.from("quiz_participants").upsert(
        { quiz_id: data.id, user_id: uid, display_name: name },
        { onConflict: "quiz_id,user_id", ignoreDuplicates: true }
      );
    }
    if (data.status === "live" || data.status === "paused") {
      navigate({ to: "/quiz/$code", params: { code: trimmed } });
    } else {
      navigate({ to: "/waiting-room", search: { code: trimmed } as any });
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
        <AuthButton type="submit">{loading ? "Checking…" : "Enter Lobby"}</AuthButton>
      </form>
    </AuthShell>
  );
}
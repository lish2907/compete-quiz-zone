import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, AuthInput, AuthButton } from "@/components/qv/AuthShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — QuizVerse" },
      { name: "description", content: "Log in to host or join quizzes on QuizVerse." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"admin" | "participant">("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setError(error?.message ?? "Login failed");
      setLoading(false);
      return;
    }
    if (tab === "admin") {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const isAdmin = roles?.some((r) => r.role === "admin");
      if (!isAdmin) {
        await supabase.auth.signOut();
        setError("This account is not an admin.");
        setLoading(false);
        return;
      }
      navigate({ to: "/admin" });
    } else {
      const { data: participant } = await supabase
        .from("participants")
        .select("id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      navigate({ to: participant ? "/waiting-room" : "/participant-register" });
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue your QuizVerse journey."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="text-primary font-semibold hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 p-1 bg-foreground/5 border border-border rounded-xl mb-6">
        {(["admin", "participant"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`py-2 text-xs font-mono uppercase tracking-widest rounded-lg transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <AuthInput
          label="Email"
          type="email"
          placeholder="you@quizverse.app"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthInput
          label="Password"
          type="password"
          placeholder="••••••••"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p className="text-sm text-destructive mb-3" role="alert">{error}</p>
        )}
        <AuthButton type="submit" disabled={loading}>
          {loading ? "Signing in…" : tab === "admin" ? "Enter Admin Console" : "Continue to Lobby"}
        </AuthButton>
      </form>
    </AuthShell>
  );
}
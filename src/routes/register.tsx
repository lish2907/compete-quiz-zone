import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthShell, AuthInput, AuthButton } from "@/components/qv/AuthShell";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create Account — QuizVerse" },
      { name: "description", content: "Sign up to host live quizzes on QuizVerse." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "participant">("admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { name, role },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    navigate({ to: role === "admin" ? "/admin" : "/participant-register" });
  }
  return (
    <AuthShell
      title="Join QuizVerse"
      subtitle="Spin up your first live quiz in under 30 seconds."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-2 p-1 bg-foreground/5 border border-border rounded-xl mb-6">
          {(["admin", "participant"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`py-2 text-xs font-mono uppercase tracking-widest rounded-lg transition-colors ${
                role === r
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <AuthInput
          label="Display name"
          placeholder="Alex Rivera"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          placeholder="At least 8 characters"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p className="text-sm text-destructive mb-3" role="alert">{error}</p>
        )}
        <AuthButton type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </AuthButton>
      </form>
    </AuthShell>
  );
}
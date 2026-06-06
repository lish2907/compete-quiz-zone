import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthShell, AuthInput, AuthButton } from "@/components/qv/AuthShell";

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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ to: "/admin" });
        }}
      >
        <AuthInput label="Display name" placeholder="Alex Rivera" required />
        <AuthInput label="Email" type="email" placeholder="you@quizverse.app" required />
        <AuthInput label="Password" type="password" placeholder="At least 8 characters" required />
        <AuthButton type="submit">Create account</AuthButton>
      </form>
    </AuthShell>
  );
}
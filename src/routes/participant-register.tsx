import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, AuthInput, AuthButton } from "@/components/qv/AuthShell";
import { ProgressSteps } from "@/components/qv/ProgressSteps";

export const Route = createFileRoute("/participant-register")({
  head: () => ({
    meta: [
      { title: "Participant Registration — QuizVerse" },
      { name: "description", content: "Register as a QuizVerse participant." },
    ],
  }),
  component: ParticipantRegisterPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  college: z.string().trim().min(2, "College is required").max(150),
  branch: z.string().trim().min(1, "Branch is required").max(100),
  year: z.string().min(1, "Select year"),
});

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Postgraduate"];

function ParticipantRegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    college: "",
    branch: "",
    year: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/login" });
        return;
      }
      setUserId(data.user.id);
      const meta = (data.user.user_metadata ?? {}) as { name?: string };
      setForm((f) => ({
        ...f,
        email: data.user!.email ?? "",
        full_name: f.full_name || meta.name || "",
      }));
    })();
  }, [navigate]);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        fieldErrors[i.path[0] as string] = i.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    if (!userId) return;
    setLoading(true);
    const { error } = await supabase
      .from("participants")
      .upsert({ ...parsed.data, user_id: userId }, { onConflict: "user_id" });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Registration successful! Heading to the waiting room…");
    navigate({ to: "/waiting-room" });
  }

  return (
    <AuthShell
      title="Participant registration"
      subtitle="Tell us a bit about yourself before you jump into the quiz lobby."
      footer={
        <>
          Wrong account?{" "}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Switch user
          </Link>
        </>
      }
    >
      <ProgressSteps current={1} />
      <form onSubmit={handleSubmit} noValidate>
        <AuthInput
          label="Full name"
          value={form.full_name}
          onChange={update("full_name")}
          placeholder="Alex Rivera"
          required
        />
        {errors.full_name && <p className="text-xs text-destructive -mt-3 mb-3">{errors.full_name}</p>}

        <AuthInput
          label="Email"
          type="email"
          value={form.email}
          readOnly
          disabled
          placeholder="you@quizverse.app"
        />

        <AuthInput
          label="College"
          value={form.college}
          onChange={update("college")}
          placeholder="MIT"
          required
        />
        {errors.college && <p className="text-xs text-destructive -mt-3 mb-3">{errors.college}</p>}

        <AuthInput
          label="Branch"
          value={form.branch}
          onChange={update("branch")}
          placeholder="Computer Science"
          required
        />
        {errors.branch && <p className="text-xs text-destructive -mt-3 mb-3">{errors.branch}</p>}

        <label className="block mb-4">
          <span className="block text-xs font-mono uppercase tracking-widest text-foreground/50 mb-2">
            Year
          </span>
          <select
            value={form.year}
            onChange={update("year")}
            required
            className="w-full bg-foreground/5 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/50 focus:bg-foreground/10 transition-colors"
          >
            <option value="" disabled>
              Select your year
            </option>
            {YEARS.map((y) => (
              <option key={y} value={y} className="bg-background">
                {y}
              </option>
            ))}
          </select>
        </label>
        {errors.year && <p className="text-xs text-destructive -mt-3 mb-3">{errors.year}</p>}

        <AuthButton type="submit" disabled={loading}>
          {loading ? "Registering…" : "Register & continue"}
        </AuthButton>
      </form>
    </AuthShell>
  );
}
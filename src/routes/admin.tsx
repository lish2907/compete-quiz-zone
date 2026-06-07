import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Copy, Eye, Plus, Search, Settings, BarChart3, BookOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Navbar } from "@/components/qv/Navbar";
import { Footer } from "@/components/qv/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — QuizVerse" },
      { name: "description", content: "Host, monitor, and manage your live quizzes." },
    ],
  }),
  component: AdminDashboard,
});

type QuizStatus = "draft" | "waiting" | "live" | "paused" | "ended";
const STATUSES: QuizStatus[] = ["draft", "waiting", "live", "paused", "ended"];

type Quiz = {
  id: string;
  title: string;
  description: string | null;
  quiz_code: string;
  status: QuizStatus;
  duration: number;
  question_count: number;
  created_at: string;
  host_id: string;
};

const STATUS_TONE: Record<QuizStatus, string> = {
  draft: "bg-foreground/10 text-foreground/70 border-border",
  waiting: "bg-secondary/15 text-secondary border-secondary/30",
  live: "bg-primary/15 text-primary border-primary/30",
  paused: "bg-accent/15 text-accent border-accent/30",
  ended: "bg-foreground/5 text-foreground/50 border-border",
};

const PAGE_SIZE = 8;

function generateQuizCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `QV-${s}`;
}

type FormState = {
  title: string;
  description: string;
  quiz_code: string;
  duration: number;
  status: QuizStatus;
  question_count: number;
};

const emptyForm = (): FormState => ({
  title: "",
  description: "",
  quiz_code: generateQuizCode(),
  duration: 10,
  status: "draft",
  question_count: 0,
});

function AdminDashboard() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [participantsCount, setParticipantsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QuizStatus>("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);

  // Modals
  const [editing, setEditing] = useState<Quiz | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Quiz | null>(null);
  const [deleting, setDeleting] = useState<Quiz | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  // Admin gate
  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid) {
        navigate({ to: "/login" });
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      if (!isAdmin) {
        toast.error("Admin access required");
        navigate({ to: "/" });
        return;
      }
      setUserId(uid);
      setAuthChecked(true);
    })();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    const [quizzesRes, partsRes] = await Promise.all([
      supabase.from("quizzes").select("*").order("created_at", { ascending: false }),
      supabase.from("participants").select("id", { count: "exact", head: true }),
    ]);
    if (quizzesRes.error) toast.error(quizzesRes.error.message);
    else setQuizzes((quizzesRes.data ?? []) as Quiz[]);
    setParticipantsCount(partsRes.count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    if (authChecked) loadData();
  }, [authChecked]);

  // Stats
  const stats = useMemo(() => {
    const total = quizzes.length;
    const active = quizzes.filter((q) => q.status === "live" || q.status === "waiting").length;
    const questions = quizzes.reduce((sum, q) => sum + (q.question_count ?? 0), 0);
    return { total, active, questions };
  }, [quizzes]);

  // Filter / sort / paginate
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let out = quizzes.filter((q) => {
      const matchesSearch =
        !term ||
        q.title.toLowerCase().includes(term) ||
        q.quiz_code.toLowerCase().includes(term) ||
        (q.description ?? "").toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    out = out.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortDir === "desc" ? db - da : da - db;
    });
    return out;
  }, [quizzes, search, statusFilter, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortDir]);

  // Actions
  const openCreate = () => {
    setForm(emptyForm());
    setCreating(true);
  };

  const openEdit = (q: Quiz) => {
    setForm({
      title: q.title,
      description: q.description ?? "",
      quiz_code: q.quiz_code,
      duration: q.duration,
      status: q.status,
      question_count: q.question_count,
    });
    setEditing(q);
  };

  const submitCreate = async () => {
    if (!userId) return;
    if (!form.title.trim()) return toast.error("Title is required");
    setSaving(true);
    const { error } = await supabase.from("quizzes").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      quiz_code: form.quiz_code,
      duration: form.duration,
      status: form.status,
      question_count: form.question_count,
      host_id: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Quiz created");
    setCreating(false);
    loadData();
  };

  const submitEdit = async () => {
    if (!editing) return;
    if (!form.title.trim()) return toast.error("Title is required");
    setSaving(true);
    const { error } = await supabase
      .from("quizzes")
      .update({
        title: form.title.trim(),
        description: form.description.trim() || null,
        quiz_code: form.quiz_code,
        duration: form.duration,
        status: form.status,
        question_count: form.question_count,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Quiz updated");
    setEditing(null);
    loadData();
  };

  const duplicateQuiz = async (q: Quiz) => {
    if (!userId) return;
    const { error } = await supabase.from("quizzes").insert({
      title: `${q.title} (copy)`,
      description: q.description,
      quiz_code: generateQuizCode(),
      duration: q.duration,
      status: "draft",
      question_count: q.question_count,
      host_id: userId,
    });
    if (error) return toast.error(error.message);
    toast.success("Quiz duplicated");
    loadData();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("quizzes").delete().eq("id", deleting.id);
    if (error) return toast.error(error.message);
    toast.success("Quiz deleted");
    setDeleting(null);
    loadData();
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen mesh-gradient flex items-center justify-center">
        <p className="font-mono text-foreground/60 text-sm">Verifying admin access…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen mesh-gradient">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-16">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 animate-fade-in">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-primary mb-2">
              Admin Console
            </p>
            <h1 className="font-display text-4xl md:text-6xl tracking-tight">Quiz Management</h1>
            <p className="text-foreground/60 mt-2 max-w-lg">
              Create, edit, and manage every quiz across QuizVerse.
            </p>
          </div>
          <Button onClick={openCreate} className="rounded-xl h-11 px-5 shadow-lg shadow-primary/20">
            <Plus className="mr-1" /> New Quiz
          </Button>
        </div>

        {/* Quick links */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-3 mb-8">
          <Link to="/questions" className="glass rounded-2xl p-5 flex items-center gap-4 hover:border-primary/40 transition-colors border border-transparent">
            <div className="size-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary"><BookOpen /></div>
            <div>
              <p className="font-display text-lg">Question Bank</p>
              <p className="text-xs text-foreground/60">Add, edit, and bulk-import questions.</p>
            </div>
          </Link>
          <Link to="/admin/analytics" className="glass rounded-2xl p-5 flex items-center gap-4 hover:border-primary/40 transition-colors border border-transparent">
            <div className="size-12 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent"><BarChart3 /></div>
            <div>
              <p className="font-display text-lg">Analytics</p>
              <p className="text-xs text-foreground/60">Participation, scores, and trends.</p>
            </div>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Total Quizzes" value={stats.total} tone="primary" />
          <StatCard label="Active Quizzes" value={stats.active} tone="secondary" />
          <StatCard label="Total Participants" value={participantsCount} tone="accent" />
          <StatCard label="Total Questions" value={stats.questions} tone="primary" />
        </div>

        {/* Toolbar */}
        <div className="glass rounded-2xl p-4 mb-4 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, code, description…"
              className="pl-9 h-10 bg-background/40"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="md:w-44 h-10 bg-background/40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortDir} onValueChange={(v) => setSortDir(v as "asc" | "desc")}>
            <SelectTrigger className="md:w-44 h-10 bg-background/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Newest first</SelectItem>
              <SelectItem value="asc">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Title</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">Questions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-foreground/50 text-sm">
                      Loading quizzes…
                    </TableCell>
                  </TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-foreground/50 text-sm">
                      No quizzes found. Try adjusting filters or create a new one.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((q) => (
                    <TableRow key={q.id} className="border-border">
                      <TableCell>
                        <div className="font-bold">{q.title}</div>
                        {q.description && (
                          <div className="text-xs text-foreground/50 line-clamp-1 max-w-xs">
                            {q.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-primary">{q.quiz_code}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize ${STATUS_TONE[q.status]}`}>
                          {q.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{q.duration}m</TableCell>
                      <TableCell className="text-right font-mono text-sm">{q.question_count}</TableCell>
                      <TableCell className="text-xs text-foreground/60">
                        {new Date(q.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild size="icon" variant="ghost" title="Manage / Live control">
                            <Link to="/admin/quiz/$quizId" params={{ quizId: q.id }}><Settings /></Link>
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setViewing(q)} title="View">
                            <Eye />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(q)} title="Edit">
                            <Pencil />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => duplicateQuiz(q)} title="Duplicate">
                            <Copy />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleting(q)}
                            title="Delete"
                            className="hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
            <p className="text-foreground/50 text-xs">
              Showing {pageRows.length} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <span className="font-mono text-xs text-foreground/60">
                {safePage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      {/* Create / Edit Dialog */}
      <Dialog
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="bg-background border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-tight">
              {editing ? "Edit Quiz" : "Create Quiz"}
            </DialogTitle>
            <DialogDescription>
              {editing ? "Update quiz details." : "Set up a new quiz room."}
            </DialogDescription>
          </DialogHeader>
          <QuizForm form={form} setForm={setForm} />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button disabled={saving} onClick={editing ? submitEdit : submitCreate}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create quiz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="bg-background border-border max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl tracking-tight">
                  {viewing.title}
                </DialogTitle>
                <DialogDescription className="font-mono text-primary">
                  {viewing.quiz_code}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <Field label="Description" value={viewing.description || "—"} />
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Status" value={viewing.status} capitalize />
                  <Field label="Duration" value={`${viewing.duration} min`} />
                  <Field label="Questions" value={String(viewing.question_count)} />
                </div>
                <Field
                  label="Created"
                  value={new Date(viewing.created_at).toLocaleString()}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="bg-background border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Delete quiz?</DialogTitle>
            <DialogDescription>
              This permanently removes "{deleting?.title}". This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "primary" | "secondary" | "accent";
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs font-mono uppercase tracking-widest text-foreground/50 mb-2">{label}</p>
      <p
        className={`font-display text-3xl md:text-4xl tracking-tight ${
          tone === "primary"
            ? "text-primary"
            : tone === "secondary"
              ? "text-secondary"
              : "text-accent"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-foreground/50">{label}</p>
      <p className={`mt-1 ${capitalize ? "capitalize" : ""}`}>{value}</p>
    </div>
  );
}

function QuizForm({
  form,
  setForm,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="e.g. World Capitals Rapid Round"
        />
      </div>
      <div>
        <Label htmlFor="desc">Description</Label>
        <Input
          id="desc"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Short summary for participants"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="code">Quiz Code</Label>
          <div className="flex gap-2">
            <Input
              id="code"
              value={form.quiz_code}
              onChange={(e) => setForm({ ...form, quiz_code: e.target.value.toUpperCase() })}
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setForm({ ...form, quiz_code: generateQuizCode() })}
            >
              ↻
            </Button>
          </div>
        </div>
        <div>
          <Label htmlFor="duration">Duration (min)</Label>
          <Input
            id="duration"
            type="number"
            min={1}
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) => setForm({ ...form, status: v as QuizStatus })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="qcount">Questions</Label>
          <Input
            id="qcount"
            type="number"
            min={0}
            value={form.question_count}
            onChange={(e) =>
              setForm({ ...form, question_count: Number(e.target.value) || 0 })
            }
          />
        </div>
      </div>
    </div>
  );
}
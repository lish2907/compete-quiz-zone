import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Pencil, Trash2, Plus, Search, Upload, ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/qv/Navbar";
import { Footer } from "@/components/qv/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { OPTIONS, DIFFICULTIES, type Difficulty, type OptionKey } from "@/lib/quiz-utils";

export const Route = createFileRoute("/questions")({
  head: () => ({
    meta: [
      { title: "Question Bank — QuizVerse" },
      { name: "description", content: "Manage QuizVerse question bank." },
    ],
  }),
  component: QuestionsPage,
});

type Question = {
  id: string;
  question: string;
  option_a: string; option_b: string; option_c: string; option_d: string;
  correct_option: string;
  category: string | null;
  difficulty: string | null;
  created_at: string | null;
};

type QForm = {
  question: string;
  option_a: string; option_b: string; option_c: string; option_d: string;
  correct_option: OptionKey;
  category: string;
  difficulty: Difficulty;
};

const emptyForm = (): QForm => ({
  question: "", option_a: "", option_b: "", option_c: "", option_d: "",
  correct_option: "A", category: "General", difficulty: "medium",
});

function QuestionsPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [diff, setDiff] = useState<string>("all");
  const [editing, setEditing] = useState<Question | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Question | null>(null);
  const [form, setForm] = useState<QForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) { navigate({ to: "/login" }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (!(roles ?? []).some((r) => r.role === "admin")) {
        toast.error("Admin access required"); navigate({ to: "/" }); return;
      }
      setAuthChecked(true);
    })();
  }, [navigate]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("questions").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as Question[]);
    setLoading(false);
  };
  useEffect(() => { if (authChecked) load(); }, [authChecked]);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category || "General"))),
    [items]
  );

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items.filter((q) => {
      const ms = !t || q.question.toLowerCase().includes(t);
      const mc = cat === "all" || (q.category || "General") === cat;
      const md = diff === "all" || (q.difficulty || "medium") === diff;
      return ms && mc && md;
    });
  }, [items, search, cat, diff]);

  const openEdit = (q: Question) => {
    setForm({
      question: q.question,
      option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
      correct_option: (q.correct_option as OptionKey) || "A",
      category: q.category || "General",
      difficulty: (q.difficulty as Difficulty) || "medium",
    });
    setEditing(q);
  };

  const validate = (f: QForm) => {
    if (!f.question.trim()) return "Question is required";
    if (!f.option_a.trim() || !f.option_b.trim() || !f.option_c.trim() || !f.option_d.trim())
      return "All four options are required";
    if (!OPTIONS.includes(f.correct_option)) return "Correct option must be A, B, C, or D";
    return null;
  };

  const submit = async () => {
    const err = validate(form);
    if (err) return toast.error(err);
    setSaving(true);
    const payload = {
      question: form.question.trim(),
      option_a: form.option_a.trim(), option_b: form.option_b.trim(),
      option_c: form.option_c.trim(), option_d: form.option_d.trim(),
      correct_option: form.correct_option,
      category: form.category.trim() || "General",
      difficulty: form.difficulty,
    };
    const res = editing
      ? await supabase.from("questions").update(payload).eq("id", editing.id)
      : await supabase.from("questions").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Question updated" : "Question added");
    setCreating(false); setEditing(null); setForm(emptyForm()); load();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("questions").delete().eq("id", deleting.id);
    if (error) return toast.error(error.message);
    toast.success("Question deleted"); setDeleting(null); load();
  };

  const onFile = async (file: File) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      const valid: any[] = [];
      const errors: string[] = [];
      rows.forEach((r, i) => {
        const get = (k: string) => String(r[k] ?? r[k.toUpperCase()] ?? "").trim();
        const q = get("question"); const a = get("option_a"); const b = get("option_b");
        const c = get("option_c"); const d = get("option_d");
        const co = get("correct_option").toUpperCase();
        if (!q || !a || !b || !c || !d) { errors.push(`Row ${i + 2}: missing fields`); return; }
        if (!OPTIONS.includes(co as OptionKey)) { errors.push(`Row ${i + 2}: correct_option must be A/B/C/D`); return; }
        valid.push({
          question: q, option_a: a, option_b: b, option_c: c, option_d: d,
          correct_option: co,
          category: get("category") || "General",
          difficulty: (get("difficulty").toLowerCase() || "medium"),
        });
      });
      if (valid.length === 0) { toast.error(`No valid rows. ${errors[0] ?? ""}`); return; }
      const { error } = await supabase.from("questions").insert(valid);
      if (error) toast.error(error.message);
      else toast.success(`Imported ${valid.length} questions${errors.length ? ` (${errors.length} skipped)` : ""}`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (!authChecked) return <div className="min-h-screen mesh-gradient flex items-center justify-center"><p className="font-mono text-foreground/60 text-sm">Verifying admin access…</p></div>;

  return (
    <div className="min-h-screen mesh-gradient">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-16">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-primary mb-6">
          <ArrowLeft className="size-4" /> Back to Admin
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-primary mb-2">Question Bank</p>
            <h1 className="font-display text-4xl md:text-5xl tracking-tight">All Questions</h1>
            <p className="text-foreground/60 mt-2">Manage and import questions used across quizzes.</p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            <Button variant="outline" disabled={importing} onClick={() => fileRef.current?.click()}>
              <Upload /> {importing ? "Importing…" : "Import CSV/XLSX"}
            </Button>
            <Button onClick={() => { setForm(emptyForm()); setCreating(true); }}>
              <Plus /> Add Question
            </Button>
          </div>
        </div>

        <div className="glass rounded-2xl p-4 mb-4 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground/40" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions…" className="pl-9 h-10 bg-background/40" />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="md:w-44 h-10 bg-background/40"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={diff} onValueChange={setDiff}>
            <SelectTrigger className="md:w-44 h-10 bg-background/40"><SelectValue placeholder="Difficulty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All difficulties</SelectItem>
              {DIFFICULTIES.map((d) => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Question</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Correct</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-foreground/50 text-sm">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-foreground/50 text-sm">No questions yet.</TableCell></TableRow>
              ) : filtered.map((q) => (
                <TableRow key={q.id} className="border-border">
                  <TableCell className="max-w-md"><div className="font-medium line-clamp-2">{q.question}</div></TableCell>
                  <TableCell className="text-xs text-foreground/70">{q.category || "General"}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{q.difficulty || "medium"}</Badge></TableCell>
                  <TableCell className="font-mono text-primary">{q.correct_option}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(q)}><Pencil /></Button>
                      <Button size="icon" variant="ghost" className="hover:text-destructive" onClick={() => setDeleting(q)}><Trash2 /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-foreground/40 mt-3 font-mono">
          CSV/XLSX columns: question, option_a, option_b, option_c, option_d, correct_option, category, difficulty
        </p>
      </main>
      <Footer />

      <Dialog open={creating || !!editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); }}}>
        <DialogContent className="bg-background border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-tight">{editing ? "Edit Question" : "Add Question"}</DialogTitle>
            <DialogDescription>Multiple-choice with one correct answer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>Question</Label>
              <Textarea value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(["a", "b", "c", "d"] as const).map((k) => (
                <div key={k}>
                  <Label>Option {k.toUpperCase()}</Label>
                  <Input value={form[`option_${k}` as const] as string} onChange={(e) => setForm({ ...form, [`option_${k}`]: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Correct</Label>
                <Select value={form.correct_option} onValueChange={(v) => setForm({ ...form, correct_option: v as OptionKey })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div>
                <Label>Difficulty</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v as Difficulty })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DIFFICULTIES.map((d) => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</Button>
            <Button disabled={saving} onClick={submit}>{saving ? "Saving…" : editing ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="bg-background border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Delete question?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

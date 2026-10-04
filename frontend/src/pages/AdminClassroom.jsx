import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Plus, Save, Trash2, CheckCircle2, AlertTriangle, FileText, ClipboardList } from "lucide-react";
import { api, getToken } from "@/lib/api";

export default function AdminClassroom() {
  const { programId } = useParams(); const navigate = useNavigate(); const [program, setProgram] = useState(null); const [lessons, setLessons] = useState([]); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { try { const [p, l] = await Promise.all([api.get(`/programs/${programId}`), api.get(`/admin/programs/${programId}/lessons`)]); setProgram(p.data); setLessons(l.data); } catch { toast.error("Classroom could not be loaded"); } finally { setLoading(false); } }, [programId]);
  useEffect(() => { if (!getToken()) { navigate("/admin/login"); return; } refresh(); }, [navigate, refresh]);
  const saveFinalProject = async () => { try { await api.put(`/admin/programs/${programId}`, program); toast.success("Final project settings saved"); } catch { toast.error("Could not save final project settings"); } };
  const deleteLesson = async (id) => { if (!window.confirm("Delete this class?")) return; await api.delete(`/admin/programs/${programId}/lessons/${id}`); toast.success("Class deleted"); refresh(); };
  if (loading) return <div data-testid="admin-classroom-loading" className="min-h-screen bg-[#090A0F] grid place-items-center text-zinc-400">Loading classroom builder...</div>;
  return <main className="min-h-screen bg-[#090A0F] px-6 py-10"><div className="max-w-5xl mx-auto"><button data-testid="back-to-admin-button" onClick={() => navigate("/admin")} className="inline-flex gap-2 items-center text-sm text-zinc-400 hover:text-white"><ArrowLeft className="w-4 h-4" /> Admin programs</button><p className="text-xs text-[#FBBF24] uppercase tracking-widest mt-8">Classroom builder</p><h1 data-testid="admin-classroom-title" className="font-condensed font-black text-5xl sm:text-6xl">{program?.title}</h1><p className="text-zinc-400 mt-3">Add YouTube classes, mixed-format quizzes, and selected class-project PDF requirements.</p><div className="grid lg:grid-cols-[1fr_1.1fr] gap-8 mt-10"><section><div className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-[#34D399]" /><h2 className="font-condensed font-black text-3xl">Published classes</h2></div><div data-testid="admin-lesson-list" className="mt-4 space-y-3">{lessons.length === 0 && <div data-testid="admin-lessons-empty" className="text-zinc-500">No classes added yet.</div>}{lessons.map((lesson) => <article key={lesson.id} data-testid={`admin-lesson-${lesson.id}`} className="border border-[#272B3C] bg-[#12141D] p-5 rounded-xl"><div className="flex justify-between gap-3"><div><p className="text-xs text-[#FBBF24]">Class {lesson.position}</p><h3 className="font-condensed font-black text-2xl">{lesson.title}</h3><p className="text-sm text-zinc-500 mt-1">{lesson.quiz_questions.length} quiz question(s){lesson.requires_project ? " · PDF project required" : ""}</p></div><button data-testid={`delete-lesson-${lesson.id}`} onClick={() => deleteLesson(lesson.id)} className="h-9 w-9 grid place-items-center border border-red-500/40 text-red-400 rounded-full"><Trash2 className="w-4 h-4" /></button></div></article>)}</div><section className="mt-8 border border-[#FBBF24]/40 bg-[#12141D] rounded-xl p-5"><h2 className="font-condensed font-black text-2xl">Final project</h2><label className="mt-4 flex items-center gap-2 text-sm text-zinc-300"><input data-testid="final-project-enabled" type="checkbox" checked={program?.final_project_enabled ?? true} onChange={(e) => setProgram({ ...program, final_project_enabled: e.target.checked })} /> Require one final PDF</label><textarea data-testid="final-project-instructions" value={program?.final_project_instructions || ""} onChange={(e) => setProgram({ ...program, final_project_instructions: e.target.value })} className={`${inputClass} h-24 py-3 mt-4`} placeholder="Final PDF instructions" /><button data-testid="save-final-project-button" onClick={saveFinalProject} className={buttonClass}><Save className="w-4 h-4" /> Save final project</button></section></section><LessonBuilder programId={programId} nextPosition={lessons.length + 1} onSaved={refresh} /></div><SubmissionsReview programId={programId} /></div></main>;
}

function LessonBuilder({ programId, nextPosition, onSaved }) {
  const [form, setForm] = useState({ title: "", description: "", video_url: "", position: nextPosition, requires_project: false, project_instructions: "", quiz_pass_score: 60, quiz_questions: [] }); const [saving, setSaving] = useState(false);
  useEffect(() => setForm((current) => ({ ...current, position: nextPosition })), [nextPosition]);
  const addQuestion = () => setForm({ ...form, quiz_questions: [...form.quiz_questions, { prompt: "", question_type: "mcq", options: ["", ""], correct_answer: "" }] });
  const updateQuestion = (index, patch) => setForm({ ...form, quiz_questions: form.quiz_questions.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question) });
  const submit = async (event) => { event.preventDefault(); setSaving(true); try { const payload = { ...form, position: Number(form.position), quiz_pass_score: Number(form.quiz_pass_score), quiz_questions: form.quiz_questions.map((q) => ({ ...q, options: q.question_type === "mcq" ? q.options.map((o) => o.trim()).filter(Boolean) : [], correct_answer: q.question_type === "mcq" ? q.correct_answer : null })) }; await api.post(`/admin/programs/${programId}/lessons`, payload); toast.success("Class added"); setForm({ title: "", description: "", video_url: "", position: nextPosition + 1, requires_project: false, project_instructions: "", quiz_pass_score: 60, quiz_questions: [] }); onSaved(); } catch (error) { toast.error(error?.response?.data?.detail || "Class could not be saved"); } finally { setSaving(false); } };
  return <form data-testid="lesson-builder-form" onSubmit={submit} className="border border-[#272B3C] bg-[#12141D] p-6 rounded-xl space-y-4"><div className="flex items-center gap-2"><Plus className="w-5 h-5 text-[#FBBF24]" /><h2 className="font-condensed font-black text-3xl">Add class</h2></div><input data-testid="lesson-title-input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Class title" className={inputClass} /><textarea data-testid="lesson-description-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What will interns learn?" className={`${inputClass} h-20 py-3`} /><input data-testid="lesson-youtube-input" required value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." className={inputClass} /><div className="grid grid-cols-2 gap-3"><input data-testid="lesson-position-input" type="number" min="1" required value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Class number" className={inputClass} /><input data-testid="lesson-pass-score-input" type="number" min="0" max="100" required value={form.quiz_pass_score} onChange={(e) => setForm({ ...form, quiz_pass_score: e.target.value })} placeholder="Pass score" className={inputClass} /></div><label className="flex gap-2 items-center text-sm text-zinc-300"><input data-testid="lesson-project-required" type="checkbox" checked={form.requires_project} onChange={(e) => setForm({ ...form, requires_project: e.target.checked })} /> Require a project PDF after this class</label>{form.requires_project && <textarea data-testid="lesson-project-instructions" required value={form.project_instructions} onChange={(e) => setForm({ ...form, project_instructions: e.target.value })} placeholder="Class project PDF instructions" className={`${inputClass} h-20 py-3`} />}<div className="pt-3 border-t border-[#272B3C]"><div className="flex justify-between items-center"><h3 className="font-condensed font-black text-xl">Quiz questions</h3><button data-testid="add-quiz-question-button" type="button" onClick={addQuestion} className="text-sm text-[#FBBF24] hover:text-white">+ Add question</button></div>{form.quiz_questions.map((question, index) => <QuestionEditor key={index} question={question} index={index} onChange={updateQuestion} onRemove={() => setForm({ ...form, quiz_questions: form.quiz_questions.filter((_, i) => i !== index) })} />)}</div><button data-testid="save-lesson-button" disabled={saving} className={buttonClass} type="submit"><Save className="w-4 h-4" />{saving ? "Saving..." : "Publish class"}</button></form>;
}

function QuestionEditor({ question, index, onChange, onRemove }) { return <div data-testid={`quiz-question-editor-${index}`} className="mt-4 border border-[#272B3C] bg-[#181B26] p-4 rounded-lg space-y-3"><div className="flex justify-between gap-3"><span className="text-xs text-zinc-500">Question {index + 1}</span><button data-testid={`remove-question-${index}`} type="button" onClick={onRemove} className="text-xs text-red-400">Remove</button></div><select data-testid={`question-type-${index}`} value={question.question_type} onChange={(e) => onChange(index, { question_type: e.target.value, options: e.target.value === "mcq" ? ["", ""] : [], correct_answer: "" })} className={inputClass}><option value="mcq">Multiple choice</option><option value="descriptive">Descriptive answer</option></select><textarea data-testid={`question-prompt-${index}`} required value={question.prompt} onChange={(e) => onChange(index, { prompt: e.target.value })} placeholder="Question prompt" className={`${inputClass} h-20 py-3`} />{question.question_type === "mcq" && <><input data-testid={`question-options-${index}`} required value={question.options.join(", ")} onChange={(e) => onChange(index, { options: e.target.value.split(",") })} placeholder="Options, comma separated" className={inputClass} /><input data-testid={`question-correct-answer-${index}`} required value={question.correct_answer} onChange={(e) => onChange(index, { correct_answer: e.target.value })} placeholder="Correct option (exactly as written)" className={inputClass} /></>}</div>; }

const inputClass = "w-full h-11 px-4 rounded-xl bg-[#181B26] border border-[#272B3C] text-sm text-white placeholder-zinc-500";
const buttonClass = "mt-2 h-11 px-5 rounded-full bg-[#FBBF24] text-[#090A0F] font-bold inline-flex items-center gap-2 hover:bg-[#F59E0B] disabled:opacity-60";

function StatusBadge({ status }) {
  const map = {
    pending: ["border-[#FBBF24]/40 text-[#FBBF24]", "Pending review"],
    approved: ["border-[#34D399]/40 text-[#34D399]", "Approved"],
    changes_requested: ["border-red-500/40 text-red-400", "Changes requested"],
  };
  const [cls, label] = map[status] || map.pending;
  return <span data-testid="review-status-badge" className={`text-[10px] tracking-widest uppercase px-3 py-1 rounded-full border ${cls}`}>{label}</span>;
}

function ReviewControls({ testidPrefix, status, feedback, onReview }) {
  const [note, setNote] = useState(feedback || "");
  const [busy, setBusy] = useState(false);
  const act = async (newStatus) => {
    setBusy(true);
    try { await onReview(newStatus, note); } finally { setBusy(false); }
  };
  return (
    <div className="mt-3 border-t border-[#272B3C] pt-3">
      <textarea data-testid={`${testidPrefix}-feedback`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional feedback to the intern" className="w-full h-16 px-3 py-2 rounded-lg bg-[#181B26] border border-[#272B3C] text-sm text-white placeholder-zinc-500" />
      <div className="flex gap-2 mt-2">
        <button data-testid={`${testidPrefix}-approve`} disabled={busy} onClick={() => act("approved")} className="inline-flex items-center gap-1 text-xs px-4 h-9 rounded-full bg-[#34D399] text-[#090A0F] font-bold hover:bg-[#10B981] disabled:opacity-60"><CheckCircle2 className="w-3.5 h-3.5" /> Approve</button>
        <button data-testid={`${testidPrefix}-request-changes`} disabled={busy} onClick={() => act("changes_requested")} className="inline-flex items-center gap-1 text-xs px-4 h-9 rounded-full border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-60"><AlertTriangle className="w-3.5 h-3.5" /> Request changes</button>
      </div>
    </div>
  );
}

function SubmissionsReview({ programId }) {
  const [quiz, setQuiz] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [q, p] = await Promise.all([
        api.get(`/admin/programs/${programId}/quiz-submissions`),
        api.get(`/admin/programs/${programId}/project-submissions`),
      ]);
      setQuiz(q.data); setProjects(p.data);
    } catch { toast.error("Submissions could not be loaded"); }
    finally { setLoading(false); }
  }, [programId]);
  useEffect(() => { load(); }, [load]);

  const reviewQuiz = async (id, status, feedback) => {
    try {
      const r = await api.patch(`/admin/quiz-submissions/${id}/review`, { status, feedback: feedback || null });
      setQuiz((cur) => cur.map((s) => (s.id === id ? r.data : s)));
      toast.success(status === "approved" ? "Answer approved" : "Changes requested");
    } catch { toast.error("Could not save review"); }
  };
  const reviewProject = async (id, status, feedback) => {
    try {
      const r = await api.patch(`/admin/project-submissions/${id}/review`, { status, feedback: feedback || null });
      setProjects((cur) => cur.map((s) => (s.id === id ? { ...s, ...r.data } : s)));
      toast.success(status === "approved" ? "Project approved" : "Changes requested");
    } catch { toast.error("Could not save review"); }
  };
  const openProjectPdf = async (id) => {
    try {
      const res = await api.get(`/admin/project-submissions/${id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch { toast.error("Could not open PDF"); }
  };

  return (
    <section data-testid="submissions-review-section" className="mt-16 border-t border-[#272B3C] pt-10">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-[#FBBF24]" />
        <h2 className="font-condensed font-black text-3xl">Submissions &amp; reviews</h2>
      </div>
      <p className="text-zinc-400 mt-2">Review descriptive quiz answers and submitted project PDFs. Approve or request changes with feedback.</p>
      {loading ? <div data-testid="submissions-loading" className="text-zinc-500 mt-6">Loading submissions...</div> : (
        <div className="grid lg:grid-cols-2 gap-8 mt-8">
          <div>
            <h3 className="font-condensed font-black text-2xl flex items-center gap-2"><FileText className="w-5 h-5 text-[#34D399]" /> Descriptive answers</h3>
            <div data-testid="quiz-review-list" className="mt-4 space-y-4">
              {quiz.length === 0 && <div data-testid="quiz-review-empty" className="text-zinc-500">No descriptive answers submitted yet.</div>}
              {quiz.map((s) => (
                <article key={s.id} data-testid={`quiz-review-${s.id}`} className="border border-[#272B3C] bg-[#12141D] p-5 rounded-xl">
                  <div className="flex justify-between gap-3 items-start">
                    <div>
                      <p className="text-xs text-[#FBBF24]">{s.lesson_title}</p>
                      <p className="text-sm text-zinc-400">{s.intern_email}</p>
                    </div>
                    <StatusBadge status={s.review_status} />
                  </div>
                  <div className="mt-3 space-y-3">
                    {s.descriptive_answers.map((a) => (
                      <div key={a.question_id}>
                        <p className="text-sm text-zinc-300 font-medium">{a.prompt}</p>
                        <p data-testid={`quiz-answer-${s.id}`} className="text-sm text-zinc-400 mt-1 whitespace-pre-wrap bg-[#181B26] border border-[#272B3C] rounded-lg p-3">{a.answer}</p>
                      </div>
                    ))}
                  </div>
                  <ReviewControls testidPrefix={`quiz-review-${s.id}`} status={s.review_status} feedback={s.review_feedback} onReview={(status, note) => reviewQuiz(s.id, status, note)} />
                  {s.review_feedback && <p className="text-xs text-zinc-500 mt-2">Last feedback: {s.review_feedback}</p>}
                </article>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-condensed font-black text-2xl flex items-center gap-2"><FileText className="w-5 h-5 text-[#FBBF24]" /> Project PDFs</h3>
            <div data-testid="project-review-list" className="mt-4 space-y-4">
              {projects.length === 0 && <div data-testid="project-review-empty" className="text-zinc-500">No project PDFs submitted yet.</div>}
              {projects.map((s) => (
                <article key={s.id} data-testid={`project-review-${s.id}`} className="border border-[#272B3C] bg-[#12141D] p-5 rounded-xl">
                  <div className="flex justify-between gap-3 items-start">
                    <div>
                      <p className="text-xs text-[#FBBF24] uppercase tracking-widest">{s.submission_type === "final" ? "Final project" : "Class project"}</p>
                      <p className="font-medium text-zinc-200">{s.original_filename}</p>
                      <p className="text-sm text-zinc-400">{s.intern_email}</p>
                    </div>
                    <StatusBadge status={s.review_status} />
                  </div>
                  <button data-testid={`project-view-${s.id}`} onClick={() => openProjectPdf(s.id)} className="mt-3 inline-flex items-center gap-1 text-xs px-4 h-9 rounded-full border border-[#272B3C] hover:bg-[#181B26]"><FileText className="w-3.5 h-3.5" /> View PDF</button>
                  <ReviewControls testidPrefix={`project-review-${s.id}`} status={s.review_status} feedback={s.review_feedback} onReview={(status, note) => reviewProject(s.id, status, note)} />
                  {s.review_feedback && <p className="text-xs text-zinc-500 mt-2">Last feedback: {s.review_feedback}</p>}
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
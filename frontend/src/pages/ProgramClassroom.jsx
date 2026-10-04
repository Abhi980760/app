import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, CirclePlay, ClipboardCheck, FileUp, GraduationCap, LockKeyhole } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { API, api } from "@/lib/api";

export default function ProgramClassroom() {
  const { programId } = useParams();
  const [classroom, setClassroom] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);

  useEffect(() => {
    api.get(`/programs/${programId}/classroom`).then((response) => {
      setClassroom(response.data);
      setActiveLesson(response.data.lessons[0]?.id || null);
    }).catch(() => toast.error("This internship classroom is unavailable."));
  }, [programId]);

  if (!classroom) return <div data-testid="classroom-loading" className="min-h-screen bg-[#090A0F] text-zinc-400 grid place-items-center">Loading classroom...</div>;
  const { program, lessons } = classroom;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-[1200px] mx-auto px-6 lg:px-10 py-12">
        <div className="max-w-3xl">
          <p className="text-xs text-[#FBBF24] tracking-[0.3em] uppercase">Internship classroom</p>
          <h1 data-testid="classroom-program-title" className="font-condensed font-black text-5xl sm:text-6xl mt-2">{program.title}</h1>
          <p className="text-zinc-400 mt-4">Choose a class, learn from the video, complete the quiz, and submit projects where required.</p>
        </div>
        <section data-testid="classroom-lessons-list" className="mt-10 space-y-4">
          {lessons.length === 0 && <div data-testid="classroom-empty" className="border border-[#272B3C] bg-[#12141D] rounded-xl p-7 text-zinc-400">Classes will be added here soon.</div>}
          {lessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} programId={programId} open={activeLesson === lesson.id} onToggle={() => setActiveLesson(activeLesson === lesson.id ? null : lesson.id)} />
          ))}
        </section>
        {program.final_project_enabled && <FinalProject programId={programId} instructions={program.final_project_instructions} />}
      </main>
      <Footer />
    </div>
  );
}

function LessonCard({ lesson, programId, open, onToggle }) {
  return (
    <article data-testid={`classroom-lesson-${lesson.id}`} className="border border-[#272B3C] bg-[#12141D] rounded-xl overflow-hidden">
      <button data-testid={`classroom-toggle-${lesson.id}`} onClick={onToggle} className="w-full p-6 flex items-center gap-4 text-left hover:bg-[#181B26] transition">
        <span className="shrink-0 w-10 h-10 rounded-md bg-[#FBBF24]/10 text-[#FBBF24] grid place-items-center font-condensed font-black text-xl">{lesson.position}</span>
        <span className="flex-1"><span className="font-condensed font-black text-2xl block">{lesson.title}</span><span className="text-sm text-zinc-400 mt-1 block">{lesson.description || "Watch the class and complete the learning check."}</span></span>
        <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-[#272B3C] p-6 space-y-7 animate-in fade-in duration-300">
        <div className="aspect-video bg-black rounded-lg overflow-hidden border border-[#272B3C]">
          <iframe data-testid={`lesson-video-${lesson.id}`} title={lesson.title} className="w-full h-full" src={toEmbedUrl(lesson.video_url)} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
        {lesson.quiz_questions.length > 0 && <QuizForm lesson={lesson} programId={programId} />}
        {lesson.requires_project && <ProjectUploader programId={programId} lessonId={lesson.id} type="class" title="Class project PDF" instructions={lesson.project_instructions} />}
      </div>}
    </article>
  );
}

function QuizForm({ lesson, programId }) {
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setLoading(true);
    try {
      const response = await api.post(`/programs/${programId}/lessons/${lesson.id}/quiz`, { intern_email: email, answers: lesson.quiz_questions.map((q) => ({ question_id: q.id, answer: answers[q.id] || "" })) });
      setResult(response.data); toast.success("Quiz submitted");
    } catch (error) { toast.error(error?.response?.data?.detail || "Quiz could not be submitted"); } finally { setLoading(false); }
  };
  return <form data-testid={`lesson-quiz-${lesson.id}`} onSubmit={submit} className="border-t border-[#272B3C] pt-7 space-y-5">
    <div className="flex items-center gap-2 text-[#34D399]"><ClipboardCheck className="w-5 h-5" /><h2 className="font-condensed font-black text-2xl">Knowledge check</h2></div>
    <input data-testid={`quiz-email-${lesson.id}`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email used for your application" className={inputClass} />
    {lesson.quiz_questions.map((question, index) => <div key={question.id}><p className="text-sm text-zinc-200 mb-2">{index + 1}. {question.prompt}</p>{question.question_type === "mcq" ? <select data-testid={`quiz-answer-${question.id}`} required value={answers[question.id] || ""} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })} className={inputClass}><option value="">Choose an answer</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <textarea data-testid={`quiz-answer-${question.id}`} required value={answers[question.id] || ""} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })} className={`${inputClass} h-24 py-3`} placeholder="Write your answer" />}</div>)}
    <button data-testid={`quiz-submit-${lesson.id}`} disabled={loading} className={primaryButton} type="submit"><CheckCircle2 className="w-4 h-4" />{loading ? "Checking..." : `Submit quiz · pass ${lesson.quiz_pass_score}%`}</button>
    {result && <p data-testid={`quiz-result-${lesson.id}`} className="text-sm text-[#34D399]">{result.score !== null ? `Score: ${result.score}% · ${result.passed ? "Passed" : "Try again after reviewing the class"}` : "Descriptive response submitted for review"}{result.descriptive_pending_review ? " · Descriptive answers are pending review." : ""}</p>}
  </form>;
}

function FinalProject({ programId, instructions }) {
  return <section data-testid="final-project-section" className="mt-12 border border-[#FBBF24]/40 bg-[#12141D] rounded-xl p-7"><div className="flex items-center gap-3 text-[#FBBF24]"><GraduationCap className="w-6 h-6" /><div><p className="text-xs tracking-widest uppercase">Internship finale</p><h2 className="font-condensed font-black text-3xl text-white">Final project</h2></div></div><ProjectUploader programId={programId} type="final" title="Final project PDF" instructions={instructions} /></section>;
}

function ProjectUploader({ programId, lessonId, type, title, instructions }) {
  const [email, setEmail] = useState(""); const [file, setFile] = useState(null); const [uploading, setUploading] = useState(false); const [download, setDownload] = useState(null);
  const submit = async (event) => { event.preventDefault(); if (!file) return; setUploading(true); try { const form = new FormData(); form.append("intern_email", email); form.append("submission_type", type); if (lessonId) form.append("lesson_id", lessonId); form.append("file", file); const response = await api.post(`/programs/${programId}/project-submissions`, form); localStorage.setItem(`zi-submission-${response.data.id}`, response.data.receipt_token); setDownload(response.data); toast.success("Project PDF submitted"); } catch (error) { toast.error(error?.response?.data?.detail || "Project upload failed"); } finally { setUploading(false); } };
  return <form data-testid={`${type}-project-upload-form${lessonId ? `-${lessonId}` : ""}`} onSubmit={submit} className="mt-5 space-y-3"><p className="text-sm text-zinc-400">{instructions}</p><input data-testid={`${type}-project-email${lessonId ? `-${lessonId}` : ""}`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email used for your application" className={inputClass} /><input data-testid={`${type}-project-file${lessonId ? `-${lessonId}` : ""}`} required accept="application/pdf,.pdf" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm text-zinc-400 file:mr-4 file:border-0 file:rounded-full file:bg-[#181B26] file:px-4 file:py-2 file:text-zinc-200" /><button data-testid={`${type}-project-submit${lessonId ? `-${lessonId}` : ""}`} disabled={uploading} type="submit" className={primaryButton}><FileUp className="w-4 h-4" />{uploading ? "Uploading..." : `Submit ${title}`}</button>{download && <a data-testid={`${type}-project-download-${download.id}`} className="inline-flex items-center gap-2 text-sm text-[#34D399] hover:text-white" href={`${API}/project-submissions/${download.id}/download?receipt=${encodeURIComponent(download.receipt_token)}`} target="_blank" rel="noreferrer"><LockKeyhole className="w-4 h-4" /> Download your submitted PDF</a>}</form>;
}

function toEmbedUrl(videoUrl) { try { const url = new URL(videoUrl); const id = url.hostname.includes("youtu.be") ? url.pathname.slice(1) : url.searchParams.get("v") || url.pathname.split("/").pop(); return `https://www.youtube.com/embed/${id}`; } catch { return videoUrl; } }
const inputClass = "w-full h-11 px-4 rounded-xl bg-[#181B26] border border-[#272B3C] text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#FBBF24]";
const primaryButton = "h-11 px-5 rounded-full bg-[#FBBF24] text-[#090A0F] font-bold inline-flex items-center justify-center gap-2 hover:bg-[#F59E0B] transition disabled:opacity-60";
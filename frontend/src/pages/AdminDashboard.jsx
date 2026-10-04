import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, API, clearToken, getToken } from "@/lib/api";
import { LogOut, Plus, Trash2, Download, Send, Award, Users, FileCheck, Layers, ImageUp, MessageCircle } from "lucide-react";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("certificates");
  const [stats, setStats] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [applications, setApplications] = useState([]);
  const [certificates, setCertificates] = useState([]);

  useEffect(() => {
    if (!getToken()) { navigate("/admin/login"); return; }
    refresh();
    // eslint-disable-next-line
  }, []);

  const refresh = async () => {
    try {
      const [s, p, a, c] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/programs", { params: { active_only: false } }),
        api.get("/admin/applications"),
        api.get("/admin/certificates"),
      ]);
      setStats(s.data); setPrograms(p.data); setApplications(a.data); setCertificates(c.data);
    } catch (e) {
      if (e?.response?.status === 401) { clearToken(); navigate("/admin/login"); }
    }
  };

  const logout = () => { clearToken(); navigate("/admin/login"); };

  return (
    <div className="min-h-screen bg-[#090A0F]">
      <header className="border-b border-[#272B3C] bg-[#090A0F]/85 backdrop-blur sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#34D399] to-[#FBBF24] flex items-center justify-center font-condensed font-black text-[#0B132B]">Z</div>
            <div>
              <div className="font-condensed font-black text-xl leading-none">ZoomIntern</div>
              <div className="text-[10px] tracking-widest uppercase text-zinc-500">Admin</div>
            </div>
          </div>
          <button data-testid="admin-logout-btn" onClick={logout} className="text-sm inline-flex items-center gap-2 px-4 h-9 rounded-full border border-[#272B3C] hover:bg-[#12141D]">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10">
        <h1 className="font-condensed font-black text-5xl sm:text-6xl">Command center.</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <StatCard icon={<Layers className="w-4 h-4" />} label="Programs" value={stats?.programs} testid="stat-programs" />
          <StatCard icon={<Users className="w-4 h-4" />} label="Applications" value={stats?.applications} testid="stat-applications" />
          <StatCard icon={<FileCheck className="w-4 h-4" />} label="Pending review" value={stats?.pending_review} testid="stat-pending" />
          <StatCard icon={<Award className="w-4 h-4" />} label="Certificates" value={stats?.certificates} testid="stat-certificates" />
        </div>

        <div className="border-b border-[#272B3C] mt-10 flex gap-6">
          {[
            ["certificates", "Certificates"],
            ["applications", "Applications"],
            ["programs", "Programs"],
          ].map(([id, label]) => (
            <button
              key={id}
              data-testid={`tab-${id}`}
              onClick={() => setTab(id)}
              className={`pb-3 -mb-px border-b-2 text-sm font-medium ${tab === id ? "border-[#FBBF24] text-[#FBBF24]" : "border-transparent text-zinc-400 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {tab === "certificates" && <CertificatesTab certificates={certificates} programs={programs} refresh={refresh} />}
          {tab === "applications" && <ApplicationsTab applications={applications} refresh={refresh} />}
          {tab === "programs" && <ProgramsTab programs={programs} refresh={refresh} />}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, testid }) {
  return (
    <div data-testid={testid} className="rounded-2xl border border-[#272B3C] bg-[#12141D] p-5">
      <div className="flex items-center gap-2 text-zinc-500 text-[10px] tracking-widest uppercase mb-3">{icon} {label}</div>
      <div className="font-condensed font-black text-4xl">{value ?? "–"}</div>
    </div>
  );
}

function CertificatesTab({ certificates, programs, refresh }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ intern_name: "", intern_email: "", intern_phone: "", area: "", start_date: "", end_date: "", issue_date: today, send_email: true });
  const [loading, setLoading] = useState(false);
  const [signature, setSignature] = useState(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  useEffect(() => {
    api.get("/admin/signature").then((response) => setSignature(response.data)).catch(() => setSignature(null));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.intern_name || !form.intern_email || !form.area || !form.start_date || !form.end_date) {
      toast.error("Please fill all required fields");
      return;
    }
    setLoading(true);
    try {
      const r = await api.post("/admin/certificates", form);
      toast.success(`Certificate ${r.data.certificate_id} issued${r.data.email_sent ? " and emailed" : ""}`);
      setForm({ intern_name: "", intern_email: "", intern_phone: "", area: "", start_date: "", end_date: "", issue_date: today, send_email: true });
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to issue certificate");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (cid) => {
    if (!window.confirm(`Delete certificate ${cid}?`)) return;
    await api.delete(`/admin/certificates/${cid}`);
    toast.success("Deleted");
    refresh();
  };
  const resend = async (cid) => {
    try { await api.post(`/admin/certificates/${cid}/resend`); toast.success("Email re-sent"); refresh(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Email failed"); }
  };

  const uploadSignature = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingSignature(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await api.post("/admin/signature", data);
      setSignature(response.data);
      toast.success("CEO signature will appear on new certificate PDFs");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Signature upload failed");
    } finally {
      setUploadingSignature(false);
      event.target.value = "";
    }
  };

  const shareWhatsApp = async (cid) => {
    try {
      const response = await api.post(`/admin/certificates/${cid}/whatsapp`);
      window.open(response.data.url, "_blank", "noopener,noreferrer");
      toast.success("WhatsApp message is ready to send");
      refresh();
    } catch (error) { toast.error(error?.response?.data?.detail || "WhatsApp sharing is unavailable"); }
  };

  return (
    <div>
      <div className="rounded-2xl border border-[#272B3C] bg-[#12141D] p-6">
        <div className="flex items-center gap-2 mb-1"><Award className="w-5 h-5 text-[#FBBF24]" /><h3 className="font-condensed font-black text-2xl">Issue certificate</h3></div>
        <p className="text-sm text-zinc-500 mb-5">Recipient gets an email with the PDF and their registry ID. Fill dates and area, then issue.</p>
        <form onSubmit={submit} data-testid="issue-cert-form" className="grid md:grid-cols-2 gap-4">
          <Field label="Intern name *"><input required data-testid="intern-name-input" value={form.intern_name} onChange={(e) => setForm({ ...form, intern_name: e.target.value })} className={inputCls} placeholder="Priya Sharma" /></Field>
          <Field label="Intern email *"><input required type="email" data-testid="intern-email-input" value={form.intern_email} onChange={(e) => setForm({ ...form, intern_email: e.target.value })} className={inputCls} placeholder="priya@example.com" /></Field>
          <Field label="WhatsApp number (optional)"><input data-testid="intern-whatsapp-input" value={form.intern_phone} onChange={(e) => setForm({ ...form, intern_phone: e.target.value })} className={inputCls} placeholder="+14155552671" /></Field>
          <Field label="Area / Program title *">
            <input required data-testid="intern-area-input" list="areas-list" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className={inputCls} placeholder="Python Programming" />
            <datalist id="areas-list">{programs.map((p) => <option key={p.id} value={p.title} />)}</datalist>
          </Field>
          <Field label="Issue date"><input type="date" data-testid="intern-issue-date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} className={inputCls} /></Field>
          <Field label="Internship start date *"><input required type="date" data-testid="intern-start-date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputCls} /></Field>
          <Field label="Internship end date *"><input required type="date" data-testid="intern-end-date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={inputCls} /></Field>
          <label className="flex items-center gap-2 md:col-span-2 text-sm text-zinc-300">
            <input data-testid="send-email-toggle" type="checkbox" checked={form.send_email} onChange={(e) => setForm({ ...form, send_email: e.target.checked })} />
            Send certificate PDF to intern via email
          </label>
          <button type="submit" disabled={loading} data-testid="issue-cert-submit-btn" className="md:col-span-2 h-12 rounded-full bg-[#FBBF24] text-[#090A0F] font-bold hover:bg-[#F59E0B] disabled:opacity-60">
            {loading ? "Issuing..." : "Issue certificate"}
          </button>
        </form>
      </div>

      <div data-testid="signature-upload-panel" className="mt-5 border border-[#272B3C] bg-[#12141D] p-5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="font-condensed font-black text-xl">CEO signature</div>
          <p data-testid="signature-upload-status" className="text-sm text-zinc-500 mt-1">{signature?.uploaded ? `${signature.filename} uploaded — used in certificate PDFs.` : "Using the generated signature until an image is uploaded."}</p>
        </div>
        <label data-testid="signature-upload-label" className="h-10 px-4 rounded-full border border-[#FBBF24]/50 text-[#FBBF24] hover:bg-[#FBBF24]/10 transition inline-flex items-center gap-2 cursor-pointer text-sm font-medium">
          <ImageUp className="w-4 h-4" /> {uploadingSignature ? "Uploading..." : "Upload signature"}
          <input data-testid="signature-upload-input" onChange={uploadSignature} disabled={uploadingSignature} accept="image/png,image/jpeg,image/webp" className="sr-only" type="file" />
        </label>
      </div>

      <h4 className="font-condensed font-black text-2xl mt-10 mb-4">Recent certificates</h4>
      <div className="space-y-3">
        {certificates.length === 0 && <div className="text-sm text-zinc-500">No certificates issued yet.</div>}
        {certificates.map((c) => (
          <div key={c.id} data-testid={`cert-row-${c.certificate_id}`} className="rounded-xl border border-[#272B3C] bg-[#12141D] p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div>
              <div className="font-condensed font-black text-xl">{c.intern_name}</div>
              <div className="text-xs text-zinc-500 mt-1">{c.area} · {c.start_date} → {c.end_date} · issued {c.issue_date}</div>
              <div className="text-xs text-zinc-500 mt-1">{c.intern_email} {c.email_sent && <span className="text-[#34D399]">· email sent</span>} {c.whatsapp_shared && <span className="text-[#34D399]">· WhatsApp ready</span>}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[#FBBF24] text-sm">{c.certificate_id}</span>
              <a data-testid={`certificate-pdf-${c.certificate_id}`} href={`${API}/certificates/${c.certificate_id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs px-3 h-9 rounded-full border border-[#272B3C] hover:bg-[#181B26]"><Download className="w-3 h-3" /> PDF</a>
              <button data-testid={`certificate-resend-${c.certificate_id}`} onClick={() => resend(c.certificate_id)} className="inline-flex items-center gap-1 text-xs px-3 h-9 rounded-full border border-[#272B3C] hover:bg-[#181B26]"><Send className="w-3 h-3" /> Resend</button>
              <button data-testid={`certificate-whatsapp-${c.certificate_id}`} onClick={() => shareWhatsApp(c.certificate_id)} className="inline-flex items-center gap-1 text-xs px-3 h-9 rounded-full border border-[#34D399]/40 text-[#34D399] hover:bg-[#34D399]/10"><MessageCircle className="w-3 h-3" /> WhatsApp</button>
              <button data-testid={`certificate-delete-${c.certificate_id}`} onClick={() => remove(c.certificate_id)} className="inline-flex items-center gap-1 text-xs px-3 h-9 rounded-full border border-red-500/40 text-red-400 hover:bg-red-500/10"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApplicationsTab({ applications, refresh }) {
  const setStatus = async (id, status) => {
    await api.patch(`/admin/applications/${id}`, null, { params: { status } });
    toast.success(`Marked ${status}`);
    refresh();
  };

  return (
    <div className="space-y-3">
      {applications.length === 0 && <div className="text-sm text-zinc-500">No applications yet.</div>}
      {applications.map((a) => (
        <div key={a.id} className="rounded-xl border border-[#272B3C] bg-[#12141D] p-5 flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex-1">
            <div className="font-condensed font-black text-xl">{a.full_name}</div>
            <div className="text-xs text-zinc-500 mt-1">{a.email} {a.phone && `· ${a.phone}`} {a.university && `· ${a.university}`}</div>
            <div className="text-xs text-[#FBBF24] mt-1">Applied to: {a.program_title}</div>
            {a.motivation && <div className="text-sm text-zinc-400 mt-2">{a.motivation}</div>}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] tracking-widest uppercase px-3 py-1 rounded-full border ${
              a.status === "accepted" ? "border-[#34D399]/40 text-[#34D399]" :
              a.status === "rejected" ? "border-red-500/40 text-red-400" :
              "border-[#272B3C] text-zinc-400"
            }`}>{a.status}</span>
            <select value={a.status} onChange={(e) => setStatus(a.id, e.target.value)} className="text-xs h-9 px-3 rounded-full bg-[#181B26] border border-[#272B3C]">
              <option value="pending">pending</option>
              <option value="reviewed">reviewed</option>
              <option value="accepted">accepted</option>
              <option value="rejected">rejected</option>
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgramsTab({ programs, refresh }) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);

  const remove = async (id) => {
    if (!window.confirm("Delete this program?")) return;
    await api.delete(`/admin/programs/${id}`);
    toast.success("Deleted");
    refresh();
  };

  return (
    <div>
      <button data-testid="new-program-btn" onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-5 h-11 rounded-full bg-[#FBBF24] text-[#090A0F] font-bold hover:bg-[#F59E0B]">
        <Plus className="w-4 h-4" /> New program
      </button>
      <div className="mt-6 space-y-3">
        {programs.map((p) => (
          <div key={p.id} className="rounded-xl border border-[#272B3C] bg-[#12141D] p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div>
              <div className="font-condensed font-black text-xl">{p.title}</div>
              <div className="text-xs text-zinc-500 mt-1">{p.area} · {p.location} · {p.duration_weeks}w · {p.active ? <span className="text-[#34D399]">active</span> : <span className="text-zinc-500">inactive</span>}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditing(p)} className="text-xs px-3 h-9 rounded-full border border-[#272B3C] hover:bg-[#181B26]">Edit</button>
              <button onClick={() => remove(p.id)} className="inline-flex items-center gap-1 text-xs px-3 h-9 rounded-full border border-red-500/40 text-red-400 hover:bg-red-500/10"><Trash2 className="w-3 h-3" /> Delete</button>
            </div>
          </div>
        ))}
      </div>
      {(showNew || editing) && (
        <ProgramModal
          program={editing}
          onClose={() => { setShowNew(false); setEditing(null); }}
          onSaved={() => { setShowNew(false); setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function ProgramModal({ program, onClose, onSaved }) {
  const [form, setForm] = useState(program ? {
    title: program.title, area: program.area, location: program.location, duration_weeks: program.duration_weeks,
    tags: (program.tags || []).join(", "), description: program.description || "", active: program.active,
  } : { title: "", area: "Programming", location: "Remote", duration_weeks: 6, tags: "", description: "", active: true });

  const submit = async (e) => {
    e.preventDefault();
    const payload = { ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean), duration_weeks: parseInt(form.duration_weeks || 6, 10) };
    try {
      if (program) { await api.put(`/admin/programs/${program.id}`, payload); toast.success("Updated"); }
      else { await api.post(`/admin/programs`, payload); toast.success("Program created"); }
      onSaved();
    } catch (e) { toast.error("Save failed"); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#12141D] border border-[#272B3C] rounded-2xl p-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-condensed font-black text-2xl mb-6">{program ? "Edit program" : "New program"}</h3>
        <form onSubmit={submit} className="space-y-3">
          <input required placeholder="Title (e.g. Python Internship)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className={inputCls}>
              <option>Programming</option><option>AI & ML</option><option>Mathematics</option><option>Finance</option><option>Design</option>
            </select>
            <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="Duration (weeks)" value={form.duration_weeks} onChange={(e) => setForm({ ...form, duration_weeks: e.target.value })} className={inputCls} />
            <label className="flex items-center gap-2 text-sm text-zinc-300 h-11 px-4 rounded-xl bg-[#181B26] border border-[#272B3C]">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
            </label>
          </div>
          <input placeholder="Tags, comma separated" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={inputCls} />
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputCls} h-24 py-3`} />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-full border border-[#272B3C]">Cancel</button>
            <button type="submit" className="flex-1 h-11 rounded-full bg-[#FBBF24] text-[#090A0F] font-bold">{program ? "Save" : "Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-[10px] tracking-widest uppercase text-zinc-500 mb-1.5">{label}</div>
      {children}
    </label>
  );
}
const inputCls = "w-full h-11 px-4 rounded-xl bg-[#181B26] border border-[#272B3C] text-sm placeholder-zinc-500";

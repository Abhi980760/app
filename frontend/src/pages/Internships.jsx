import { useEffect, useState } from "react";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { api } from "@/lib/api";
import { ArrowUpRight, MapPin, Clock, X } from "lucide-react";

export default function Internships() {
  const [programs, setPrograms] = useState([]);
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get("/programs").then((r) => setPrograms(r.data)).catch(() => {});
  }, []);

  const areas = ["All", ...new Set(programs.map((p) => p.area))];
  const filtered = filter === "All" ? programs : programs.filter((p) => p.area === filter);

  return (
    <div className="min-h-screen">
      <Header />
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
        <div className="text-[#FBBF24] text-xs tracking-[0.3em] uppercase mb-3">All programs</div>
        <h1 className="font-condensed font-black text-5xl sm:text-6xl leading-tight">Explore internships.</h1>
        <p className="text-zinc-400 mt-4 max-w-2xl">Pick a track, apply in under a minute, and start building.</p>

        <div className="flex flex-wrap gap-2 mt-8">
          {areas.map((a) => (
            <button
              key={a}
              data-testid={`filter-${a}`}
              onClick={() => setFilter(a)}
              className={`px-4 h-9 rounded-full text-sm border transition ${
                filter === a ? "bg-[#FBBF24] text-[#090A0F] border-[#FBBF24]" : "border-[#272B3C] text-zinc-300 hover:border-[#FBBF24]/40"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
          {filtered.map((p) => (
            <div key={p.id} data-testid={`program-card-${p.id}`} className="rounded-2xl border border-[#272B3C] bg-[#12141D] p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] tracking-widest uppercase border border-[#38bdf8]/40 text-[#38bdf8] rounded-full px-3 py-1">{p.area}</span>
                <span className="text-[10px] tracking-widest uppercase text-zinc-500">{p.location}</span>
              </div>
              <h3 className="font-condensed font-black text-2xl">{p.title}</h3>
              <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.location}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {p.duration_weeks} weeks</span>
              </div>
              <p className="text-sm text-zinc-400 mt-3 flex-1">{p.description}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {(p.tags || []).map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-md bg-[#181B26] border border-[#272B3C]">{t}</span>
                ))}
              </div>
              <div className="flex items-center justify-between mt-6 pt-5 border-t border-[#272B3C]">
                <span className="text-xs text-[#34D399] border border-[#34D399]/40 rounded-full px-3 py-1">FREE</span>
                <button
                  data-testid={`apply-btn-${p.id}`}
                  onClick={() => setSelected(p)}
                  className="text-sm text-[#FBBF24] flex items-center gap-1 hover:text-[#F59E0B]"
                >
                  View & apply <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {selected && <ApplyModal program={selected} onClose={() => setSelected(null)} />}

      <Footer />
    </div>
  );
}

function ApplyModal({ program, onClose }) {
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", university: "", motivation: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/applications", { program_id: program.id, ...form });
      toast.success("Application submitted! We'll review and get back to you.");
      onClose();
    } catch (err) {
      toast.error("Could not submit application");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#12141D] border border-[#272B3C] rounded-2xl p-8 relative" onClick={(e) => e.stopPropagation()}>
        <button data-testid="apply-modal-close" onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        <div className="text-[#FBBF24] text-xs tracking-widest uppercase mb-1">Apply</div>
        <h3 className="font-condensed font-black text-3xl">{program.title}</h3>
        <p className="text-sm text-zinc-500 mt-1">{program.location} · {program.duration_weeks} weeks · Free</p>

        <form onSubmit={submit} className="mt-6 space-y-3" data-testid="apply-form">
          <Input placeholder="Full name" required value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} testid="apply-name" />
          <Input placeholder="Email" type="email" required value={form.email} onChange={(v) => setForm({ ...form, email: v })} testid="apply-email" />
          <Input placeholder="Phone (optional)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} testid="apply-phone" />
          <Input placeholder="University / College (optional)" value={form.university} onChange={(v) => setForm({ ...form, university: v })} testid="apply-university" />
          <textarea
            data-testid="apply-motivation"
            placeholder="Why this program? (optional)"
            value={form.motivation}
            onChange={(e) => setForm({ ...form, motivation: e.target.value })}
            className="w-full h-24 px-4 py-3 rounded-xl bg-[#181B26] border border-[#272B3C] text-sm resize-none"
          />
          <button
            type="submit"
            disabled={loading}
            data-testid="apply-submit-btn"
            className="w-full h-12 rounded-full bg-[#FBBF24] text-[#090A0F] font-bold hover:bg-[#F59E0B] disabled:opacity-60 transition"
          >
            {loading ? "Submitting..." : "Submit application"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Input({ placeholder, value, onChange, type = "text", required, testid }) {
  return (
    <input
      data-testid={testid}
      type={type}
      required={required}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-11 px-4 rounded-xl bg-[#181B26] border border-[#272B3C] text-sm placeholder-zinc-500"
    />
  );
}

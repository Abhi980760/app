import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ShieldCheck, Sparkles, BadgeCheck, Users, Wallet, Briefcase } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { api } from "@/lib/api";

export default function Home() {
  const [programs, setPrograms] = useState([]);

  useEffect(() => {
    api.get("/programs").then((r) => setPrograms(r.data.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-14 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-[#FBBF24] text-xs tracking-[0.3em] uppercase mb-6">
              <Sparkles className="w-3.5 h-3.5" /> ZoomIntern — Class of 2026
            </div>
            <h1 className="font-condensed font-black uppercase leading-[0.9] tracking-tight text-5xl sm:text-6xl lg:text-7xl">
              Real internships. <br />
              <span className="text-[#FBBF24]">Verified certificates.</span> <br />
              Futures woven here.
            </h1>
            <p className="text-zinc-400 mt-6 max-w-lg leading-relaxed">
              Free, mentor-led programs in programming, AI, mathematics, and finance — two to six weeks each.
              Finish one, and walk away with a certificate anyone on the internet can verify.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link
                to="/internships"
                data-testid="hero-apply-btn"
                className="inline-flex items-center gap-2 px-6 h-12 rounded-full bg-[#FBBF24] text-[#090A0F] font-bold hover:bg-[#F59E0B] transition"
              >
                Browse internships <ArrowUpRight className="w-4 h-4" />
              </Link>
              <Link
                to="/verify"
                className="inline-flex items-center gap-2 px-6 h-12 rounded-full border border-[#272B3C] bg-[#12141D] hover:bg-[#1F2332] transition"
              >
                <ShieldCheck className="w-4 h-4 text-[#34D399]" /> Verify a certificate
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-8 mt-14 pt-8 border-t border-[#272B3C]">
              {[
                { n: "6+", l: "Open Programs" },
                { n: "120+", l: "Industry Mentors" },
                { n: "100%", l: "Verifiable Certificates" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-condensed font-black text-4xl">{s.n}</div>
                  <div className="text-xs tracking-wider uppercase text-zinc-500 mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-3xl overflow-hidden border border-[#272B3C] shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1549692520-acc6669e2f0c?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80"
                alt="Interns coding"
                className="w-full h-[520px] object-cover"
              />
            </div>
            <div className="absolute top-6 left-6 bg-[#12141D]/95 border border-[#272B3C] backdrop-blur-md rounded-2xl px-4 py-3">
              <div className="text-[10px] tracking-widest uppercase text-zinc-500">This month</div>
              <div className="text-[#FBBF24] font-bold text-lg">32 offers sent</div>
            </div>
            <div className="absolute bottom-6 right-6 bg-[#12141D]/95 border border-[#34D399]/40 backdrop-blur-md rounded-2xl px-4 py-3 flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-[#34D399]" />
              <div>
                <div className="text-[10px] tracking-widest uppercase text-zinc-500">Certificate</div>
                <div className="text-[#34D399] font-bold text-sm">Verified ✓</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <section className="border-y border-[#272B3C] py-5 overflow-hidden">
        <div className="marquee-track">
          {[...Array(2)].map((_, i) => (
            <div className="flex gap-12 items-center text-zinc-500 text-xs tracking-[0.35em] uppercase" key={i}>
              {["Data", "Product", "Verified Certificates", "100% Free", "Real Mentorship", "Engineering", "AI & ML", "Finance"].map((t) => (
                <span key={t} className="flex items-center gap-3">
                  <span className="text-[#FBBF24]">✦</span> {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24">
        <div className="text-[#FBBF24] text-xs tracking-[0.3em] uppercase mb-4">Why ZoomIntern</div>
        <h2 className="font-condensed font-black text-4xl sm:text-5xl max-w-3xl leading-tight">
          Not another certificate mill. <span className="text-zinc-500">A launchpad for real careers.</span>
        </h2>

        <div className="grid md:grid-cols-2 gap-6 mt-14">
          <FeatureCard
            icon={<Users className="w-5 h-5 text-[#38bdf8]" />}
            title="1:1 mentorship, every week"
            desc="Senior engineers, designers, and PMs review your work line by line — not a pre-recorded video in sight."
            image="https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?crop=entropy&cs=srgb&fm=jpg&w=900&q=80"
          />
          <FeatureCard
            icon={<Wallet className="w-5 h-5 text-[#34D399]" />}
            title="100% Free"
            eyebrow="Every program, forever"
            desc="No fees, no paywalls, no premium tiers. Pick a topic, apply, and start learning — the only thing we ask for is your effort."
          />
          <FeatureCard
            icon={<BadgeCheck className="w-5 h-5 text-[#FBBF24]" />}
            title="ZI-2026-XXXX"
            eyebrow="Publicly verifiable IDs"
            desc="Every certificate carries a unique ID that employers can check in seconds on our public registry."
          />
          <FeatureCard
            icon={<Briefcase className="w-5 h-5 text-[#FBBF24]" />}
            title="Ship real production work"
            desc="No toy projects. You contribute to live products used by thousands — with your name in the commit history."
            image="https://images.unsplash.com/photo-1531482615713-2afd69097998?crop=entropy&cs=srgb&fm=jpg&w=900&q=80"
          />
        </div>
      </section>

      {/* Featured programs */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
        <div className="flex items-end justify-between mb-12">
          <div>
            <div className="text-[#FBBF24] text-xs tracking-[0.3em] uppercase mb-3">Open now</div>
            <h2 className="font-condensed font-black text-4xl sm:text-5xl">Featured programs</h2>
          </div>
          <Link to="/internships" className="text-sm text-zinc-400 hover:text-[#FBBF24] flex items-center gap-1">
            View all programs <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {programs.map((p, idx) => (
            <ProgramCard key={p.id} program={p} highlighted={idx === 0} />
          ))}
          {programs.length === 0 && [1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl border border-[#272B3C] bg-[#12141D] animate-pulse" />
          ))}
        </div>
      </section>

      {/* Certificate showcase */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <div className="text-[#FBBF24] text-xs tracking-[0.3em] uppercase mb-4">Certificates</div>
            <h2 className="font-condensed font-black text-4xl sm:text-5xl leading-tight">
              A credential that <span className="text-[#FBBF24]">proves itself.</span>
            </h2>
            <p className="text-zinc-400 mt-6 leading-relaxed">
              Finish a program and receive a gold-standard digital certificate with a unique registry ID.
              Recruiters enter the ID on our verification page and instantly see your name, program, and issue date.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              <li className="flex items-center gap-3 text-zinc-300"><span className="w-2 h-2 rounded-full bg-[#34D399]"></span> Unique tamper-proof registry ID</li>
              <li className="flex items-center gap-3 text-zinc-300"><span className="w-2 h-2 rounded-full bg-[#34D399]"></span> Instant public verification, no login needed</li>
              <li className="flex items-center gap-3 text-zinc-300"><span className="w-2 h-2 rounded-full bg-[#34D399]"></span> Signed by CEO Abhishek Singh Tomar</li>
            </ul>
            <Link to="/verify" className="mt-8 inline-flex items-center gap-2 px-6 h-12 rounded-full border border-[#FBBF24]/50 text-[#FBBF24] hover:bg-[#FBBF24]/10 transition">
              Try verification <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="relative">
            <CertificateMock />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FeatureCard({ icon, title, desc, eyebrow, image }) {
  return (
    <div className="relative rounded-2xl border border-[#272B3C] bg-[#12141D] overflow-hidden group hover:border-[#FBBF24]/40 transition">
      {image && (
        <div className="h-48 overflow-hidden">
          <img src={image} alt="" className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition duration-700" />
        </div>
      )}
      <div className="p-7">
        <div className="w-9 h-9 rounded-lg border border-[#272B3C] flex items-center justify-center mb-4">{icon}</div>
        {eyebrow && <div className="text-[10px] tracking-[0.3em] uppercase text-[#34D399] mb-2">{eyebrow}</div>}
        <h3 className="font-condensed font-black text-2xl tracking-tight">{title}</h3>
        <p className="text-sm text-zinc-400 mt-3 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function ProgramCard({ program, highlighted }) {
  return (
    <Link
      to="/internships"
      className={`block rounded-2xl border ${highlighted ? "border-[#FBBF24]/70" : "border-[#272B3C]"} bg-[#12141D] p-6 hover:border-[#FBBF24]/50 hover:-translate-y-0.5 transition`}
    >
      <div className="flex items-center justify-between mb-6">
        <span className="text-[10px] tracking-widest uppercase border border-[#38bdf8]/40 text-[#38bdf8] rounded-full px-3 py-1">{program.area}</span>
        <span className="text-[10px] tracking-widest uppercase text-zinc-500">{program.location}</span>
      </div>
      <h3 className={`font-condensed font-black text-2xl ${highlighted ? "text-[#FBBF24]" : "text-white"}`}>{program.title}</h3>
      <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
        <span>📍 {program.location}</span>
        <span>⏱ {program.duration_weeks} weeks</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {(program.tags || []).slice(0, 3).map((t) => (
          <span key={t} className="text-xs px-2.5 py-1 rounded-md bg-[#181B26] border border-[#272B3C]">{t}</span>
        ))}
      </div>
      <div className="flex items-center justify-between mt-6 pt-5 border-t border-[#272B3C]">
        <span className="text-xs text-[#34D399] border border-[#34D399]/40 rounded-full px-3 py-1">FREE</span>
        <span className="text-sm text-[#FBBF24] flex items-center gap-1">View & apply <ArrowUpRight className="w-3.5 h-3.5" /></span>
      </div>
    </Link>
  );
}

function CertificateMock() {
  return (
    <div className="rounded-2xl bg-[#0B132B] border-[6px] border-[#D97706] p-6 shadow-2xl">
      <div className="border border-[#D97706]/60 rounded-lg bg-[#FBF9F2] text-[#0B132B] p-8 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center text-[#D4A24A]/10 font-serif-cert text-[220px] font-black">ZI</div>
        <div className="relative">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-[#0B132B] flex items-center justify-center text-[#D4A24A] font-serif-cert font-bold text-xl">ZI</div>
          </div>
          <div className="text-center text-[10px] tracking-[0.4em] mt-2 text-[#0B132B]">Z O O M I N T E R N</div>
          <h3 className="text-center font-serif-cert font-black text-4xl mt-3 tracking-wide">CERTIFICATE</h3>
          <div className="flex items-center justify-center gap-3 mt-1">
            <span className="h-px w-8 bg-[#D97706]"></span>
            <span className="text-[10px] tracking-widest text-[#D97706]">OF COMPLETION</span>
            <span className="h-px w-8 bg-[#D97706]"></span>
          </div>
          <div className="text-center italic text-xs text-slate-500 mt-4">This certificate is proudly presented to</div>
          <div className="text-center font-serif-cert italic font-black text-3xl mt-3">Priya Sharma</div>
          <div className="h-px bg-[#D97706] mx-auto mt-1 w-40"></div>
          <p className="text-center text-xs text-slate-600 mt-4 leading-relaxed">
            for successfully completing the 6-week Internship Program in <b>Python Programming</b> at ZoomIntern,
            and demonstrating dedication, professionalism and a strong commitment to learning.
          </p>
          <div className="grid grid-cols-4 gap-2 mt-6 text-center">
            {[
              ["INTERNSHIP START", "04 May 2026"],
              ["INTERNSHIP END", "12 Jun 2026"],
              ["DURATION", "6 Weeks"],
              ["ISSUE DATE", "15 Jun 2026"],
            ].map(([l, v]) => (
              <div key={l}>
                <div className="text-[8px] tracking-widest text-[#D97706] font-bold">{l}</div>
                <div className="font-serif-cert font-bold text-sm mt-0.5">{v}</div>
              </div>
            ))}
          </div>
          <div className="flex items-end justify-between mt-6">
            <div className="flex items-center gap-2">
              <div className="w-14 h-14 bg-[#0B132B] rounded" />
              <div>
                <div className="text-[8px] font-bold text-[#D97706]">CERTIFICATE ID</div>
                <div className="font-serif-cert font-bold text-sm text-[#0B132B]">ZI-2026-4821</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-signature text-2xl text-[#0B132B] leading-none">Abhishek Singh Tomar</div>
              <div className="h-px bg-[#0B132B] mt-1"></div>
              <div className="text-[9px] font-bold text-[#0B132B] mt-1">Abhishek Singh Tomar</div>
              <div className="text-[8px] text-[#D97706] font-bold">CEO & FOUNDER, ZOOMINTERN</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

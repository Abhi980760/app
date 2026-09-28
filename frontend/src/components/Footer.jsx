export default function Footer() {
  return (
    <footer className="border-t border-[#272B3C] mt-24 py-10 px-6 lg:px-10">
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="font-condensed font-black text-2xl">
            Zoom<span className="text-[#FBBF24]">Intern</span>
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Real internships. Verified certificates. Built by Abhishek Singh Tomar.
          </p>
        </div>
        <div className="text-xs text-zinc-500 tracking-wider uppercase">
          © {new Date().getFullYear()} ZoomIntern · All rights reserved
        </div>
      </div>
    </footer>
  );
}

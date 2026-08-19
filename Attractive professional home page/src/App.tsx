import { useEffect, useRef, useState } from "react";
import OsianLogo from "./imports/osian-logo-transparent.svg";

function useReveal(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => el.classList.add("visible"), delay);
          obs.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return ref;
}

// ── Navbar ─────────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "nav-glass" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2 group">
          <img src={OsianLogo} alt="Osian" className="h-9 w-auto" />
        </a>

        <nav className="hidden md:flex items-center gap-1">
          <a href="#" className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 rounded-lg transition-all duration-150">
            Courses
          </a>
        </nav>

        <button className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors" onClick={() => setMenuOpen(!menuOpen)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            {menuOpen
              ? <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
              : <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
            }
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden nav-glass border-t border-slate-100 px-6 py-4">
          <a href="#" className="block px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">Courses</a>
        </div>
      )}
    </header>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────────
const FEATURED_COURSES = [
  { title: "Full-Stack Web Dev", tag: "Bestseller", students: "14.2k", color: "from-violet-500 to-indigo-500" },
  { title: "Machine Learning A–Z", tag: "New", students: "9.8k", color: "from-sky-500 to-cyan-400" },
  { title: "UI/UX Design Mastery", tag: "Top rated", students: "11.1k", color: "from-pink-500 to-rose-400" },
];

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="blob absolute -top-40 -right-40 w-[600px] h-[600px] bg-violet-100 opacity-60 animate-float" style={{ animationDuration: "9s" }}/>
        <div className="blob absolute bottom-0 -left-20 w-[400px] h-[400px] bg-indigo-100 opacity-50 animate-float" style={{ animationDuration: "11s", animationDelay: "-4s" }}/>
        <div className="blob absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-sky-100 opacity-40 animate-float" style={{ animationDuration: "7s", animationDelay: "-2s" }}/>
        <div className="grid-bg absolute inset-0 opacity-50" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 60% 50%, transparent 20%, white 90%)" }}/>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-sm font-medium mb-7 animate-slide-up">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
            50,000+ students already enrolled
          </div>

          <h1
            style={{ fontFamily: "var(--font-display)", lineHeight: 1.05, letterSpacing: "-0.04em" }}
            className="text-5xl md:text-7xl font-800 text-slate-900 mb-6 opacity-0 animate-slide-up delay-100"
          >
            Learn tech skills
            <br />
            that{" "}
            <span className="relative inline-block">
              <span className="gradient-text">actually</span>
            </span>
            <br />
            get you hired.
          </h1>

          <p className="text-lg text-slate-500 leading-relaxed mb-8 max-w-lg opacity-0 animate-slide-up delay-200">
            Osian offers project-based courses in web development, AI, design, and cloud — taught by senior engineers from top companies. No fluff, just skills.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-10 opacity-0 animate-slide-up delay-300">
            <a href="#" className="group flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl text-white font-semibold text-base bg-gradient-to-r from-violet-600 to-indigo-500 shadow-lg shadow-violet-200 hover:shadow-xl hover:shadow-violet-300 hover:-translate-y-0.5 transition-all duration-200 active:scale-95">
              Browse courses
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="group-hover:translate-x-0.5 transition-transform">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <a href="#" className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-slate-700 font-semibold text-base bg-white border border-slate-200 hover:border-slate-300 hover:-translate-y-0.5 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <circle cx="7.5" cy="7.5" r="6.5" stroke="#475569" strokeWidth="1.2"/>
                <path d="M6 5.5L10 7.5L6 9.5V5.5Z" fill="#475569"/>
              </svg>
              See how it works
            </a>
          </div>

          {/* Trust row */}
          <div className="flex items-center gap-5 opacity-0 animate-fade-in delay-500">
            <div className="flex -space-x-2.5">
              {["EK","JM","SP","RN","AL"].map((initials, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ background: ["#7c3aed","#6366f1","#0ea5e9","#10b981","#f59e0b"][i] }}>
                  {initials}
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-0.5 mb-0.5">
                {Array.from({length:5}).map((_,i) => (
                  <svg key={i} width="12" height="12" viewBox="0 0 12 12" fill="#f59e0b"><path d="M6 1l1.3 3H11l-2.7 2 1 3.1L6 7.4 2.7 9.1l1-3.1L1 4h3.7L6 1Z"/></svg>
                ))}
                <span className="text-xs font-semibold text-slate-700 ml-1">4.9</span>
              </div>
              <p className="text-xs text-slate-400">from 12,400+ reviews</p>
            </div>
          </div>
        </div>

        {/* Right — course cards */}
        <div className="relative hidden lg:block opacity-0 animate-scale-in delay-400">
          <div className="space-y-4">
            {FEATURED_COURSES.map(({ title, tag, students, color }, i) => (
              <div
                key={title}
                className="feature-card flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-100 cursor-default"
                style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.06)", marginLeft: i === 1 ? "2.5rem" : i === 2 ? "1.25rem" : "0" }}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 15V7l6-4 6 4v8l-6 4-6-4Z" fill="white" fillOpacity="0.3" stroke="white" strokeWidth="1.2"/>
                    <path d="M10 3v14M4 7l6 4 6-4" stroke="white" strokeWidth="1" strokeOpacity="0.6"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-slate-900 truncate" style={{ fontFamily: "var(--font-display)" }}>{title}</span>
                    <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full shrink-0">{tag}</span>
                  </div>
                  <p className="text-xs text-slate-400">{students} students enrolled</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center hover:bg-violet-50 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7h9M7 3l4 4-4 4" stroke="#6366f1" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {/* Floating badge */}
          <div className="absolute -top-6 -right-6 bg-white rounded-2xl p-4 shadow-xl shadow-slate-200 border border-slate-100 animate-float" style={{ animationDuration: "5s" }}>
            <div className="text-2xl font-800 text-slate-900 mb-0.5" style={{ fontFamily: "var(--font-display)" }}>94%</div>
            <div className="text-xs text-slate-500 font-medium">job placement rate</div>
          </div>

          {/* Certificate badge */}
          <div className="absolute -bottom-4 -left-6 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-4 shadow-xl animate-float" style={{ animationDuration: "7s", animationDelay: "-3s" }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                  <path d="M7 1L8.5 4.5H12L9.5 6.5L10.5 10L7 8L3.5 10L4.5 6.5L2 4.5H5.5L7 1Z"/>
                </svg>
              </div>
              <div>
                <div className="text-xs font-bold text-white">Certificate</div>
                <div className="text-[10px] text-white/70">on completion</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Stats ──────────────────────────────────────────────────────────────────────
function Stats() {
  const ref = useReveal();
  const stats = [
    { value: "50k+", label: "Active students", sub: "across 120 countries" },
    { value: "320+", label: "Courses available", sub: "updated every quarter" },
    { value: "94%", label: "Job placement", sub: "within 6 months" },
    { value: "4.9★", label: "Average rating", sub: "from 12,400+ reviews" },
  ];

  return (
    <section className="py-20 border-y border-slate-100 bg-gradient-to-b from-slate-50/50 to-white">
      <div ref={ref} className="reveal max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map(({ value, label, sub }) => (
            <div key={label} className="text-center group cursor-default">
              <div style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }} className="text-4xl md:text-5xl font-800 gradient-text mb-1">{value}</div>
              <div className="text-sm font-semibold text-slate-700 mb-0.5">{label}</div>
              <div className="text-xs text-slate-400">{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Course categories ──────────────────────────────────────────────────────────
const CATEGORIES = [
  { icon: "⚡", name: "Web Development", courses: 84, color: "from-violet-500 to-indigo-500", bg: "bg-violet-50 border-violet-100" },
  { icon: "🤖", name: "AI & Machine Learning", courses: 47, color: "from-sky-500 to-cyan-400", bg: "bg-sky-50 border-sky-100" },
  { icon: "🎨", name: "UI/UX Design", courses: 39, color: "from-pink-500 to-rose-400", bg: "bg-pink-50 border-pink-100" },
  { icon: "☁️", name: "Cloud & DevOps", courses: 56, color: "from-teal-500 to-emerald-400", bg: "bg-teal-50 border-teal-100" },
  { icon: "📱", name: "Mobile Development", courses: 32, color: "from-orange-500 to-amber-400", bg: "bg-orange-50 border-orange-100" },
  { icon: "🔐", name: "Cybersecurity", courses: 28, color: "from-red-500 to-rose-500", bg: "bg-red-50 border-red-100" },
  { icon: "📊", name: "Data Science", courses: 41, color: "from-indigo-500 to-blue-500", bg: "bg-indigo-50 border-indigo-100" },
  { icon: "🧱", name: "Blockchain & Web3", courses: 19, color: "from-purple-500 to-violet-500", bg: "bg-purple-50 border-purple-100" },
];

function Categories() {
  const titleRef = useReveal();
  const gridRef = useReveal();

  return (
    <section className="py-28 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div ref={titleRef} className="reveal text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 border border-violet-100 text-violet-600 text-xs font-semibold uppercase tracking-widest mb-5">
            Explore
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }} className="text-4xl md:text-6xl font-800 text-slate-900 mb-4">
            Every skill you need
            <br />
            <span className="gradient-text-warm">in one place.</span>
          </h2>
          <p className="text-lg text-slate-500 max-w-md mx-auto">
            From beginner to senior engineer — structured paths that actually make sense.
          </p>
        </div>

        <div ref={gridRef} className="reveal grid grid-cols-2 md:grid-cols-4 gap-4">
          {CATEGORIES.map(({ icon, name, courses, color, bg }) => (
            <a
              key={name}
              href="#"
              className={`feature-card group flex flex-col gap-3 p-5 rounded-2xl border ${bg} cursor-pointer transition-all duration-200`}
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                {icon}
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-display)" }} className="font-700 text-sm text-slate-900 mb-0.5 leading-tight">{name}</div>
                <div className="text-xs text-slate-400">{courses} courses</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Step card (extracted to avoid hooks-in-loop) ───────────────────────────────
function StepCard({ n, icon, title, desc, detail, delay }: {
  n: string; icon: string; title: string; desc: string; detail: string[]; delay: number;
}) {
  const ref = useReveal(delay);
  return (
    <div ref={ref} className="reveal relative">
      <div className="flex flex-col items-center text-center md:items-start md:text-left">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 shadow-md flex items-center justify-center text-2xl z-10 relative hover:shadow-lg hover:-translate-y-1 transition-all duration-300" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            {icon}
          </div>
          <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
            <span style={{ fontFamily: "var(--font-mono)" }} className="text-[9px] font-bold text-white">{n}</span>
          </div>
        </div>
        <h3 style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }} className="text-xl font-700 text-slate-900 mb-3">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed mb-5">{desc}</p>
        <ul className="space-y-2 w-full">
          {detail.map((d) => (
            <li key={d} className="flex items-center gap-2.5 text-sm text-slate-600">
              <div className="w-4 h-4 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4l2 2 3-3" stroke="#7c3aed" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              {d}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── How it works ───────────────────────────────────────────────────────────────
function HowItWorks() {
  const titleRef = useReveal();

  const steps = [
    {
      n: "01",
      icon: "🎯",
      title: "Pick your learning path",
      desc: "Answer a few questions about your goals and experience. Osian builds you a personalised roadmap — no guesswork, no wasted time.",
      detail: ["Career-aligned curriculum", "Skill gap analysis", "Weekly schedule planner"],
    },
    {
      n: "02",
      icon: "🛠️",
      title: "Learn by building real projects",
      desc: "Every course is project-first. You build real-world apps, not toy tutorials. Portfolio-ready by the end of every module.",
      detail: ["Code in-browser, no setup", "Peer code review", "Mentor office hours"],
    },
    {
      n: "03",
      icon: "🏆",
      title: "Get hired with confidence",
      desc: "Osian's career team reviews your portfolio, preps you for interviews, and connects you directly with our hiring partners.",
      detail: ["150+ hiring partners", "Interview prep sessions", "Verified certificate"],
    },
  ];

  return (
    <section className="py-28 bg-gradient-to-b from-slate-50/40 to-white relative overflow-hidden">
      <div className="grid-bg absolute inset-0 opacity-40" />
      <div className="max-w-6xl mx-auto px-6 relative">
        <div ref={titleRef} className="reveal text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-100 text-sky-600 text-xs font-semibold uppercase tracking-widest mb-5">
            How it works
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }} className="text-4xl md:text-5xl font-800 text-slate-900 mb-4">
            From zero to job-ready
            <br />in three stages.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-10 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-gradient-to-r from-violet-200 via-indigo-200 to-sky-200" />

          {steps.map((step, i) => (
            <StepCard key={step.n} {...step} delay={i * 120} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Instructor showcase ────────────────────────────────────────────────────────
const INSTRUCTORS = [
  { name: "Arjun Mehta", role: "Senior SWE, Google", subject: "Full-Stack & System Design", students: "18.4k", rating: "4.95", initials: "AM", color: "from-violet-500 to-indigo-500" },
  { name: "Leila Öztürk", role: "ML Engineer, OpenAI", subject: "Machine Learning & LLMs", students: "12.7k", rating: "4.97", initials: "LÖ", color: "from-sky-500 to-cyan-400" },
  { name: "James Okafor", role: "Staff Engineer, Stripe", subject: "APIs, Payments & Cloud", students: "9.1k", rating: "4.93", initials: "JO", color: "from-teal-500 to-emerald-400" },
  { name: "Sofia Reyes", role: "Design Lead, Figma", subject: "Product Design & Systems", students: "15.2k", rating: "4.96", initials: "SR", color: "from-pink-500 to-rose-400" },
];

function Instructors() {
  const titleRef = useReveal();
  const gridRef = useReveal();

  return (
    <section className="py-28 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div ref={titleRef} className="reveal text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-semibold uppercase tracking-widest mb-5">
            Instructors
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }} className="text-4xl md:text-5xl font-800 text-slate-900 mb-4">
            Learn from engineers
            <br />who actually build things.
          </h2>
          <p className="text-lg text-slate-500 max-w-lg mx-auto">
            Every Osian instructor is a senior practitioner from a top-tier company — vetted, tested, and passionate about teaching.
          </p>
        </div>

        <div ref={gridRef} className="reveal grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {INSTRUCTORS.map(({ name, role, subject, students, rating, initials, color }) => (
            <div key={name} className="feature-card group p-6 rounded-2xl bg-white border border-slate-100 text-center cursor-default" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-white text-lg font-bold mx-auto mb-4 group-hover:scale-105 transition-transform duration-300`} style={{ fontFamily: "var(--font-display)" }}>
                {initials}
              </div>
              <div style={{ fontFamily: "var(--font-display)" }} className="font-700 text-slate-900 text-sm mb-0.5">{name}</div>
              <div className="text-xs text-slate-400 mb-3">{role}</div>
              <div className="text-xs font-medium text-violet-600 bg-violet-50 px-3 py-1.5 rounded-full mb-4">{subject}</div>
              <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="#f59e0b"><path d="M6 1l1.3 3H11l-2.7 2 1 3.1L6 7.4 2.7 9.1l1-3.1L1 4h3.7L6 1Z"/></svg>
                  {rating}
                </span>
                <span className="text-slate-300">·</span>
                <span>{students} students</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Testimonial card ───────────────────────────────────────────────────────────
function TestimonialCard({ quote, author, role, avatar, delay }: {
  quote: string; author: string; role: string; avatar: string; delay: number;
}) {
  const ref = useReveal(delay);
  return (
    <div ref={ref} className="reveal feature-card relative p-7 rounded-2xl bg-white border border-slate-100" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div className="flex gap-1 mb-5">
        {Array.from({ length: 5 }).map((_, j) => (
          <svg key={j} width="13" height="13" viewBox="0 0 12 12" fill="#f59e0b"><path d="M6 1l1.3 3H11l-2.7 2 1 3.1L6 7.4 2.7 9.1l1-3.1L1 4h3.7L6 1Z"/></svg>
        ))}
      </div>
      <p className="text-sm text-slate-600 leading-relaxed mb-6 italic">"{quote}"</p>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-indigo-400 flex items-center justify-center text-white text-xs font-bold">
          {avatar}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>{author}</div>
          <div className="text-xs text-slate-400">{role}</div>
        </div>
      </div>
    </div>
  );
}

// ── Testimonials ───────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: "I went from a junior support role to a full-stack developer in 7 months. The projects were challenging but the mentors were always there. Best investment I've made in myself.",
    author: "Emeka Nwosu",
    role: "Full-Stack Developer @ Flutterwave",
    avatar: "EN",
  },
  {
    quote: "Osian's ML path is the most honest curriculum I've seen. They don't sugarcoat the hard parts — maths included — and that made all the difference when I started at DeepMind.",
    author: "Yuki Tanaka",
    role: "ML Engineer @ DeepMind",
    avatar: "YT",
  },
  {
    quote: "Six months in, I had a portfolio of six real projects and an offer from Shopify. The career team's mock interviews were brutal but completely worth it.",
    author: "Sara Lindqvist",
    role: "Software Engineer @ Shopify",
    avatar: "SL",
  },
];

function Testimonials() {
  const ref = useReveal();
  return (
    <section className="py-28 bg-gradient-to-b from-slate-50/40 to-white relative overflow-hidden">
      <div className="grid-bg absolute inset-0 opacity-30" />
      <div className="max-w-6xl mx-auto px-6 relative">
        <div ref={ref} className="reveal text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-600 text-xs font-semibold uppercase tracking-widest mb-5">
            Student stories
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }} className="text-4xl md:text-5xl font-800 text-slate-900 mb-4">
            Real careers. Real results.
          </h2>
          <p className="text-lg text-slate-500">Straight from the people who made the switch.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={t.author} {...t} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  );
}


// ── Company logos marquee ──────────────────────────────────────────────────────
const HIRING_PARTNERS = [
  "Google","Meta","Stripe","Shopify","Figma","Vercel","DeepMind","Monzo","Revolut","Wise",
  "Google","Meta","Stripe","Shopify","Figma","Vercel","DeepMind","Monzo","Revolut","Wise",
];

function HiringPartners() {
  return (
    <section className="py-16 overflow-hidden border-y border-slate-100 bg-white">
      <div className="text-center mb-8">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">
          Osian graduates work at
        </p>
      </div>
      <div className="relative">
        <div className="flex overflow-hidden">
          <div className="marquee-inner flex items-center gap-14 whitespace-nowrap">
            {HIRING_PARTNERS.map((name, i) => (
              <span key={i} className="text-slate-300 font-bold text-sm tracking-tight hover:text-slate-500 transition-colors cursor-default" style={{ fontFamily: "var(--font-display)" }}>
                {name}
              </span>
            ))}
          </div>
        </div>
        <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-white to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-white to-transparent pointer-events-none" />
      </div>
    </section>
  );
}

// ── CTA ────────────────────────────────────────────────────────────────────────
function CTA() {
  const ref = useReveal();
  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-indigo-700 to-violet-900" />
        <div className="grid-bg absolute inset-0 opacity-[0.06]" />
        <div className="blob absolute -top-24 -right-24 w-[500px] h-[500px] bg-violet-400 opacity-20 animate-float" />
        <div className="blob absolute -bottom-24 -left-24 w-[500px] h-[500px] bg-indigo-400 opacity-20 animate-float" style={{ animationDelay: "-5s" }}/>
      </div>
      <div ref={ref} className="reveal relative z-10 max-w-4xl mx-auto px-6 text-center">
        <div className="text-5xl mb-6 animate-float" style={{ animationDuration: "4s" }}>🚀</div>
        <h2
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.04em", lineHeight: 1.05 }}
          className="text-5xl md:text-7xl font-800 text-white mb-6"
        >
          Your next role
          <br />starts today.
        </h2>
        <p className="text-lg text-violet-200 max-w-xl mx-auto mb-10 leading-relaxed">
          Join 50,000+ students at osian.tech. Pick a path, build real projects, get hired. First 7 days are on us.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="#" className="group flex items-center gap-2.5 px-8 py-4 rounded-xl text-violet-700 font-semibold text-base bg-white shadow-xl hover:bg-violet-50 hover:-translate-y-0.5 transition-all duration-200 active:scale-95">
            Start free today
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="group-hover:translate-x-0.5 transition-transform">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <a href="#" className="flex items-center gap-2.5 px-8 py-4 rounded-xl text-white font-semibold text-base border border-white/20 hover:bg-white/10 transition-all duration-200 active:scale-95">
            Browse all courses
          </a>
        </div>
        <p className="mt-6 text-sm text-violet-300">No credit card required · Cancel any time · 7-day free trial</p>
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────────
function Footer() {
  const cols = [
    { title: "Learn", links: ["All Courses", "Learning Paths", "Free Courses", "Certificates", "Live Sessions"] },
    { title: "Company", links: ["About Osian", "Blog", "Careers", "Press", "Partnerships"] },
    { title: "Support", links: ["Help Center", "Community", "Contact Us", "System Status", "Accessibility"] },
    { title: "Legal", links: ["Privacy Policy", "Terms of Use", "Cookie Policy", "GDPR", "Refund Policy"] },
  ];

  return (
    <footer className="bg-slate-900 text-white pt-20 pb-10">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-5 gap-12 mb-16">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src={OsianLogo} alt="Osian" className="h-8 w-auto brightness-0 invert opacity-80" />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-5">
              Project-based tech education for ambitious learners.
            </p>
            <div className="flex items-center gap-3">
              {["X","in","yt"].map((s) => (
                <a key={s} href="#" className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white text-xs font-bold transition-colors">
                  {s}
                </a>
              ))}
            </div>
          </div>

          {cols.map(({ title, links }) => (
            <div key={title}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">{title}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">© 2026 Osian Ltd. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Made with ❤️ for learners everywhere</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <Stats />
      <Categories />
      <HowItWorks />
      <HiringPartners />
      <Instructors />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  );
}

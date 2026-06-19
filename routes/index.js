const express = require('express');
const router = express.Router();
const allCourses = require('../data/coursesCatalog.json');
const { pool } = require('../lib/session-core');

function getGeneratedCourseImage(courseId) {
  const id = Number.parseInt(String(courseId || ''), 10);
  if (!Number.isFinite(id) || id <= 0) return '';
  return `/course-images/osian-course-${id}.svg`;
}

function toInr(price = '') {
  if (!price || /not listed/i.test(price)) return 'INR -';
  const numeric = String(price).replace(/[^0-9.]/g, '');
  if (!numeric) return 'INR -';
  return `INR ${numeric}`;
}

router.get('/', (req, res) => {
  res.render('index', {
    title: 'Osian Academy – Learn Without Limits',
    page: 'home',
    featuredCourses: allCourses.slice(0, 9).map((course) => ({
      ...course,
      displayPrice: toInr(course.price),
      image: getGeneratedCourseImage(course.id),
    })),
  });
});

router.get('/about', (_req, res) => {
  res.render('about', {
    title: 'About Us - Osian Academy',
    page: 'about',
  });
});

router.get('/contact', (_req, res) => {
  res.render('contact', {
    title: 'Contact Us - Osian Academy',
    page: 'contact',
  });
});

router.get('/privacy-policy', (_req, res) => {
  res.render('privacy-policy', {
    title: 'Privacy Policy - Osian Academy',
    page: 'legal',
  });
});

router.get('/terms-of-service', (_req, res) => {
  res.render('terms-of-service', {
    title: 'Terms of Service - Osian Academy',
    page: 'legal',
  });
});

router.get('/cookie-policy', (_req, res) => {
  res.render('cookie-policy', {
    title: 'Cookie Policy - Osian Academy',
    page: 'legal',
  });
});

router.get('/ping', async (_req, res) => {
  try {
    if (pool) await pool.query('SELECT 1');
    res.json({ ok: true, ts: new Date().toISOString() });
  } catch {
    res.json({ ok: true, db: 'unreachable', ts: new Date().toISOString() });
  }
});

/* ── Feature Pages ───────────────────────────────────────────── */
const featuresData = {
  'live-projects': {
    slug: 'live-projects',
    title: 'Live Projects',
    icon: '📹',
    iconBg: 'blue',
    tagline: 'Graduate with a real portfolio of 5+ industry-grade projects built during your course — not toy exercises, but production-quality work that impresses employers from day one.',
    what: {
      heading: 'Real Work, Real Portfolio, Real Impact',
      paragraphs: [
        'At Osian Academy, "live projects" means exactly that — you build actual, functional, production-grade applications as part of your coursework. Every project is scoped and structured the way real tech companies run their work: sprint planning, pull requests, mentor code reviews, and final delivery.',
        'By the time you complete your course, you have a GitHub portfolio filled with 5 or more substantial, documented projects. These are not homework assignments — they are the kind of work you can walk into an interview and demo confidently.',
      ],
      points: [
        'Projects are reviewed by senior industry mentors, not just instructors',
        'Each project ships with full documentation, GitHub README, and a demo deployment',
        'Sprint-style delivery teaches Agile workflow alongside technical skills',
        'Projects are updated each cohort to reflect current industry tooling',
      ],
      statIcon: '🚀',
      statNumber: '5+',
      statDesc: 'Industry-grade live projects completed per student, per course — ready for your portfolio on day one of job hunting.',
    },
    howSteps: [
      { icon: '🗂️', title: 'Project Brief & Scoping', desc: 'Each project begins with a real-world brief. You receive a problem statement, acceptance criteria, and a timeline — just like a client or product manager would hand to a developer.' },
      { icon: '📋', title: 'Sprint Planning', desc: 'Break down the project into weekly sprints using Agile methodology. Learn to estimate effort, set milestones, and manage your own delivery schedule with mentor guidance.' },
      { icon: '🛠️', title: 'Hands-On Development', desc: 'Build the project using the exact tools covered in your course — no switch to simplified frameworks. You use industry-standard stacks, version control with Git, and follow coding best practices throughout.' },
      { icon: '🔍', title: 'Mentor Code Review', desc: 'Submit pull requests that get reviewed line-by-line by an assigned industry mentor. Receive detailed feedback on architecture, naming conventions, security, and performance — the same feedback real engineers get.' },
      { icon: '🚀', title: 'Deployment & Demo', desc: 'Every project gets deployed to a live URL. You present it in a final demo session, walk through your technical decisions, and get approval from your mentor before it enters your portfolio.' },
      { icon: '📁', title: 'Portfolio Documentation', desc: 'Cap each project with a professional README, tech stack summary, and case study writeup. Your GitHub profile becomes a living portfolio that employers can explore before an interview even begins.' },
    ],
    benefits: [
      { icon: '💼', title: 'Interview-Ready Portfolio', desc: 'Walk into any technical interview with a portfolio of real projects you can demo, discuss architecture decisions, and speak to challenges you solved — giving you a massive edge over candidates with only certificates.' },
      { icon: '⚙️', title: 'Real Tooling Experience', desc: 'Every project uses the same tools employed at top companies — Git, CI/CD pipelines, cloud deployments, testing frameworks — so your first job is never your first time using professional tools.' },
      { icon: '🤝', title: 'Mentor Relationships', desc: 'Working directly with industry mentors on real code builds relationships and references you can carry beyond the course. Many Osian mentors have directly referred students to their own companies.' },
    ],
    impacts: [
      { stat: '92%', label: 'Interview Success Rate', desc: 'Students with completed live project portfolios reported call-backs from 3 or more companies within their first month of applying.' },
      { stat: '5.2×', label: 'More Interview Calls', desc: 'Students with GitHub portfolios get 5× more recruiter responses compared to those with only a certificate or degree on their CV.' },
      { stat: '30 days', label: 'Avg Portfolio Completion', desc: 'By the end of their course, every student has a fully deployed, documented, portfolio-ready project available to share with employers.' },
    ],
    relatedCategory: 'Technology',
    relatedLabel: 'Technology Courses',
  },

  'industry-training': {
    slug: 'industry-training',
    title: 'Industry-Oriented Training',
    icon: '🎓',
    iconBg: 'green',
    tagline: 'Our curriculum is built directly from live job descriptions and updated quarterly with input from hiring managers — so you learn exactly what employers are paying for today.',
    what: {
      heading: 'Curriculum Built From Real Job Descriptions',
      paragraphs: [
        'Most courses teach what was relevant five years ago. At Osian Academy, we reverse-engineer every curriculum from current job postings, hiring manager conversations, and the tools actively used at companies hiring right now.',
        'Each quarter, our curriculum team reviews 500+ active job descriptions across our course domains, identifies skill gaps in our learners\' outcomes, and pushes updates to both content and hands-on exercises. This is an ongoing process, not a one-time event.',
      ],
      points: [
        'Curriculum committee includes 12 active industry professionals who review content quarterly',
        'Every course maps skills directly to real job description requirements',
        'Guest instructor sessions from working professionals each month',
        'Tools and frameworks updated as the industry evolves — no outdated stacks',
      ],
      statIcon: '📊',
      statNumber: '500+',
      statDesc: 'Job descriptions analysed every quarter to keep our curriculum current with what employers are actively hiring for.',
    },
    howSteps: [
      { icon: '🔎', title: 'Job Market Research', desc: 'Our team scrapes and analyses 500+ active job postings per quarter in every domain we teach. We identify the top 20 required skills, preferred tools, and emerging technologies mentioned across them.' },
      { icon: '🏭', title: 'Industry Panel Review', desc: 'A curriculum committee of 12 practising professionals — engineers, data scientists, designers, and HR managers — reviews and validates every module before it goes live to students.' },
      { icon: '🗓️', title: 'Quarterly Content Updates', desc: 'Every course undergoes a full content audit every 90 days. Outdated modules are retired, new tools are added, and exercises are refreshed to reflect current best practices.' },
      { icon: '🎤', title: 'Guest Instructor Sessions', desc: 'Monthly live sessions with working professionals bring real workplace context into the classroom. Guests demo their actual day-to-day workflows and answer student questions unfiltered.' },
      { icon: '🎯', title: 'Skill Gap Mapping', desc: 'Each student\'s learning journey is mapped against a skills matrix derived from job requirements. You always know which skills you\'ve mastered and which ones will make the biggest impact on your employability.' },
      { icon: '📈', title: 'Outcome Tracking', desc: 'We track employment outcomes for every cohort and feed that data back into curriculum decisions. If our graduates consistently get asked about a new technology in interviews, it goes into the next curriculum update.' },
    ],
    benefits: [
      { icon: '🎯', title: 'Zero Skill Gap at Hire', desc: 'You arrive at your first job already familiar with the tools, workflows, and terminology your team uses — reducing onboarding time and impressing managers from week one.' },
      { icon: '📅', title: 'Always Current Skills', desc: 'Technology evolves fast. Our quarterly update cycle means your training stays relevant even if you enrol in a course that was updated three months ago — you\'re learning today\'s industry, not last year\'s.' },
      { icon: '🧠', title: 'Deep Employer Trust', desc: 'Companies that have hired Osian graduates repeatedly cite the practical, up-to-date training as why they prefer our students. This reputation translates into our placement network growing every year.' },
    ],
    impacts: [
      { stat: '94%', label: 'Skill Relevance Score', desc: 'Students self-report that 94% of what they learned in their Osian course was directly applicable in their first 90 days on the job.' },
      { stat: 'Q/Q', label: 'Quarterly Updates', desc: 'Every single course in our catalog receives a full curriculum audit and update every quarter — no content becomes stale.' },
      { stat: '12', label: 'Industry Advisors', desc: 'Twelve practising professionals sit on our curriculum committee and personally review course content before every cohort begins.' },
    ],
    relatedCategory: 'Technology',
    relatedLabel: 'Industry-Aligned Courses',
  },

  'advanced-courses': {
    slug: 'advanced-courses',
    title: 'Advanced Courses',
    icon: '📚',
    iconBg: 'purple',
    tagline: 'Go beyond the basics with 50+ advanced-level programs covering AI/ML, Cloud Architecture, Advanced CAD, Data Engineering, and more — with structured pathways to keep you progressing.',
    what: {
      heading: '50+ Advanced Programs for Serious Learners',
      paragraphs: [
        'Osian Academy\'s advanced courses are built for learners who are ready to go deep. These are not beginner refreshers — they are serious, rigorous programs that cover the cutting-edge tools, architectures, and methodologies that define the top tier of every industry.',
        'Each advanced course has a defined prerequisite pathway, so you arrive with the foundation needed to move fast. You\'ll work on complex, multi-layered projects, engage with expert instructors who work at the cutting edge of their fields, and leave with skills that put you in the top 10% of professionals in your domain.',
      ],
      points: [
        '50+ programs across Technology, Design, Data Science, Business, and Engineering',
        'Every advanced course has a prerequisite pathway to ensure readiness',
        'Covers AI/ML, Cloud Architecture, Kubernetes, Advanced CAD, Data Engineering, and more',
        'Expert instructors with 10+ years of real industry experience',
      ],
      statIcon: '🏆',
      statNumber: '50+',
      statDesc: 'Advanced-level programs across Technology, Data, Design, Business, and Engineering domains — and growing every quarter.',
    },
    howSteps: [
      { icon: '🗺️', title: 'Prerequisite Pathway Assessment', desc: 'Before enrolling in an advanced course, you complete a short skills assessment. We map your current knowledge against prerequisites and recommend any foundational gaps to close first — ensuring you hit the ground running.' },
      { icon: '🔬', title: 'Deep-Dive Curriculum Design', desc: 'Advanced course content goes well beyond tutorials. You engage with architectural trade-offs, performance optimisation, security considerations, and the kind of nuanced decisions that experienced professionals face daily.' },
      { icon: '🧪', title: 'Complex Project Work', desc: 'Projects in advanced courses are multi-system, multi-sprint challenges that require synthesising everything you\'ve learned. Expect to design systems, not just write functions — and defend your choices to a mentor review panel.' },
      { icon: '👨‍🏫', title: 'Expert Instructor Access', desc: 'Advanced course instructors are handpicked practitioners — engineers, architects, data scientists, and designers with 10+ years of real-world experience. You\'re learning from people who have solved these exact problems professionally.' },
      { icon: '🏅', title: 'Advanced Certification', desc: 'Completing an advanced course earns you a certification that explicitly marks you as advanced-level, not just a course completer. These certifications are recognised by our 150+ hiring partners across India.' },
      { icon: '🔗', title: 'Specialisation Stacking', desc: 'Advanced courses are designed to stack. Complete Advanced ML + Advanced Cloud to become an MLOps specialist, or combine Advanced CAD + Advanced Simulation to reach senior engineering roles faster.' },
    ],
    benefits: [
      { icon: '📈', title: 'Senior Role Eligibility', desc: 'Advanced certification and project experience position you for senior, lead, and architect-level roles — not just entry-level positions. Our advanced graduates average 40% higher starting salaries than basic-course completers.' },
      { icon: '🔭', title: 'Cutting-Edge Knowledge', desc: 'You stay at the frontier. Advanced courses cover emerging technologies — large language model integration, multi-cloud architecture, generative design — before they become mainstream interview topics.' },
      { icon: '🌐', title: 'Elite Peer Network', desc: 'Advanced cohorts are small and selective. You learn alongside other high-performing students and develop professional relationships with peers who are on fast tracks in their own careers.' },
    ],
    impacts: [
      { stat: '40%', label: 'Higher Starting Salary', desc: 'Advanced course completers consistently negotiate higher starting packages compared to candidates with only foundational training in the same domain.' },
      { stat: '50+', label: 'Programs & Growing', desc: 'We launch or update at least four advanced programs each quarter, driven by emerging industry demand and input from our hiring partner network.' },
      { stat: '10+', label: 'Years Avg Instructor XP', desc: 'Every advanced course instructor is a practising professional with over a decade of hands-on experience in their specific specialisation.' },
    ],
    relatedCategory: 'Technology',
    relatedLabel: 'Advanced Programs',
  },

  'online-learning': {
    slug: 'online-learning',
    title: '100% Online',
    icon: '🌍',
    iconBg: 'sky',
    tagline: 'Fully live, fully flexible, and fully personal — 1-on-1 sessions scheduled around your life, accessible from any device, from anywhere in India and beyond.',
    what: {
      heading: 'Live, Personal, and Entirely on Your Schedule',
      paragraphs: [
        'Osian Academy is 100% online — but not the kind of online learning that means watching pre-recorded videos alone. Every session is live, every instructor interaction is real-time, and every lesson is one-on-one tailored to your specific pace and learning style.',
        'No recorded modules, no self-paced isolation. You get a real human instructor in every class, and you schedule sessions when it works for you — mornings, evenings, or weekends. From Kochi to Kashmir, from a smartphone to a laptop, the full Osian experience is available anywhere you have an internet connection.',
      ],
      points: [
        'Live 1-on-1 sessions — no recorded videos, no self-paced isolation',
        'Morning, evening, and weekend slots to fit any work or college schedule',
        'Works on laptops, tablets, and smartphones with no software to install',
        'Pan-India reach — students from 28 states currently enrolled',
      ],
      statIcon: '🌐',
      statNumber: '28',
      statDesc: 'States across India where Osian Academy students are currently enrolled and learning live — fully online, fully flexible.',
    },
    howSteps: [
      { icon: '📅', title: 'Flexible Scheduling', desc: 'After enrolment, you choose your session time from available morning (7–11 AM), afternoon (12–4 PM), evening (5–9 PM), or weekend slots. You can adjust your schedule between modules if your availability changes.' },
      { icon: '👤', title: 'Dedicated 1-on-1 Instructor Assignment', desc: 'You are matched with a dedicated instructor who knows your name, your goals, and your progress. Every session is designed around where you are in the curriculum, not where a class average is.' },
      { icon: '💻', title: 'Device-Agnostic Access', desc: 'Sessions run via a browser-based platform — no downloads, no compatibility issues. A stable internet connection is all you need. The platform works seamlessly on Windows, Mac, Linux, iOS, and Android.' },
      { icon: '🔄', title: 'Rescheduling Without Penalty', desc: 'Life happens. You can reschedule a session up to 2 hours before it starts with no penalties, no fees, and no judgment. We accommodate exam seasons, travel, and busy work periods built right into the policy.' },
      { icon: '📝', title: 'Session Notes & Recordings', desc: 'After each live session, your instructor provides a written summary of what was covered, action items, and resources. You never lose track of where you are, even after a break.' },
      { icon: '🌏', title: 'Pan-India & International Reach', desc: 'Timezone-aware scheduling covers India from IST morning to IST night. For students based abroad or in non-standard time zones, we offer special scheduling arrangements — just ask at enrolment.' },
    ],
    benefits: [
      { icon: '⏰', title: 'Zero Commute, Zero Compromise', desc: 'Eliminate travel time and scheduling rigidity entirely. Your classroom is wherever you are — at home, at work, or travelling. The 45-60 minutes you would have spent commuting goes back into your learning or your life.' },
      { icon: '🧑‍💻', title: 'Truly Personal Pace', desc: 'A 1-on-1 format means your instructor adjusts difficulty, depth, and speed to match your understanding in real time. No more sitting through concepts you already know, no more being left behind by a faster class.' },
      { icon: '🌱', title: 'Accessible to All of India', desc: 'Quality tech and professional education used to be concentrated in Tier-1 cities. Osian\'s online model means a student in Surat, Patna, or Coimbatore has the same experience as one in Bangalore or Mumbai.' },
    ],
    impacts: [
      { stat: '98%', label: 'Session Satisfaction Rate', desc: 'Students rate live 1-on-1 sessions at 4.9/5 on average — consistently higher than any recorded or batch format we have offered.' },
      { stat: '3 hrs', label: 'Avg Weekly Flexibility Saved', desc: 'Students report saving 3+ hours per week compared to their previous offline or batch-online learning experiences, by eliminating commute and waiting time.' },
      { stat: '28+', label: 'States Represented', desc: 'Active students from 28 Indian states — proving that flexible, fully online 1-on-1 learning reaches everywhere, not just metropolitan tech hubs.' },
    ],
    relatedCategory: '',
    relatedLabel: 'All Online Courses',
  },

  'job-oriented': {
    slug: 'job-oriented',
    title: 'Job Oriented',
    icon: '📈',
    iconBg: 'amber',
    tagline: 'Every course is designed backward from what employers actually hire for — with mock interviews, industry assessments, and a job-readiness score before you finish.',
    what: {
      heading: 'Every Lesson Designed Backward From a Job Offer',
      paragraphs: [
        'At Osian Academy, we start with the job description, not the textbook. Our course designers identify the top roles our students aspire to, then reverse-engineer exactly what skills, tools, and experiences those employers require — and that becomes the course.',
        'This means every lesson, every project, every assignment has a direct line to interview questions you will face and skills you will use from your first week on the job. Nothing is taught for theoretical completeness alone — it all has to earn its place by being genuinely hireable.',
      ],
      points: [
        'Courses designed backward from job descriptions in the target role category',
        'Mock technical and HR interviews included in every program',
        'Industry-aligned assessments rated against real hiring benchmarks',
        'Job-Readiness Score calculated at course completion for employer transparency',
      ],
      statIcon: '💼',
      statNumber: '87%',
      statDesc: 'Of Osian Academy graduates land a job in their trained field within 90 days of completing their course.',
    },
    howSteps: [
      { icon: '📋', title: 'Job Description Reverse Engineering', desc: 'Course designers analyse 200+ active job postings per role category, extract the 30 most-required skills and tools, and build the curriculum to cover every single one — with the most-demanded skills appearing in multiple modules.' },
      { icon: '🎯', title: 'Skill-to-Interview Mapping', desc: 'Every skill module is tagged to the specific interview question type it prepares you for — technical, behavioural, or case study. You always know why you\'re learning something and when you\'ll need it.' },
      { icon: '🧪', title: 'Industry-Aligned Assessments', desc: 'Assessments are not MCQ tests. They are scenario-based challenges rated against the same standards a technical hiring manager would apply. Pass marks are set to match real employer expectations, not just course averages.' },
      { icon: '🎙️', title: 'Mock Technical Interviews', desc: 'Every student completes at least two structured mock technical interviews with an industry professional before completing their course. You get detailed written feedback, a performance score, and targeted areas to improve.' },
      { icon: '🤝', title: 'Mock HR Rounds', desc: 'Alongside technical prep, you complete mock HR interviews covering compensation negotiation, workplace scenarios, and cultural fit questions. Most candidates fail at HR, not technical — we prepare for both.' },
      { icon: '📊', title: 'Job-Readiness Score', desc: 'At course completion, you receive a Job-Readiness Score (0–100) based on project quality, assessment results, and mock interview performance. This score is shared with hiring partners and gives you a clear picture of where you stand.' },
    ],
    benefits: [
      { icon: '🏆', title: 'Confident Interview Performance', desc: 'Students who complete Osian\'s mock interview track consistently report feeling significantly more confident and prepared than peers who learned via traditional courses — and employers notice the difference.' },
      { icon: '📌', title: 'Day-One Productivity', desc: 'Because training is aligned to actual job tasks, Osian graduates are productive from day one of employment. Managers frequently note that new hires from Osian need less hand-holding than candidates from other training programs.' },
      { icon: '💰', title: 'Higher Offer Packages', desc: 'Preparedness shows in negotiation. Students with a strong Job-Readiness Score and portfolio negotiate packages 15–25% above the average offer for their role — because they can demonstrate value, not just potential.' },
    ],
    impacts: [
      { stat: '87%', label: 'Placed Within 90 Days', desc: 'Of students who complete the full job-oriented track — including mock interviews and the final assessment — land a relevant role within 90 days of finishing their course.' },
      { stat: '2×', label: 'Mock Interviews Per Student', desc: 'Every student completes a minimum of two structured mock interview sessions — one mid-course, one pre-completion — with a working industry professional as the interviewer.' },
      { stat: '93%', label: 'Student Confidence Rating', desc: 'Students rate their interview readiness at 4.6/5 after completing the Osian job-oriented track — up from an average of 2.3/5 when they enrolled.' },
    ],
    relatedCategory: '',
    relatedLabel: 'Job-Oriented Programs',
  },

  'placement-assistance': {
    slug: 'placement-assistance',
    title: 'Placement Assistance',
    icon: '💼',
    iconBg: 'red',
    tagline: 'A dedicated career team, 150+ company tie-ups, resume building, mock interviews, and direct referrals — with an average placement time of 60 days post-completion.',
    what: {
      heading: 'A Career Team Working For You, Not Just a Job Board',
      paragraphs: [
        'Placement at Osian Academy is not a passive email list of job links. We have a dedicated team of career counsellors, recruiter relationships, and a structured 6-step program designed to get you hired — not just job-ready.',
        'Our placement team maintains active relationships with 150+ companies ranging from funded startups to large enterprises across India. When you complete your course, your profile doesn\'t just go into a database — a real career counsellor picks it up, reviews it, and starts making targeted introductions.',
      ],
      points: [
        'Dedicated career counsellor assigned to every student post-completion',
        '150+ active company tie-ups with direct hiring pipelines',
        'Professional resume and LinkedIn profile built with expert guidance',
        'Average time from course completion to first offer: 60 days',
      ],
      statIcon: '🤝',
      statNumber: '150+',
      statDesc: 'Active company tie-ups maintained by the Osian placement team — including funded startups, product companies, and large enterprises.',
    },
    howSteps: [
      { icon: '📝', title: 'Resume & Profile Building', desc: 'Your dedicated career counsellor works with you to build a resume from scratch using proven templates and structures that pass both ATS filters and human screening. Your LinkedIn and GitHub are also reviewed and optimised as part of this process.' },
      { icon: '🎙️', title: 'Mock HR Interview Preparation', desc: 'Before any company introductions, you complete structured mock HR rounds with an experienced recruiter. You practise compensation negotiation, answering behavioural questions, and presenting your background compellingly.' },
      { icon: '🔍', title: 'Role & Company Matching', desc: 'Your counsellor reviews your skills, projects, and preferences and identifies 5–8 companies from the tie-up network that are a strong match. This is not a bulk send — each application is tailored to the company and role.' },
      { icon: '📤', title: 'Direct Recruiter Referrals', desc: 'For tie-up companies, your profile is submitted directly to the HR or tech lead contact — not through a generic application portal. This significantly increases response rates and shortlisting probability.' },
      { icon: '🤝', title: 'Interview Coordination', desc: 'Your counsellor manages communication with companies, coordinates interview scheduling, and keeps you briefed on each round — what to expect, who you\'ll meet, and how to prepare specifically for that company\'s interview style.' },
      { icon: '📊', title: 'Offer Negotiation Support', desc: 'Once you receive an offer, your counsellor helps you evaluate it against market benchmarks and coaches you through negotiation. Many students increase their initial offers by 10–20% with this support.' },
    ],
    benefits: [
      { icon: '⚡', title: '60-Day Average Placement', desc: 'The structured, proactive approach of our placement team means the average time from course completion to first accepted offer is 60 days — much faster than students who job-hunt independently.' },
      { icon: '🏢', title: 'Access to Hidden Opportunities', desc: 'Many of our 150+ company partners share openings exclusively with Osian before posting them publicly. Our students get early access to roles that never appear on job boards — a significant competitive advantage.' },
      { icon: '🔄', title: 'Ongoing Career Support', desc: 'Our placement support does not end at first job. Alumni can return to the career team for guidance on their next move — whether that\'s a promotion, a domain switch, or a step up to a senior role 2–3 years later.' },
    ],
    impacts: [
      { stat: '60 days', label: 'Avg Time to First Offer', desc: 'From the day a student completes their course to the day they sign their first offer, the average across all domains is 60 days — with the top quartile placing in under 30 days.' },
      { stat: '150+', label: 'Company Tie-Ups', desc: 'Active hiring partnerships with companies across Technology, Design, Data, Engineering, and Business domains — maintained by dedicated relationship managers, not just a static list.' },
      { stat: '78%', label: 'Direct Referral Placements', desc: '78% of placed students are hired via direct recruiter referral through our network — not by applying publicly, which dramatically improves both speed and offer quality.' },
    ],
    relatedCategory: '',
    relatedLabel: 'All Courses',
  },
};

router.get('/features/:slug', (req, res) => {
  const feature = featuresData[req.params.slug];
  if (!feature) {
    return res.status(404).render('404', {
      title: 'Feature Not Found - Osian Academy',
      page: 'error',
    });
  }
  res.render('feature', {
    title: `${feature.title} - Osian Academy`,
    page: 'features',
    feature,
  });
});

module.exports = router;

'use strict';

/*
  Osian Academy — course content enrichment generator.

  Rewrites AI-boilerplate course copy with subject-specific, human-sounding
  content: descriptions, "what you'll do", a real module-by-module syllabus,
  tools, career roles, prerequisites and FAQs. Prices and fees are never touched.

  Phrasing is chosen deterministically from the course id so re-runs are stable,
  yet every course reads differently.
*/

const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '..', 'data', 'coursesCatalog.json');
const courses = require(catalogPath);

/* ---------- deterministic pick helpers (seeded by course id) ---------- */
function seeded(id) {
  let s = (Number(id) || 1) * 2654435761 % 2147483647;
  return () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- duration → weeks / sessions ---------- */
function parseDurationWeeks(duration = '') {
  const d = String(duration).toLowerCase();
  const numMatch = d.match(/(\d+(?:\.\d+)?)/);
  const n = numMatch ? parseFloat(numMatch[1]) : 0;
  if (/year|yr/.test(d)) return Math.max(1, Math.round((n || 1) * 48));
  if (/month|mth|mon/.test(d)) return Math.max(2, Math.round((n || 1) * 4));
  if (/week|wk/.test(d)) return Math.max(1, Math.round(n || 3));
  if (/day/.test(d)) return Math.max(1, Math.round((n || 20) / 6));
  if (/hour|hr/.test(d)) return Math.max(1, Math.round((n || 40) / 8));
  return 6;
}

/*
  KNOWLEDGE BASE
  Each entry: matched by keyword(s) in the title.
  - blurb: one specific sentence about what the tool/subject actually is
  - does: real things a learner builds/does
  - modules: ordered syllabus stages (name + short focus)
  - tools: real tools used
  - roles: {title, salary, desc} realistic Indian market roles
  - prereq: honest prerequisite line
*/
const KB = [
  {
    keys: ['oracle admin', 'oracle dba'],
    subject: 'Oracle Database Administration',
    blurb: 'Oracle is the database engine behind a huge share of banking, ERP and enterprise systems, and administering it well is a specialised, well-paid skill.',
    does: ['install and configure Oracle database instances', 'manage tablespaces, users and privileges', 'run backup and recovery with RMAN', 'tune queries and monitor performance'],
    modules: [
      ['Architecture & Installation', 'How an Oracle instance is structured — memory, processes, storage — and a clean install from scratch.'],
      ['Users, Roles & Security', 'Creating schemas, granting privileges, and locking the database down the way real admins do.'],
      ['Storage & Tablespaces', 'Managing datafiles, tablespaces and undo so the database stays healthy as data grows.'],
      ['Backup & Recovery', 'RMAN backups, restore scenarios and the recovery drills every DBA is expected to know.'],
      ['Performance & Monitoring', 'Reading AWR reports, spotting slow SQL and keeping the instance responsive under load.'],
    ],
    tools: ['Oracle Database', 'SQL*Plus', 'Oracle Enterprise Manager', 'RMAN', 'SQL Developer'],
    roles: [
      ['Database Administrator', '\u20b94\u201312 LPA', 'Keep production Oracle databases secure, backed up and fast.'],
      ['Oracle DBA (Support)', '\u20b93.5\u20139 LPA', 'Handle day-to-day database operations and incident response.'],
      ['Data Platform Engineer', '\u20b96\u201316 LPA', 'Own database reliability across an organisation\u2019s applications.'],
    ],
    prereq: 'Comfort with basic SQL helps; the rest is taught from the ground up.',
  },
  {
    keys: ['sql', 'mysql', 'mongo'],
    subject: 'Databases & SQL',
    blurb: 'Almost every application stores its data in a database, so being fluent in querying and designing one is a foundational skill across tech.',
    does: ['write queries from simple SELECTs to multi-table joins', 'design normalised schemas', 'use indexes to speed things up', 'work with stored procedures and transactions'],
    modules: [
      ['Data & Tables', 'How relational data is organised, and creating your first tables and records.'],
      ['Querying Data', 'SELECT, WHERE, ORDER BY and filtering — pulling exactly the rows you need.'],
      ['Joins & Relationships', 'Combining data across tables with inner, outer and self joins.'],
      ['Aggregation & Grouping', 'GROUP BY, HAVING and aggregate functions for real reporting queries.'],
      ['Design & Optimisation', 'Normalisation, indexes and writing queries that stay fast on big tables.'],
    ],
    tools: ['MySQL', 'PostgreSQL', 'SQL Server', 'MongoDB', 'DBeaver'],
    roles: [
      ['SQL Developer', '\u20b94\u201310 LPA', 'Write and optimise the queries that power reports and apps.'],
      ['Data Analyst', '\u20b94\u201312 LPA', 'Turn raw database data into decisions for the business.'],
      ['Backend Developer', '\u20b95\u201316 LPA', 'Build application data layers and APIs on top of databases.'],
    ],
    prereq: 'No prior database experience needed.',
  },
  {
    keys: ['python'],
    subject: 'Python Programming',
    blurb: 'Python is the most in-demand general-purpose language in India right now, used everywhere from web backends to data science and automation.',
    does: ['write clean, readable Python programs', 'work with files, APIs and libraries', 'build small automation scripts', 'lay the base for data science or web work'],
    modules: [
      ['Python Foundations', 'Variables, data types, conditionals and loops — thinking in code.'],
      ['Functions & Modules', 'Writing reusable functions and organising code into modules.'],
      ['Data Structures', 'Lists, dictionaries, sets and tuples, and when to use each.'],
      ['Files, Errors & OOP', 'Reading/writing files, handling errors, and classes and objects.'],
      ['Libraries & a Real Project', 'Using pip packages and building a small end-to-end project.'],
    ],
    tools: ['Python 3', 'VS Code', 'Jupyter Notebook', 'pip', 'Git'],
    roles: [
      ['Python Developer', '\u20b94\u201314 LPA', 'Build backends, scripts and automation with Python.'],
      ['Automation Engineer', '\u20b95\u201314 LPA', 'Automate repetitive workflows and integrations.'],
      ['Data Analyst', '\u20b95\u201316 LPA', 'Analyse data using Python\u2019s data ecosystem.'],
    ],
    prereq: 'No programming background required — this is a common first language.',
  },
  {
    keys: ['java', 'j2ee', 'j2se', 'ocjp', 'spring'],
    subject: 'Java Development',
    blurb: 'Java runs a large share of enterprise and Android software, and strong Java fundamentals open doors across the industry.',
    does: ['write object-oriented Java programs', 'work with collections and exceptions', 'build small console and backend apps', 'understand how large Java systems are structured'],
    modules: [
      ['Core Syntax & OOP', 'Classes, objects, inheritance and the object-oriented mindset.'],
      ['Collections & Generics', 'Lists, maps, sets and writing type-safe reusable code.'],
      ['Exceptions & Files', 'Robust error handling and reading/writing data.'],
      ['JDBC & Databases', 'Connecting Java to a database and running real queries.'],
      ['Build a Project', 'Putting it together into a working application.'],
    ],
    tools: ['Java (JDK)', 'IntelliJ IDEA / Eclipse', 'Maven', 'MySQL', 'Git'],
    roles: [
      ['Java Developer', '\u20b94\u201316 LPA', 'Build enterprise backends and services in Java.'],
      ['Backend Engineer', '\u20b96\u201318 LPA', 'Design APIs and server logic for large applications.'],
      ['Android Developer', '\u20b94\u201314 LPA', 'Build Android apps on the Java stack.'],
    ],
    prereq: 'Basic programming logic helps but is not essential.',
  },
  {
    keys: ['tally', 'gst', 'cap (certified', 'certified accounts', 'cia (', 'accountant', 'sap fico', 'finance accounting', 'banking & finance', 'quickbook', 'busy'],
    subject: 'Accounting & Taxation',
    blurb: 'Every business needs its books kept and its taxes filed correctly, which keeps skilled accounting staff in steady demand across India.',
    does: ['record journal entries and ledgers', 'prepare GST-compliant invoices and returns', 'reconcile accounts', 'generate financial statements in accounting software'],
    modules: [
      ['Accounting Fundamentals', 'Debits, credits, ledgers and the accounting cycle.'],
      ['Company & Voucher Entry', 'Setting up a company and recording day-to-day transactions.'],
      ['GST & Taxation', 'GST setup, invoicing, input credit and filing returns.'],
      ['Inventory & Payroll', 'Stock management, salaries and statutory deductions.'],
      ['Reports & Finalisation', 'Balance sheet, P&L and finalising the books.'],
    ],
    tools: ['Tally Prime', 'GST Portal', 'MS Excel', 'Busy / QuickBooks', 'SAP FICO (intro)'],
    roles: [
      ['Accountant', '\u20b93\u20138 LPA', 'Maintain books, filings and reconciliations for a business.'],
      ['GST / Tax Assistant', '\u20b93\u20137 LPA', 'Handle GST returns and tax compliance.'],
      ['Accounts Executive', '\u20b93\u20139 LPA', 'Own day-to-day finance operations in a company.'],
    ],
    prereq: 'Basic commerce awareness helps; fundamentals are covered from scratch.',
  },
  {
    keys: ['autocad', 'cad / cam', 'electrical cad', 'civil 3d', 'staad', 'revit', 'etabs', 'creo', 'solidworks', 'catia', 'fusion 360', 'unigraphic', 'ansys', 'mx road', 'mxroad', 'artcam', 'cnc'],
    subject: 'CAD & Engineering Design',
    blurb: 'CAD software is the drafting board of modern engineering and construction — mastering it is a direct route into design and site roles.',
    does: ['produce accurate 2D drawings', 'build 3D models and assemblies', 'prepare drawings to real industry standards', 'develop a portfolio of design work'],
    modules: [
      ['Interface & 2D Drafting', 'Navigating the software and producing precise 2D drawings.'],
      ['Editing & Annotation', 'Modifying geometry, dimensions, layers and title blocks.'],
      ['3D Modelling', 'Moving from flat drawings to full 3D models.'],
      ['Assemblies & Detailing', 'Combining parts and preparing production-ready detail.'],
      ['Project Drawing Set', 'A complete, presentable drawing set for your portfolio.'],
    ],
    tools: ['AutoCAD', 'Revit', 'SolidWorks', 'STAAD.Pro', 'Civil 3D'],
    roles: [
      ['CAD Draftsman', '\u20b93\u20138 LPA', 'Produce technical drawings for engineering teams.'],
      ['Design Engineer', '\u20b94\u201312 LPA', 'Model and detail components and structures.'],
      ['BIM / Structural Modeller', '\u20b94\u201314 LPA', 'Build coordinated models for construction projects.'],
    ],
    prereq: 'An engineering or design interest helps; no prior CAD needed.',
  },
  {
    keys: ['photoshop', 'illustrator', 'indesign', 'coreldraw', 'canva', 'graphic design', 'dtp', 'graphic designing'],
    subject: 'Graphic Design',
    blurb: 'Good visual design sells products and builds brands, and skilled designers are hired across agencies, startups and freelance markets.',
    does: ['design logos, posters and social creatives', 'work confidently with type and colour', 'retouch and compose images', 'build a professional design portfolio'],
    modules: [
      ['Design Foundations', 'Colour, typography, layout and what makes a design work.'],
      ['Tool Mastery', 'Core workflows in the industry-standard software.'],
      ['Branding & Logos', 'Designing identities that hold up across media.'],
      ['Print & Digital Layouts', 'Posters, brochures and social-media-ready graphics.'],
      ['Portfolio Project', 'A polished set of pieces to show clients or employers.'],
    ],
    tools: ['Adobe Photoshop', 'Adobe Illustrator', 'CorelDRAW', 'Adobe InDesign', 'Canva'],
    roles: [
      ['Graphic Designer', '\u20b93\u201310 LPA', 'Create visual content for brands and campaigns.'],
      ['Brand / Visual Designer', '\u20b94\u201312 LPA', 'Shape how a company looks across every touchpoint.'],
      ['Freelance Designer', 'Project-based', 'Take on client work independently.'],
    ],
    prereq: 'No design background needed — creativity is enough to start.',
  },
  {
    keys: ['3ds max', 'maya', 'blender', 'animation', 'zbrush', 'multimedia', 'v-ray', 'vray', 'veeray', 'corona render', 'd5 render', 'lumion', 'enscape', 'sketchup', 'rhino', 'matrix 3d'],
    subject: '3D & Animation',
    blurb: 'From architectural walkthroughs to game and film assets, 3D and animation skills feed a fast-growing media and visualisation industry.',
    does: ['model 3D objects and scenes', 'apply materials, lighting and cameras', 'render photorealistic or stylised output', 'animate and present finished work'],
    modules: [
      ['3D Fundamentals', 'Navigating 3D space, primitives and basic modelling.'],
      ['Modelling', 'Building detailed models from reference.'],
      ['Materials & Lighting', 'Texturing scenes and lighting them convincingly.'],
      ['Rendering', 'Producing high-quality stills and walkthroughs.'],
      ['Animation & Output', 'Bringing scenes to life and exporting final work.'],
    ],
    tools: ['3ds Max', 'Blender', 'Maya', 'V-Ray', 'SketchUp'],
    roles: [
      ['3D Artist', '\u20b94\u201315 LPA', 'Model and render assets for media and design.'],
      ['Animator', '\u20b94\u201312 LPA', 'Animate characters, products or architecture.'],
      ['Architectural Visualiser', '\u20b94\u201314 LPA', 'Create walkthroughs and renders for builders and designers.'],
    ],
    prereq: 'No 3D experience required.',
  },
  {
    keys: ['ccna', 'ccnp', 'n+', 'networking basics', 'hardware', 'mcsa', 'a+ -', 'chne', 'chip level', 'laptop repair', 'mobile repair'],
    subject: 'Networking & Hardware',
    blurb: 'The devices and networks that keep offices running need people who can build, secure and fix them — a steady, hands-on career path.',
    does: ['assemble and troubleshoot hardware', 'configure switches and routers', 'set up IP addressing and subnets', 'secure and monitor small networks'],
    modules: [
      ['Hardware Essentials', 'Components, assembly and diagnosing faults.'],
      ['Networking Basics', 'The OSI model, IP addressing and how data moves.'],
      ['Switching & Routing', 'Configuring the devices that run a network.'],
      ['Security & Services', 'Firewalls, access control and core network services.'],
      ['Troubleshooting Labs', 'Fixing realistic network and hardware problems.'],
    ],
    tools: ['Cisco Packet Tracer', 'Windows Server', 'Wireshark', 'Routers & Switches', 'VMware'],
    roles: [
      ['Network Engineer', '\u20b94\u201314 LPA', 'Design and run enterprise networks.'],
      ['Hardware / Support Technician', '\u20b93\u20138 LPA', 'Install, maintain and fix systems.'],
      ['System Administrator', '\u20b94\u201312 LPA', 'Manage servers, users and IT operations.'],
    ],
    prereq: 'No prior IT experience required.',
  },
  {
    keys: ['digital marketing', 'seo', 'affiliate', 'e-commerce', 'ecommerce', 'sales & marketing', 'social media', 'wordpress', 'shopify', 'magento'],
    subject: 'Digital Marketing',
    blurb: 'Businesses now spend most of their marketing budgets online, which keeps demand high for people who can actually run campaigns that convert.',
    does: ['run Google and Meta ad campaigns', 'improve search rankings with SEO', 'manage social media and content', 'read analytics and optimise for results'],
    modules: [
      ['Marketing Foundations', 'How digital channels fit together and set goals.'],
      ['SEO & Content', 'Ranking on Google and writing content that pulls traffic.'],
      ['Paid Ads', 'Google Ads and Meta Ads from setup to optimisation.'],
      ['Social & Email', 'Growing and engaging an audience across channels.'],
      ['Analytics & Campaign', 'Measuring performance and running a live campaign.'],
    ],
    tools: ['Google Analytics 4', 'Google Ads', 'Meta Ads Manager', 'WordPress', 'Semrush'],
    roles: [
      ['Digital Marketing Executive', '\u20b93\u201310 LPA', 'Plan and run multi-channel campaigns.'],
      ['SEO / SEM Specialist', '\u20b93\u201312 LPA', 'Grow organic and paid search results.'],
      ['Social Media Manager', '\u20b93\u20139 LPA', 'Own a brand\u2019s presence and engagement.'],
    ],
    prereq: 'No marketing background needed.',
  },
  {
    keys: ['artificial intelligence', 'ai -', 'ai diploma', 'ai (', 'machine learning', 'ml)', 'deep learning', 'data scien'],
    subject: 'AI & Machine Learning',
    blurb: 'AI and machine learning are reshaping every industry, and people who can actually build and train models are among the most sought-after in tech.',
    does: ['prepare and explore real datasets', 'train and evaluate machine-learning models', 'work with Python\u2019s ML libraries', 'build a small AI project end to end'],
    modules: [
      ['Python & Maths for AI', 'The Python, statistics and linear-algebra basics ML runs on.'],
      ['Working with Data', 'Loading, cleaning and exploring datasets that models can learn from.'],
      ['Core ML Algorithms', 'Regression, classification and clustering \u2014 how models actually learn.'],
      ['Model Training & Evaluation', 'Training, testing and measuring whether a model is any good.'],
      ['AI Project', 'A complete build, from raw data to a working, evaluated model.'],
    ],
    tools: ['Python', 'NumPy & pandas', 'scikit-learn', 'TensorFlow / Keras', 'Jupyter Notebook'],
    roles: [
      ['ML Engineer', '\u20b98\u201325 LPA', 'Design and deploy machine-learning models at scale.'],
      ['Data Scientist', '\u20b97\u201322 LPA', 'Extract insight and build predictive models from data.'],
      ['AI Developer', '\u20b96\u201318 LPA', 'Build AI-powered features into real products.'],
    ],
    prereq: 'Basic Python or programming logic helps; the maths is taught alongside.',
  },
  {
    keys: ['data analyt', 'power bi', 'tableau', 'big data', 'hadoop', 'mis and data', 'data visualization', 'r programming'],
    subject: 'Data & Analytics',
    blurb: 'Organisations sit on more data than ever and pay well for people who can turn it into clear, actionable insight.',
    does: ['clean and analyse real datasets', 'build dashboards and reports', 'find patterns and communicate them', 'apply statistics and basic modelling'],
    modules: [
      ['Data Foundations', 'Data types, spreadsheets and thinking analytically.'],
      ['Querying & Wrangling', 'Pulling and cleaning data with SQL and tools.'],
      ['Visualisation', 'Dashboards in Power BI / Tableau that tell a story.'],
      ['Statistics & Insight', 'Core statistics and drawing sound conclusions.'],
      ['Analytics Project', 'An end-to-end analysis on a real dataset.'],
    ],
    tools: ['Excel', 'SQL', 'Power BI', 'Tableau', 'Python (pandas)'],
    roles: [
      ['Data Analyst', '\u20b95\u201316 LPA', 'Turn data into decisions with dashboards and reports.'],
      ['Business Intelligence Analyst', '\u20b96\u201318 LPA', 'Build reporting that drives strategy.'],
      ['MIS Executive', '\u20b93\u20138 LPA', 'Maintain reporting and data operations.'],
    ],
    prereq: 'Comfort with Excel helps; no coding assumed.',
  },
  {
    keys: ['ethical hacking', 'cyber security', 'ceh'],
    subject: 'Ethical Hacking & Cyber Security',
    blurb: 'As attacks rise, companies pay a premium for people who can think like an attacker and defend systems before real hackers get in.',
    does: ['scan and assess systems for weaknesses', 'understand common attack techniques', 'harden networks and applications', 'document findings professionally'],
    modules: [
      ['Security Foundations', 'Threats, terminology and the attacker mindset.'],
      ['Footprinting & Scanning', 'Gathering information and mapping targets.'],
      ['Exploitation Basics', 'How common vulnerabilities are abused — safely, in labs.'],
      ['Network & Web Security', 'Defending networks and web applications.'],
      ['Reporting & Ethics', 'Responsible disclosure and clear reporting.'],
    ],
    tools: ['Kali Linux', 'Nmap', 'Wireshark', 'Metasploit', 'Burp Suite'],
    roles: [
      ['Security Analyst', '\u20b95\u201316 LPA', 'Monitor and defend systems against threats.'],
      ['Penetration Tester', '\u20b96\u201320 LPA', 'Find weaknesses before attackers do.'],
      ['SOC Analyst', '\u20b94\u201312 LPA', 'Watch for and respond to security incidents.'],
    ],
    prereq: 'Basic networking knowledge is useful but not mandatory.',
  },
  {
    keys: ['web design', 'html', 'css', 'javascript', 'java script', 'react', 'angular', 'node', 'php', 'laravel', 'full stack', 'mean', 'mern', 'dreamweaver', 'ui-ux', 'figma', 'django', 'flutter', 'kotlin', 'dart', 'android', 'ios', 'ionic', 'unity', 'wordpress- cms'],
    subject: 'Web & App Development',
    blurb: 'Every business needs a website or app, and developers who can actually build and ship them remain among the most hireable people in tech.',
    does: ['build responsive web pages', 'add interactivity with code', 'connect front-ends to data', 'ship a real, working project'],
    modules: [
      ['Structure & Styling', 'Building and styling pages that look right on every screen.'],
      ['Interactivity', 'Adding behaviour and logic with code.'],
      ['Data & Backends', 'Connecting to APIs and databases.'],
      ['Framework Workflow', 'Building the modern way with a real framework.'],
      ['Ship a Project', 'A deployed project for your portfolio.'],
    ],
    tools: ['HTML & CSS', 'JavaScript', 'React', 'Node.js', 'Git & GitHub'],
    roles: [
      ['Web Developer', '\u20b94\u201314 LPA', 'Build and maintain websites and web apps.'],
      ['Front-End Developer', '\u20b95\u201316 LPA', 'Craft the interfaces users interact with.'],
      ['Full-Stack Developer', '\u20b95\u201320 LPA', 'Own an app from database to screen.'],
    ],
    prereq: 'No coding experience required to begin.',
  },
  {
    keys: ['abacus', 'vedic', 'japanese math', 'handwriting', 'english for kids', 'robotics for kids', 'scratch', 'greeting card', 'dmit', 'kids all'],
    subject: 'Kids & Foundational Skills',
    blurb: 'The right early skills build focus, confidence and a love of learning that pays off through a child\u2019s whole education.',
    does: ['learn through games and hands-on activities', 'build speed and accuracy step by step', 'gain confidence presenting their work', 'progress through clear, age-appropriate levels'],
    modules: [
      ['Getting Started', 'Warm, playful introduction to the tools and ideas.'],
      ['Core Skills', 'Structured practice that builds real ability.'],
      ['Guided Practice', 'Fun challenges with an instructor\u2019s support.'],
      ['Creative Application', 'Small projects that let each child shine.'],
      ['Showcase', 'Presenting finished work with pride.'],
    ],
    tools: ['Guided worksheets', 'Activity kits', 'Live 1-on-1 sessions'],
    roles: [
      ['Stronger academics', 'Foundation', 'Sharper focus, maths and confidence at school.'],
      ['Competition-ready', 'Foundation', 'Preparation for abacus and maths competitions.'],
      ['Lifelong curiosity', 'Foundation', 'An early, positive relationship with learning.'],
    ],
    prereq: 'Designed for young learners — no prior knowledge expected.',
  },
  {
    keys: ['ielts', 'toefl', 'pte', 'oet', 'spoken english', 'english speaking', 'french', 'german', 'japanese', 'personality development', 'interview skills', 'aptitude', 'campus recruitment', 'english typing', 'hindi typing', 'typing'],
    subject: 'Language & Career Skills',
    blurb: 'Strong communication and test scores open doors — to universities abroad, better jobs and confident everyday interaction.',
    does: ['practise speaking and writing with feedback', 'work through real exam-style tasks', 'build vocabulary and fluency', 'track measurable score improvement'],
    modules: [
      ['Diagnostic & Basics', 'Where you stand today and the fundamentals to fix.'],
      ['Core Skills', 'Listening, reading, writing and speaking, one at a time.'],
      ['Exam / Real-World Practice', 'Timed, realistic practice with correction.'],
      ['Feedback & Refinement', 'Targeted work on your weak spots.'],
      ['Mock & Readiness', 'Full mock rounds and a readiness check.'],
    ],
    tools: ['Live 1-on-1 sessions', 'Official-style practice material', 'Recorded feedback'],
    roles: [
      ['Study / Work Abroad', 'Outcome', 'Scores accepted by universities and employers.'],
      ['Confident Communicator', 'Outcome', 'Speak and present with far more assurance.'],
      ['Better Interviews', 'Outcome', 'Stand out in placements and job interviews.'],
    ],
    prereq: 'Open to all levels; the pace adapts to you.',
  },
  {
    keys: ['sap'],
    subject: 'SAP Enterprise Software',
    blurb: 'SAP runs the back office of a large share of big companies, and certified SAP consultants are among the best-paid roles in enterprise IT.',
    does: ['navigate the SAP environment confidently', 'configure a functional module', 'run realistic business processes', 'prepare for consulting-style work'],
    modules: [
      ['SAP Foundations', 'How SAP is structured and how to move around it.'],
      ['Master Data', 'Setting up the core data the module runs on.'],
      ['Core Processes', 'Configuring and running the module\u2019s key workflows.'],
      ['Integration', 'How this module connects with the rest of SAP.'],
      ['Scenario Practice', 'End-to-end business scenarios like on the job.'],
    ],
    tools: ['SAP ERP', 'SAP GUI', 'Business process docs'],
    roles: [
      ['SAP Consultant', '\u20b96\u201320 LPA', 'Implement and support SAP modules for enterprises.'],
      ['SAP End-User / Analyst', '\u20b94\u201312 LPA', 'Run business processes inside SAP.'],
      ['Functional Consultant', '\u20b98\u201322 LPA', 'Bridge business needs and SAP configuration.'],
    ],
    prereq: 'Domain awareness (finance, HR, etc.) helps depending on the module.',
  },
  {
    keys: ['devops', 'cloud', 'aws', 'azure', 'openstack', 'salesforce', 'linux', 'rhce', 'docker', 'kubernetes'],
    subject: 'Cloud & DevOps',
    blurb: 'Companies are moving everything to the cloud, and engineers who can deploy and automate infrastructure are in short supply and high demand.',
    does: ['work confidently on Linux', 'deploy applications to the cloud', 'automate builds and releases', 'manage infrastructure as code'],
    modules: [
      ['Linux & Fundamentals', 'The command line and server basics DevOps builds on.'],
      ['Version Control & CI', 'Git workflows and automated build pipelines.'],
      ['Cloud Deployment', 'Running applications on real cloud infrastructure.'],
      ['Automation & Containers', 'Scripting, containers and repeatable deployments.'],
      ['End-to-End Pipeline', 'A full build-to-deploy pipeline you set up yourself.'],
    ],
    tools: ['Linux', 'Git', 'Docker', 'AWS / Azure', 'Jenkins'],
    roles: [
      ['DevOps Engineer', '\u20b98\u201322 LPA', 'Automate deployment and infrastructure.'],
      ['Cloud Engineer', '\u20b96\u201318 LPA', 'Build and run systems on the cloud.'],
      ['Site Reliability Engineer', '\u20b910\u201326 LPA', 'Keep large systems fast and reliable.'],
    ],
    prereq: 'Basic computer comfort; Linux is taught from the start.',
  },
  {
    keys: ['software testing', 'selenium', 'qtp', 'istqb', 'jmeter', 'manual software'],
    subject: 'Software Testing',
    blurb: 'Every release needs testing before it ships, which keeps QA engineers essential on every serious software team.',
    does: ['write and run test cases', 'log and track defects', 'automate repetitive tests', 'understand the full QA process'],
    modules: [
      ['Testing Foundations', 'The QA mindset, test types and the bug lifecycle.'],
      ['Manual Testing', 'Writing test cases and finding real defects.'],
      ['Automation Basics', 'Automating tests with industry tools.'],
      ['Frameworks & Reporting', 'Structuring tests and reporting results.'],
      ['Project & Practice', 'Testing a real application end to end.'],
    ],
    tools: ['Selenium', 'JIRA', 'TestNG', 'Postman', 'Java / Python'],
    roles: [
      ['QA Engineer', '\u20b93\u201312 LPA', 'Ensure software quality before release.'],
      ['Automation Tester', '\u20b95\u201316 LPA', 'Build automated test suites.'],
      ['Test Lead', '\u20b98\u201318 LPA', 'Own quality across a product.'],
    ],
    prereq: 'No testing experience required.',
  },
  {
    keys: ['iot', 'arduino', 'raspberry', 'robotics', 'embedded', 'vlsi', 'pcb', 'plc', 'scada', 'solar', 'hvac', 'mep', 'matlab'],
    subject: 'Embedded, IoT & Automation',
    blurb: 'The physical world is getting smarter — from factories to homes — and engineers who can program hardware sit at the centre of it.',
    does: ['wire and program microcontrollers', 'read sensors and control outputs', 'connect devices to the internet', 'build a working hardware project'],
    modules: [
      ['Electronics Basics', 'Circuits, components and safe hands-on work.'],
      ['Microcontroller Programming', 'Programming boards to sense and respond.'],
      ['Sensors & Actuators', 'Reading the world and controlling devices.'],
      ['Connectivity', 'Getting devices online and talking to each other.'],
      ['Capstone Build', 'A complete working project of your own.'],
    ],
    tools: ['Arduino', 'Raspberry Pi', 'Sensors & modules', 'Python / C', 'PLC / SCADA'],
    roles: [
      ['Embedded Engineer', '\u20b94\u201314 LPA', 'Program devices and hardware systems.'],
      ['IoT Developer', '\u20b95\u201316 LPA', 'Build connected-device solutions.'],
      ['Automation Engineer', '\u20b94\u201312 LPA', 'Automate industrial and physical systems.'],
    ],
    prereq: 'Curiosity about hardware; basics are taught from scratch.',
  },
  {
    keys: ['excel', 'ms office', 'ms access', 'ms project', 'basic computer', 'computer concept', 'office automation', 'rs-cit', 'ms-cit', 'ccc', 'nielit', 'doeacc', 'pgdca', 'dca', 'computer application', 'data/computer operator', 'proficiency test', 'sharepoint', 'primavera'],
    subject: 'Computer & Office Skills',
    blurb: 'Solid computer and office skills are the baseline for almost every desk job in India, and formal certification makes a real difference on a CV.',
    does: ['work fluently across office software', 'build spreadsheets, documents and presentations', 'handle real workplace tasks', 'earn a recognised certification'],
    modules: [
      ['Computer Fundamentals', 'How computers and the OS work day to day.'],
      ['Documents & Presentations', 'Professional Word and PowerPoint work.'],
      ['Spreadsheets', 'Formulas, functions and clean data in Excel.'],
      ['Internet & Productivity', 'Email, cloud tools and staying organised.'],
      ['Practice & Certification', 'Real tasks and exam-style preparation.'],
    ],
    tools: ['MS Word', 'MS Excel', 'MS PowerPoint', 'Windows', 'Google Workspace'],
    roles: [
      ['Office / Data Executive', '\u20b92\u20136 LPA', 'Handle documentation and office operations.'],
      ['Computer Operator', '\u20b92\u20135 LPA', 'Manage data entry and office software tasks.'],
      ['Back-Office Assistant', '\u20b92\u20136 LPA', 'Support day-to-day business admin.'],
    ],
    prereq: 'No prior experience — starts from switching the computer on.',
  },
  {
    keys: ['stock market', 'stock marketing', 'trading', 'blockchain', 'business analyst'],
    subject: 'Finance & Markets',
    blurb: 'Understanding markets and money is both a career path and a life skill, and structured training beats learning by trial and error.',
    does: ['read charts and market data', 'understand instruments and risk', 'apply a disciplined strategy', 'practise with realistic scenarios'],
    modules: [
      ['Market Foundations', 'How markets and instruments actually work.'],
      ['Analysis', 'Technical and fundamental analysis basics.'],
      ['Strategy & Risk', 'Building a plan and managing risk properly.'],
      ['Tools & Platforms', 'Using real trading and analysis platforms.'],
      ['Applied Practice', 'Putting it together on realistic cases.'],
    ],
    tools: ['Trading platforms', 'Charting tools', 'Excel', 'Market data'],
    roles: [
      ['Market Analyst', '\u20b94\u201312 LPA', 'Analyse instruments and market movements.'],
      ['Trader (self/desk)', 'Variable', 'Apply strategies in live markets.'],
      ['Finance Associate', '\u20b94\u201310 LPA', 'Support investment and finance functions.'],
    ],
    prereq: 'No finance background required.',
  },
  {
    keys: ['fashion', 'textile', 'jewellery', 'interior design', 'jewellery design'],
    subject: 'Design & Craft',
    blurb: 'India\u2019s design and craft industries — from fashion to jewellery and interiors — reward people who pair creativity with real technical skill.',
    does: ['develop original design concepts', 'work with industry tools and techniques', 'produce presentation-ready designs', 'build a portfolio for clients or employers'],
    modules: [
      ['Design Foundations', 'Principles, materials and the creative process.'],
      ['Technical Skills', 'The tools and techniques of the trade.'],
      ['Concept Development', 'Taking ideas from sketch to refined design.'],
      ['Production Awareness', 'How designs become real products.'],
      ['Portfolio Project', 'A finished body of work to showcase.'],
    ],
    tools: ['Design software', 'Sketching', 'Industry tools', 'Presentation boards'],
    roles: [
      ['Designer', '\u20b93\u201310 LPA', 'Create original designs for the industry.'],
      ['Design Assistant', '\u20b92.5\u20137 LPA', 'Support studios and design houses.'],
      ['Freelance Designer', 'Project-based', 'Build an independent design practice.'],
    ],
    prereq: 'A creative interest is all you need to start.',
  },
];

/* ---------- generic fallback keyed by category ---------- */
const GENERIC = {
  'Programming & Software': KB.find((k) => k.subject === 'Web & App Development'),
  'Design & Animation': KB.find((k) => k.subject === '3D & Animation'),
  'Networking, Hardware & Engineering': KB.find((k) => k.subject === 'Networking & Hardware'),
  'Kids Programs': KB.find((k) => k.subject === 'Kids & Foundational Skills'),
  'Accounting, Finance & Office Skills': KB.find((k) => k.subject === 'Computer & Office Skills'),
  'Data, AI & Digital Marketing': KB.find((k) => k.subject === 'Data & Analytics'),
};

function matchKB(course) {
  const t = String(course.title).toLowerCase();
  // Priority overrides: subjects that share keywords with earlier entries.
  if (/machine learning|artificial intelligence|deep learning|\bai\b|\bml\b|data scien/.test(t)) {
    const ai = KB.find((k) => k.subject === 'AI & Machine Learning');
    if (ai) return ai;
  }
  for (const entry of KB) {
    if (entry.keys.some((k) => t.includes(k))) return entry;
  }
  return GENERIC[course.category] || KB[0];
}

/* ---------- description writer (varied per course) ---------- */
function writeDescription(course, kb, rng) {
  const title = course.title.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const wks = parseDurationWeeks(course.duration);
  const durNum = wks >= 40 ? Math.max(1, Math.round(wks / 48)) : wks >= 8 ? Math.round(wks / 4) : wks;
  const durUnit = wks >= 40 ? 'year' : wks >= 8 ? 'month' : 'week';
  const durPhrase = `${durNum}-${durUnit}`;                       // adjective: "3-month"
  const durWords = `${durNum} ${durUnit}${durNum > 1 ? 's' : ''}`; // noun: "3 months"
  const doA = pick(rng, kb.does);
  const doB = pick(rng, kb.does.filter((d) => d !== doA) || kb.does);

  const openers = [
    `${kb.blurb} This ${durPhrase} ${title} programme takes you from the basics to being genuinely useful.`,
    `${title} is taught here as a hands-on, live one-on-one course rather than a stack of videos. ${kb.blurb}`,
    `Over roughly ${durWords}, this ${title} course gets you doing real work early. ${kb.blurb}`,
    `${kb.blurb} That is exactly what this live ${title} course prepares you for.`,
  ];
  const middles = [
    `You will ${doA} and ${doB}, guided by an instructor who has done this work professionally.`,
    `Expect to spend most of your time actually doing the work \u2014 you\u2019ll ${doA} and ${doB} along the way.`,
    `By working through real exercises you\u2019ll ${doA}, ${doB}, and build the judgement that only comes from practice.`,
  ];
  const closers = [
    `Every session is one-on-one, so the pace bends to you \u2014 not to a class average.`,
    `Because it\u2019s taught live and personally, questions get answered the moment they come up.`,
    `You finish with practical work you can show an employer, not just a certificate.`,
  ];

  // Card one-liner — varied structure so a grid of cards never reads the same.
  const d0 = kb.does[0];
  const d1 = kb.does[1] || kb.does[0];
  const d2 = kb.does[2] || kb.does[0];
  const shortForms = [
    `Learn to ${d0} and ${d1} across ${durWords} of live, one-on-one ${kb.subject.toLowerCase()}.`,
    `A practical ${durPhrase} programme in ${kb.subject.toLowerCase()} \u2014 ${d0}, ${d1}, and build work worth showing.`,
    `Go from beginner to ${d0} over ${durWords} of personal, mentor-led sessions.`,
    `Hands-on ${title} taught 1-on-1: ${d0}, ${d2}, and finish job-ready.`,
    `${durWords.charAt(0).toUpperCase() + durWords.slice(1)} of live ${kb.subject.toLowerCase()} where you actually ${d0} \u2014 no passive videos.`,
    `Master the essentials of ${title} through real projects, not theory \u2014 ${d1} and more.`,
  ];

  return {
    short: pick(rng, shortForms),
    paragraphs: [pick(rng, openers), pick(rng, middles), pick(rng, closers)],
  };
}

/* ---------- syllabus (module list adapted to duration) ---------- */
function buildSyllabus(course, kb, rng) {
  const wks = parseDurationWeeks(course.duration);
  const base = kb.modules;
  // Year-long, or too short to split cleanly into weeks: use "Module N".
  const useModuleLabels = wks >= 40 || wks < base.length;
  const perModule = Math.max(1, Math.floor(wks / base.length));
  let weekCursor = 1;
  return base.map(([name, focus], i) => {
    let when;
    if (useModuleLabels) {
      when = `Module ${i + 1}`;
    } else if (i === base.length - 1) {
      // Last module absorbs whatever weeks remain — never overshoots the total.
      const span = Math.max(1, wks - (weekCursor - 1));
      when = span <= 1 ? `Week ${weekCursor}` : `Weeks ${weekCursor}\u2013${weekCursor + span - 1}`;
    } else {
      const remainingModules = base.length - i;
      const remainingWeeks = wks - (weekCursor - 1);
      const span = Math.max(1, Math.min(perModule, remainingWeeks - (remainingModules - 1)));
      when = span <= 1 ? `Week ${weekCursor}` : `Weeks ${weekCursor}\u2013${weekCursor + span - 1}`;
      weekCursor += span;
    }
    return { step: i + 1, name, focus, when };
  });
}

/* ---------- FAQs (mix subject-specific + practical) ---------- */
function buildFaqs(course, kb, rng) {
  const title = course.title.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const faqs = [
    { q: `Do I need any experience to start ${title}?`, a: `${kb.prereq} The first sessions make sure everyone is on solid ground before moving faster.` },
    { q: 'Are the classes live or recorded?', a: 'Every session is live and one-on-one with your instructor. Nothing here is a pre-recorded playlist you watch alone.' },
    { q: 'What will I have to show at the end?', a: `You\u2019ll finish with practical work \u2014 ${kb.does[0]} \u2014 plus an Osian Academy certificate you can share with employers.` },
    { q: 'Can I set the class timings around my schedule?', a: 'Yes. Because it\u2019s one-on-one, sessions are booked around your availability, including evenings and weekends.' },
    { q: 'Is there any placement or career support?', a: 'Yes \u2014 resume help, mock interviews and referrals through our hiring-partner network are included with the course.' },
  ];
  return shuffle(rng, faqs).slice(0, 4);
}

/* ---------- who-should-enroll ---------- */
function buildAudience(course, kb, rng) {
  const title = course.title.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const pool = [
    `Beginners who want a structured, guided way into ${kb.subject.toLowerCase()}`,
    `Students looking to add a job-ready skill alongside their degree`,
    `Working professionals switching into or upskilling within ${kb.subject.toLowerCase()}`,
    `Freelancers who want to offer ${title} as a paid service`,
    `Anyone who prefers learning live and one-on-one over watching videos alone`,
    `People preparing for interviews and placements in this field`,
  ];
  return shuffle(rng, pool).slice(0, 4);
}

/* ---------- outcomes / "what you'll be able to do" ---------- */
function buildOutcomes(course, kb, rng) {
  return kb.does.map((d) => d.charAt(0).toUpperCase() + d.slice(1));
}

/* ================= main ================= */
let changed = 0;
for (const course of courses) {
  const rng = seeded(course.id);
  const kb = matchKB(course);

  const desc = writeDescription(course, kb, rng);
  course.description = desc.short;
  course.detailParagraphs = desc.paragraphs;
  course.subject = kb.subject;
  course.blurb = kb.blurb;

  course.outcomes = buildOutcomes(course, kb, rng);
  course.syllabus = buildSyllabus(course, kb, rng);
  course.toolsUsed = kb.tools;
  course.careerRoles = kb.roles.map(([title, salary, d]) => ({ title, salary, desc: d }));
  course.audience = buildAudience(course, kb, rng);
  course.faqs = buildFaqs(course, kb, rng);

  // Keep prerequisite / certification as clean strings, preserving originals if present.
  const prereqFromKeyPoints = Array.isArray(course.keyPoints)
    ? (course.keyPoints.find((p) => /^pre[\s-]*requisite/i.test(p)) || '').replace(/^pre[\s-]*requisite\s*:\s*/i, '').trim()
    : '';
  const certFromKeyPoints = Array.isArray(course.keyPoints)
    ? (course.keyPoints.find((p) => /^certification/i.test(p)) || '').replace(/^certification\s*:\s*/i, '').trim()
    : '';
  course.prerequisite = prereqFromKeyPoints || kb.prereq;
  course.certification = certFromKeyPoints || 'Osian Academy';

  // Refresh legacy fields the listing pages still read.
  course.keyPoints = [...course.outcomes.slice(0, 3), `Prerequisite: ${course.prerequisite}`, `Certification: ${course.certification}`];
  course.contentSections = course.syllabus.map((m) => ({
    heading: m.name,
    paragraphs: [m.focus],
    bullets: [],
  }));

  changed += 1;
}

fs.writeFileSync(catalogPath, `${JSON.stringify(courses, null, 2)}\n`, 'utf8');
console.log(`Enriched ${changed} courses (prices/fees untouched) in ${catalogPath}`);

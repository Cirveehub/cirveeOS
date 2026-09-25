/**
 * CRM nurture content, transcribed from Cirvee's own operating document —
 * `docs/CRM Flow + Course Details..docx` — rather than invented. That
 * document describes an 11-stage lead lifecycle (New Lead → … → Alumni),
 * a walk-in visitor flow, and a library of WhatsApp/email copy for each
 * stage, including a Day 0–5 nurture drip and course-specific Day 1 email.
 *
 * Scope drawn deliberately narrow: every record below is a *template* (real
 * copy, ready to send) or an automation *shell* (the right trigger, and the
 * message sequence in the order and timing the document states) — never
 * activated, and never carrying a condition or branch choice the document
 * didn't already spell out. Two branch points the document explicitly wants
 * split further — Day 1 by course interest, and the post-enrolment access
 * email by learning mode — are left with one representative default
 * (Product Design; Physical) rather than guessed at, with every other
 * variant seeded as its own template ready to be wired in.
 */

import {
  msgTemplateId as asMsgTemplateId,
  automationId as asAutomationId,
  type Automation,
  type AutomationNode,
  type ConditionGroup,
  type MessageTemplate,
} from '@/mocks/types'
import { CRM_AUTO, CRM_MSGT, U } from '@/mocks/seed/ids'
import { at, audit } from '@/mocks/seed/_helpers'

function group(operator: 'and' | 'or', rules: Array<{ field: string; op: string; value: unknown }>): ConditionGroup {
  return { operator, rules }
}

const SEEDED_AT = at('2026-09-20', 9, 0)

/* -------------------------------------------------------------------------- */
/* Message templates                                                         */
/* -------------------------------------------------------------------------- */

interface TemplateSpec {
  id: string
  name: string
  channel: MessageTemplate['channel']
  category: string
  subject: string | null
  body: string
}

const CRM_TEMPLATE_SPECS: TemplateSpec[] = [
  {
    id: CRM_MSGT.whatsappInitialResponse,
    name: 'Sales — initial WhatsApp response',
    channel: 'whatsapp',
    category: 'Sales',
    subject: null,
    body: `Hello Sir/Ma 👋 Thanks for reaching out to Cirvee! My name is {{owner.firstName}}, and I'm here to make your journey into tech simple, exciting, and worth it 💜. Which course would you like to enroll in?`,
  },
  {
    id: CRM_MSGT.day0Welcome,
    name: 'New Lead Nurture — Day 0 — Welcome',
    channel: 'email',
    category: 'CRM Nurture',
    subject: 'Welcome to Cirvee 💜 Your tech journey starts here',
    body: `Hi {{person.firstName}},

Firstly… welcome 💜
And thank you for showing interest in Cirvee Academy.

You've officially taken the first step toward learning a high income digital skill that can open doors locally and globally.

Whether you're looking to switch careers, upskill, build a side income, freelance, or break into tech for the first time…

You're in the right place.

At Cirvee, we don't just teach theory.
We help people build real skills through:
✅ Practical live classes ✅ Real projects ✅ Industry standard tools ✅ Physical and virtual learning options ✅ Mentorship and career support

Over the next few days, we'll show you:
✔ What your selected course really covers ✔ What career opportunities exist ✔ Real student success stories ✔ Tuition and installment options ✔ How to secure your spot in the next cohort

Your selected interest: {{course.title}}
Preferred mode: {{admission.mode}}
Preferred location: {{branch.name}}

One of our advisors may also reach out personally to guide you.

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.day1ProductDesign,
    name: 'New Lead Nurture — Day 1 — Product Design (UI/UX)',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, here's what you'll actually learn in UI/UX 👀`,
    body: `Hi {{person.firstName}},

Yesterday, you took the first step.
Today… let's show you exactly what your Product Design (UI/UX) journey at Cirvee looks like 💜

Over 12 practical weeks, you won't just sit through classes…
You'll actually design real digital products.

Here's what you'll master:
✅ Design Thinking & Problem Solving ✅ User Research & Personas ✅ User Flows & Information Architecture ✅ Wireframing & Low Fidelity Design ✅ Visual Design Principles ✅ Design Systems & Components ✅ High Fidelity UI Design ✅ Interactive Prototyping in Figma ✅ Usability Testing ✅ Real Client Style Capstone Project

By the end of this program, you won't just say "I'm learning design."
You'll have:
✔ A strong portfolio ✔ Real projects ✔ Confidence with Figma ✔ Career readiness ✔ Skills to freelance, intern, or land your first design role

Possible career paths:
💼 UI Designer 💼 UX Designer 💼 Product Designer 💼 Design Intern 💼 Freelance Designer

And yes…
Everything is taught the Cirvee way.
Simple. Practical. Transformative.

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.day1Ai,
    name: 'New Lead Nurture — Day 1 — Artificial Intelligence',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, your AI journey starts here 🤖`,
    body: `Hi {{person.firstName}},

Yesterday, you took the first step.
Today… let's show you exactly what your Artificial Intelligence journey at Cirvee looks like 💜

Over 12 practical weeks, you won't just attend classes…
you'll think, build, experiment, and create like a real AI builder.

Here's what you'll master:
✅ Understanding Artificial Intelligence fundamentals ✅ Python for AI ✅ Working with NumPy, Pandas, and data libraries ✅ Data cleaning and preparation ✅ Data visualization and analysis ✅ Machine Learning fundamentals ✅ Classification algorithms ✅ Neural Networks (ANNs) ✅ Deep Learning & Computer Vision ✅ Natural Language Processing (NLP) ✅ Responsible AI & real-world applications ✅ Capstone AI project

By the end of this program, you won't just say "I'm learning AI."
You'll have:
✔ Real AI projects ✔ Practical Python experience ✔ Machine learning foundations ✔ Portfolio-ready work ✔ Confidence to build smarter solutions

Possible career paths:
💼 AI Intern 💼 Machine Learning Trainee 💼 Data Science Assistant 💼 AI Project Support Specialist 💼 Junior AI Builder

And yes…
Everything is taught the Cirvee way.
Simple. Practical. Transformative.

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.day1DataAnalysis,
    name: 'New Lead Nurture — Day 1 — Data Analysis',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, data skills can change everything 📊`,
    body: `Hi {{person.firstName}},

Yesterday, you took the first step.
Today… let's show you exactly what your Data Analysis journey at Cirvee looks like 💜

Over 16 practical weeks, you won't just attend classes…
you'll analyze, visualize, solve real business problems, and think like a real data analyst.

Here's what you'll master:
✅ Data fundamentals and analytics workflow ✅ Data cleaning with Excel ✅ Advanced Excel for business insights ✅ SQL and database querying ✅ Python for data analysis ✅ NumPy and Pandas ✅ Exploratory Data Analysis (EDA) ✅ Data visualization ✅ Interactive dashboards with Power BI ✅ Statistics for analysts ✅ Predictive analysis ✅ Business intelligence and storytelling ✅ Real world capstone project

By the end of this program, you won't just say "I'm learning data."
You'll have:
✔ Real analysis projects ✔ Dashboard projects ✔ SQL and Python experience ✔ Portfolio-ready case studies ✔ Confidence to solve real business problems

Possible career paths:
💼 Data Analyst 💼 Business Intelligence Analyst 💼 Reporting Analyst 💼 Operations Analyst 💼 Data Visualization Specialist 💼 Junior Data Engineer

And yes…
Everything is taught the Cirvee way.
Simple. Practical. Transformative.

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.day1Cyber,
    name: 'New Lead Nurture — Day 1 — Cybersecurity',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, the world needs more cyber defenders 🔐`,
    body: `Hi {{person.firstName}},

Yesterday, you took the first step.
Today… let's show you exactly what your Cybersecurity journey at Cirvee looks like 💜

Over 16 practical weeks, you won't just attend classes…
you'll investigate threats, secure systems, analyze attacks, and think like a real cyber defender.

Here's what you'll master:
✅ Cybersecurity fundamentals ✅ Windows and Linux security ✅ Networking and protocols ✅ Firewalls and system hardening ✅ Identity and access management ✅ Security Operations Center (SOC) basics ✅ SIEM and log analysis ✅ Incident response ✅ Vulnerability management ✅ Malware and threat intelligence ✅ Governance, Risk, and Compliance ✅ Ethical hacking fundamentals ✅ Scanning and enumeration ✅ Real-world capstone security project

By the end of this program, you won't just say "I'm learning cybersecurity."
You'll have:
✔ Hands-on lab experience ✔ Exposure to real security tools ✔ Threat detection skills ✔ Incident response experience ✔ Portfolio-ready security projects ✔ Confidence to defend real systems

Possible career paths:
💼 Cybersecurity Analyst 💼 SOC Support Analyst 💼 Information Security Associate 💼 IT Security Specialist 💼 Vulnerability Management Associate 💼 Ethical Hacking Trainee

And yes…
Everything is taught the Cirvee way.
Simple. Practical. Transformative.

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.day1Frontend,
    name: 'New Lead Nurture — Day 1 — Frontend Development',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, ready to build what people actually use? 💻`,
    body: `Hi {{person.firstName}},

Ready to build what people actually use? 💻
Let's show you exactly what your Frontend Development journey at Cirvee looks like 💜

Over 12 practical weeks, you won't just attend classes…
you'll code, build, debug, collaborate, and think like a real frontend developer.

Here's what you'll master:
✅ How the web works ✅ HTML and semantic page structure ✅ Modern CSS styling ✅ Responsive design for mobile and desktop ✅ JavaScript fundamentals ✅ DOM manipulation and interactivity ✅ APIs and dynamic content ✅ Git and GitHub collaboration ✅ React fundamentals ✅ Components, hooks, and routing ✅ Live project deployment ✅ Real-world capstone project

By the end of this program, you won't just say "I'm learning to code."
You'll have:
✔ Multiple live websites ✔ Real coding projects ✔ GitHub portfolio projects ✔ Practical React experience ✔ Deployment experience ✔ Confidence to build real products

Possible career paths:
💼 Frontend Developer 💼 React Developer 💼 Web Developer 💼 UI Developer 💼 Junior Software Engineer 💼 Freelance Web Developer

And yes…
Everything is taught the Cirvee way.
Simple. Practical. Transformative.

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.day1Backend,
    name: 'New Lead Nurture — Day 1 — Backend Development',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, ready to build what powers the internet? ⚙️`,
    body: `Hi {{person.firstName}},

Ready to build what powers the internet? ⚙️
Let's show you exactly what your Backend Development journey at Cirvee looks like 💜

Over 16 practical weeks, you won't just attend classes…
you'll code, build APIs, manage databases, secure applications, and think like a real backend developer.

Here's what you'll master:
✅ Backend development fundamentals ✅ Node.js and server-side programming ✅ Express.js and API development ✅ RESTful API design ✅ PostgreSQL and relational databases ✅ MongoDB and NoSQL databases ✅ Authentication and authorization ✅ Testing and API documentation ✅ Deployment and CI/CD workflows ✅ Performance optimization ✅ Real-time applications ✅ Software architecture patterns ✅ Real-world capstone project

By the end of this program, you won't just say "I'm learning backend."
You'll have:
✔ Multiple live backend projects ✔ Real API development experience ✔ Database design skills ✔ Authentication and security experience ✔ Deployment experience ✔ Confidence to build production-ready systems

Possible career paths:
💼 Backend Developer 💼 API Engineer 💼 Software Engineer 💼 Cloud Deployment Associate 💼 Infrastructure Engineer 💼 Full Stack Developer

And yes…
Everything is taught the Cirvee way.
Simple. Practical. Transformative.

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.day1Fullstack,
    name: 'New Lead Nurture — Day 1 — Full-Stack Development',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, ready to build complete digital products? 🚀`,
    body: `Hi {{person.firstName}},

Ready to build complete digital products? 🚀
Let's show you exactly what your Full-Stack Development journey at Cirvee looks like 💜

Over 7 practical months, you won't just attend classes…
you'll code, build, connect frontend to backend, deploy live applications, and think like a real full-stack engineer.

Here's what you'll master:
✅ How the web works ✅ HTML, CSS, and JavaScript fundamentals ✅ Responsive design and user interfaces ✅ React development ✅ Git and GitHub collaboration ✅ Backend development with Node.js ✅ Express.js and API development ✅ PostgreSQL and MongoDB ✅ Authentication and authorization ✅ Full-stack application architecture ✅ Cloud deployment and live hosting ✅ Real-world capstone project

By the end of this program, you won't just say "I'm learning to code."
You'll have:
✔ Multiple live frontend and backend projects ✔ Full-stack application projects ✔ Real GitHub portfolio projects ✔ API development experience ✔ Deployment experience ✔ Confidence to build complete digital products

Possible career paths:
💼 Full-Stack Developer 💼 Software Engineer 💼 Frontend Developer 💼 Backend Developer 💼 Web Application Developer 💼 API Engineer

And yes…
Everything is taught the Cirvee way.
Simple. Practical. Transformative.

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.day1DigitalMarketing,
    name: 'New Lead Nurture — Day 1 — Digital Marketing',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, ready to turn clicks into real results? 📈`,
    body: `Hi {{person.firstName}},

Ready to turn clicks into real results? 📈
Let's show you exactly what your Digital Marketing journey at Cirvee looks like 💜

Over 12 practical weeks, you won't just attend classes…
you'll create campaigns, run ads, analyze performance, grow brands, and think like a real digital marketer.

Here's what you'll master:
✅ Digital marketing fundamentals ✅ Branding and market positioning ✅ Content marketing and copywriting ✅ Visual storytelling and creative design ✅ Social media strategy ✅ Community building and audience growth ✅ Meta Ads (Facebook & Instagram) ✅ Google Ads and cross-platform advertising ✅ TikTok, YouTube, and LinkedIn marketing ✅ Search Engine Optimization (SEO) ✅ Email marketing and automation ✅ Analytics and AI-powered marketing ✅ Real-world capstone campaign project

By the end of this program, you won't just say "I'm learning marketing."
You'll have:
✔ Real campaign projects ✔ Ad setup and optimization experience ✔ Analytics and reporting skills ✔ Portfolio-ready marketing case studies ✔ Practical automation experience ✔ Confidence to grow brands and businesses

Possible career paths:
💼 Digital Marketing Strategist 💼 Social Media Manager 💼 SEO Specialist 💼 PPC Advertising Manager 💼 Content Marketing Executive 💼 Marketing Automation Specialist

And yes…
Everything is taught the Cirvee way.
Simple. Practical. Transformative.

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.day1ProjectMgmt,
    name: 'New Lead Nurture — Day 1 — Project Management',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, ready to lead projects that actually get delivered? 📋`,
    body: `Hi {{person.firstName}},

Ready to lead projects that actually get delivered? 📋
Let's show you exactly what your Project Management journey at Cirvee looks like 💜

Over 12 practical weeks, you won't just attend classes…
you'll plan, organize, lead teams, manage timelines, solve problems, and think like a real project manager.

Here's what you'll master:
✅ Project management fundamentals ✅ Project initiation and goal setting ✅ Scope planning and deliverables ✅ Timeline and resource planning ✅ Budget and cost management ✅ Risk and quality management ✅ Team coordination and communication ✅ Project monitoring and reporting ✅ Project closure and evaluation ✅ Agile and Scrum methodologies ✅ Trello, ClickUp, Asana, and Notion ✅ Real-world capstone project

By the end of this program, you won't just say "I'm learning project management."
You'll have:
✔ Real project planning experience ✔ Team leadership skills ✔ Agile and Scrum knowledge ✔ Portfolio-ready project case studies ✔ Industry tool experience ✔ Confidence to lead projects from start to finish

Possible career paths:
💼 Project Coordinator 💼 Assistant Project Manager 💼 Operations Associate 💼 Scrum Assistant 💼 Project Administrator 💼 Program Support Officer

And yes…
Everything is taught the Cirvee way.
Simple. Practical. Transformative.

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.day2SuccessStories,
    name: 'New Lead Nurture — Day 2 — Student Success Stories',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, others started exactly where you are today 💜`,
    body: `Hi {{person.firstName}},

A lot of people who join Cirvee usually say things like:
"I've never done tech before." "Can I really learn this?" "What if I'm not smart enough?" "Can I actually make money from this?"

Truth is…
Many of our students started exactly where you are today.
Unsure. Curious. A little nervous.

But they took the first step…
And everything changed.

Meet a few Cirveefied stories 💜
🚀 Watch student transformation story [Insert Instagram Reel Link Here]
📊 Watch real student project showcase [Insert YouTube Video Link Here]
🎓 Watch graduation moments [Insert Graduation Video Link Here]
💼 Watch internship / placement success story [Insert Success Story Link Here]
🔥 Watch what happens inside a live Cirvee class [Insert Classroom Reel Link Here]

And the beautiful part?
None of them had it all figured out when they started.
They simply started.
And stayed consistent.

At Cirvee…
we don't just teach people.
We build builders. We build creators. We build leaders. We build tech-savvy people.

Your story could be next.

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.day3Pricing,
    name: 'New Lead Nurture — Day 3 — Pricing + Flexible Payment',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, learning made easy with Cirvee 💜`,
    body: `Hi {{person.firstName}},

By now…
you've seen what learning at Cirvee looks like.
You've seen real student stories.
You've seen what's possible.

Now let's talk about something many people quietly wonder about…
"Can I really afford this?"

At Cirvee…
we believe world-class tech education shouldn't feel out of reach.
And no…
you don't have to break the bank to learn with us 💜

Because learning should be powerful…
and flexible.

Your selected program: {{course.title}}
Duration: {{course.duration}}
Tuition: ₦{{course.fee}}

With Cirvee, you can choose:
✅ Full payment
✅ Flexible installment payment
✅ Monthly cohort options
✅ Physical live classes
✅ Live virtual classes
✅ Private one-on-one premium learning

Because at Cirvee…
we care about helping serious people start.
Not just admire from afar.

Ready to secure your spot?
Reply with: I'M READY 💜
or click below: [Insert Enrollment Link]

One of our advisors will personally guide you.

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.day4LimitedSlots,
    name: 'New Lead Nurture — Day 4 — Limited Slots / Cohort Urgency',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, your spot at Cirvee won't stay open forever ⏳`,
    body: `Hi {{person.firstName}},

A quick heads up from us at Cirvee Academy 💜

Our upcoming {{cohort.code}} is currently filling up…
and we're already seeing strong interest from:
📍 Ibadan learners 📍 Lagos learners 🌍 Virtual learners joining from anywhere 💼 Private learning enquiries from individuals across different locations

As much as we'd love to take everyone…
we intentionally keep learning at Cirvee practical, interactive, and properly guided.

That means:
✅ Limited class size ✅ Live tutor access ✅ Real-time support ✅ Hands-on projects ✅ Better learning outcomes ✅ Personalized learning experience

And because of that…
available slots don't stay open forever.

Your selected program: {{course.title}}
Learning options: 🏫 Physical Classes (Ibadan & Lagos) 💻 Live Virtual Learning (Anywhere) 👤 Private One-on-One Learning (Anywhere in the world)
Next cohort: {{cohort.code}}
Class start date: {{cohort.startDate}}
Current status: {{cohort.slotsRemaining}} spots left

If you've been thinking about it…
This might be your sign.
Don't wait until the cohort is full…
and have to wait for the next intake.

Ready to secure your spot?
Reply with: SAVE MY SPOT 💜
or click below: [Insert Enrollment Link]

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.day5FinalPush,
    name: 'New Lead Nurture — Day 5 — Final Push',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, should we save your spot at Cirvee? 💜`,
    body: `Hi {{person.firstName}},

Over the past few days…
you've seen what learning at Cirvee looks like.

You've seen:
✅ What your selected course covers ✅ Real student success stories ✅ Flexible payment options ✅ Available learning modes ✅ Upcoming cohort opportunities

So now…
the only real question is:
Are you ready to start? 💜

Because the truth is…
One decision can completely change your career.
One skill can open global opportunities.
One step can shift everything.

And maybe…
this is your moment.

At Cirvee, whether you want to learn through:
🏫 Physical classes in Ibadan or Lagos 💻 Live virtual classes from anywhere 👤 Private one-on-one learning from anywhere in the world
We're ready for you.

Your selected program: {{course.title}}
Next cohort: {{cohort.code}}
Class starts: {{cohort.startDate}}

What happens next?
Simply reply with any of these:
💜 I'M READY 📞 CALL ME 💬 WHATSAPP ME 👤 PRIVATE TRAINING 💻 VIRTUAL CLASS 🏫 PHYSICAL CLASS
…and a member of our team will personally guide you.

Or click below to secure your spot: [Insert Enrollment Link]

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.cohortAnnouncement,
    name: 'Promotional — New Cohort Announcement',
    channel: 'email',
    category: 'Promotional',
    subject: `{{person.firstName}}, a new Cirvee cohort is officially here 💜`,
    body: `Hi {{person.firstName}},

A new month means new opportunities…
and at Cirvee Academy, a new cohort is officially open 💜

Introducing: {{cohort.code}}

And this might just be your sign to finally start.

Whether you're looking to:
💻 Break into tech 📈 Switch careers 💼 Build a side income 🌍 Work globally 🚀 Future-proof your career

Cirvee is ready for you.

Programs currently open:
🎨 Product Design (UI/UX) 📊 Data Analysis 🤖 Artificial Intelligence 💻 Frontend Development ⚙️ Backend Development 🚀 Full-Stack Development 🔐 Cybersecurity 📋 Project Management 📈 Digital Marketing

Learning options:
🏫 Physical classes across our Cirvee campuses (Ibadan or Lagos) 💻 Live virtual learning from anywhere 👤 Private one-on-one learning from anywhere in the world

Cohort details:
📅 Start Date: {{cohort.startDate}} 🎓 Cohort: {{cohort.code}}

Ready to join?
Reply with: 💜 I'M READY
or click below: [Insert Enrollment Link]

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.walkinThankYou,
    name: 'Walk-in — Thank You for Visiting',
    channel: 'whatsapp',
    category: 'Walk-in',
    subject: null,
    body: `Hi {{person.firstName}} 👋 It was great having you at Cirvee today. Thank you for stopping by our {{branch.name}} campus. We're excited about your interest in {{course.title}}. Our team will be in touch shortly to guide your next steps. Stay Cirvee 💜`,
  },
  {
    id: CRM_MSGT.walkin24h,
    name: 'Walk-in — 24-Hour Follow-up',
    channel: 'whatsapp',
    category: 'Walk-in',
    subject: null,
    body: `Hi {{person.firstName}}, just checking in after your visit to Cirvee Academy yesterday 😊 We hope you had a great experience exploring {{course.title}} with us. Do you have any questions about the course content, tuition or installment options, physical/virtual/private learning, or start dates? Simply reply with I HAVE A QUESTION or I'M READY.`,
  },
  {
    id: CRM_MSGT.walkin72h,
    name: 'Walk-in — 72-Hour Follow-up',
    channel: 'whatsapp',
    category: 'Walk-in',
    subject: null,
    body: `Hi {{person.firstName}}, just checking in again 😊 It's been a few days since your visit to Cirvee Academy, and we wanted to see how you're feeling about {{course.title}} 💜 If you're still considering physical, virtual, or private learning, we'd genuinely love to help you get started. Reply with I'M READY, I HAVE A QUESTION, or I NEED INSTALLMENT. Stay Cirvee 💜`,
  },
  {
    id: CRM_MSGT.walkinCourtesy,
    name: 'Walk-in — Courtesy Check-in',
    channel: 'whatsapp',
    category: 'Walk-in',
    subject: null,
    body: `Hi {{person.firstName}}, it was truly a pleasure having you at Cirvee Academy today — we genuinely appreciate your time 💜 At Cirvee, we're building more than classrooms… we're building a community. Thanks once again for stopping by. Our doors are always open. Stay Cirvee 💜`,
  },
  {
    id: CRM_MSGT.registrationReminder,
    name: 'Payment Follow-up — Registration Reminder',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, your Cirvee application is almost complete 💜`,
    body: `Hi {{person.firstName}},

Good news…
Your interest in {{course.title}} has already been noted, and your profile is almost ready.

The only thing left?
Securing your slot with your registration payment 💜

Once your registration is completed, we immediately begin preparing your journey:
✅ Student profile creation ✅ Cohort allocation ✅ Customer experience onboarding ✅ Timetable preparation ✅ Tutor assignment ✅ Class access preparation

Program: {{course.title}}
Registration Fee: ₦{{invoice.total}}
Next Cohort: {{cohort.code}}

Ready to complete it?
Reply with: 💜 I'M MAKING PAYMENT
or click below: [Insert Payment Link]

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.tuitionReminder,
    name: 'Payment Follow-up — Tuition Completion Reminder',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, you're closer than you think 💜`,
    body: `Hi {{person.firstName}},

Firstly… welcome once again 💜

We've successfully received your registration for {{course.title}}…
and your journey with Cirvee has officially begun.

Now… there's just one final step left.
Completing your tuition payment to fully secure your spot.

Once your tuition is completed, we immediately move you into:
✅ Full student onboarding ✅ Cohort confirmation ✅ Timetable access ✅ Tutor introduction ✅ Class group access ✅ Academic tracking ✅ Student ID generation

Your selected program: {{course.title}}
Tuition balance: ₦{{invoice.balance}}
Payment plan: {{invoice.paymentPlan}}
Class starts: {{cohort.startDate}}

The truth? Serious people don't just start… they finish.

Ready to complete your enrollment?
Reply with: 💜 PAYING NOW
or click below: [Insert Payment Link]

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.classStartingReminder,
    name: 'Payment Follow-up — Class Starts Soon / Final Reminder',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, your Cirvee class starts soon ⏳`,
    body: `Hi {{person.firstName}},

Just a quick and important reminder from us at Cirvee Academy 💜

Your selected program, {{course.title}}, is scheduled to begin very soon…
and we noticed your enrollment is not yet fully completed.

We'd genuinely hate for you to miss this cohort.
Because once classes begin… learning starts immediately. Projects begin. Teams are formed. Tutors start live sessions. And students begin building real things from Day One.

Your class details:
📚 Program: {{course.title}} 📅 Start Date: {{cohort.startDate}} ⏰ Schedule: {{cohort.schedule}} 🎓 Cohort: {{cohort.code}}

Outstanding balance: ₦{{invoice.balance}}

Once payment is completed, we immediately activate:
✅ Student onboarding ✅ Timetable access ✅ Tutor introduction ✅ WhatsApp class group access ✅ Student ID generation ✅ Academic onboarding

This is your moment. Don't let procrastination delay your growth.

Ready to complete your enrollment?
Reply with: 💜 PAYING NOW
or click below: [Insert Payment Link]

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.welcomeOnboarding,
    name: 'Post-Enrolment — Welcome Onboarding',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, welcome officially to Cirvee Academy 💜`,
    body: `Hi {{person.firstName}},

Congratulations 🎉
Your enrollment for {{course.title}} has been successfully confirmed…
and you're now officially part of Cirvee Academy 💜

Firstly… we want to say welcome. Not just to a class… but to a growing community of builders, creators, innovators, and future leaders.

At Cirvee… you're not here to just watch. You're here to:
✅ Learn live ✅ Build hands-on ✅ Ask questions in real time ✅ Work on real projects ✅ Grow with expert tutors ✅ Become truly tech-savvy

Your enrollment details:
👤 Student Name: {{person.firstName}} {{person.lastName}} 📚 Program: {{course.title}} 🎓 Cohort: {{cohort.code}} 📅 Start Date: {{cohort.startDate}} 🆔 Student ID: {{student.id}}

Your timetable and student dashboard:
🔗 Access Your Cirvee Student Dashboard [Insert Dashboard Link]

Inside your dashboard, you'll find:
✅ Your full timetable ✅ Upcoming classes ✅ Assignments and projects ✅ Learning resources ✅ Payment records ✅ Attendance records ✅ Tutor updates ✅ Important announcements

Important onboarding resources — please review before orientation:
📘 Student Handbook [Insert PDF / Drive Link] 📜 Student Learning Policy [Insert PDF / Drive Link] 🔗 Student Portal / Dashboard [Insert Portal Link]

Over the next few emails, we'll send you orientation details, tutor information, timetable, class access, and community access.

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.orientationVideo,
    name: 'Post-Enrolment — Orientation / Welcome Video',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, your Cirvee welcome video is here 💜`,
    body: `Hi {{person.firstName}},

Your journey at Cirvee Academy officially begins now…
and before your first class… we'd love you to watch this special onboarding experience created just for you 💜

Watch Your Cirvee Welcome & Orientation Video:
🎥 [Insert Video Link Here] (YouTube • Vimeo • Private Drive Link • Student Portal)

In this short session, you'll discover:
✅ How learning works at Cirvee ✅ What to expect from your classes ✅ Academic expectations ✅ Projects and assessments ✅ Student culture and community ✅ Attendance and certification requirements ✅ Support channels available to you ✅ How to maximize your Cirvee experience

Your enrollment details:
📚 Program: {{course.title}} 🎓 Cohort: {{cohort.code}} 📅 Class Start: {{cohort.startDate}}

Please watch this before your first class. It'll help you start stronger, smarter, and more confidently.

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.meetTutor,
    name: 'Post-Enrolment — Meet Your Tutor / Academic Team',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, meet your Cirvee tutor 💜`,
    body: `Hi {{person.firstName}},

By now… you're officially enrolled. You've watched your onboarding. You've reviewed your student resources.

Now it's time to meet the people who'll help shape your journey at Cirvee Academy 💜

Meet your tutor:
👨‍🏫 {{tutor.name}} 🎯 Role: {{tutor.role}} 💼 Experience: {{tutor.experience}} 🌍 Industry Focus: {{tutor.specialty}}

About your tutor: {{tutor.bio}}

Your academic support team:
👩‍💼 Academic Officer: {{academicOfficer.contact}} 💜 Customer Experience Coordinator: {{cxOfficer.contact}} 📞 Student Support: {{support.contact}}

At Cirvee… you're never learning alone. You'll have access to:
✅ Live classes ✅ Real-time feedback ✅ Project reviews ✅ Career guidance ✅ Assignment support ✅ Community accountability

Your team is ready. And trust us… they're rooting for your growth already 💜

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.accessPhysical,
    name: 'Post-Enrolment — Class Access — Physical',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, your Cirvee campus access is here 💜`,
    body: `Hi {{person.firstName}},

This is it. Your journey at Cirvee Academy officially starts now 💜
Everything has been prepared… and you're now ready for Day One.

Your learning details:
👤 Student Name: {{person.firstName}} {{person.lastName}} 🆔 Student ID: {{student.id}} 📚 Program: {{course.title}} 🎓 Cohort: {{cohort.code}} 📅 Start Date: {{cohort.startDate}} ⏰ Class Schedule: {{cohort.schedule}}

Your campus access:
🏫 Campus Address: {{branch.address}}
🗺️ Google Maps [Insert Maps Link]
💬 Class Community [Insert WhatsApp Link]
📂 Learning Resources [Insert Portal Link]

Please arrive at least 15–20 minutes early. Come with your laptop (where applicable), a jotter or digital note setup, a charger, and positive energy 💜

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.accessVirtual,
    name: 'Post-Enrolment — Class Access — Virtual',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, your virtual class access is here 💜`,
    body: `Hi {{person.firstName}},

This is it. Your journey at Cirvee Academy officially starts now 💜
Everything has been prepared… and you're now ready for Day One.

Your learning details:
👤 Student Name: {{person.firstName}} {{person.lastName}} 🆔 Student ID: {{student.id}} 📚 Program: {{course.title}} 🎓 Cohort: {{cohort.code}} 📅 Start Date: {{cohort.startDate}} ⏰ Class Schedule: {{cohort.schedule}}

Your virtual class access:
💻 Live Class Link [Insert Zoom / Meet Link]
💬 Class Community [Insert WhatsApp Link]
📂 Learning Resources [Insert Portal Link]
📹 Orientation Video [Insert Video Link]

Please join at least 10 minutes early. Ensure you have stable internet, a fully charged device, a quiet learning environment, notebook or digital notes, and positive energy 💜

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
  {
    id: CRM_MSGT.accessPrivate,
    name: 'Post-Enrolment — Class Access — Private Training',
    channel: 'email',
    category: 'CRM Nurture',
    subject: `{{person.firstName}}, your private Cirvee learning access is here 💜`,
    body: `Hi {{person.firstName}},

Welcome officially to Cirvee Private Training 💜
A personalized learning experience has now been prepared specifically for you.

This means… you won't just attend classes… you'll learn with dedicated attention, flexible scheduling, and personalized guidance built around your goals.

Your learning details:
👤 Student Name: {{person.firstName}} {{person.lastName}} 🆔 Student ID: {{student.id}} 📚 Program: {{course.title}} 📅 Start Date: {{admission.startDate}} ⏰ Schedule: {{admission.schedule}}

Your private access:
🔗 Live Access Link: {{admission.accessLink}}
💬 Private Support Channel [Insert WhatsApp Link]
📂 Learning Resources [Insert Portal Link]
📹 Orientation Video [Insert Video Link]

Your tutor and support team are ready.

Big things are coming.
Remember, only Cirvee can make you tech-savvy.

With love,
Team Cirvee 💜`,
  },
]

export const crmMessageTemplates: MessageTemplate[] = CRM_TEMPLATE_SPECS.map((t) => ({
  id: asMsgTemplateId(t.id),
  name: t.name,
  channel: t.channel,
  category: t.category,
  subject: t.subject,
  preview: t.body.replace(/\s+/g, ' ').trim().slice(0, 90),
  body: t.body,
  mergeFields: [...new Set([...t.body.matchAll(/\{\{([a-zA-Z.]+)\}\}/g)].map((m) => m[1]))],
  language: 'en',
  version: 1,
  whatsappApprovalStatus: t.channel === 'whatsapp' ? 'pending' : 'n_a',
  usedByCount: 0,
  ...audit(SEEDED_AT, U.amarachi),
}))

/* -------------------------------------------------------------------------- */
/* Automation shells                                                          */
/* -------------------------------------------------------------------------- */

function sendEmail(id: string, templateId: string, summary: string): AutomationNode {
  return { id, kind: 'action', actionType: 'send_message', params: { channel: 'email', templateId, recipient: 'trigger.person' }, summary }
}

function sendWhatsapp(id: string, templateId: string, summary: string): AutomationNode {
  return { id, kind: 'action', actionType: 'send_message', params: { channel: 'whatsapp', templateId, recipient: 'trigger.person' }, summary }
}

function wait(id: string, amount: number, unit: 'hours' | 'days', summary: string): AutomationNode {
  return { id, kind: 'delay', wait: { amount, unit }, workingHoursOnly: false, summary }
}

/**
 * Day 1 of the nurture drip is one email out of nine, chosen by the course
 * the lead actually said they wanted — not the same email for everyone. Each
 * lane tests `lead.course` against one course name and points at that
 * course's own Day 1 template; a lead whose course doesn't match any lane
 * (or hasn't been captured yet) falls through the empty "Otherwise" lane and
 * simply skips to Day 2, rather than receiving the wrong course's content.
 */
const DAY1_COURSE_BRANCH: AutomationNode[] = [
  {
    id: 'n4',
    kind: 'branch',
    label: 'Which course did the lead say they wanted?',
    lanes: [
      { label: 'Product Design (UI/UX)', condition: group('and', [{ field: 'lead.course', op: 'is', value: 'Product Design (UI/UX)' }]), nodeIds: ['n4a'] },
      { label: 'Artificial Intelligence (AI)', condition: group('and', [{ field: 'lead.course', op: 'is', value: 'Artificial Intelligence (AI)' }]), nodeIds: ['n4b'] },
      { label: 'Data Analysis', condition: group('and', [{ field: 'lead.course', op: 'is', value: 'Data Analysis' }]), nodeIds: ['n4c'] },
      { label: 'Cybersecurity Fundamentals', condition: group('and', [{ field: 'lead.course', op: 'is', value: 'Cybersecurity Fundamentals' }]), nodeIds: ['n4d'] },
      { label: 'Frontend Engineering', condition: group('and', [{ field: 'lead.course', op: 'is', value: 'Frontend Engineering' }]), nodeIds: ['n4e'] },
      { label: 'Backend Engineering', condition: group('and', [{ field: 'lead.course', op: 'is', value: 'Backend Engineering' }]), nodeIds: ['n4f'] },
      { label: 'Full-Stack Development', condition: group('and', [{ field: 'lead.course', op: 'is', value: 'Full-Stack Development' }]), nodeIds: ['n4g'] },
      { label: 'Digital Marketing', condition: group('and', [{ field: 'lead.course', op: 'is', value: 'Digital Marketing' }]), nodeIds: ['n4h'] },
      { label: 'Project Management', condition: group('and', [{ field: 'lead.course', op: 'is', value: 'Project Management' }]), nodeIds: ['n4i'] },
      { label: 'Otherwise', condition: null, nodeIds: [] },
    ],
  },
  sendEmail('n4a', CRM_MSGT.day1ProductDesign, 'Day 1 — course breakdown for Product Design (UI/UX).'),
  sendEmail('n4b', CRM_MSGT.day1Ai, 'Day 1 — course breakdown for Artificial Intelligence (AI).'),
  sendEmail('n4c', CRM_MSGT.day1DataAnalysis, 'Day 1 — course breakdown for Data Analysis.'),
  sendEmail('n4d', CRM_MSGT.day1Cyber, 'Day 1 — course breakdown for Cybersecurity.'),
  sendEmail('n4e', CRM_MSGT.day1Frontend, 'Day 1 — course breakdown for Frontend Development.'),
  sendEmail('n4f', CRM_MSGT.day1Backend, 'Day 1 — course breakdown for Backend Development.'),
  sendEmail('n4g', CRM_MSGT.day1Fullstack, 'Day 1 — course breakdown for Full-Stack Development.'),
  sendEmail('n4h', CRM_MSGT.day1DigitalMarketing, 'Day 1 — course breakdown for Digital Marketing.'),
  sendEmail('n4i', CRM_MSGT.day1ProjectMgmt, 'Day 1 — course breakdown for Project Management.'),
]

const CRM_AUTOMATION_SHELLS: Array<{
  id: string
  key: string
  name: string
  description: string
  modules: string[]
  nodes: AutomationNode[]
}> = [
  {
    id: CRM_AUTO.newLeadNurture,
    key: 'crm-new-lead-nurture',
    name: 'New Lead Nurture — Day 0 to Day 5',
    description:
      'The Stage 1 email drip from the CRM document: welcome, course breakdown, success stories, pricing, urgency, final push. Day 1 branches by the course the lead expressed interest in, one lane per course from the document — a lead whose course does not match any lane simply skips to Day 2.',
    modules: ['CRM', 'Engage'],
    nodes: [
      { id: 'n1', kind: 'trigger', triggerType: 'lead_created', params: {}, summary: 'Runs when a new lead record is created, from any source.' },
      sendEmail('n2', CRM_MSGT.day0Welcome, 'Day 0 — welcome and acknowledge interest.'),
      wait('n3', 1, 'days', 'Wait one day.'),
      ...DAY1_COURSE_BRANCH,
      wait('n5', 1, 'days', 'Wait one day.'),
      sendEmail('n6', CRM_MSGT.day2SuccessStories, 'Day 2 — student success stories.'),
      wait('n7', 1, 'days', 'Wait one day.'),
      sendEmail('n8', CRM_MSGT.day3Pricing, 'Day 3 — pricing and flexible payment.'),
      wait('n9', 1, 'days', 'Wait one day.'),
      sendEmail('n10', CRM_MSGT.day4LimitedSlots, 'Day 4 — limited slots / cohort urgency.'),
      wait('n11', 1, 'days', 'Wait one day.'),
      sendEmail('n12', CRM_MSGT.day5FinalPush, 'Day 5 — final push.'),
    ],
  },
  {
    id: CRM_AUTO.walkinNurture,
    key: 'crm-walkin-nurture',
    name: 'Walk-in visitor — thank you through 7-day follow-up',
    description:
      'The walk-in visitor cadence from the CRM document: same-day thank-you, then 24-hour, 72-hour and 7-day follow-ups, WhatsApp-first. The document has no fresh copy for the 7-day step beyond "limited slot / cohort reminder", so this reuses the cohort announcement template.',
    modules: ['CRM', 'Engage', 'Physical'],
    nodes: [
      { id: 'n1', kind: 'trigger', triggerType: 'lead_created', params: {}, summary: 'Runs when a new lead record is created, from any source.' },
      { id: 'n2', kind: 'condition', group: group('and', [{ field: 'lead.source', op: 'is', value: 'walk_in_kiosk' }]), summary: 'Only for walk-in visitors.' },
      sendWhatsapp('n3', CRM_MSGT.walkinThankYou, 'Same day — thank you for visiting.'),
      wait('n4', 24, 'hours', 'Wait 24 hours.'),
      sendWhatsapp('n5', CRM_MSGT.walkin24h, '24-hour follow-up check-in.'),
      wait('n6', 48, 'hours', 'Wait a further 48 hours (72 hours since the visit).'),
      sendWhatsapp('n7', CRM_MSGT.walkin72h, '72-hour follow-up with urgency.'),
      wait('n8', 4, 'days', 'Wait a further 4 days (7 days since the visit).'),
      sendEmail('n9', CRM_MSGT.cohortAnnouncement, '7-day — limited slot / cohort reminder.'),
    ],
  },
  {
    id: CRM_AUTO.walkinCourtesy,
    key: 'crm-walkin-courtesy',
    name: 'Walk-in visitor — courtesy check-in',
    description:
      'For courtesy, parent, partner, vendor and guest visits that are not sales prospects. The document distinguishes these by a "visit type" the CX intake form does not yet capture as a field here, so the condition below only recognises the visit as a walk-in, not the visit type.',
    modules: ['CRM', 'Physical'],
    nodes: [
      { id: 'n1', kind: 'trigger', triggerType: 'lead_created', params: {}, summary: 'Runs when a new lead record is created, from any source.' },
      { id: 'n2', kind: 'condition', group: group('and', [{ field: 'lead.source', op: 'is', value: 'walk_in_kiosk' }]), summary: 'Only for walk-in visitors.' },
      sendWhatsapp('n3', CRM_MSGT.walkinCourtesy, 'Courtesy thank-you, no sales follow-up attached.'),
    ],
  },
  {
    id: CRM_AUTO.registrationReminder,
    key: 'crm-registration-reminder',
    name: 'Registration payment reminder',
    description:
      'The document calls for this 24–48 hours after a lead enters Registration Pending, if unpaid. This prototype tracks payment on the Invoice, not as an Admission status flag, so the unpaid condition is not wired — add it once the right invoice condition is decided.',
    modules: ['CRM', 'Finance'],
    nodes: [
      { id: 'n1', kind: 'trigger', triggerType: 'admission_created', params: {}, summary: 'Runs when an admission record is created against a cohort.' },
      wait('n2', 48, 'hours', 'Wait 48 hours.'),
      sendEmail('n3', CRM_MSGT.registrationReminder, 'Registration payment reminder.'),
    ],
  },
  {
    id: CRM_AUTO.tuitionReminder,
    key: 'crm-tuition-reminder',
    name: 'Tuition payment completion reminder',
    description:
      'Follows the registration reminder once a slot is secured but tuition is outstanding. Same caveat as the registration reminder: the unpaid-balance condition is not wired here yet.',
    modules: ['CRM', 'Finance'],
    nodes: [
      { id: 'n1', kind: 'trigger', triggerType: 'admission_created', params: {}, summary: 'Runs when an admission record is created against a cohort.' },
      wait('n2', 5, 'days', 'Wait five days.'),
      sendEmail('n3', CRM_MSGT.tuitionReminder, 'Tuition / payment completion reminder.'),
    ],
  },
  {
    id: CRM_AUTO.classStartingReminder,
    key: 'crm-class-starting-reminder',
    name: 'Class starting soon — final reminder',
    description:
      'The document wants this 5 days before the cohort start date. This automation engine does not yet have a "days before a cohort date" trigger, only fixed-schedule and event triggers, so this is seeded on `scheduled` as the closest fit — a real days-before-cohort-start trigger is a small engineering addition, not a configuration choice.',
    modules: ['CRM', 'Academy'],
    nodes: [
      { id: 'n1', kind: 'trigger', triggerType: 'scheduled', params: { frequency: 'daily', time: '08:00' }, summary: 'Runs on a fixed schedule rather than an event.' },
      sendEmail('n2', CRM_MSGT.classStartingReminder, 'Class starting soon — final reminder.'),
    ],
  },
  {
    id: CRM_AUTO.postEnrolmentOnboarding,
    key: 'crm-post-enrolment-onboarding',
    name: 'Post-enrolment onboarding sequence',
    description:
      'Stage 3 of the CRM document: welcome onboarding, orientation video, meet-your-tutor, then class access. The document wants the access step split into three separate automations by learning mode — this shell sends the Physical version to everyone; the Virtual and Private Training versions are seeded as templates, ready to be split out once that branch is configured.',
    modules: ['CRM', 'Engage', 'Learn'],
    nodes: [
      { id: 'n1', kind: 'trigger', triggerType: 'tuition_fully_paid', params: { scope: 'invoice' }, summary: "Runs when an invoice's balance reaches zero." },
      sendEmail('n2', CRM_MSGT.welcomeOnboarding, 'Welcome onboarding.'),
      wait('n3', 1, 'days', 'Wait one day.'),
      sendEmail('n4', CRM_MSGT.orientationVideo, 'Orientation / welcome video.'),
      wait('n5', 1, 'days', 'Wait one day.'),
      sendEmail('n6', CRM_MSGT.meetTutor, 'Meet your tutor / academic team.'),
      wait('n7', 1, 'days', 'Wait one day.'),
      sendEmail('n8', CRM_MSGT.accessPhysical, 'Class access (Physical default; Virtual and Private versions are in the template library).'),
    ],
  },
]

export const crmAutomations: Automation[] = CRM_AUTOMATION_SHELLS.map((s) => ({
  id: asAutomationId(s.id),
  automationKey: s.key,
  version: 1,
  name: s.name,
  description: s.description,
  status: 'draft',
  ownerUserId: U.amarachi,
  nodes: s.nodes,
  modulesTouched: s.modules,
  reliability: {
    idempotencyKeyFields: ['person.id'],
    retryAttempts: 1,
    retryBackoff: 'exponential' as const,
    onFailure: 'retry_then_exception' as const,
    maxRunsPerPersonPerPeriod: null,
  },
  stats: { runs7d: 0, successRate: 0, lastRunAt: null },
  supersedesVersionId: null,
  ...audit(SEEDED_AT, U.amarachi),
}))

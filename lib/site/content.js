// Website content: services, the five-step journey and plans.
// Edit the text here; every page that shows it updates.
// status "live" = available now; "soon" = shown on the site, opening shortly.

export const SITE = {
  name: "Academic Catalyst",
  url: "https://academic-catalyst.app",
  tagline: "From a rough idea to a proposal you can defend.",
  description:
    "Test your topic, sharpen your objectives, map the literature and plan your methods, then turn the whole project into a formatted research proposal with verified references.",
  payment: "Pay by MTN or Airtel mobile money, or USDT.",
  whatsapp: "256784335273",
};

// Click-to-chat link for the WhatsApp Business number, with a friendly opening message.
export const whatsappHref = (text = "Hello Academic Catalyst, I have a question about my research proposal.") =>
  `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`;

export const SERVICES = [
  {
    slug: "topic-validator",
    group: "tools",
    kind: "Free tool",
    step: 1,
    status: "live",
    name: "Topic Validator",
    short: "Check that a topic is clear, original, relevant and feasible.",
    headline: "Find out if your topic will hold up, before you write a word.",
    intro:
      "Paste your proposed topic or working title. You get an honest check on four tests, the closest existing studies, and stronger titles to choose from.",
    price: "3 free checks a month",
    features: [
      "A score out of five for clarity, originality, relevance and feasibility, each with the reasons behind it",
      "The closest existing studies, with real links",
      "Three sharper titles and the red flags to avoid",
    ],
    how: [
      ["Paste your topic", "Add your level and institution if you know them. They sharpen the feasibility check."],
      ["We search and score", "Published studies are searched and the topic is tested against the four criteria."],
      ["Refine and move on", "Pick a title and carry it straight into the SMART Objectives Builder."],
    ],
    note: "Originality is reported as what our searches found. No tool can prove that a topic has never been studied.",
    next: "smart-objectives",
  },
  {
    slug: "smart-objectives",
    group: "tools",
    kind: "Free tool",
    step: 2,
    status: "live",
    name: "SMART Objectives Builder",
    short: "Focused objectives and research questions from a broad idea.",
    headline: "Turn a broad topic into objectives an examiner will accept.",
    intro:
      "Start from your topic. You get a general objective, three to five specific objectives tested against the SMART criteria, and the research questions that go with them.",
    price: "3 free uses a month",
    features: [
      "A general objective and three to five specific objectives",
      "A SMART check for every objective: specific, measurable, achievable, relevant and time-bound",
      "Matching research questions, with optional hypotheses",
      "A table linking each objective to its question and its method",
    ],
    how: [
      ["Bring your topic", "Type it in, or carry it over from the Topic Validator."],
      ["Review the objectives", "Each objective is tested and the weak points are shown, not hidden."],
      ["Keep what works", "Edit, regenerate one objective, then move on to the literature."],
    ],
    next: "literature-review",
  },
  {
    slug: "literature-review",
    group: "tools",
    kind: "Free tool",
    step: 3,
    status: "live",
    name: "Literature Review Assistant",
    short: "Search real papers and build a synthesis matrix.",
    headline: "See what the evidence says, with sources you can open.",
    intro:
      "Search published research by question, read what each study found, and build a synthesis matrix that turns into your literature review.",
    price: "Free searching; 3 free evidence summaries a month",
    features: [
      "Search more than 250 million published works by research question, free",
      "An evidence summary by theme that cites the studies it draws on",
      "A synthesis matrix of aims, methods, settings, findings and gaps",
      "References built from the database records, in APA, RIS or BibTeX",
    ],
    how: [
      ["Ask a question", "Use your research question, or one of your objectives."],
      ["Read the evidence", "Open each paper, see its key finding, and keep the ones that matter."],
      ["Build the matrix", "Your selected studies become a matrix and a reference list."],
    ],
    next: "methodology",
  },
  {
    slug: "methodology",
    group: "tools",
    kind: "Free tool",
    step: 4,
    status: "live",
    name: "Methodology Builder",
    short: "Design, sampling, instruments and analysis, planned for you.",
    headline: "A complete methodology plan, with the working shown.",
    intro:
      "From your objectives to a full plan: research design, population, sampling, instruments, analysis by objective, validity and ethics.",
    price: "3 free plans a month",
    features: [
      "Research philosophy and design, with the reasons for each choice",
      "Sample size by Yamane, Krejcie and Morgan or Cochran, calculated with the working shown",
      "Data collection instruments matched to each objective",
      "Analysis, validity, reliability and ethics covered",
    ],
    how: [
      ["Add your objectives", "Carry them over from the Objectives Builder, or type them in."],
      ["Describe the setting", "Population, place and the time and money you have."],
      ["Get the plan", "A methodology you can adapt, with every calculation explained."],
    ],
    next: "research-proposal",
  },
  {
    slug: "research-proposal",
    group: "services",
    kind: "Full document",
    step: 5,
    status: "live",
    name: "Research Proposal",
    short: "A complete, formatted proposal with verified references.",
    headline: "A complete research proposal, built on your own thinking.",
    intro:
      "Everything you have prepared comes together in a full proposal that follows your institution's guidelines, with every reference found and checked during writing, ready to download as a Word document.",
    price: "$80 single, or from $70 a month",
    features: [
      "Introduction, literature review, methodology, ethics, timeline, references and data collection tools",
      "Length, structure and citation style set by your institution's guidelines",
      "Every reference confirmed during writing; anything uncertain is flagged for you",
      "A plain-language clarity note showing where to add your own experience and data",
      "A formatted Word download with cover page, contents and page numbers",
    ],
    how: [
      ["Describe your project", "Topic, institution, a short background, and why you and why now."],
      ["Read a free preview", "See the first pages before you pay anything."],
      ["Unlock and download", "Pay by mobile money or USDT, then download the Word document."],
    ],
  },
  {
    slug: "data-simulation",
    group: "services",
    kind: "Full document",
    status: "live",
    name: "Practice Data Pack",
    short: "Clearly labelled practice data to plan and rehearse your analysis. Not for submission.",
    headline: "Rehearse your analysis before you collect real data.",
    intro:
      "A twelve-part pack of practice responses, distributions, a coding framework and triangulation, built from your approved proposal, with a step-by-step guide to running the same analysis on your real data. Every item is marked PRACTICE DATA: NOT FOR SUBMISSION. Useful for students planning their analysis, researchers running pilots and lecturers preparing teaching cases.",
    price: "$135 single, or from $110 a month",
    features: [
      "Practice qualitative and quantitative responses mapped to your sampling plan",
      "A coding framework, codebook and worked thematic analysis to rehearse with",
      "A real-data guide: how to run each analysis again on the data you collect, and what to look for",
      "Quality checks and gaps in your instruments, found before fieldwork",
      "Marked PRACTICE DATA: NOT FOR SUBMISSION throughout",
    ],
    how: [
      ["Paste your proposal", "The package is built from your approved design and instruments."],
      ["We build practice data", "Practice responses are generated for each group and instrument in your plan."],
      ["Rehearse, then use real data", "Practise the analysis, sharpen your instruments, then follow the guide with your real data."],
    ],
    note: "Practice data is never a substitute for real fieldwork. It must not be submitted, or presented as data collected from real participants.",
  },
  {
    slug: "dissertation",
    group: "services",
    kind: "Full document",
    status: "live",
    name: "Dissertation Draft Report",
    short: "Your proposal and field data turned into a structured draft for you to finish.",
    headline: "Your fieldwork, structured into a draft you finish.",
    intro:
      "From your approved proposal and the data you collected to a structured draft of every chapter, with checked sources and plain \"Your input\" notes showing where your own interpretation, field experience and voice must go before you submit.",
    price: "$540 single, or $400 a month",
    features: [
      "Every finding traced to the data you supplied",
      "\"Your input\" notes in every chapter: where your own interpretation, reflection and voice must go",
      "Discussion that compares your findings with the literature, ready for you to develop",
      "References confirmed during writing, and a formatted Word download",
      "No declaration is written for you: you sign it yourself once the work is complete and your own",
    ],
    how: [
      ["Supply your materials", "Approved proposal, field data, and interview notes or transcripts."],
      ["We structure the draft", "Chapter by chapter, in stages, with progress shown as it goes."],
      ["Finish and download", "Add your own input where marked, then download it in Word."],
    ],
  },
];

export const TOOLS = SERVICES.filter((s) => s.group === "tools");
export const FULL_SERVICES = SERVICES.filter((s) => s.group === "services");
export const serviceBySlug = (slug) => SERVICES.find((s) => s.slug === slug);
export const serviceHref = (s) => `/${s.group}/${s.slug}`;

export const JOURNEY = SERVICES.filter((s) => s.step).sort((a, b) => a.step - b.step);

export const PLANS = [
  {
    name: "Free",
    price: "$0",
    per: "",
    what: "All four tools, three uses each a month, and one free proposal preview.",
  },
  {
    name: "Proposal Architect",
    price: "$70",
    per: "a month",
    what: "Five proposals a month and unlimited tool use.",
  },
  {
    name: "Data Suite",
    price: "$110",
    per: "a month",
    what: "Five proposals, the Practice Data Pack and unlimited tool use.",
    featured: true,
  },
  {
    name: "Consultant Enterprise",
    price: "$400",
    per: "a month",
    what: "Unlimited proposals, three dissertation draft reports and unlimited tool use.",
  },
];

export const SINGLE_PRICES = "Single purchases: research proposal $80, Practice Data Pack $135, dissertation draft report $540.";

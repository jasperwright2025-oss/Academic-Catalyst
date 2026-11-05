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
};

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
    status: "soon",
    name: "Literature Review Assistant",
    short: "Search real papers and build a synthesis matrix.",
    headline: "See what the evidence says, with sources you can open.",
    intro:
      "Search published research by question, read what each study found, and build a synthesis matrix that turns into your literature review.",
    price: "3 free searches a month",
    features: [
      "Search millions of published papers by research question",
      "Summaries that cite the studies they draw on",
      "A synthesis matrix of authors, methods, findings and gaps",
      "Export references in APA, RIS or BibTeX",
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
    name: "Data Simulation",
    short: "Clearly labelled simulated data for pilots, teaching and instrument testing.",
    headline: "Test your instruments before you go to the field.",
    intro:
      "A twelve-part package of simulated responses, distributions, coding frameworks and triangulation, built from your approved proposal. Every item is labelled as simulated.",
    price: "$135 single, or from $110 a month",
    features: [
      "Qualitative and quantitative responses mapped to your sampling plan",
      "Coding framework, codebook and thematic analysis",
      "Quality checks and gaps in your instruments",
      "Clearly marked as simulated throughout: for pilots, teaching and instrument testing only",
    ],
    how: [
      ["Paste your proposal", "The package is built from your approved design and instruments."],
      ["We simulate", "Responses are generated for each group and instrument in your plan."],
      ["Test and adjust", "Use the results to sharpen your instruments before real fieldwork."],
    ],
    note: "Simulated data is never a substitute for real fieldwork, and it must not be presented as data collected from real participants.",
  },
  {
    slug: "dissertation",
    group: "services",
    kind: "Full document",
    status: "live",
    name: "Dissertation Report",
    short: "Your proposal and field data written up chapter by chapter.",
    headline: "Your fieldwork, written up chapter by chapter.",
    intro:
      "From your approved proposal and the data you collected to a full report: introduction, literature, methodology, findings, discussion and recommendations.",
    price: "$540 single, or $400 a month",
    features: [
      "Every finding traced to the data you supplied",
      "Tables with interpretation before and after each one",
      "Discussion that compares your findings with the literature",
      "References confirmed during writing, and a formatted Word download",
    ],
    how: [
      ["Supply your materials", "Approved proposal, field data, and interview notes or transcripts."],
      ["We write it up", "Chapter by chapter, in stages, with progress shown as it goes."],
      ["Review and download", "Read the report and its clarity note, then download it in Word."],
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
    what: "Five proposals, the data simulation engine and unlimited tool use.",
    featured: true,
  },
  {
    name: "Consultant Enterprise",
    price: "$400",
    per: "a month",
    what: "Unlimited proposals, three dissertation reports and unlimited tool use.",
  },
];

export const SINGLE_PRICES = "Single purchases: research proposal $80, data simulation $135, dissertation report $540.";

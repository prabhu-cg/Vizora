/**
 * Single source of truth for marketing claims. Every capability carries an
 * availability status so no page can imply a feature exists when it does not.
 * Keep this in step with what the application actually does.
 */
export type Availability = "available" | "in-development" | "planned";

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: "Available now",
  "in-development": "In development",
  planned: "Planned",
};

export type VisualKind = "flowchart" | "mindmap" | "conceptmap" | "timeline" | "chart" | "dashboard";

export interface Capability {
  id: string;
  title: string;
  status: Availability;
  summary: string;
  /** What works today, in the real app. */
  today: string[];
  /** What is not built yet. */
  next: string[];
  visual?: VisualKind;
}

export const CAPABILITIES: Capability[] = [
  {
    id: "diagrams",
    title: "Flowcharts",
    status: "available",
    visual: "flowchart",
    summary: "Lay out processes with steps, decisions and branches, then refine them on a pan-and-zoom canvas.",
    today: [
      "Start/end, process, decision and input/output shapes, with Yes/No labels on branches",
      "Automatic layout, top-to-bottom or left-to-right, then drag anything into place",
      "Connect steps by dragging or from the Inspector, which works with a keyboard",
      "Colours, descriptions and labels on every step and connection",
      "Swimlanes: divide a flowchart into lanes for people or teams, by ending a line with a lane name in brackets or from the panel, and drag a step into another lane",
    ],
    next: ["Further shape libraries"],
  },
  {
    id: "mindmaps",
    title: "Mind maps",
    status: "available",
    visual: "mindmap",
    summary: "Branch ideas out from a central topic, as many levels deep as you need.",
    today: [
      "Central topic with primary and secondary branches over multiple levels",
      "Expand and collapse branches, or all at once",
      "Add, remove, duplicate and rename branches; move a branch under another or reorder siblings",
      "Colour categories assigned per branch, which you can change",
    ],
    next: ["Dragging a branch onto a new parent (today you choose the new parent in the Inspector)"],
  },
  {
    id: "conceptmaps",
    title: "Concept maps",
    status: "available",
    visual: "conceptmap",
    summary: "Show how concepts relate, with labelled, directional links between them.",
    today: [
      "Concepts joined by labelled relationships that you can edit, reverse or make arrowless",
      "Hierarchy layout or network layout, switchable at any time",
      "Relationships can be read from sentences such as “A depends on B” or from “A -> B”",
    ],
    next: ["Cross-links grouped into themes"],
  },
  {
    id: "timelines",
    title: "Timelines",
    status: "available",
    visual: "timeline",
    summary: "Place events and milestones in order, horizontally or vertically.",
    today: [
      "Events with dates, descriptions, categories and milestone markers",
      "Dates such as 2026-03-15, 15 March 2026, March 2026, Q3 2026 and Week 2 are recognised",
      "Events stay in date order; reorder undated events with Move earlier / later",
      "Horizontal or vertical layout",
    ],
    next: ["Scaling the spacing to the real length of time between events"],
  },
  {
    id: "charts",
    title: "Data visualisation",
    status: "available",
    visual: "chart",
    summary: "Turn a table of data into the right chart, with a plain-language reason for the recommendation.",
    today: [
      "Import CSV, TSV, JSON or Excel (.xlsx) files, paste straight from a spreadsheet, or type data in; everything is read in your browser",
      "Column types, dates, missing values and duplicate rows are detected and shown in a preview, and you can correct any column's type",
      "Nineteen chart types: bar, horizontal bar, line, area, pie, donut, scatter, stacked bar, 100% stacked bar, grouped bar, bar and line, multi-series line, heatmap, histogram, treemap, box plot, funnel, number tile and Gantt schedule",
      "Choose the X axis, measures and series, with sum, average, count, minimum or maximum, and group dates by month or year",
      "Edit titles, axis labels, legend, colours, data labels, tooltips, sorting, top-N limits and filters",
      "Inspect the numbers behind any chart, and a profile of each column",
      "Table view: your data as a sortable, searchable, filterable table, with chosen columns in your order and shaded numbers (colour scale or data bars); export it as CSV or an image of the first 40 rows",
    ],
    next: ["Gantt task dependencies; further chart types such as waterfall, bubble and Sankey", "Custom number and date formats", "Older spreadsheet formats such as .xls"],
  },
  {
    id: "dashboards",
    title: "Dashboards",
    status: "available",
    visual: "dashboard",
    summary: "Combine several charts from your data on one page.",
    today: [
      "Add, duplicate and delete charts, each with its own data and settings",
      "Drag charts into place and resize them from the corner, or do both with the keyboard",
      "A 12-column grid that stacks into one column on small screens",
      "Save, duplicate and export the whole dashboard as PNG, SVG or PDF",
    ],
    next: ["Dashboard-wide filters", "Text tiles"],
  },
];

export const WORKSPACE_FEATURES: Capability[] = [
  {
    id: "generation",
    title: "Diagram generation",
    status: "available",
    summary: "Paste or describe structured content and Vizora lays it out for you, using fixed rules rather than AI.",
    today: [
      "Reads numbered or bulleted steps, “if … otherwise …” decisions, outlines, dated lines and “A depends on B” statements",
      "Detects which kind of visualisation fits, or you choose one",
      "Tells you what it could not read and never invents steps, branches or dates",
      "Keeps your source text so you can edit it and generate again, or refine the result by hand",
    ],
    next: [
      "AI-assisted generation from plain language (planned for Pro; not built)",
      "Understanding free-form prose as well as it understands structured text",
    ],
  },
  {
    id: "editing",
    title: "Editing and customisation",
    status: "available",
    summary: "Everything stays editable, and your changes are saved as you work.",
    today: [
      "Undo and redo, duplicate, delete, fit to screen, zoom and reset layout",
      "Keyboard shortcuts, and an Inspector that does everything the pointer can",
      "Change a visualisation's type, with a clear list of what will change before you confirm",
      "Autosave with a visible Saved / Unsaved status; changes survive a refresh",
      "If the same visualisation is changed in two tabs, Vizora asks which version to keep instead of overwriting",
    ],
    next: ["Themes and further styling controls"],
  },
  {
    id: "projects",
    title: "Projects and your library",
    status: "available",
    summary: "Keep related visualisations together, find them again, and look after your data.",
    today: [
      "A dashboard of recent projects and recent visualisations, with search across both and sorting",
      "Projects hold many visualisations: rename, duplicate, reorder, move between projects and delete with confirmation",
      "Panels collapse and the canvas goes full screen, with keyboard shortcuts for both",
      "Download a backup of everything or of one project, and restore it later; the file is checked and previewed first, and nothing is overwritten",
      "A storage panel shows how much space your work uses and lets you clear it, after a typed confirmation",
      "Your work is stored only in this browser and Vizora keeps no other copy, so download a backup to keep one",
    ],
    next: ["Dragging to reorder (today you use up and down buttons)", "Syncing between devices"],
  },
  {
    id: "exporting",
    title: "Exporting",
    status: "available",
    summary: "Take your work with you.",
    today: [
      "PNG and SVG images that keep your colours, shapes and labels",
      "A one-page PDF of a whole dashboard",
      "CSV of the data behind a chart, or of the dataset itself",
      "Editable Vizora JSON, a lossless copy of the visualisation",
      "Copy embed code or an HTML page with the picture inline, to paste into any web page (a static snapshot that does not update)",
      "A backup of everything, or of one project, in one file; restoring checks the file first and never overwrites existing work",
    ],
    next: ["Live, interactive embeds that update (these would need you to publish a copy, so they will be opt-in)", "PDF for single charts and diagrams", "Importing a single exported visualisation file"],
  },
];

export interface UseCase {
  id: string;
  title: string;
  intro: string;
  visual: VisualKind;
  example: string;
  today: string[];
  next: string[];
}

export const USE_CASES: UseCase[] = [
  {
    id: "product-ux",
    title: "Product and UX design",
    visual: "flowchart",
    intro: "Make user journeys and screen flows easy to discuss.",
    example: "Paste the steps of a sign-up flow, with the “if the email is verified…” decision, and get a flowchart you can refine and export as an image.",
    today: ["Flowcharts of user flows, with decisions and Yes/No branches", "Mind maps for research themes and ideas", "Duplicate a flow to explore a variation, and export PNG or SVG for slides"],
    next: ["Journey maps and persona boards"],
  },
  {
    id: "business-process",
    title: "Business process management",
    visual: "flowchart",
    intro: "Show how work moves from one step to the next.",
    example: "Map an approval process with each handover as a step and each decision as a branch, then switch the same content to a concept map to see the relationships.",
    today: ["Flowcharts with start/end, decision and input/output shapes", "Every version kept as its own visualisation", "Everything stays on your device"],
    next: ["Swimlanes and standard process shape libraries", "Shared process libraries (Team, planned)"],
  },
  {
    id: "data-analysis",
    title: "Data analysis",
    visual: "chart",
    intro: "Get from a spreadsheet export to a readable chart quickly.",
    example: "Import an Excel export of monthly sales, accept the recommended line chart, add a second chart for sales by region, and export the dashboard as a PDF.",
    today: ["Import Excel, CSV, JSON or pasted data, with profiling and type checks", "Nineteen chart types with a recommendation and the reason for it", "Filters, aggregation, sorting and underlying-data inspection", "Dashboards exported as PNG, SVG or PDF", "Files are read and processed in your browser; Vizora has no upload feature"],
    next: ["Dashboard-wide filters", "Text tiles"],
  },
  {
    id: "project-management",
    title: "Project management",
    visual: "timeline",
    intro: "See how work, dependencies and dates fit together.",
    example: "Paste dated milestones to get a timeline in date order, and map task dependencies as a flowchart.",
    today: ["Timelines with dates, milestones and categories, horizontal or vertical", "Flowcharts for workflows and dependencies", "A status dashboard built from an exported tracker, as a PDF for your update"],
    next: ["Spacing events by true elapsed time", "Dashboard-wide filters"],
  },
  {
    id: "software-development",
    title: "Software development",
    visual: "flowchart",
    intro: "Explain systems, services and data flows.",
    example: "Write “Orders depends on Payments” style statements to get a concept map, and chart a JSON export of build times.",
    today: ["Flowcharts and concept maps from structured text", "Chart data from JSON or CSV exports", "Lossless JSON export of each visualisation, plus SVG for documentation"],
    next: ["Diagrams generated from code and configuration"],
  },
  {
    id: "research-learning",
    title: "Research and learning",
    visual: "mindmap",
    intro: "Organise what you know so you can see how it connects.",
    example: "Paste an outline of your notes to get a mind map, or list relationships to get a concept map.",
    today: ["Mind maps and concept maps from outlines and statements", "Chart survey or experiment data", "Timelines of events and sources"],
    next: ["Document intelligence (Pro, planned)"],
  },
];

export const STEPS = [
  { title: "Bring your information", body: "Paste or describe steps, an outline, dated events or relationships; import a CSV or JSON file; or start from a blank canvas. Vizora has no upload feature." },
  { title: "Choose a visualisation", body: "Vizora suggests a flowchart, mind map, concept map or timeline from your text, or you pick one. Numbers become a chart." },
  { title: "Explore, edit and export", body: "Refine it by hand, undo and redo freely, let autosave look after it, and export a PNG, SVG or editable JSON file." },
] as const;

export const EXAMPLES = [
  { title: "Business processes", body: "Approvals, onboarding and hand-offs as flowcharts.", visual: "flowchart" as const },
  { title: "Project workflows", body: "Dated milestones as a timeline, tasks as a flowchart.", visual: "timeline" as const },
  { title: "Ideas and brainstorming", body: "Outlines become mind maps you can reorganise.", visual: "mindmap" as const },
  { title: "Data and analytics", body: "Charts and dashboards from CSV, Excel or pasted data.", visual: "chart" as const },
  { title: "Research and information", body: "Relate concepts, and chart your findings.", visual: "conceptmap" as const },
  { title: "Planning", body: "Timelines for dates, dashboards for status.", visual: "dashboard" as const },
];

export const AUDIENCES = [
  { title: "Designers", body: "Turn flows and structures into something you can walk a team through." },
  { title: "Analysts", body: "Go from an Excel or CSV export to a chart or dashboard, with profiling and filters." },
  { title: "Product managers", body: "Show journeys, dependencies and trade-offs on one page." },
  { title: "Developers", body: "Explain systems and chart technical data, with lossless JSON, CSV and SVG export." },
  { title: "Business professionals", body: "Make processes and numbers clear for people who were not in the room." },
  { title: "Students and independent creators", body: "A free tool that runs in your browser, with nothing to sign up for." },
];

export const FREE_PROMISES = [
  { title: "No subscription required", body: "The Free edition is free, with no trial clock and no card." },
  { title: "No AI key required", body: "Nothing in Vizora needs an AI service or API key." },
  { title: "Local-first storage", body: "Projects live in your browser on your device. Vizora has no cloud backup, and nothing is stored on our servers." },
  { title: "Useful from the start", body: "Flowcharts, mind maps, concept maps, timelines, nineteen chart types and dashboards, with undo, autosave, Excel, CSV and JSON import, projects, and backup and restore." },
  { title: "Export your work", body: "PNG, SVG, CSV and PDF, editable JSON per visualisation, static embed code for any web page, and one-file backups." },
];

export interface PlanItem {
  text: string;
  status: Availability;
}
export interface Plan {
  id: "FREE" | "PRO" | "TEAM";
  name: string;
  price: string;
  priceNote: string;
  available: boolean;
  blurb: string;
  items: PlanItem[];
}

export const PLANS: Plan[] = [
  {
    id: "FREE",
    name: "Free",
    price: "£0",
    priceNote: "forever",
    available: true,
    blurb: "Everything listed here works today.",
    items: [
      { text: "Core diagrams (flowcharts)", status: "available" },
      { text: "Mind maps", status: "available" },
      { text: "Concept maps", status: "available" },
      { text: "Timelines", status: "available" },
      { text: "Charts: 19 types with recommendations", status: "available" },
      { text: "Dashboards", status: "available" },
      { text: "Rule-based text-to-visual (no AI)", status: "available" },
      { text: "CSV, JSON, Excel and pasted-data imports", status: "available" },
      { text: "Local storage with autosave", status: "available" },
      { text: "Standard exports: PNG, SVG, CSV, PDF (dashboards) and editable JSON, plus full backup", status: "available" },
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: "£9",
    priceNote: "per month, indicative",
    available: false,
    blurb: "Planned. Not available yet, and the price may change.",
    items: [
      { text: "AI-assisted generation", status: "planned" },
      { text: "Advanced visualisations", status: "planned" },
      { text: "Document intelligence", status: "planned" },
      { text: "Cloud synchronisation", status: "planned" },
      { text: "Advanced exports", status: "planned" },
      { text: "Higher usage limits", status: "planned" },
    ],
  },
  {
    id: "TEAM",
    name: "Team",
    price: "£19",
    priceNote: "per user per month, indicative",
    available: false,
    blurb: "Planned. Not available yet, and the price may change.",
    items: [
      { text: "Shared workspaces", status: "planned" },
      { text: "Collaboration", status: "planned" },
      { text: "Team libraries", status: "planned" },
      { text: "Team administration", status: "planned" },
      { text: "Organisation controls", status: "planned" },
    ],
  },
];

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  { q: "What is Vizora?", a: "Vizora is a universal visualisation platform that runs in your browser. It turns ideas, information and data into visuals you can explore and edit: flowcharts, mind maps, concept maps, timelines and charts. It is not a chart builder alone and it is not an AI image generator." },
  { q: "Is Vizora free?", a: "Yes. The Free edition costs nothing, has no time limit and needs no payment details or account. Pro and Team are planned for the future and are not available yet." },
  { q: "Do I need an AI subscription?", a: "No. Nothing in Vizora uses AI, so no AI service, subscription or API key is needed. Turning text into a visual is done with fixed rules. AI-assisted features are planned for Pro." },
  { q: "What can I visualise?", a: "You can create flowcharts, mind maps, concept maps and timelines from pasted or typed content, or build them by hand. You can turn Excel, CSV, JSON or pasted tables into charts (nineteen types) and combine charts into dashboards." },
  { q: "Can I edit generated diagrams?", a: "Yes. Everything Vizora generates opens in the same editor as something you built yourself: change text, add or remove items, reconnect, restyle, undo and redo. You can also edit your source text and generate again." },
  { q: "How well does it understand my text?", a: "It understands visible structure: numbered or bulleted steps, “if … otherwise …”, outlines, dates and statements like “A depends on B”. It does not understand arbitrary prose. When something is ambiguous or cannot be read, it tells you and leaves it for you to fix; it never invents steps, dates or relationships. A bare request such as “create a flowchart for onboarding” produces an empty flowchart, because there is nothing to structure." },
  { q: "Can I upload data?", a: "Yes. You can import CSV, TSV, JSON and Excel (.xlsx) files, paste data copied from a spreadsheet, or type it in. Files are read and processed in your browser; Vizora has no upload feature and does not send them anywhere, and your original file is never changed. Files up to 25 MB are accepted, older .xls files are not, and Vizora tells you clearly if a file cannot be read." },
  { q: "Where are my projects stored?", a: "In your browser, using IndexedDB on your own device. They are not stored on Vizora's servers. Clearing your browser's site data can remove them, so download a backup from Settings regularly." },
  { q: "Can I export my visualisations?", a: "Yes. Export a PNG or SVG image that keeps your colours, shapes and labels, the data behind a chart as CSV, a whole dashboard as a one-page PDF, an editable Vizora JSON file, or a backup of everything. You can also copy embed code to paste a static picture into any web page; it does not update when you change the visualisation." },
  { q: "Is my data sent to external services?", a: "Your projects, pasted text and imported files are not sent anywhere; they stay in your browser. The website is delivered by a hosting provider that sees standard request information, as any website does. The Privacy policy explains this in detail." },
  { q: "Will Vizora support AI?", a: "AI-assisted generation is planned for the Pro edition. It is not available today, and the Free edition will keep working without any AI service." },
  { q: "What is included in Pro?", a: "Pro is planned, with an indicative price of £9 per month. The intended features are AI-assisted generation, advanced visualisations, document intelligence, cloud synchronisation, advanced exports and higher usage limits. None of these are available yet, and details and prices may change." },
  { q: "Is Vizora suitable for business use?", a: "For individual work, yes: your data stays on your device and you can export it. Vizora does not yet offer sharing, collaboration, accounts or administration controls; those are planned for Team. Review the Privacy policy and Terms against your organisation's requirements." },
];

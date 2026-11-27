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
    title: "Flowcharts and diagrams",
    status: "available",
    visual: "flowchart",
    summary: "Lay out processes, systems and relationships as nodes and connections on a pan-and-zoom canvas.",
    today: [
      "Add nodes, drag them into place and connect them",
      "Delete nodes and connections; zoom, pan and use the minimap",
      "Keyboard-accessible canvas",
      "Your view and layout are saved with the diagram",
    ],
    next: ["Generate a diagram from structured text", "Automatic layout", "Node styling and shapes"],
  },
  {
    id: "mindmaps",
    title: "Mind maps",
    status: "planned",
    visual: "mindmap",
    summary: "Branch ideas out from a central topic.",
    today: ["The underlying data model already supports a mind-map type"],
    next: ["A mind-map renderer and editor", "Create mind maps from an outline"],
  },
  {
    id: "conceptmaps",
    title: "Concept maps",
    status: "planned",
    visual: "conceptmap",
    summary: "Show how concepts relate, with labelled links between them.",
    today: ["Diagram connections already carry optional labels in the data model"],
    next: ["A concept-map editor with labelled relationships"],
  },
  {
    id: "timelines",
    title: "Timelines",
    status: "planned",
    visual: "timeline",
    summary: "Place events and milestones in order over time.",
    today: ["The data model already supports a timeline type and date columns when you import data"],
    next: ["A timeline renderer and editor", "Build a timeline from a dated CSV"],
  },
  {
    id: "charts",
    title: "Data visualisation",
    status: "available",
    visual: "chart",
    summary: "Turn a table of numbers into a bar or line chart.",
    today: [
      "Import a CSV or JSON file, read in your browser; column types are detected automatically",
      "Bar and line charts with one or more series",
      "Clear messages when a file cannot be read",
      "Colours that adapt to light and dark themes",
      "Charts carry an accessible text description",
    ],
    next: ["More chart types", "Axis and series options", "Choosing which columns to plot", "Spreadsheet files and pasting data"],
  },
  {
    id: "dashboards",
    title: "Dashboards",
    status: "planned",
    visual: "dashboard",
    summary: "Combine several charts and figures on one page.",
    today: [],
    next: ["A dashboard canvas that arranges multiple visualisations"],
  },
];

export const WORKSPACE_FEATURES: Capability[] = [
  {
    id: "generation",
    title: "Diagram generation",
    status: "planned",
    summary: "Describe a process or structure and have Vizora lay it out for you.",
    today: ["Build diagrams by hand on the canvas (see Flowcharts and diagrams)"],
    next: [
      "Rule-based generation from structured text (planned for the Free edition)",
      "AI-assisted generation from plain language (planned for Pro)",
    ],
  },
  {
    id: "editing",
    title: "Editing and customisation",
    status: "available",
    summary: "Everything stays editable, and your changes are saved as you work.",
    today: [
      "Rename a visualisation and add a description",
      "Autosave with a visible Saved / Unsaved status",
      "Changes survive a refresh",
      "If the same visualisation is changed in two tabs, Vizora asks which version to keep instead of overwriting",
      "Duplicate a visualisation",
    ],
    next: ["Undo and redo", "Themes and styling controls"],
  },
  {
    id: "exporting",
    title: "Exporting",
    status: "available",
    summary: "Take your work with you.",
    today: [
      "Export any visualisation as a lossless Vizora JSON file",
      "Back up every project to one file and restore it later; restoring never overwrites existing work",
    ],
    next: ["PNG, SVG and PDF image export", "Importing a single exported visualisation"],
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
    example: "Sketch a sign-up flow as connected steps, then duplicate it to try an alternative.",
    today: ["Draw user flows as diagrams", "Duplicate a flow to explore a variation", "Export it as a file to keep with your notes"],
    next: ["Journey maps and persona boards", "Image export for slides"],
  },
  {
    id: "business-process",
    title: "Business process management",
    visual: "flowchart",
    intro: "Show how work moves from one step to the next.",
    example: "Map an approval process, with each handover as a node and each decision as a branch.",
    today: ["Map a process as a flowchart", "Keep every version as its own visualisation", "Everything stays on your device"],
    next: ["Swimlanes and standard process shapes", "Shared process libraries (Team, planned)"],
  },
  {
    id: "data-analysis",
    title: "Data analysis",
    visual: "chart",
    intro: "Get from a spreadsheet export to a readable chart quickly.",
    example: "Import monthly sales as a CSV and see revenue and costs as a bar or line chart.",
    today: ["Import CSV and JSON", "Bar and line charts", "Data is read in your browser and never uploaded"],
    next: ["More chart types and options", "Dashboards combining several charts"],
  },
  {
    id: "project-management",
    title: "Project management",
    visual: "timeline",
    intro: "See how work, dependencies and dates fit together.",
    example: "Draw task dependencies as a flowchart today; lay milestones out on a timeline when timelines arrive.",
    today: ["Map workflows and dependencies as diagrams", "Chart progress from an exported tracker"],
    next: ["Timelines (in development)", "Dashboards for status at a glance"],
  },
  {
    id: "software-development",
    title: "Software development",
    visual: "flowchart",
    intro: "Explain systems, services and data flows.",
    example: "Draw how requests move between services, and chart a JSON export of build times.",
    today: ["Architecture and flow diagrams", "Chart data from JSON or CSV exports", "Lossless JSON export of each diagram"],
    next: ["Generate a diagram from structured text", "Diagrams from code and configuration"],
  },
  {
    id: "research-learning",
    title: "Research and learning",
    visual: "mindmap",
    intro: "Organise what you know so you can see how it connects.",
    example: "Chart survey results today; use mind maps and concept maps for notes once they are built.",
    today: ["Chart survey or experiment data", "Diagram relationships between ideas"],
    next: ["Mind maps and concept maps (planned)", "Document intelligence (Pro, planned)"],
  },
];

export const STEPS = [
  { title: "Bring your information", body: "Import a CSV or JSON file, or start from a blank canvas. Your files are read in the browser and are never uploaded." },
  { title: "Choose a visualisation", body: "Pick a diagram for relationships and processes, or a chart for numbers. More types are on the way." },
  { title: "Explore, edit and export", body: "Adjust it, let autosave look after it, and take it with you as a JSON file or a full backup." },
] as const;

export const EXAMPLES = [
  { title: "Business processes", body: "Approvals, onboarding and hand-offs as flowcharts.", visual: "flowchart" as const },
  { title: "Project workflows", body: "Tasks and dependencies, with timelines to follow.", visual: "timeline" as const },
  { title: "Ideas and brainstorming", body: "Start a diagram now; mind maps are planned.", visual: "mindmap" as const },
  { title: "Data and analytics", body: "Bar and line charts from CSV or JSON.", visual: "chart" as const },
  { title: "Research and information", body: "Relate concepts and chart findings.", visual: "conceptmap" as const },
  { title: "Planning", body: "Plan with flowcharts today; timelines are coming.", visual: "timeline" as const },
];

export const AUDIENCES = [
  { title: "Designers", body: "Turn flows and structures into something you can walk a team through." },
  { title: "Analysts", body: "Go from an export to a chart without a spreadsheet detour." },
  { title: "Product managers", body: "Show journeys, dependencies and trade-offs on one page." },
  { title: "Developers", body: "Explain systems and chart technical data, with lossless JSON export." },
  { title: "Business professionals", body: "Make processes and numbers clear for people who were not in the room." },
  { title: "Students and independent creators", body: "A free tool that works offline-friendly in your browser, with nothing to sign up for." },
];

export const FREE_PROMISES = [
  { title: "No subscription required", body: "The Free edition is free, with no trial clock and no card." },
  { title: "No AI key required", body: "Nothing in Vizora needs an AI service or API key." },
  { title: "Local-first storage", body: "Projects live in your browser on your device, not on our servers." },
  { title: "Useful from the start", body: "Diagrams, charts, CSV and JSON import, autosave, duplicate and backup." },
  { title: "Export your work", body: "Lossless JSON per visualisation and one-file backups." },
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
    blurb: "Everything below marked “Available now” works today.",
    items: [
      { text: "Core diagrams", status: "available" },
      { text: "Basic charts (bar and line)", status: "available" },
      { text: "CSV and JSON imports", status: "available" },
      { text: "Local storage with autosave", status: "available" },
      { text: "JSON export and full backup", status: "available" },
      { text: "Mind maps", status: "planned" },
      { text: "Concept maps", status: "planned" },
      { text: "Timelines", status: "planned" },
      { text: "Image exports (PNG, SVG)", status: "planned" },
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
  { q: "What is Vizora?", a: "Vizora is a universal visualisation platform that runs in your browser. The goal is to turn ideas, information and data into visuals you can explore and edit: diagrams, charts and more. It is not a chart builder alone and it is not an AI image generator." },
  { q: "Is Vizora free?", a: "Yes. The Free edition costs nothing, has no time limit and needs no payment details or account. Pro and Team are planned for the future and are not available yet." },
  { q: "Do I need an AI subscription?", a: "No. Nothing in Vizora uses AI today, so no AI service, subscription or API key is needed. AI-assisted features are planned for Pro." },
  { q: "What can I visualise?", a: "Today you can draw flowcharts and diagrams by hand and turn CSV or JSON tables into bar and line charts. Mind maps, concept maps, timelines and dashboards are planned; the Features page shows the status of each." },
  { q: "Can I edit generated diagrams?", a: "Vizora does not generate diagrams yet, so there is nothing generated to edit. Diagrams you create are fully editable: move, connect, delete and rename. When generation arrives, the results will open in the same editor." },
  { q: "Can I upload data?", a: "Yes. You can import CSV and JSON files. They are read in your browser and are not uploaded anywhere. Files up to 25 MB are accepted, and Vizora tells you clearly if a file cannot be read." },
  { q: "Where are my projects stored?", a: "In your browser, using IndexedDB on your own device. They are not stored on Vizora's servers. Clearing your browser's site data can remove them, so download a backup from Settings regularly." },
  { q: "Can I export my visualisations?", a: "Yes. Export any visualisation as a lossless Vizora JSON file, or download a backup of everything. Image exports such as PNG, SVG and PDF are planned." },
  { q: "Is my data sent to external services?", a: "Your projects and imported files are not sent anywhere; they stay in your browser. The website is delivered by a hosting provider that sees standard request information, as any website does. The Privacy policy explains this in detail." },
  { q: "Will Vizora support AI?", a: "AI-assisted generation is planned for the Pro edition. It is not available today, and the Free edition will keep working without any AI service." },
  { q: "What is included in Pro?", a: "Pro is planned, with an indicative price of £9 per month. The intended features are AI-assisted generation, advanced visualisations, document intelligence, cloud synchronisation, advanced exports and higher usage limits. None of these are available yet, and details and prices may change." },
  { q: "Is Vizora suitable for business use?", a: "For individual work, yes: your data stays on your device and you can export it. Vizora does not yet offer sharing, collaboration, accounts or administration controls; those are planned for Team. Review the Privacy policy and Terms against your organisation's requirements." },
];

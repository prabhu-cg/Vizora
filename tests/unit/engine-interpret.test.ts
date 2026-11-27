import { describe, expect } from "vitest";
import { documentFromInterpretation, interpret, type Interpretation } from "@/lib/engine";
import { visualisationSchema } from "@/lib/validation";

const labels = (it: Interpretation) => it.graph.items.map((i) => i.label);
const byLabel = (it: Interpretation, label: string) => it.graph.items.find((i) => i.label === label)!;
const edge = (it: Interpretation, from: string, to: string) => {
  const f = byLabel(it, from).id;
  const t = byLabel(it, to).id;
  return it.graph.links.find((l) => l.from === f && l.to === t);
};

describe("flowchart interpretation", () => {
  const text = `Create a flowchart for customer onboarding:
1. Customer signs up
2. Verify email address
3. If the email is verified, create the account, otherwise resend the verification email
4. Send welcome message
5. End`;
  const it = interpret(text);

  it_("detects a flowchart and takes the title from the request", () => {
    expect(it.detection.type).toBe("flowchart");
    expect(it.graph.title).toBe("Customer onboarding");
  });
  it_("reads steps in order, with a structural Start", () => {
    expect(labels(it)).toEqual([
      "Start", "Customer signs up", "Verify email address", "The email is verified?", "Create the account", "Resend the verification email", "Send welcome message", "End",
    ]);
    expect(byLabel(it, "Start")).toMatchObject({ kind: "start", structural: true });
    expect(byLabel(it, "End").structural).toBeUndefined(); // the user wrote it
    expect(byLabel(it, "The email is verified?").kind).toBe("decision");
  });
  it_("branches a decision with Yes/No labels and rejoins afterwards", () => {
    expect(edge(it, "The email is verified?", "Create the account")?.label).toBe("Yes");
    expect(edge(it, "The email is verified?", "Resend the verification email")?.label).toBe("No");
    expect(edge(it, "Create the account", "Send welcome message")).toBeTruthy();
    expect(edge(it, "Resend the verification email", "Send welcome message")).toBeTruthy();
    expect(edge(it, "Send welcome message", "End")).toBeTruthy();
    expect(edge(it, "Start", "Customer signs up")).toBeTruthy();
  });
  it_("invents nothing: every non-structural label comes from the text", () => {
    for (const i of it.graph.items.filter((x) => !x.structural)) expect(text.toLowerCase()).toContain(i.label.replace(/\?$/, "").toLowerCase().slice(0, 10));
  });
  it_("does not warn about well-formed input", () => {
    expect(it.warnings.filter((w) => w.severity === "warning")).toEqual([]);
  });

  it_("reads running prose: sequence words and a conditional", () => {
    const r = interpret("First the user opens the app, then logs in. If the password is wrong, show an error, otherwise open the dashboard.", { type: "flowchart" });
    expect(labels(r)).toContain("The password is wrong?");
    expect(edge(r, "The password is wrong?", "Show an error")?.label).toBe("Yes");
    expect(edge(r, "The password is wrong?", "Open the dashboard")?.label).toBe("No");
  });
  it_("supports question lines with Yes:/No: outcomes", () => {
    const r = interpret("Receive order\nIs the item in stock?\nYes: Ship item\nNo: Notify customer\nClose order", { type: "flowchart" });
    expect(byLabel(r, "Is the item in stock?").kind).toBe("decision");
    expect(edge(r, "Is the item in stock?", "Ship item")?.label).toBe("Yes");
    expect(edge(r, "Is the item in stock?", "Notify customer")?.label).toBe("No");
    expect(edge(r, "Ship item", "Close order")).toBeTruthy();
  });
  it_("warns about a question with no outcomes instead of inventing them", () => {
    const r = interpret("Check the form\nIs it valid?\nSave it", { type: "flowchart" });
    expect(r.warnings.map((w) => w.code)).toContain("no-outcomes");
  });
  it_("turns loop-backs into edges, and warns when the target cannot be found", () => {
    const ok = interpret("Enter details\nValidate details\nIf invalid, go back to step 1, otherwise save", { type: "flowchart" });
    expect(edge(ok, "Invalid?", "Enter details")?.label).toBe("Yes");
    const bad = interpret("Do a thing\nGo back to the moon", { type: "flowchart" });
    expect(bad.warnings.map((w) => w.code)).toContain("loop-unresolved");
  });
  it_("merges repeated steps and says so", () => {
    const r = interpret("Review draft\nEdit draft\nReview draft\nPublish", { type: "flowchart" });
    expect(labels(r).filter((l) => l === "Review draft")).toHaveLength(1);
    expect(r.warnings.map((w) => w.code)).toContain("repeated");
  });
  it_("recognises input/output steps and explicit end of flow on a branch", () => {
    const r = interpret("Input: customer name\nIf blacklisted, stop\nCreate record", { type: "flowchart" });
    expect(byLabel(r, "Input: customer name").kind).toBe("io");
    expect(edge(r, "Blacklisted?", "End")?.label).toBe("Yes");
  });
});

describe("mind map interpretation", () => {
  const it = interpret(`Create a mind map for a SaaS launch
- Marketing
  - Website
  - Email campaign
- Product
  - Onboarding
  - Pricing
- Sales`);
  it_("uses the request topic as the central topic and outline items as branches", () => {
    expect(it.detection.type).toBe("mindmap");
    expect(byLabel(it, "SaaS launch").kind).toBe("topic");
    expect(edge(it, "SaaS launch", "Marketing")).toBeTruthy();
    expect(edge(it, "Marketing", "Website")).toBeTruthy();
    expect(edge(it, "Product", "Pricing")).toBeTruthy();
    expect(edge(it, "SaaS launch", "Sales")).toBeTruthy();
  });
  it_("colours branches by primary branch and inherits down", () => {
    expect(byLabel(it, "Marketing").color).toBe(byLabel(it, "Website").color);
    expect(byLabel(it, "Marketing").color).not.toBe(byLabel(it, "Product").color);
  });
  it_("expands 'Topic: a, b, c' lists and uses a lone root heading", () => {
    const r = interpret("# Launch plan\n## Channels: email, social, events\n## Budget", { type: "mindmap" });
    expect(byLabel(r, "Launch plan").kind).toBe("topic");
    expect(edge(r, "Channels", "Social")).toBeTruthy();
  });
  it_("adds a flagged placeholder root when there is none, never silently", () => {
    const r = interpret("- Alpha\n- Beta", { type: "mindmap" });
    expect(byLabel(r, "Main topic").structural).toBe(true);
    expect(r.warnings.map((w) => w.code)).toContain("no-root");
  });
});

describe("concept map interpretation", () => {
  it_("extracts labelled relationships and merges repeated concepts", () => {
    const r = interpret("Customers sign contracts. Suppliers supply products. A contract depends on a supplier.", { type: "conceptmap" });
    expect(r.graph.items.map((i) => i.label).sort()).toEqual(["Contract", "Contracts", "Customers", "Products", "Supplier", "Suppliers"].filter((l) => r.graph.items.some((i) => i.label === l)).sort());
    const rel = r.graph.links.map((l) => l.label);
    expect(rel).toEqual(expect.arrayContaining(["sign", "supply", "depends on"]));
    // "a supplier" and "Suppliers" are one concept; "a contract" and "contracts" are one concept.
    expect(r.graph.items).toHaveLength(4);
  });
  it_("reads both singular and plural verb forms and never drops a statement silently", () => {
    const r = interpret("Contracts depend on suppliers\nA contract depends on a supplier\nCustomers belong to regions", { type: "conceptmap" });
    expect(r.warnings.filter((w) => w.code === "unparsed")).toEqual([]);
    expect(r.graph.links.map((l) => l.label)).toEqual(["depend on", "depends on", "belong to"]);
  });
  it_("uses a hierarchical layout for tree-like maps and a network for cross-linked ones", () => {
    expect(interpret("A -> B\nB -> C", { type: "conceptmap" }).graph.layoutHint?.algorithm).toBe("layered");
    expect(interpret("A -> B\nB -> C\nC -> A\nA -> C", { type: "conceptmap" }).graph.layoutHint?.algorithm).toBe("force");
  });
  it_("reads arrow syntax, with and without labels", () => {
    const r = interpret("Order -> Invoice\nInvoice --paid by--> Customer\nCustomer -[places]-> Order", { type: "conceptmap" });
    expect(r.graph.links.map((l) => l.label ?? null)).toEqual([null, "paid by", "places"]);
  });
  it_("'map relationships between A, B and C' creates the concepts, unconnected, with a warning", () => {
    const r = interpret("Map relationships between customers, suppliers and contracts");
    expect(r.detection.type).toBe("conceptmap");
    expect(labels(r)).toEqual(["Customers", "Suppliers", "Contracts"]);
    expect(r.graph.links).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toContain("entities-only");
  });
  it_("reports sentences it cannot read instead of guessing", () => {
    const r = interpret("Customers sign contracts.\nThe weather was lovely and everyone was happy about it today.", { type: "conceptmap" });
    expect(r.warnings.some((w) => w.code === "unparsed")).toBe(true);
  });
  it_("chooses a hierarchical layout when relationships are mostly 'is a / contains'", () => {
    const r = interpret("Animal contains Dog\nAnimal contains Cat\nDog is a Pet", { type: "conceptmap" });
    expect(r.graph.layoutHint).toMatchObject({ algorithm: "layered", direction: "TB" });
  });
});

describe("timeline interpretation", () => {
  const it = interpret(`Create a timeline for a website redesign
2026-04-20: Launch
2026-01-12: Kick-off — Agree scope with stakeholders
2026-02-02: Design review [Design]
March 2026 - Development complete`);
  it_("detects a timeline and sorts events by date", () => {
    expect(it.detection.type).toBe("timeline");
    expect(labels(it)).toEqual(["Kick-off", "Design review", "Development complete", "Launch"]);
    expect(it.warnings.map((w) => w.code)).toContain("reordered");
  });
  it_("captures dates, descriptions, categories and milestones", () => {
    expect(byLabel(it, "Kick-off")).toMatchObject({ date: "2026-01-12", description: "Agree scope with stakeholders", kind: "milestone" });
    expect(byLabel(it, "Design review")).toMatchObject({ category: "Design", kind: "event", date: "2026-02-02" });
    expect(byLabel(it, "Development complete")).toMatchObject({ date: "2026-03", dateLabel: "March 2026" });
  });
  it_("keeps your order and warns when some events have no date", () => {
    const r = interpret("2026-01-01: Start\nThen something happens\n2026-03-01: Finish", { type: "timeline" });
    expect(labels(r)).toEqual(["Start", "Then something happens", "Finish"]);
    expect(r.warnings.map((w) => w.code)).toContain("undated");
    expect(r.graph.items[1]!.date).toBeUndefined();
  });
  it_("assumes day-first for 12/03/2026 and says so", () => {
    const r = interpret("12/03/2026: Review\n01/04/2026: Ship", { type: "timeline" });
    expect(r.graph.items[0]!.date).toBe("2026-03-12");
    expect(r.warnings.map((w) => w.code)).toContain("ambiguous-date");
  });
  it_("rejects impossible dates instead of accepting them", () => {
    const r = interpret("2026-02-31: Phantom\n2026-03-01: Real", { type: "timeline" });
    expect(r.graph.items.find((i) => i.label.startsWith("Phantom"))?.date).toBeUndefined();
  });
  it_("uses markdown headings as categories", () => {
    const r = interpret("## Design\n2026-01-01: Wireframes\n## Build\n2026-02-01: Prototype", { type: "timeline" });
    expect(r.graph.items.map((i) => i.category)).toEqual(["Design", "Build"]);
  });
});

describe("request handling and ambiguity", () => {
  it_("a bare request produces an empty visualisation and an honest warning, never invented content", () => {
    for (const [text, type, title] of [
      ["Create a flowchart for customer onboarding.", "flowchart", "Customer onboarding"],
      ["Show the stages of UX research", "flowchart", "UX research"],
      ["Create a timeline for a website redesign", "timeline", "Website redesign"],
    ] as const) {
      const r = interpret(text);
      expect(r.requestOnly).toBe(true);
      expect(r.detection.type).toBe(type);
      expect(r.graph.title).toBe(title);
      expect(r.graph.items).toEqual([]);
      expect(r.warnings[0]!.code).toBe("request-only");
      expect(r.warnings[0]!.message).toMatch(/does not write content/);
    }
  });
  it_("a bare mind-map request creates only the named central topic", () => {
    const r = interpret("Create a mind map for a SaaS launch");
    expect(r.graph.items).toEqual([expect.objectContaining({ kind: "topic", label: "SaaS launch" })]);
  });
  it_("warns when it cannot tell the type and offers alternatives", () => {
    const r = interpret("Apples\nOranges\nPears");
    expect(r.detection.confidence).toBeLessThan(0.5);
    expect(r.warnings.some((w) => w.code === "low-confidence")).toBe(true);
  });
  it_("an explicit type overrides detection and is respected", () => {
    const r = interpret("2026-01-01: Start\n2026-02-01: End", { type: "flowchart" });
    expect(r.detection).toMatchObject({ type: "flowchart", chosen: true, confidence: 1 });
  });
  it_("truncates very long input with a warning", () => {
    const r = interpret("step one\n".repeat(5000), { type: "flowchart" });
    expect(r.warnings.some((w) => w.code === "too-long")).toBe(true);
  });
  it_("is deterministic", () => {
    const text = "1. A\n2. If B, C, otherwise D\n3. E";
    expect(JSON.stringify(interpret(text))).toBe(JSON.stringify(interpret(text)));
  });
});

describe("IR generation", () => {
  for (const [name, text] of [
    ["flowchart", "1. Sign up\n2. If verified, activate, otherwise resend\n3. Welcome"],
    ["mindmap", "Create a mind map for Launch\n- A\n  - A1\n- B"],
    ["conceptmap", "Order -> Invoice\nInvoice --paid by--> Customer"],
    ["timeline", "2026-01-01: Start\n2026-02-01: Middle\n2026-03-01: End"],
  ] as const) {
    it_(`${name}: produces a schema-valid, positioned document that remembers its source`, () => {
      const r = interpret(text, { type: name });
      const doc = documentFromInterpretation(text, r);
      expect(visualisationSchema.safeParse(doc).success).toBe(true);
      expect(doc.type).toBe(name);
      expect(doc.nodes.length).toBeGreaterThan(0);
      expect(doc.nodes.every((n) => n.size && Number.isFinite(n.position.x) && Number.isFinite(n.position.y))).toBe(true);
      expect(doc.configuration.options.inputText).toBe(text);
      expect(doc.source.kind).toBe("text");
    });
  }
});

// `it` is shadowed by interpretation results above; alias the runner.
import { it as it_ } from "vitest";

import type { EngineType } from "@/lib/engine";

export interface ExamplePrompt {
  id: string;
  label: string;
  type: EngineType;
  /** The request plus content to structure. The engine reads content; it never writes it. */
  text: string;
}

/**
 * Example inputs. Each includes the material to structure, because the
 * rule-based engine arranges what you give it and does not invent content.
 */
export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    id: "onboarding",
    label: "Flowchart for customer onboarding",
    type: "flowchart",
    text: `Create a flowchart for customer onboarding:
1. Customer signs up
2. Verify email address
3. If the email is verified, create the account, otherwise resend the verification email
4. Send welcome message`,
  },
  {
    id: "saas",
    label: "Mind map for a SaaS launch",
    type: "mindmap",
    text: `Create a mind map for a SaaS launch
- Marketing
  - Website
  - Email campaign
- Product
  - Onboarding
  - Pricing
- Sales
  - Partners`,
  },
  {
    id: "team",
    label: "Org chart for a product team",
    type: "orgchart",
    text: `Create an org chart for the product team
Maya Chen - Head of Product
  Ravi Patel - Design Lead
    Sam Ortiz - Product Designer
    Lena Fischer - UX Researcher
  Tom Becker - Engineering Manager
    Aisha Khan - Senior Engineer
    Jon Smith - Engineer`,
  },
  {
    id: "ux",
    label: "Stages of UX research",
    type: "flowchart",
    text: `Show the stages of UX research:
1. Plan the research
2. Recruit participants
3. Run the sessions
4. Analyse the findings
5. Share the insights`,
  },
  {
    id: "redesign",
    label: "Timeline for a website redesign",
    type: "timeline",
    text: `Create a timeline for a website redesign
2026-01-12: Kick-off — Agree scope with stakeholders
2026-02-02: Design review [Design]
March 2026 - Development complete
2026-04-20: Launch`,
  },
  {
    id: "relationships",
    label: "Relationships between customers, suppliers and contracts",
    type: "conceptmap",
    text: `Map relationships between customers, suppliers and contracts
Customers sign contracts.
Suppliers supply products.
Contracts depend on suppliers.
Customers buy products.`,
  },
];

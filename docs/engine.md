# Core visualisation engine (F2)

Everything here is deterministic and runs in the browser. No AI, no network.

## Layers (`lib/engine`, pure TypeScript; `features/editor`, React)
| Layer | Where | Role |
|---|---|---|
| Interpretation | `lib/engine/interpret/*` | Text → `SemanticGraph` + warnings |
| Layout | `lib/engine/layout/*` | Layered, balanced tree, force, timeline; deterministic; sizes shared with export |
| IR build | `lib/engine/build.ts` | Graph → IR, remembers source text and warnings in `configuration.options` |
| Operations | `lib/engine/ops.ts` | Every edit as a pure `doc → doc` function that enforces each type's rules |
| Conversion | `lib/engine/convert.ts` | `planConversion` returns the result *and* a list of what changes |
| Export | `lib/export/*` | SVG from the IR alone, PNG by rasterising it, editable JSON |
| Editor | `features/editor/*` | React Flow is a projection of the IR; all changes go through `ops` |

## IR conventions (schema v2)
Structure lives in the IR proper (`type`, `label`, `position`, edges). Optional detail is in `node.data`: `description`, `category`, `date`/`dateLabel`, `collapsed`, `structural` (true for nodes the interpreter added, e.g. Start/End), plus `prevKind`/`prevFor`/`relation` which let a format switch round-trip exactly. Colour is `node.style.color` (a key, resolved to theme tokens on screen and literal colours in exports).

- Node kinds: flowchart `start|end|process|decision|io`; mind map `topic|branch`; concept map `concept`; timeline `event|milestone`.
- A mind map's hierarchy is its edges (source = parent, in sibling order). A timeline's order is the order of `nodes`.
- Mind maps and timelines are laid out automatically after every structural change; flowcharts and concept maps keep manual positions until "Reset layout".
- v1 → v2 migration: `diagram` became `flowchart`; node kind `default` became `process`. Records saved by earlier builds are read, migrated and listed without being rewritten until edited.

## What the interpreter recognises
- **Flowchart:** numbered/bulleted/plain steps; "then/next/after that/;/->" sequences; `if X, A, otherwise B` (also when/whenever/in case); question lines ending `?` with `Yes:`/`No:` outcomes; `go back to step N` / `return to <step>`; `Input:`/`Output:`/read/print/display/enter/receive/submit/upload/download as input-output shapes; repeated steps merge into one node.
- **Mind map:** indentation, markdown headings, dotted numbering, `Topic: a, b, c` lists; the request's topic (or a lone root heading) is the central topic.
- **Concept map:** ~70 relationship phrases ("depends on", "is part of", "supplies", …, singular and plural), `A -> B`, `A --label--> B`, `A -[label]-> B`; repeated concepts merge (case, determiners and a trailing plural "s" ignored).
- **Timeline:** ISO dates, "12 March 2026", "March 2026", `12/03/2026` (day first, flagged as ambiguous), "Q3 2026", bare years at line start, "Week 2"; `Title — description`; `[Category]`/`#tag`/headings as categories; milestone keywords.

## What it deliberately does not do
- It does not write content. "Create a flowchart for onboarding" alone yields an empty flowchart with an explanation.
- It does not understand arbitrary prose. Anything it cannot read becomes a warning with the line number.
- It never invents steps, branches, dates or relationships. Nodes it adds for structure (Start, End, a placeholder central topic) are flagged `structural` and disclosed.
- Ambiguity is surfaced: unknown type (low confidence + alternatives), day/month dates, decisions without outcomes, unresolved loop-backs, unconnected items.

## Keyboard and accessibility
Shortcuts are defined once (`features/editor/shortcuts.ts`) and drive both the handler and the help dialog. They are off while typing, off while a dialog is open, and Tab/Enter/Delete apply only when the canvas has focus, so page navigation is never trapped. Everything pointer-only (connecting, reparenting, reordering) has a form equivalent in the Inspector.

## Swimlanes (flowcharts)
Lanes are stored in `configuration.options.lanes` (ordered) and each step names its lane in `data.lane`. Bands are derived (`lib/engine/lanes.ts`): a band's size comes from the steps in it, and each step's cross-axis position is computed from its lane, so a step cannot be outside its lane. Only the position along the flow is stored. Dragging a step into another lane's band changes its lane (`moveNodes`). The interpreter reads a trailing `[Lane]` on a line (two or more distinct lanes are needed; one lane is ignored with a note); Start and End join the lane of the step beside them. Regenerating from text replaces the lanes. Lanes run left to right by default; top to bottom turns them into columns.

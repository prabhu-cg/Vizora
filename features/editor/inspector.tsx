"use client";

import { ArrowDown, ArrowLeftRight, ArrowUp, ChevronDown, ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  COLOR_KEYS, COLOR_LABEL, COLOR_VAR, MAX_LANES, NODE_KINDS, addLane, assignLane, canDelete, moveLane, readLanes, removeLane, renameLane, setLanes, canMoveEvent, connect, deleteEdges, getColor, getExtras, mindTree, moveEvent, moveSibling, reparent,
  reparentTargets, reverseEdge, setStyle, toggleCollapse, updateEdge, updateNode,
  type ColorKey,
} from "@/lib/engine";
import { findDate, formatDateValue, isAbsolute } from "@/lib/engine/interpret/dates";
import { cn } from "@/lib/utils/cn";
import type { UpdateOptions } from "@/features/visualisation/use-visualisation-editor";
import type { IREdge, IRNode, VisualisationIR } from "@/types/visualisation";
import type { EditorSession } from "./use-editor-session";

type Update = (updater: (d: VisualisationIR) => VisualisationIR, options?: UpdateOptions) => void;

const H = ({ children }: { children: React.ReactNode }) => <h3 className="text-[15px] font-semibold">{children}</h3>;

function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ColourPicker({ value, onChange, label = "Colour" }: { value: ColorKey; onChange: (c: ColorKey) => void; label?: string }) {
  const name = useId();
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 text-sm font-medium text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {COLOR_KEYS.map((c) => (
          <label key={c} className="relative cursor-pointer">
            <input type="radio" name={name} value={c} checked={value === c} onChange={() => onChange(c)} className="peer sr-only" />
            <span
              aria-hidden="true"
              className="block size-7 rounded-full border-2 border-card outline outline-1 outline-border-strong peer-checked:outline-2 peer-checked:outline-offset-2 peer-checked:outline-ring peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
              style={{ background: c === "default" ? "var(--card)" : COLOR_VAR[c] }}
            />
            <span className="sr-only">{COLOR_LABEL[c]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Text that must never be blank. Holds a local draft so the field can be
 * cleared and retyped; commits every non-blank change and restores the saved
 * text if left blank. Follows external changes (undo, regenerate).
 */
function RequiredTextArea({ id, value, onCommit }: { id: string; value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value.trim() !== draft.trim()) setDraft(value);
  }
  return (
    <Textarea
      id={id}
      rows={2}
      value={draft}
      maxLength={500}
      aria-invalid={draft.trim() ? undefined : true}
      onChange={(e) => {
        setDraft(e.target.value);
        if (e.target.value.trim()) onCommit(e.target.value);
      }}
      onBlur={() => !draft.trim() && setDraft(value)}
    />
  );
}

function ButtonRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function DateField({ node, update }: { node: IRNode; update: Update }) {
  const id = useId();
  const ex = getExtras(node);
  const shown = ex.dateLabel ?? (ex.date ? formatDateValue(ex.date) : "");
  const [draft, setDraft] = useState(shown);
  const [error, setError] = useState<string>();
  const commit = () => {
    const text = draft.trim();
    if (text === shown) return setError(undefined);
    if (!text) {
      setError(undefined);
      return update((d) => updateNode(d, node.id, { date: null, dateLabel: null }));
    }
    const f = findDate(text, { allowBareYear: true, allowRelative: true });
    if (!f || f.index !== 0 || f.length !== text.length) {
      return setError("Not recognised. Try 2026-03-15, 15 March 2026, March 2026, Q3 2026 or Week 2.");
    }
    setError(undefined);
    update((d) => updateNode(d, node.id, { date: f.value, dateLabel: text }));
  };
  return (
    <Field label="Date" htmlFor={id} hint={ex.date && isAbsolute(findDate(ex.date, { allowBareYear: true })?.precision ?? "relative") ? `Stored as ${ex.date}` : "Events with calendar dates are kept in date order."}>
      <Input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-e` : undefined} />
      {error && <p id={`${id}-e`} className="text-xs text-destructive">{error}</p>}
    </Field>
  );
}

function Connections({ node, doc, update }: { node: IRNode; doc: VisualisationIR; update: Update }) {
  const id = useId();
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState("");
  const labelOf = (nid: string) => doc.nodes.find((n) => n.id === nid)?.label ?? "(missing)";
  const edges = doc.edges.filter((e) => e.source === node.id || e.target === node.id);
  const options = doc.nodes.filter((n) => n.id !== node.id);
  return (
    <section aria-labelledby={`${id}-h`} className="grid gap-3">
      <h3 id={`${id}-h`} className="text-[15px] font-semibold">Connections</h3>
      {edges.length === 0 && <p className="text-sm text-muted-foreground">Not connected to anything yet.</p>}
      <ul className="grid gap-2">
        {edges.map((e) => {
          const outgoing = e.source === node.id;
          const other = outgoing ? e.target : e.source;
          return (
            <li key={e.id} className="grid gap-1.5 rounded-input border border-border p-2.5">
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">{outgoing ? "To " : "From "}</span>
                {labelOf(other)}
              </p>
              <div className="flex gap-1.5">
                <Input aria-label={`Label for connection ${outgoing ? "to" : "from"} ${labelOf(other)}`} placeholder="Label (optional)" defaultValue={e.label ?? ""} className="h-9"
                  onBlur={(ev) => ev.target.value.trim() !== (e.label ?? "") && update((d) => updateEdge(d, e.id, { label: ev.target.value }))}
                  onKeyDown={(ev) => ev.key === "Enter" && ev.currentTarget.blur()} />
                <Button variant="outline" size="icon" className="size-9" aria-label={`Reverse direction of connection ${outgoing ? "to" : "from"} ${labelOf(other)}`} onClick={() => update((d) => reverseEdge(d, e.id))}>
                  <ArrowLeftRight aria-hidden="true" />
                </Button>
                <Button variant="outline" size="icon" className="size-9" aria-label={`Remove connection ${outgoing ? "to" : "from"} ${labelOf(other)}`} onClick={() => update((d) => deleteEdges(d, [e.id]))}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {options.length > 0 && (
        <div className="grid gap-2 rounded-input bg-surface p-2.5">
          <Field label="Connect to…" htmlFor={`${id}-t`}>
            <Select id={`${id}-t`} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Choose an item</option>
              {options.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </Select>
          </Field>
          <Field label={doc.type === "conceptmap" ? "Relationship" : "Label"} htmlFor={`${id}-l`}>
            <Input id={`${id}-l`} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={doc.type === "conceptmap" ? "e.g. depends on" : "optional"} />
          </Field>
          <Button variant="outline" size="sm" disabled={!target} onClick={() => { update((d) => connect(d, node.id, target, label)); setTarget(""); setLabel(""); }}>
            Connect
          </Button>
        </div>
      )}
    </section>
  );
}

function NodeForm({ node, doc, update, session }: { node: IRNode; doc: VisualisationIR; update: Update; session: EditorSession }) {
  const id = useId();
  const ex = getExtras(node);
  const type = doc.type;
  const kinds = type === "flowchart" || type === "timeline" ? NODE_KINDS[type] : [];
  const tree = type === "mindmap" ? mindTree(doc) : undefined;
  const key = (f: string): UpdateOptions => ({ coalesceKey: `${f}:${node.id}` });
  const moveBlocked = (d: -1 | 1) => (type === "timeline" ? canMoveEvent(doc, node.id, d) : { ok: false });
  const earlier = moveBlocked(-1), later = moveBlocked(1);
  const parent = tree?.parent.get(node.id);
  const parentOptions = reparentTargets(doc, node.id);

  return (
    <div className="grid gap-5">
      <Field label="Text" htmlFor={`${id}-l`}>
        <RequiredTextArea id={`${id}-l`} value={node.label} onCommit={(v) => update((d) => updateNode(d, node.id, { label: v }), key("label"))} />
      </Field>
      <Field label="Description" htmlFor={`${id}-d`} hint={type === "timeline" ? "Shown on the event card." : "Notes kept with this item."}>
        <Textarea id={`${id}-d`} rows={3} value={ex.description ?? ""} maxLength={2000} onChange={(e) => update((d) => updateNode(d, node.id, { description: e.target.value }), key("desc"))} />
      </Field>

      {kinds.length > 1 && (
        <Field label={type === "timeline" ? "Type" : "Shape"} htmlFor={`${id}-k`}>
          <Select id={`${id}-k`} value={node.type} onChange={(e) => update((d) => updateNode(d, node.id, { kind: e.target.value }))}>
            {kinds.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
          </Select>
        </Field>
      )}

      {type === "flowchart" && readLanes(doc).length > 0 && (
        <Field label="Swimlane" htmlFor={`${id}-lane`} hint="Who or what does this step. Dragging a step into another lane does the same.">
          <Select id={`${id}-lane`} value={ex.lane && readLanes(doc).includes(ex.lane) ? ex.lane : readLanes(doc)[0]} onChange={(e) => update((d) => assignLane(d, [node.id], e.target.value))}>
            {readLanes(doc).map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </Field>
      )}

      <ColourPicker value={getColor(node)} onChange={(c) => update((d) => setStyle(d, [node.id], c))} />

      {type === "timeline" && (
        <>
          <DateField key={`${node.id}-${ex.date ?? ""}`} node={node} update={update} />
          <Field label="Category" htmlFor={`${id}-c`} hint="Free text, for your own grouping.">
            <Input id={`${id}-c`} value={ex.category ?? ""} maxLength={60} onChange={(e) => update((d) => updateNode(d, node.id, { category: e.target.value }), key("cat"))} />
          </Field>
          <div className="grid gap-1.5">
            <p className="text-sm font-medium text-foreground">Order</p>
            <ButtonRow>
              <Button variant="outline" size="sm" disabled={!earlier.ok} onClick={() => update((d) => moveEvent(d, node.id, -1))}><ArrowUp aria-hidden="true" /> Move earlier</Button>
              <Button variant="outline" size="sm" disabled={!later.ok} onClick={() => update((d) => moveEvent(d, node.id, 1))}><ArrowDown aria-hidden="true" /> Move later</Button>
            </ButtonRow>
            {(earlier.reason || later.reason) && <p className="text-xs text-muted-foreground">{earlier.reason ?? later.reason}</p>}
          </div>
        </>
      )}

      {type === "mindmap" && tree && (
        <>
          {node.id !== tree.rootId && (
            <Field label="Move under…" htmlFor={`${id}-p`} hint={parent ? `Currently under “${tree.byId.get(parent)?.label}”.` : undefined}>
              <Select id={`${id}-p`} value="" onChange={(e) => e.target.value && update((d) => reparent(d, node.id, e.target.value))}>
                <option value="">Choose a new parent</option>
                {parentOptions.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
              </Select>
            </Field>
          )}
          <ButtonRow>
            {node.id !== tree.rootId && (
              <>
                <Button variant="outline" size="sm" onClick={() => update((d) => moveSibling(d, node.id, -1))}><ArrowUp aria-hidden="true" /> Move up</Button>
                <Button variant="outline" size="sm" onClick={() => update((d) => moveSibling(d, node.id, 1))}><ArrowDown aria-hidden="true" /> Move down</Button>
              </>
            )}
            {(tree.children.get(node.id)?.length ?? 0) > 0 && (
              <Button variant="outline" size="sm" onClick={() => update((d) => toggleCollapse(d, node.id))}>
                {ex.collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />} {ex.collapsed ? "Expand" : "Collapse"} branch
              </Button>
            )}
          </ButtonRow>
        </>
      )}

      {(type === "flowchart" || type === "conceptmap") && <Connections node={node} doc={doc} update={update} />}

      <ButtonRow>
        <Button variant="outline" size="sm" onClick={() => session.addChildOf(node.id)}>
          {type === "mindmap" ? "Add child branch" : type === "timeline" ? "Add event after" : "Add connected item"}
        </Button>
        <Button variant="outline" size="sm" onClick={session.duplicate}><Copy aria-hidden="true" /> Duplicate</Button>
        <Button variant="destructive" size="sm" disabled={!canDelete(doc, [node.id])} onClick={session.remove}><Trash2 aria-hidden="true" /> Delete</Button>
      </ButtonRow>
    </div>
  );
}

function EdgeForm({ edge, doc, update, session }: { edge: IREdge; doc: VisualisationIR; update: Update; session: EditorSession }) {
  const id = useId();
  const name = (nid: string) => doc.nodes.find((n) => n.id === nid)?.label ?? "(missing)";
  return (
    <div className="grid gap-5">
      <p className="text-sm text-body">From <strong>{name(edge.source)}</strong> to <strong>{name(edge.target)}</strong></p>
      <Field label={doc.type === "conceptmap" ? "Relationship" : "Label"} htmlFor={`${id}-l`}>
        <Input id={`${id}-l`} value={edge.label ?? ""} maxLength={500} onChange={(e) => update((d) => updateEdge(d, edge.id, { label: e.target.value }), { coalesceKey: `elabel:${edge.id}` })} />
      </Field>
      <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={edge.data?.directed !== false} onChange={(e) => update((d) => updateEdge(d, edge.id, { directed: e.target.checked }))} />
        Show an arrow (direction matters)
      </label>
      <ButtonRow>
        <Button variant="outline" size="sm" onClick={() => update((d) => reverseEdge(d, edge.id))}><ArrowLeftRight aria-hidden="true" /> Reverse direction</Button>
        <Button variant="destructive" size="sm" onClick={session.remove}><Trash2 aria-hidden="true" /> Remove</Button>
      </ButtonRow>
    </div>
  );
}

/** Edit whatever is selected. Everything the canvas can do with a pointer can be done here with a keyboard. */
function LaneRow({ name, index, count, update }: { name: string; index: number; count: number; update: Update }) {
  const id = useId();
  const [draft, setDraft] = useState(name);
  const [seen, setSeen] = useState(name);
  if (seen !== name) {
    setSeen(name);
    setDraft(name);
  }
  const commit = () => {
    const next = draft.trim();
    if (!next) return setDraft(name);
    if (next !== name) update((d) => renameLane(d, name, next));
  };
  return (
    <li className="flex items-center gap-1">
      <Label htmlFor={id} className="sr-only">Lane {index + 1} name</Label>
      <Input id={id} value={draft} maxLength={60} className="h-9 min-w-0 flex-1" onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())} />
      <Button variant="ghost" size="icon" className="size-8" aria-label={`Move lane ${name} up`} disabled={index === 0} onClick={() => update((d) => moveLane(d, name, -1))}><ArrowUp aria-hidden="true" /></Button>
      <Button variant="ghost" size="icon" className="size-8" aria-label={`Move lane ${name} down`} disabled={index === count - 1} onClick={() => update((d) => moveLane(d, name, 1))}><ArrowDown aria-hidden="true" /></Button>
      <Button variant="ghost" size="icon" className="size-8" aria-label={`Remove lane ${name}`} onClick={() => update((d) => removeLane(d, name))}><Trash2 aria-hidden="true" /></Button>
    </li>
  );
}

/** Swimlanes for a flowchart: switch them on, name them, reorder them. Each step then says who does it. */
export function LanesPanel({ doc, update }: { doc: VisualisationIR; update: Update }) {
  const id = useId();
  const lanes = readLanes(doc);
  const [name, setName] = useState("");
  if (doc.type !== "flowchart") return null;
  if (lanes.length === 0) {
    return (
      <section aria-label="Swimlanes" className="grid gap-2 border-b border-border p-4">
        <H>Swimlanes</H>
        <p className="text-xs text-muted-foreground">Divide the flowchart into lanes for people, teams or systems, so it shows who does each step. You can also end a line in the Source panel with a lane name in brackets, such as [Customer].</p>
        <div><Button variant="outline" size="sm" onClick={() => update((d) => setLanes(d, ["Lane 1", "Lane 2"]))}><Plus aria-hidden="true" /> Add swimlanes</Button></div>
      </section>
    );
  }
  return (
    <section aria-label="Swimlanes" className="grid gap-3 border-b border-border p-4">
      <H>Swimlanes</H>
      <ul className="grid gap-1.5" aria-label="Lanes, top to bottom">
        {lanes.map((l, i) => <LaneRow key={l} name={l} index={i} count={lanes.length} update={update} />)}
      </ul>
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { update((d) => addLane(d, name)); setName(""); } }}>
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Label htmlFor={`${id}-new`}>Add a lane</Label>
          <Input id={`${id}-new`} value={name} maxLength={60} className="h-9" placeholder="For example, Support" disabled={lanes.length >= MAX_LANES} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={!name.trim() || lanes.length >= MAX_LANES}>Add</Button>
      </form>
      <p className="text-xs text-muted-foreground">Drag a step into another lane to change who does it. Lanes grow to fit their steps.</p>
      <div><Button variant="ghost" size="sm" onClick={() => update((d) => setLanes(d, []))}>Remove swimlanes</Button></div>
    </section>
  );
}

export function Inspector({ doc, session, update, fallback }: { doc: VisualisationIR; session: EditorSession; update: Update; fallback: React.ReactNode }) {
  const { nodes, edges } = session.selection;
  const node = nodes.length === 1 && edges.length === 0 ? doc.nodes.find((n) => n.id === nodes[0]) : undefined;
  const edge = edges.length === 1 && nodes.length === 0 ? doc.edges.find((e) => e.id === edges[0]) : undefined;
  const total = nodes.length + edges.length;

  if (node) {
    return (
      <section aria-label="Inspector: selected item" className="grid gap-4 p-4">
        <H>{NODE_KINDS[doc.type as keyof typeof NODE_KINDS]?.find((k) => k.kind === node.type)?.label ?? "Item"}</H>
        <NodeForm key={node.id} node={node} doc={doc} update={update} session={session} />
      </section>
    );
  }
  if (edge) {
    return (
      <section aria-label="Inspector: selected connection" className="grid gap-4 p-4">
        <H>Connection</H>
        <EdgeForm key={edge.id} edge={edge} doc={doc} update={update} session={session} />
      </section>
    );
  }
  if (total > 1) {
    return (
      <section aria-label="Inspector: selection" className="grid gap-4 p-4">
        <H>{total} items selected</H>
        {nodes.length > 0 && <ColourPicker value="default" label="Set colour for all" onChange={(c) => update((d) => setStyle(d, nodes, c))} />}
        <ButtonRow>
          <Button variant="outline" size="sm" disabled={nodes.length === 0} onClick={session.duplicate}><Copy aria-hidden="true" /> Duplicate</Button>
          <Button variant="destructive" size="sm" onClick={session.remove}><Trash2 aria-hidden="true" /> Delete</Button>
        </ButtonRow>
      </section>
    );
  }
  return (
    <>
      {doc.type === "flowchart" && <LanesPanel doc={doc} update={update} />}
      {fallback}
    </>
  );
}

void cn;

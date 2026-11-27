import { getExtras, withExtras } from "./semantics";
import type { IRNode, VisualisationIR } from "@/types/visualisation";

/**
 * Swimlanes: a flowchart divided into bands, one per person, team or system,
 * so you can see who does each step.
 *
 * The lanes live in `configuration.options.lanes` (in order) and each step names
 * its lane in `data.lane`. Bands are *derived*: their size comes from the steps
 * inside them, and each step's cross-axis position is computed from its lane. Only
 * the position along the flow (left to right, or top to bottom) is stored, so a
 * step can never be left outside its lane, and dragging one into another lane
 * simply changes which lane it belongs to.
 */
export const MAX_LANES = 12;
export const LANE_NAME_MAX = 60;
const PAD = 22;
const MIN_BAND = 120;
const SLOT_GAP = 18;
const ALONG_GAP = 28;
/** How far the bands extend beyond the first and last step, along the flow. */
export const LANE_MARGIN = 140;

const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, LANE_NAME_MAX);

/** Names with blanks removed and repeats (any case) dropped, keeping the first spelling. */
export function uniqueNames(names: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const n = clean(raw);
    if (n && !seen.has(n.toLowerCase())) {
      seen.add(n.toLowerCase());
      out.push(n);
    }
  }
  return out;
}

export function readLanes(doc: Pick<VisualisationIR, "type" | "configuration">): string[] {
  if (doc.type !== "flowchart") return [];
  const raw = doc.configuration.options.lanes;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    const name = typeof v === "string" ? clean(v) : "";
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out.slice(0, MAX_LANES);
}

/** Which lane a step is in (an unknown or missing lane falls back to the first). */
export function laneIndexOf(node: IRNode, lanes: readonly string[]): number {
  const i = lanes.indexOf(getExtras(node).lane ?? "");
  return i === -1 ? 0 : i;
}

export interface LaneBand {
  name: string;
  index: number;
  /** Where the band starts and how big it is, across the flow. */
  start: number;
  size: number;
}

export interface LaneGeometry {
  bands: LaneBand[];
  /** Flow runs left to right (lanes are rows) when true; top to bottom (lanes are columns) when false. */
  horizontal: boolean;
  /** The stretch along the flow that the bands cover. */
  along: { start: number; end: number };
  positions: Map<string, { x: number; y: number }>;
}

const sizeOf = (n: IRNode) => ({ w: n.size?.width ?? 140, h: n.size?.height ?? 44 });

export function laneGeometry(doc: VisualisationIR): LaneGeometry | undefined {
  const lanes = readLanes(doc);
  if (lanes.length === 0) return undefined;
  const horizontal = doc.layout.direction !== "TB" && doc.layout.direction !== "BT";
  const along = (n: IRNode) => (horizontal ? n.position.x : n.position.y);
  const alongSize = (n: IRNode) => (horizontal ? sizeOf(n).w : sizeOf(n).h);
  const crossSize = (n: IRNode) => (horizontal ? sizeOf(n).h : sizeOf(n).w);

  const bands: LaneBand[] = [];
  const slotOf = new Map<string, { band: number; slot: number }>();
  const pitchOf: number[] = [];
  let cursor = 0;
  lanes.forEach((name, bi) => {
    const members = doc.nodes.filter((n) => laneIndexOf(n, lanes) === bi).sort((a, b) => along(a) - along(b) || a.id.localeCompare(b.id));
    const pitch = Math.max(0, ...members.map(crossSize)) + SLOT_GAP;
    const slots: number[][] = []; // for each slot, where the last step in it ends along the flow
    const ends: number[] = [];
    for (const n of members) {
      let k = ends.findIndex((end) => end + ALONG_GAP <= along(n));
      if (k === -1) {
        k = ends.length;
        ends.push(-Infinity);
        slots.push([]);
      }
      ends[k] = along(n) + alongSize(n);
      slotOf.set(n.id, { band: bi, slot: k });
    }
    const size = Math.max(MIN_BAND, PAD * 2 + Math.max(1, ends.length) * pitch - SLOT_GAP);
    bands.push({ name, index: bi, start: cursor, size });
    pitchOf.push(pitch);
    cursor += size;
  });

  const positions = new Map<string, { x: number; y: number }>();
  for (const n of doc.nodes) {
    const s = slotOf.get(n.id)!;
    const band = bands[s.band]!;
    const slotCross = pitchOf[s.band]! - SLOT_GAP;
    const cross = band.start + PAD + s.slot * pitchOf[s.band]! + (slotCross - crossSize(n)) / 2;
    positions.set(n.id, horizontal ? { x: n.position.x, y: Math.round(cross) } : { x: Math.round(cross), y: n.position.y });
  }
  const starts = doc.nodes.map(along), ends = doc.nodes.map((n) => along(n) + alongSize(n));
  const a0 = (doc.nodes.length ? Math.min(...starts) : 0) - LANE_MARGIN, a1 = (doc.nodes.length ? Math.max(...ends) : 400) + LANE_MARGIN;
  return { bands, horizontal, along: { start: a0, end: Math.max(a1, a0 + 400) }, positions };
}

/** The document with every step's cross-axis position taken from its lane. Unchanged when there are no lanes. */
export function withLanePositions(doc: VisualisationIR): VisualisationIR {
  const geo = laneGeometry(doc);
  if (!geo) return doc;
  return { ...doc, nodes: doc.nodes.map((n) => ({ ...n, position: geo.positions.get(n.id) ?? n.position })) };
}

/** The lane a point falls in (across the flow), clamped to the first and last lane. */
export function laneAtCross(geo: LaneGeometry, cross: number): number {
  const hit = geo.bands.find((b) => cross >= b.start && cross < b.start + b.size);
  if (hit) return hit.index;
  return cross < 0 ? 0 : geo.bands.length - 1;
}

const withLaneList = (doc: VisualisationIR, lanes: string[]): VisualisationIR => {
  const options = { ...doc.configuration.options } as Record<string, unknown>;
  if (lanes.length === 0) delete options.lanes;
  else options.lanes = lanes;
  return { ...doc, configuration: { options: options as VisualisationIR["configuration"]["options"] } };
};

/** Turn swimlanes on (or replace the list). Steps keep their lane where it still exists; the rest go to the first lane. Flows left to right. */
export function setLanes(doc: VisualisationIR, names: readonly string[]): VisualisationIR {
  if (doc.type !== "flowchart") return doc;
  const lanes = uniqueNames(names).slice(0, MAX_LANES);
  const cur = readLanes(doc);
  if (lanes.length === cur.length && lanes.every((l, i) => l === cur[i])) return doc;
  if (lanes.length === 0) {
    return withLaneList({ ...doc, nodes: doc.nodes.map((n) => withExtras(n, { lane: null })) }, []);
  }
  const nodes = doc.nodes.map((n) => {
    const own = getExtras(n).lane;
    return withExtras(n, { lane: own && lanes.includes(own) ? own : lanes[0]! });
  });
  const direction = cur.length === 0 && doc.layout.direction === "TB" ? "LR" : doc.layout.direction;
  return withLaneList({ ...doc, nodes, layout: { ...doc.layout, direction } }, lanes);
}

export function addLane(doc: VisualisationIR, name: string): VisualisationIR {
  const lanes = readLanes(doc);
  const n = clean(name);
  if (!n || lanes.length >= MAX_LANES || lanes.some((l) => l.toLowerCase() === n.toLowerCase())) return doc;
  return setLanes(doc, [...lanes, n]);
}

/** Rename a lane; every step in it follows. */
export function renameLane(doc: VisualisationIR, from: string, to: string): VisualisationIR {
  const lanes = readLanes(doc);
  const n = clean(to);
  const i = lanes.indexOf(from);
  if (i === -1 || !n || n === from || lanes.some((l, j) => j !== i && l.toLowerCase() === n.toLowerCase())) return doc;
  const next = lanes.map((l, j) => (j === i ? n : l));
  const nodes = doc.nodes.map((node) => (getExtras(node).lane === from ? withExtras(node, { lane: n }) : node));
  return withLaneList({ ...doc, nodes }, next);
}

export function moveLane(doc: VisualisationIR, name: string, delta: -1 | 1): VisualisationIR {
  const lanes = readLanes(doc);
  const i = lanes.indexOf(name), j = i + delta;
  if (i === -1 || j < 0 || j >= lanes.length) return doc;
  const next = [...lanes];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return withLaneList(doc, next);
}

/** Remove a lane; its steps move to the lane above (or below, for the first). Removing the last lanes but one is allowed; removing the final lane turns swimlanes off. */
export function removeLane(doc: VisualisationIR, name: string): VisualisationIR {
  const lanes = readLanes(doc);
  const i = lanes.indexOf(name);
  if (i === -1) return doc;
  const next = lanes.filter((l) => l !== name);
  if (next.length === 0) return setLanes(doc, []);
  const heir = next[Math.max(0, i - 1)]!;
  const nodes = doc.nodes.map((n) => (getExtras(n).lane === name ? withExtras(n, { lane: heir }) : n));
  return withLaneList({ ...doc, nodes }, next);
}

/** Put steps in a lane. */
export function assignLane(doc: VisualisationIR, ids: readonly string[], lane: string): VisualisationIR {
  const lanes = readLanes(doc);
  if (!lanes.includes(lane)) return doc;
  const set = new Set(ids);
  let changed = false;
  const nodes = doc.nodes.map((n) => {
    if (!set.has(n.id) || laneIndexOf(n, lanes) === lanes.indexOf(lane) && getExtras(n).lane === lane) return n;
    changed = true;
    return withExtras(n, { lane });
  });
  return changed ? { ...doc, nodes } : doc;
}

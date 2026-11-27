import { capitalise, cleanLabel, stripDeterminer } from "../text";
import type { EngineType } from "../semantics";

export interface RequestInfo {
  /** 1-based line number the request phrase was found on. */
  line: number;
  /** The request text itself (to exclude it from the content). */
  raw: string;
  typeHint?: EngineType;
  topic?: string;
  /** Entities named by "relationships between A, B and C". */
  entities?: string[];
  /** Content appended after a colon on the same line. */
  inline?: string;
}

const VERB = /^(?:please\s+|can you\s+|could you\s+)?(?:(?:i\s+(?:want|need|would like|'d like)\s+(?:you\s+)?to\s+)|(?:i\s+(?:want|need|would like)\s+))?(?:create|make|draw|build|generate|produce|design|sketch|show|map|visuali[sz]e|illustrate|plot|give me|lay out|outline)\b/i;

const TYPE_WORDS: [RegExp, EngineType][] = [
  [/\b(?:flow\s?-?chart|process (?:diagram|map)|workflow|decision tree)\b/i, "flowchart"],
  [/\borg(?:ani[sz]ation(?:al)?)?\s?-?chart\b|\breporting lines?\b/i, "orgchart"],
  [/\bmind\s?-?map\b/i, "mindmap"],
  [/\bconcept\s?-?map\b/i, "conceptmap"],
  [/\b(?:timeline|roadmap|time line)\b/i, "timeline"],
  [/\brelationships?\b/i, "conceptmap"],
  [/\b(?:stages|steps|phases)\b/i, "flowchart"],
];

export function typeFromWords(text: string): EngineType | undefined {
  for (const [re, t] of TYPE_WORDS) if (re.test(text)) return t;
  return undefined;
}

function splitList(s: string): string[] {
  return s
    .split(/\s*,\s*(?:and\s+)?|\s+and\s+/i)
    .map((x) => cleanLabel(stripDeterminer(x)))
    .filter(Boolean);
}

/**
 * Recognise an instruction such as "Create a flowchart for customer
 * onboarding". Only the first matching line is treated as a request. It tells
 * us the intended type and topic; it never supplies content.
 */
export function findRequest(lines: { line: number; text: string }[]): RequestInfo | undefined {
  for (const l of lines.slice(0, 3)) {
    if (!VERB.test(l.text)) continue;
    const typeHint = typeFromWords(l.text);
    if (!typeHint && !/\b(?:stages|steps|phases|diagram|visual|chart|map)\b/i.test(l.text)) continue;

    let head = l.text;
    let inline: string | undefined;
    const colon = /^(.*?):\s+(.+)$/.exec(head);
    if (colon) {
      head = colon[1]!;
      inline = colon[2]!;
    }

    const between = /\brelationships?\s+(?:between|among|of)\s+(.+)$/i.exec(head);
    const topicMatch = /\b(?:for|about|on|of|covering|showing)\s+(?:the\s+)?(.+)$/i.exec(head);
    let topic = topicMatch?.[1];
    let entities: string[] | undefined;
    if (between) {
      entities = splitList(between[1]!);
      topic = undefined;
    }
    if (topic) topic = capitalise(cleanLabel(stripDeterminer(cleanLabel(topic))));
    return { line: l.line, raw: l.text, typeHint, topic: topic || undefined, entities, inline };
  }
  return undefined;
}

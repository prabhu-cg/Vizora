import { ENGINE_TYPES, type EngineType } from "../semantics";
import { capitalise, cleanLabel } from "../text";
import { interpretConcept } from "./concept";
import { detectType } from "./detect";
import { interpretFlowchart } from "./flowchart";
import { GraphBuilder } from "./graph-builder";
import { parseLines } from "./lines";
import { interpretMindmap } from "./mindmap";
import { findRequest } from "./prompt";
import { interpretTimeline } from "./timeline";
import { MAX_INPUT_CHARS, type Detection, type InterpretOptions, type Interpretation, type Warning } from "./types";

export * from "./types";
export { findRequest } from "./prompt";

const TYPE_NAME: Record<EngineType, string> = { flowchart: "flowchart", mindmap: "mind map", conceptmap: "concept map", timeline: "timeline" };

/**
 * Deterministic, rule-based interpretation. It reads structure that is
 * visibly there (steps, if/otherwise, outlines, dates, "A depends on B") and
 * never adds facts. It reports what it could not read as warnings.
 */
export function interpret(input: string, options: InterpretOptions = {}): Interpretation {
  const warnings: Warning[] = [];
  let text = input;
  if (text.length > MAX_INPUT_CHARS) {
    text = text.slice(0, MAX_INPUT_CHARS);
    warnings.push({ code: "too-long", severity: "warning", message: `The text is longer than ${MAX_INPUT_CHARS.toLocaleString()} characters, so only the start was used.` });
  }

  const all = parseLines(text);
  const request = findRequest(all);
  const content = all.filter((l) => !(request && l.line === request.line && request.raw === l.text));
  if (request?.inline) content.unshift({ line: request.line, text: request.inline, marker: "none", depth: 0 });

  const chosen = options.type && options.type !== "auto" ? options.type : undefined;
  let detection: Detection;
  if (chosen) {
    detection = { type: chosen, confidence: 1, alternatives: ENGINE_TYPES.filter((t) => t !== chosen), reason: "you chose this type", chosen: true };
  } else {
    detection = detectType(content.map((l) => l.text).join("\n"), content, request?.typeHint);
  }
  const type = detection.type;

  const title = cleanLabel(options.title ?? "") || request?.topic || "";
  const fallbackTitle = `Untitled ${TYPE_NAME[type]}`;
  const requestOnly = content.length === 0 && !(request?.entities?.length);

  let result: { graph: Interpretation["graph"]; warnings: Warning[] };
  if (requestOnly) {
    const g = new GraphBuilder();
    if (type === "mindmap" && request?.topic) g.add({ kind: "topic", label: request.topic });
    g.warn(
      "request-only",
      `Vizora's rule-based engine structures text you provide; it does not write content for you. It created an empty ${TYPE_NAME[type]}${title ? ` called “${title}”` : ""}. Paste or type the steps, outline, dates or relationships and generate again, or build it by hand.`,
    );
    result = { graph: g.graph(type, title || fallbackTitle, { algorithm: type === "mindmap" ? "tree" : type === "timeline" ? "linear" : "layered" }), warnings: g.warnings };
  } else {
    switch (type) {
      case "flowchart":
        result = interpretFlowchart(content, title || fallbackTitle);
        break;
      case "mindmap":
        result = interpretMindmap(content, { topic: request?.topic, title: title || fallbackTitle });
        break;
      case "conceptmap":
        result = interpretConcept(content, { title: title || fallbackTitle, entities: request?.entities });
        break;
      case "timeline":
        result = interpretTimeline(content, title || fallbackTitle);
        break;
    }
  }
  warnings.push(...result.warnings);

  if (!requestOnly && !chosen && detection.confidence < 0.5) {
    const alts = detection.alternatives.slice(0, 2).map((t) => TYPE_NAME[t]).join(" or ");
    warnings.unshift({
      code: "low-confidence",
      severity: "warning",
      message: `It was not clear what kind of visualisation this is, so a ${TYPE_NAME[type]} was chosen${alts ? `. Try ${alts} instead` : ""}.`,
    });
  }
  if (!requestOnly && chosen && result.graph.items.length > 0 && result.graph.links.length === 0 && type !== "timeline" && type !== "conceptmap") {
    warnings.push({ code: "no-structure", severity: "warning", message: `No connections were found in the text for a ${TYPE_NAME[type]}.` });
  }
  void capitalise;
  return { graph: result.graph, warnings, detection, requestOnly };
}

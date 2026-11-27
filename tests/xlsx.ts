import { strToU8, zipSync } from "fflate";

type Cell = string | number | boolean | Date | null;
export interface SheetSpec {
  name: string;
  rows: Cell[][];
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const col = (i: number) => String.fromCharCode(65 + i);
const serial = (d: Date) => (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(1899, 11, 30)) / 86_400_000 + (d.getUTCHours() * 3600 + d.getUTCMinutes() * 60) / 86400;

/** Build a minimal but valid .xlsx workbook in memory (shared strings, a date style, booleans). */
export function makeXlsx(sheets: SheetSpec[]): Uint8Array {
  const strings: string[] = [];
  const sid = (s: string) => {
    const i = strings.indexOf(s);
    if (i >= 0) return i;
    strings.push(s);
    return strings.length - 1;
  };
  const sheetXml = (rows: Cell[][]) =>
    `<?xml version="1.0" encoding="UTF-8"?><worksheet ${NS}><sheetData>` +
    rows
      .map(
        (r, ri) =>
          `<row r="${ri + 1}">` +
          r
            .map((v, ci) => {
              const ref = `${col(ci)}${ri + 1}`;
              if (v === null || v === "") return "";
              if (typeof v === "number") return `<c r="${ref}"><v>${v}</v></c>`;
              if (typeof v === "boolean") return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
              if (v instanceof Date) return `<c r="${ref}" s="1"><v>${serial(v)}</v></c>`;
              return `<c r="${ref}" t="s"><v>${sid(v)}</v></c>`;
            })
            .join("") +
          `</row>`,
      )
      .join("") +
    `</sheetData></worksheet>`;

  const files: Record<string, Uint8Array> = {};
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s.rows))));
  const rel = (id: string, type: string, target: string) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
  files["[Content_Types].xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`,
  );
  files["_rels/.rels"] = strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel("rId1", "officeDocument", "xl/workbook.xml")}</Relationships>`);
  files["xl/workbook.xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
  );
  files["xl/_rels/workbook.xml.rels"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => rel(`rId${i + 1}`, "worksheet", `worksheets/sheet${i + 1}.xml`)).join("")}${rel(`rId${sheets.length + 1}`, "styles", "styles.xml")}${rel(`rId${sheets.length + 2}`, "sharedStrings", "sharedStrings.xml")}</Relationships>`,
  );
  files["xl/styles.xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><styleSheet ${NS}><fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>`,
  );
  files["xl/sharedStrings.xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8"?><sst ${NS} count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}</sst>`);
  return zipSync(files);
}

export const xlsxFile = (sheets: SheetSpec[], name = "book.xlsx") => new File([makeXlsx(sheets) as BlobPart], name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

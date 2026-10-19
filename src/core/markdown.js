import { BLOCK_CLASSES } from "./constants.js";

/**
 * 将识别行与版块分类合成为结构化 Markdown。
 */
export function toMarkdown(lines, clsTensor) {
  if (!lines.length) return "";
  const NC = BLOCK_CLASSES.length;
  const kindOf = (i) => {
    if (!clsTensor) return "Text";
    const idx = lines[i]?.origIdx ?? i;
    let best = 0;
    for (let c = 1; c < NC; c++) if (clsTensor[idx * NC + c] > clsTensor[idx * NC + best]) best = c;
    return BLOCK_CLASSES[best];
  };

  const hs = lines.map(l => l.box[3] - l.box[1]).sort((a, b) => a - b);
  const medH = hs[hs.length >> 1] || 1;
  const gaps = [];
  for (let i = 1; i < lines.length; i++) gaps.push(Math.max(0, lines[i].box[1] - lines[i-1].box[3]));
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const medGap = sortedGaps.length ? sortedGaps[sortedGaps.length >> 1] : 0;

  const out = [];
  let para = [];
  const flush = () => { if (para.length) { out.push(para.join(" ")); para = []; } };
  let table = null;
  const flushTable = () => { if (table && table.length) out.push(table.join("\n")); table = null; };

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text.trim();
    if (!t) continue;
    const k = kindOf(i);
    const tall = (lines[i].box[3] - lines[i].box[1]) > medH * 1.25;
    if (k === "Page-Header" || k === "Page-Footer" || k === "Footnote") { flush(); flushTable(); continue; }
    if (k === "Section-Header" || (tall && t.length < 80 && !/[。.!?！？]$/.test(t))) {
      flush(); flushTable(); out.push((tall ? "## " : "# ") + t); continue;
    }
    if (k === "List-Group") { flush(); flushTable(); out.push("- " + t.replace(/^[•·▪◦\-*–—]\s*/, "")); continue; }
    if (k === "Caption")    { flush(); flushTable(); out.push("*" + t + "*"); continue; }
    if (k === "Table")      { flush(); (table ??= []).push("| " + t + " |"); continue; }
    flushTable();

    if (i > 0 && para.length) {
      const prev = lines[i-1].box;
      const sameCol = Math.abs(lines[i].box[0] - prev[0]) < medH * 0.6;
      const tight = medGap > 0 ? (lines[i].box[1] - prev[3]) < medGap * 2.2 : true;
      if (!sameCol || !tight) flush();
    }
    para.push(t);
  }
  flush(); flushTable();
  return out.join("\n\n");
}

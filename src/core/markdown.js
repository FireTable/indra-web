import { BLOCK_CLASSES } from "./constants.js";

/**
 * Group cell lines into rows by vertical center, top to bottom.
 */
export function groupTableRows(boxes) {
  const n = boxes.length;
  const cy = boxes.map(b => (b[1] + b[3]) / 2);
  const idxs = Array.from({ length: n }, (_, i) => i).sort((a, b) => cy[a] - cy[b]);
  const rows = [];
  for (const i of idxs) {
    const h = boxes[i][3] - boxes[i][1];
    if (rows.length) {
      const lastRow = rows[rows.length - 1];
      const meanCy = lastRow.reduce((s, k) => s + cy[k], 0) / lastRow.length;
      if (Math.abs(cy[i] - meanCy) < 0.5 * h) {
        lastRow.push(i);
        continue;
      }
    }
    rows.push([i]);
  }
  return rows.map(r => r.sort((a, b) => boxes[a][0] - boxes[b][0]));
}

/**
 * Merge wrapped lines of the same cell into one table row.
 */
export function mergeWrappedRows(rows, boxes) {
  if (rows.length < 3) return rows;
  const allHeights = [];
  for (const r of rows) for (const k of r) allHeights.push(boxes[k][3] - boxes[k][1]);
  allHeights.sort((a, b) => a - b);
  const medH = allHeights[allHeights.length >> 1] || 1;

  const gaps = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const cur = rows[i], nxt = rows[i + 1];
    const curMaxY = Math.max(...cur.map(k => boxes[k][3]));
    const nxtMinY = Math.min(...nxt.map(k => boxes[k][1]));
    gaps.push(nxtMinY - curMaxY);
  }
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const medGap = sortedGaps[sortedGaps.length >> 1] || 0;

  const out = [[...rows[0]]];
  let prev = rows[0];
  for (let i = 0; i < gaps.length; i++) {
    const g = gaps[i];
    const r = rows[i + 1];
    if (g < 0.5 * medGap && g < 0.6 * medH && r.length < prev.length) {
      out[out.length - 1].push(...r);
    } else {
      out.push([...r]);
      prev = r;
    }
  }
  return out.map(r => r.sort((a, b) => boxes[a][0] - boxes[b][0]));
}

/**
 * Reconstruct a 2D Markdown grid table from a list of recognized cell lines with bounding boxes.
 */
export function tableToMarkdown(lines) {
  if (!lines || !lines.length) return "";
  const boxes = lines.map(l => l.box);
  const texts = lines.map(l => (l.text || "").trim());
  let rows = groupTableRows(boxes);
  rows = mergeWrappedRows(rows, boxes);

  const minX = Math.min(...boxes.map(b => b[0]));
  const maxX = Math.max(...boxes.map(b => b[2]));
  const tableSpanX = maxX - minX;

  let titleText = "";
  let effectiveRows = rows;
  if (
    rows.length > 2 &&
    rows[0].length === 1 &&
    Math.max(...rows.map(r => r.length)) > 1 &&
    (boxes[rows[0][0]][2] - boxes[rows[0][0]][0]) > 0.6 * tableSpanX
  ) {
    titleText = texts[rows[0][0]];
    effectiveRows = rows.slice(1);
  }

  const width = Math.max(...effectiveRows.map(r => r.length));
  if (width <= 1) {
    const mdLines = effectiveRows.map(r => r.map(k => texts[k]).join(" "));
    const res = mdLines.join("\n");
    return titleText ? `**${titleText}**\n\n${res}` : res;
  }

  const fullRows = effectiveRows.filter(r => r.length === width);
  const bands = [];
  for (let c = 0; c < width; c++) {
    const x0s = fullRows.map(r => boxes[r[c]][0]).sort((a, b) => a - b);
    const x1s = fullRows.map(r => boxes[r[c]][2]).sort((a, b) => a - b);
    bands.push([
      x0s[x0s.length >> 1],
      x1s[x1s.length >> 1]
    ]);
  }

  const edges = [-Infinity];
  for (let c = 0; c < width - 1; c++) {
    edges.push((bands[c][1] + bands[c + 1][0]) / 2);
  }
  edges.push(Infinity);

  const tableGrid = [];
  for (let ri = 0; ri < effectiveRows.length; ri++) {
    const r = effectiveRows[ri];
    const sortedK = [...r].sort((a, b) => (boxes[a][1] - boxes[b][1]) || (boxes[a][0] - boxes[b][0]));
    const cells = new Map();

    for (const k of sortedK) {
      const x0 = boxes[k][0], x1 = boxes[k][2];
      let first = 0;
      while (first < edges.length - 1 && x0 >= edges[first + 1]) first++;
      let last = 0;
      while (last < edges.length - 1 && x1 >= edges[last + 1]) last++;
      first = Math.max(0, Math.min(width - 1, first));
      last = Math.max(0, Math.min(width - 1, last));

      const span = [];
      for (let c = first; c <= last; c++) {
        const bandW = bands[c][1] - bands[c][0];
        const overlap = Math.min(x1, bands[c][1]) - Math.max(x0, bands[c][0]);
        if (overlap > 0.5 * bandW) span.push(c);
      }
      if (!span.length) span.push(first);
      const c0 = span[0];
      const text = texts[k];
      if (cells.has(c0)) {
        cells.get(c0).text += " " + text;
      } else {
        cells.set(c0, { span: span.length, text });
      }
    }

    const rowCells = [];
    let c = 0;
    while (c < width) {
      if (cells.has(c)) {
        const cell = cells.get(c);
        const safeText = cell.text.replace(/\|/g, "\\|").trim();
        rowCells.push(safeText);
        for (let s = 1; s < cell.span && c + s < width; s++) rowCells.push("");
        c += cell.span;
      } else {
        rowCells.push("");
        c++;
      }
    }
    tableGrid.push(rowCells);
  }

  const outTable = [];
  const headerRow = tableGrid[0];
  outTable.push("| " + headerRow.join(" | ") + " |");
  outTable.push("| " + headerRow.map(() => "---").join(" | ") + " |");
  for (let i = 1; i < tableGrid.length; i++) {
    outTable.push("| " + tableGrid[i].join(" | ") + " |");
  }
  const mdTable = outTable.join("\n");
  return titleText ? `**${titleText}**\n\n${mdTable}` : mdTable;
}

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
  let tableLines = null;
  const flushTable = () => {
    if (tableLines && tableLines.length) {
      out.push(tableToMarkdown(tableLines));
      tableLines = null;
    }
  };

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
    if (k === "Table")      { flush(); (tableLines ??= []).push(lines[i]); continue; }
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

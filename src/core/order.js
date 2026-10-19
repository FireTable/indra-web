import { BLOCK_CLASSES } from "./constants.js";

export function lineFeatures(boxes, W, H, texts) {
  const n = boxes.length;
  const hs = boxes.map(b => Math.max(b[3] - b[1], 1e-3)).sort((a, b) => a - b);
  const med = n ? hs[n >> 1] : 1;
  const f = new Float32Array(n * 16);
  for (let i = 0; i < n; i++) {
    const b = boxes[i], w = Math.max(b[2] - b[0], 1e-3), h = Math.max(b[3] - b[1], 1e-3);
    f.set([ b[0]/W, b[1]/H, b[2]/W, b[3]/H, (b[0]+b[2])/(2*W), (b[1]+b[3])/(2*H),
            w/W, Math.log(h/med), Math.log(w/h)/4, med/H*20 ], i*16);
    const t = (texts[i] || "").trim();
    if (!t) continue;
    const digits = [...t].filter(c => c >= "0" && c <= "9").length / t.length;
    const head = t.slice(0, 3).replace(/[.)]+$/, "");
    const bullet = "•-–▪◦*·→".includes(t[0]) || (/^\d+$/.test(head) && t.length > 3);
    const upper = t[0] === t[0].toUpperCase() && t[0] !== t[0].toLowerCase();
    f.set([ Math.log1p(t.length)/5, digits, bullet ? 1 : 0,
            t.endsWith("-") ? 1 : 0, ".!?:;".includes(t[t.length-1]) ? 1 : 0,
            upper ? 1 : 0 ], i*16 + 10);
  }
  return f;
}

/**
 * 同块 logit 的平均连接聚类：一对错判不足以把两个块粘在一起
 */
export function cluster(logits, n, stride) {
  if (!n) return [];
  const S = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) S[i * n + j] = i === j ? 0 : logits[i * stride + j];
  const M = new Float64Array(n * n), size = new Float64Array(n).fill(1);
  const alive = new Uint8Array(n).fill(1), members = Array.from({ length: n }, (_, i) => [i]);
  const NEG = -Infinity;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) M[i * n + j] = i === j ? NEG : S[i * n + j];
  const best = new Int32Array(n), bestV = new Float64Array(n);
  for (let i = 0; i < n; i++) { let b = 0; for (let j = 1; j < n; j++) if (M[i * n + j] > M[i * n + b]) b = j; best[i] = b; bestV[i] = M[i * n + b]; }
  for (let it = 0; it < n - 1; it++) {
    let a = 0; for (let i = 1; i < n; i++) if (bestV[i] > bestV[a]) a = i;
    if (bestV[a] <= 0) break;
    let b = best[a]; [a, b] = a < b ? [a, b] : [b, a];
    for (let j = 0; j < n; j++) { const v = S[a * n + j] + S[b * n + j]; S[a * n + j] = v; S[j * n + a] += S[b * n + j]; }
    S[a * n + a] = 0;
    size[a] += size[b]; alive[b] = 0; members[a] = members[a].concat(members[b]);
    const row = new Float64Array(n);
    for (let j = 0; j < n; j++) row[j] = (!alive[j] || j === a) ? NEG : S[a * n + j] / (size[a] * size[j]);
    for (let j = 0; j < n; j++) { M[a * n + j] = row[j]; M[j * n + a] = row[j]; }
    for (let j = 0; j < n; j++) { M[b * n + j] = NEG; M[j * n + b] = NEG; }
    bestV[b] = NEG;
    let bb = 0; for (let j = 1; j < n; j++) if (row[j] > row[bb]) bb = j;
    best[a] = bb; bestV[a] = bb >= 0 ? row[bb] : NEG;
    for (let j = 0; j < n; j++) {
      if (!alive[j] || j === a) continue;
      if (best[j] === a || best[j] === b) {
        let q = 0; for (let k = 1; k < n; k++) if (M[j * n + k] > M[j * n + q]) q = k;
        best[j] = q; bestV[j] = M[j * n + q];
      }
      if (row[j] > bestV[j]) { best[j] = a; bestV[j] = row[j]; }
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (alive[i]) out.push(members[i].sort((p, q) => p - q));
  return out;
}

/**
 * 递归 XY-cut：沿最宽空白切，横切先读上半、竖切先读左半
 */
export function xycut(boxes, ids) {
  if (ids.length <= 1) return ids;
  const best = (list, vertical) => {
    const lo = list.map(i => vertical ? boxes[i][0] : boxes[i][1]);
    const hi = list.map(i => vertical ? boxes[i][2] : boxes[i][3]);
    const o = list.map((_, k) => k).sort((p, q) => lo[p] - lo[q]);
    let end = -Infinity, gap = 0, at = -1;
    for (let k = 0; k < o.length; k++) {
      if (k > 0) { const g = lo[o[k]] - end; if (g > gap) { gap = g; at = k; } }
      end = Math.max(end, hi[o[k]]);
    }
    return { gap, at, o };
  };
  const gy = best(ids, false), gx = best(ids, true);
  if (gy.at < 0 && gx.at < 0) return topDownOf(boxes, ids);
  const use = gy.gap >= gx.gap ? gy : gx;
  return xycut(boxes, use.o.slice(0, use.at).map(k => ids[k]))
       .concat(xycut(boxes, use.o.slice(use.at).map(k => ids[k])));
}

export function topDownOf(boxes, ids) {
  const cy = ids.map(i => (boxes[i][1] + boxes[i][3]) / 2);
  const hs = ids.map(i => boxes[i][3] - boxes[i][1]).sort((a, b) => a - b);
  const med = hs[hs.length >> 1] || 1;
  return ids.map((_, k) => k).sort((p, q) =>
    (Math.round(cy[p] / (med * 0.5)) - Math.round(cy[q] / (med * 0.5))) || (boxes[ids[p]][0] - boxes[ids[q]][0])
  ).map(k => ids[k]);
}

export function topDown(boxes) {
  const cy = boxes.map(b => (b[1] + b[3]) / 2);
  const hs = boxes.map(b => b[3] - b[1]).sort((a, b) => a - b);
  const med = hs[hs.length >> 1] || 1;
  return [...Array(boxes.length).keys()].sort((i, j) =>
    (Math.round(cy[i] / (med * 0.5)) - Math.round(cy[j] / (med * 0.5))) || (boxes[i][0] - boxes[j][0]));
}

/**
 * 先分块、块内 XY-cut、块间按成对顺序 logit 排
 */
export function decodeBlocksOrder(a, same, boxes, cls, n, stride, sameStride) {
  if (n <= 1) return boxes.map((_, i) => i);
  const blocks = cluster(same, n, sameStride);
  const GRID = new Set(["Table", "Form", "Table-Of-Contents"].map(c => BLOCK_CLASSES.indexOf(c)));
  const inner = blocks.map(b => {
    let local;
    if (cls) {
      const sums = new Float64Array(BLOCK_CLASSES.length);
      for (const i of b) for (let c = 0; c < BLOCK_CLASSES.length; c++) sums[c] += cls[i * BLOCK_CLASSES.length + c];
      let best = 0; for (let c = 1; c < sums.length; c++) if (sums[c] > sums[best]) best = c;
      local = GRID.has(best) ? topDownOf(boxes, b) : xycut(boxes, b);
    } else local = xycut(boxes, b);
    return local;
  });
  const m = blocks.length;
  const G = new Float64Array(m * n);
  blocks.forEach((b, k) => b.forEach(i => { G[k * n + i] = 1 / b.length; }));
  const Ga = new Float64Array(m * n);
  for (let p = 0; p < m; p++) for (let q = 0; q < n; q++) {
    let s = 0; for (let k = 0; k < n; k++) s += G[p * n + k] * a[k * stride + q];
    Ga[p * n + q] = s;
  }
  const M = new Float64Array(m * m);
  for (let p = 0; p < m; p++) for (let q = 0; q < m; q++) {
    let s = 0; for (let k = 0; k < n; k++) s += Ga[p * n + k] * G[q * n + k];
    M[p * m + q] = s;
  }
  const ab = new Float64Array(m * m);
  for (let p = 0; p < m; p++) for (let q = 0; q < m; q++)
    ab[p * m + q] = p === q ? 0 : M[p * m + q] - M[q * m + p];
  return decodeOrder(ab, m, m).flatMap(k => inner[k]);
}

/**
 * 成对 logit → 顺序搜索（多起点启发式插入）
 */
export function decodeOrder(a, n, stride = n, sweeps = 4) {
  const lp = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = Math.max(-30, Math.min(30, a[i * stride + j]));
    lp[i * n + j] = -Math.log1p(Math.exp(-v));
  }
  const total = (ord) => {
    let s = 0;
    for (let k = 0; k < ord.length; k++) for (let l = k + 1; l < ord.length; l++) s += lp[ord[k] * n + ord[l]];
    return s;
  };
  const search = (start) => {
    let order = [...start];
    for (let s = 0; s < sweeps; s++) {
      let improved = false;
      for (const x of [...order]) {
        const rest = order.filter(v => v !== x), L = rest.length;
        const gains = new Float64Array(L + 1);
        for (let k = 1; k <= L; k++) gains[k] = gains[k-1] + lp[rest[k-1] * n + x];
        let suf = 0;
        for (let k = L - 1; k >= 0; k--) { suf += lp[x * n + rest[k]]; gains[k] += suf; }
        let bk = 0; for (let k = 1; k <= L; k++) if (gains[k] > gains[bk]) bk = k;
        const cur = order.indexOf(x);
        if (gains[bk] > gains[cur] + 1e-6) { order = [...rest.slice(0, bk), x, ...rest.slice(bk)]; improved = true; }
      }
      if (!improved) break;
    }
    return order;
  };
  const key = (i) => { let s = 0; for (let j = 0; j < n; j++) { if (j !== i) s += lp[j * n + i] - lp[i * n + j]; } return s; };
  const ranked = [...Array(n).keys()].sort((x, y) => key(x) - key(y));
  const starts = [ranked, [...Array(n).keys()], [...ranked].reverse()];
  let best = starts[0], bestScore = -Infinity;
  for (const st of starts) { const r = search(st), t = total(r); if (t > bestScore) { bestScore = t; best = r; } }
  return best;
}

export async function readingOrder(sessOrder, ort, boxes, texts, W, H) {
  const n = boxes.length;
  if (n <= 1) return { order: boxes.map((_, i) => i), cls: null };
  if (!sessOrder) return { order: topDown(boxes), cls: null };
  const feats = lineFeatures(boxes, W, H, texts);
  const out = await sessOrder.run({
    feats: new ort.Tensor("float32", feats, [1, n, 16]),
    mask:  new ort.Tensor("bool", new Uint8Array(n).fill(1), [1, n]),
  });
  const aT = out["a"], sameT = out["same"], clsT = out["cls"];
  const a = new Float32Array(aT.data), same = new Float32Array(sameT.data), cls = new Float32Array(clsT.data);
  const [, N, N2] = aT.dims, S2 = sameT.dims[2];
  if (!(N >= n && N2 >= n && sameT.dims[1] >= n && S2 >= n)) return { order: topDown(boxes), cls };
  return { order: decodeBlocksOrder(a, same, boxes, cls, n, N2, S2), cls };
}

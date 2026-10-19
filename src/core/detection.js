import { OUT_STRIDE, CORE_X_SHRINK, ADAPTIVE_MIN_H, ADAPTIVE_TARGET_H, ADAPTIVE_MAX_SIDE, tick } from "./constants.js";
import { pageToInput } from "./image.js";

/**
 * 4-连通域 + 统计量（并查集两遍扫描）
 */
export function components(mask, w, h) {
  const lab = new Int32Array(w * h).fill(-1), parent = [0];
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!mask[i]) continue;
    const up = y > 0 && lab[i - w] >= 0 ? lab[i - w] : -1;
    const lf = x > 0 && lab[i - 1] >= 0 ? lab[i - 1] : -1;
    if (up < 0 && lf < 0) { const id = parent.length; parent.push(id); lab[i] = id; }
    else if (up < 0) lab[i] = lf;
    else if (lf < 0) lab[i] = up;
    else { lab[i] = Math.min(up, lf); union(up, lf); }
  }
  const remap = new Map(), stats = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (lab[i] < 0) continue;
    const r = find(lab[i]);
    let s = remap.get(r);
    if (!s) { s = stats.length + 1; remap.set(r, s); stats.push({ left: x, top: y, w: 0, h: 0, area: 0 }); }
    lab[i] = s;
    const st = stats[s - 1];
    st.left = Math.min(st.left, x); st.top = Math.min(st.top, y);
    st.w = Math.max(st.w, x - st.left + 1); st.h = Math.max(st.h, y - st.top + 1);
    st.area++;
  }
  return { lab, stats };
}

/**
 * det 输出 [3,h,w] → 行框 [N,5]（输入像素）
 */
export function decodeDet(out, ow, oh, thresh = 0.5, minArea = 2) {
  const n = ow * oh, prob = new Float32Array(n), mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const p = 1 / (1 + Math.exp(-out[i])); prob[i] = p; mask[i] = p > thresh ? 1 : 0; }
  const { lab, stats } = components(mask, ow, oh);
  const cnt = stats.length + 1;
  const c = new Float64Array(cnt), y0s = new Float64Array(cnt), y1s = new Float64Array(cnt), sc = new Float64Array(cnt);
  for (let y = 0; y < oh; y++) {
    const ys = (y + 0.5) * OUT_STRIDE, row = y * ow;
    for (let x = 0; x < ow; x++) {
      const i = row + x, L = lab[i];
      if (L <= 0) continue;
      c[L]++; y0s[L] += ys - out[n + i]; y1s[L] += ys + out[2 * n + i]; sc[L] += prob[i];
    }
  }
  const boxes = [];
  for (let i = 1; i < cnt; i++) {
    if (stats[i - 1].area < minArea) continue;
    const y0 = y0s[i] / c[i], y1 = y1s[i] / c[i];
    const lh = Math.max(1, y1 - y0), ex = Math.min(CORE_X_SHRINK * lh, 0.5 * lh);
    boxes.push([stats[i-1].left * OUT_STRIDE - ex, y0,
                (stats[i-1].left + stats[i-1].w) * OUT_STRIDE + ex, y1, sc[i] / c[i]]);
  }
  return boxes;
}

export async function detAt(sess, ort, g, w, h, longSide, ev) {
  let t = performance.now();
  const pi = pageToInput(g, w, h, longSide);
  ev?.mark?.("resize", performance.now() - t);
  t = performance.now();
  const dr = await sess.run({ x: new ort.Tensor("float32", pi.x, pi.dims) });
  ev?.mark?.("det", performance.now() - t);
  t = performance.now();
  const dout = dr["out"];
  const boxes = decodeDet(dout.data, dout.dims[3], dout.dims[2]);
  ev?.mark?.("decode", performance.now() - t);
  return { pi, boxes };
}

export const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

/**
 * 自适应重检测：行高低于阈值说明缩小过度，按官方逻辑重跑一遍高分辨率
 */
export async function detectAdaptive(sess, ort, g, w, h, opt, ev) {
  let { pi, boxes } = await detAt(sess, ort, g, w, h, opt.longSide, ev);
  let bumped = false, medH = 0;
  if (boxes.length >= 8) {
    medH = median(boxes.map(b => b[3] - b[1]));
    if (opt.adaptive && medH < ADAPTIVE_MIN_H) {
      const ls = Math.floor(Math.min(ADAPTIVE_MAX_SIDE, opt.longSide * ADAPTIVE_TARGET_H / Math.max(medH, 1)) / 32) * 32;
      if (ls > opt.longSide) {
        await tick();
        const second = await detAt(sess, ort, g, w, h, ls, ev);
        pi = second.pi; boxes = second.boxes; bumped = true;
      }
    }
  }
  return { pi, boxes, bumped, medH };
}

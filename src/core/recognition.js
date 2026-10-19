import { PAD_Y, PAD_X, WIDTH_MULTIPLE, tick, isAborted } from "./constants.js";
import { resizeGray } from "./image.js";

/**
 * 行裁剪：按 PAD_X/PAD_Y 外扩 → 缩放到 rec_height 高的墨迹图
 */
export function cropLine(g, W, H, box, height) {
  const [x0, y0, x1, y1] = box, bh = Math.max(1, y1 - y0);
  const ix0 = Math.floor(x0 - PAD_X * bh), ix1 = Math.ceil(x1 + PAD_X * bh);
  const iy0 = Math.floor(y0 - PAD_Y * bh), iy1 = Math.ceil(y1 + PAD_Y * bh);
  const cw = Math.max(1, ix1 - ix0), ch = Math.max(1, iy1 - iy0);
  const buf = new Uint8Array(cw * ch).fill(255);
  const sx0 = Math.max(0, ix0), sy0 = Math.max(0, iy0), sx1 = Math.min(W, ix1), sy1 = Math.min(H, iy1);
  for (let r = sy0; r < sy1; r++)
    for (let c = sx0; c < sx1; c++) buf[(r - iy0) * cw + (c - ix0)] = g[r * W + c];
  const outW = Math.max(WIDTH_MULTIPLE, Math.min(4096, Math.round(cw * height / ch)));
  const rs = resizeGray(buf, cw, ch, outW, height);
  const ink = new Float32Array(outW * height);
  for (let i = 0; i < ink.length; i++) ink[i] = 1 - rs[i] / 255;
  return { ink, w: outW };
}

export function padBatch(lines, height, multiple = WIDTH_MULTIPLE) {
  let Wm = 0; for (const l of lines) Wm = Math.max(Wm, l.w);
  Wm = Math.ceil(Wm / multiple) * multiple;
  const B = lines.length;
  const x = new Float32Array(B * height * Wm), widths = new BigInt64Array(B);
  for (let i = 0; i < B; i++) {
    const l = lines[i];
    for (let r = 0; r < height; r++)
      for (let c = 0; c < l.w; c++) x[i * height * Wm + r * Wm + c] = l.ink[r * l.w + c];
    widths[i] = BigInt(l.w);
  }
  return { x, dims: [B, 1, height, Wm], widths };
}

/**
 * 宽度相近的行批处理，减少补零浪费
 */
export function widthBatches(widths, maxBatch = 8, maxRatio = 1.3, minWidth = 64, maxArea = 8 * 900) {
  const order = widths.map((_, i) => i).sort((a, b) => widths[a] - widths[b]);
  const out = [];
  for (const i of order) {
    const last = out[out.length - 1];
    if (last && last.length < maxBatch
        && Math.max(widths[i], minWidth) <= maxRatio * Math.max(widths[last[0]], minWidth)
        && (last.length + 1) * Math.max(widths[i], minWidth) <= maxArea) last.push(i);
    else out.push([i]);
  }
  return out;
}

export async function runRec(sess, ort, names, crops, height, vocab, onBatch) {
  const results = new Array(crops.length).fill(null);
  const groups = widthBatches(crops.map(c => c.w));
  for (const sel of groups) {
    if (isAborted()) return results;
    const lines = sel.map(i => crops[i]);
    const pb = padBatch(lines, height);
    const out = await sess.run({
      x: new ort.Tensor("float32", pb.x, pb.dims),
      widths: new ort.Tensor("int64", pb.widths, [pb.widths.length])
    });
    // onnxruntime-web 的输出可能共享一块 wasm 内存，先各自拷出来再用
    const ids = Array.from(out[names[0]].data, Number);
    const conf = Array.from(out[names[1]].data);
    const lens = Array.from(out[names[2]].data, Number);
    const T = out[names[0]].dims[1];
    sel.forEach((idx, k) => {
      let s = "", sum = 0, cnt = 0, prev = -1;
      const n = lens[k];
      for (let t = 0; t < n; t++) {
        const id = ids[k * T + t];
        if (id !== 0 && id !== prev) { s += vocab[id - 1] ?? "?"; sum += conf[k * T + t]; cnt++; }
        prev = id;
      }
      results[idx] = { text: s, conf: cnt ? (sum / cnt) : 0 };
    });
    onBatch?.(sel, results);
    await tick();
  }
  return results;
}

const ORT_VER = "1.22.0";
const ORTBASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/`;
const HF      = "https://huggingface.co/datalab-to/indra-ocr/resolve/main/";

let ort = null, S = {}, META = null;

const OUT_STRIDE = 2, INPUT_MULTIPLE = 32, CORE_X_SHRINK = 0.15;
const PAD_Y = 0.2, PAD_X = 0.3, WIDTH_MULTIPLE = 8;
// 自适应重检测：行高（检测输入像素）低于 MIN 就提高分辨率重跑，见 indra_ocr/pipeline.py
const ADAPTIVE_MIN_H = 9.0, ADAPTIVE_TARGET_H = 12.0, ADAPTIVE_MAX_SIDE = 2048;
// 可调项
const OPT = { longSide: 1024, adaptive: true, minConf: 0.5 };
const BLOCK_CLASSES = ["Text","Section-Header","Page-Header","Page-Footer","List-Group",
                       "Table","Caption","Footnote","Table-Of-Contents","Form"];
const NEEDED = ["det.onnx","rec.onnx","rec_cjk.onnx","script.onnx","order.onnx","meta.json"];

let abortFlag = false;
/* 把线程还给事件循环，流式展示的前提。
   scheduler.yield 在 Worker 里可能永不 resolve，这里一律用 MessageChannel 通道，
   它在主线程与 Worker 中行为一致，且比 setTimeout(0) 的钳制更轻。 */
const _yieldChan = new MessageChannel();
const tick = () => new Promise((resolve) => {
  _yieldChan.port1.onmessage = () => resolve();
  _yieldChan.port2.postMessage(0);
});
/* 可用时开多线程 WASM（需要 SharedArrayBuffer，即跨源隔离）。 */
/* 核心只负责「能不能多线程」；用几个线程是上层的策略（见 app.js 的 wasmThreads）。
   没有跨源隔离就没有 SharedArrayBuffer，只能单线程。 */
const maxThreads = () =>
  (typeof SharedArrayBuffer !== "undefined" && globalThis.crossOriginIsolated)
    ? Math.max(1, navigator.hardwareConcurrency || 4) : 1;


/* ------------------------------------------------------------ 图像工具 */

const toGray = (img) => {
  const iw = img.naturalWidth ?? img.width, ih = img.naturalHeight ?? img.height;
  const c = new OffscreenCanvas(iw, ih);
  const x = c.getContext("2d", { willReadFrequently: true });
  x.fillStyle = "#ffffff";
  x.fillRect(0, 0, iw, ih);
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, iw, ih).data;
  const g = new Uint8Array(iw * ih);
  for (let i = 0, p = 0; i < g.length; i++, p += 4)
    g[i] = (d[p] * 299 + d[p + 1] * 587 + d[p + 2] * 114) / 1000 | 0;
  return { g, w: iw, h: ih };
};

/* 与 cv2.INTER_AREA / INTER_LINEAR 对齐的缩放。
   canvas 的 imageSmoothing 只是近似，边界几个像素的差异就足以让检测框的均值偏移亚像素，
   进而让小字行的裁剪高度差 2px、识别结果翻转，所以这里按 OpenCV 的算法自己算。
   Python 侧：page_to_input 与 crop_line 都是缩小用 AREA、放大用 LINEAR。 */
function resizeArea(g, w, h, nw, nh) {
  // 盒式滤波可分离：先横向平均，再纵向平均，全程 float 累加，最后一次性取整
  const sx = w / nw;
  const span = [];
  for (let x = 0; x < w; x++) {
    const d0 = x / sx, d1 = (x + 1) / sx;
    const i0 = Math.floor(d0), i1 = Math.min(w, Math.ceil(d1));
    const list = [];
    for (let i = i0; i < i1; i++) {
      const wt = Math.min(i + 1, d1) - Math.max(i, d0);
      if (wt > 0) list.push(i, wt);
    }
    span.push(list);
  }
  const colW = new Float64Array(nw);
  for (const list of span) for (let k = 0; k < list.length; k += 2) colW[list[k]] += list[k + 1];

  const tmp = new Float64Array(h * nw);
  for (let y = 0; y < h; y++) {
    const srow = y * w, orow = y * nw;
    for (let x = 0; x < w; x++) {
      const v = g[srow + x];                      // 白色是背景，必须参与平均，不能跳过
      const list = span[x];
      for (let k = 0; k < list.length; k += 2) tmp[orow + list[k]] += v * list[k + 1];
    }
    for (let i = 0; i < nw; i++) { const d = colW[i]; if (d > 0) tmp[orow + i] /= d; }
  }

  const sy = h / nh, out = new Uint8Array(nw * nh);
  const acc = new Float64Array(nw);
  for (let j = 0; j < nh; j++) {
    const d0 = j * sy, d1 = (j + 1) * sy;        // 输出行 j 对应的源行区间
    const j0 = Math.floor(d0), j1 = Math.min(h, Math.ceil(d1));
    acc.fill(0);
    let wsum = 0;
    for (let y = j0; y < j1; y++) {
      const wt = Math.min(y + 1, d1) - Math.max(y, d0);
      if (wt <= 0) continue;
      wsum += wt;
      const orow = y * nw;
      for (let i = 0; i < nw; i++) acc[i] += tmp[orow + i] * wt;
    }
    for (let i = 0; i < nw; i++) out[j * nw + i] = wsum > 0 ? Math.round(acc[i] / wsum) : 0;
  }
  return out;
}

function resizeLinear(g, w, h, nw, nh) {
  const o = new Uint8Array(nw * nh);
  const sx = w / nw, sy = h / nh;
  for (let y = 0; y < nh; y++) {
    const fy = Math.max(0, Math.min(h - 1, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), wy = fy - y0;
    for (let x = 0; x < nw; x++) {
      const fx = Math.max(0, Math.min(w - 1, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), wx = fx - x0;
      const a = g[y0 * w + x0] * (1 - wx) + g[y0 * w + x1] * wx;
      const b = g[y1 * w + x0] * (1 - wx) + g[y1 * w + x1] * wx;
      o[y * nw + x] = Math.round(a * (1 - wy) + b * wy);
    }
  }
  return o;
}

function resizeGray(g, w, h, nw, nh) {
  return nw * nh < w * h ? resizeArea(g, w, h, nw, nh) : resizeLinear(g, w, h, nw, nh);
}

/* 整页 → 墨迹图（长边 longSide，补白到 32 的倍数） */
function pageToInput(g, w, h, longSide) {
  const scale = longSide / Math.max(h, w);
  const nh = Math.max(1, Math.round(h * scale)), nw = Math.max(1, Math.round(w * scale));
  const ph = Math.ceil(nh / INPUT_MULTIPLE) * INPUT_MULTIPLE;
  const pw = Math.ceil(nw / INPUT_MULTIPLE) * INPUT_MULTIPLE;
  const small = (nh === h && nw === w) ? g : resizeGray(g, w, h, nw, nh);
  const x = new Float32Array(ph * pw);
  for (let r = 0; r < nh; r++) for (let c = 0; c < nw; c++) x[r * pw + c] = 1 - small[r * nw + c] / 255;
  return { x, dims: [1, 1, ph, pw], scale };
}

/* 4-连通域 + 统计量（并查集两遍扫描） */
function components(mask, w, h) {
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

/* det 输出 [3,h,w] → 行框 [N,5]（输入像素） */
function decodeDet(out, ow, oh, thresh = 0.5, minArea = 2) {
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

/* 行裁剪：按 PAD_X/PAD_Y 外扩 → 缩放到 rec_height 高的墨迹图 */
function cropLine(g, W, H, box, height) {
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

function padBatch(lines, height, multiple = WIDTH_MULTIPLE) {
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

/* 宽度相近的行批处理，减少补零浪费 */
function widthBatches(widths, maxBatch = 8, maxRatio = 1.3, minWidth = 64, maxArea = 8 * 900) {
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


/* ------------------------------------------------------------------ 流水线 */

async function runRec(sess, names, crops, height, vocab, onBatch) {
  const results = new Array(crops.length).fill(null);
  const groups = widthBatches(crops.map(c => c.w));
  for (const sel of groups) {
    if (abortFlag) return results;
    const lines = sel.map(i => crops[i]);
    const pb = padBatch(lines, height);
    const out = await sess.run({ x: new ort.Tensor("float32", pb.x, pb.dims),
                                widths: new ort.Tensor("int64", pb.widths, [pb.widths.length]) });
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

async function detAt(g, w, h, longSide, ev) {
  let t = performance.now();
  const pi = pageToInput(g, w, h, longSide);
  ev?.mark?.("resize", performance.now() - t);
  t = performance.now();
  const dr = await S["det.onnx"].run({ x: new ort.Tensor("float32", pi.x, pi.dims) });
  ev?.mark?.("det", performance.now() - t);
  t = performance.now();
  const dout = dr["out"];
  const boxes = decodeDet(dout.data, dout.dims[3], dout.dims[2]);
  ev?.mark?.("decode", performance.now() - t);
  return { pi, boxes };
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

/* 行高在检测输入里普遍不足 ADAPTIVE_MIN_H，说明整页缩得太狠，按官方逻辑重跑一遍高分辨率 */
async function detectAdaptive(g, w, h, opt, ev) {
  let { pi, boxes } = await detAt(g, w, h, opt.longSide, ev);
  let bumped = false, medH = 0;
  if (boxes.length >= 8) {
    medH = median(boxes.map(b => b[3] - b[1]));                // 输入像素
    if (opt.adaptive && medH < ADAPTIVE_MIN_H) {
      const ls = Math.floor(Math.min(ADAPTIVE_MAX_SIDE, opt.longSide * ADAPTIVE_TARGET_H / Math.max(medH, 1)) / 32) * 32;
      if (ls > opt.longSide) {
        await tick();
        const second = await detAt(g, w, h, ls, ev);
        pi = second.pi; boxes = second.boxes; bumped = true;
      }
    }
  }
  return { pi, boxes, bumped, medH };
}

async function ocrPage(img, ev = {}) {
  const t0 = performance.now();
  const { g, w, h } = toGray(img);
  const height = META.rec_height;

  ev.stage?.("detect");
  const det = await detectAdaptive(g, w, h, { longSide: OPT.longSide, adaptive: OPT.adaptive }, ev);
  await tick();
  const { pi, boxes } = det;
  if (!boxes.length) return { lines: [], md: "", time: performance.now() - t0, det };

  const boxesPx = boxes.map(b => [b[0]/pi.scale, b[1]/pi.scale, b[2]/pi.scale, b[3]/pi.scale, b[4]]);
  // 检测一结束就把框推出去：界面可以先画框、再等文字，不必等整页识别完
  ev.boxes?.(boxesPx);
  const crops = boxesPx.map(b => cropLine(g, w, h, b, height));

  // script.onnx：判断每行是否含汉字，分流到对应识别器
  ev.stage?.("script", { lines: crops.length });
  const latin = JSON.parse(META.vocab).chars;
  const isCjk = new Array(crops.length).fill(false);
  const tScript = performance.now();
  if (S["script.onnx"] && crops.length) {
    for (const sel of widthBatches(crops.map(c => c.w), 64, 1.3, 64, 64 * 640)) {
      const pb = padBatch(sel.map(i => crops[i]), height);
      const so = await S["script.onnx"].run({ x: new ort.Tensor("float32", pb.x, pb.dims),
                                               widths: new ort.Tensor("int64", pb.widths, [pb.widths.length]) });
      const p = Array.from(so["p"].data);
      sel.forEach((i, k) => { isCjk[i] = p[k] > 0.5; });
    }
  }
  ev?.mark?.("script", performance.now() - tScript);
  await tick();

  const pickIdx = (want) => crops.map((_, i) => i).filter(i => isCjk[i] === want);
  const idxL = pickIdx(false), idxC = pickIdx(true);
  const texts = new Array(crops.length).fill(""), confs = new Array(crops.length).fill(0);

  const stream = (sel, r) => {
    if (!ev.line) return;
    sel.forEach((idx, k) => {
      if (r[k]) ev.line({ text: r[k].text, conf: r[k].conf, box: boxesPx[idx], cjk: isCjk[idx] });
    });
  };

  /* 识别是整页最大的一块开销（实测一页 368 ms 里，resize+det+decode
     只占 59 ms），以前却完全没有计时，日志里也就看不到。
     逐段报出来，界面才知道这一页的时间花在哪。 */
  ev.stage?.("recognize", { lines: crops.length, cjk: idxC.length });
  let tRec = performance.now();
  if (idxL.length) {
    const r = await runRec(S["rec.onnx"], ["ids","conf","lengths"], idxL.map(i => crops[i]), height, latin, stream);
    idxL.forEach((i, k) => { if (r[k]) { texts[i] = r[k].text; confs[i] = r[k].conf; } });
  }
  if (idxC.length) {
    const cjk = JSON.parse(META.vocab_cjk).chars;
    const r = await runRec(S["rec_cjk.onnx"], ["ids","conf","lengths"], idxC.map(i => crops[i]), height, cjk, stream);
    idxC.forEach((i, k) => { if (r[k]) { texts[i] = r[k].text; confs[i] = r[k].conf; } });
  }
  ev?.mark?.("rec", performance.now() - tRec);

  ev.stage?.("order", { lines: crops.length });
  let tOrd = performance.now();
  const keep = crops.map((_, i) => i).filter(i => texts[i].trim() && confs[i] >= OPT.minConf);
  const B = keep.map(i => boxesPx[i]);
  const T = keep.map(i => texts[i]);
  await tick();
  const { order, cls } = await readingOrder(B, T, w, h);
  ev?.mark?.("order", performance.now() - tOrd);

  ev.stage?.("markdown");
  const lines = order.map(i => ({ box: B[i], text: T[i], conf: +confs[keep[i]].toFixed(4), origIdx: i }));
  const md = toMarkdown(lines, cls);
  await tick();
  return { lines, md, time: performance.now() - t0, det };
}

/* ------------------------------------------------- 阅读顺序（order.onnx） */

function lineFeatures(boxes, W, H, texts) {
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

/* 同块 logit 的平均连接聚类：一对错判不足以把两个块粘在一起 */
function cluster(logits, n, stride) {
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

/* 递归 XY-cut：沿最宽空白切，横切先读上半、竖切先读左半 */
function xycut(boxes, ids) {
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
function topDownOf(boxes, ids) {
  const cy = ids.map(i => (boxes[i][1] + boxes[i][3]) / 2);
  const hs = ids.map(i => boxes[i][3] - boxes[i][1]).sort((a, b) => a - b);
  const med = hs[hs.length >> 1] || 1;
  return ids.map((_, k) => k).sort((p, q) =>
    (Math.round(cy[p] / (med * 0.5)) - Math.round(cy[q] / (med * 0.5))) || (boxes[ids[p]][0] - boxes[ids[q]][0])
  ).map(k => ids[k]);
}

/* 先分块、块内 XY-cut、块间按成对顺序 logit 排 */
function decodeBlocksOrder(a, same, boxes, cls, n, stride, sameStride) {
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
  // 块间成对顺序 logit：先把行按块平均（G·a），再按右块平均（·Gᵀ），取反对称部分
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

/* 返回 {order, cls} */
async function readingOrder(boxes, texts, W, H) {
  const n = boxes.length;
  if (n <= 1) return { order: boxes.map((_, i) => i), cls: null };
  if (!S["order.onnx"]) return { order: topDown(boxes), cls: null };
  const feats = lineFeatures(boxes, W, H, texts);
  const out = await S["order.onnx"].run({
    feats: new ort.Tensor("float32", feats, [1, n, 16]),
    mask:  new ort.Tensor("bool", new Uint8Array(n).fill(1), [1, n]),
  });
  // onnxruntime-web 的多个输出可能共享同一块 wasm 内存，后读的张量会覆盖先读的。
  // 所以 run 之后立刻把三个张量各自拷贝出来，后面只用副本。
  const aT = out["a"], sameT = out["same"], clsT = out["cls"];
  const a = new Float32Array(aT.data), same = new Float32Array(sameT.data), cls = new Float32Array(clsT.data);
  const [, N, N2] = aT.dims, S2 = sameT.dims[2];
  if (!(N >= n && N2 >= n && sameT.dims[1] >= n && S2 >= n)) return { order: topDown(boxes), cls };
  return { order: decodeBlocksOrder(a, same, boxes, cls, n, N2, S2), cls };
}

/* 成对 logit（a[i,j]>0 表示 i 在 j 前）→ 顺序。
   插入式局部搜索会落进局部最优，且起点不同结果可能不同，
   所以从三个起点各搜一遍，取总对数概率最高的那个。 */
function decodeOrder(a, n, stride = n, sweeps = 4) {
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
        const gains = new Float64Array(L + 1);               // gains[k] = 把 x 放到第 k 位的收益
        // 前缀和：rest[0..k-1] 都排在 x 前面
        for (let k = 1; k <= L; k++) gains[k] = gains[k-1] + lp[rest[k-1] * n + x];
        // 后缀和要独立累加，不能从 gains[L] 接着加，否则两个和会串在一起
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
  // 起点一：按 (列和 − 行和) 升序，即「我排在别人前面」的代价从小到大
  const key = (i) => { let s = 0; for (let j = 0; j < n; j++) { if (j !== i) s += lp[j * n + i] - lp[i * n + j]; } return s; };
  const ranked = [...Array(n).keys()].sort((x, y) => key(x) - key(y));
  const starts = [ranked, [...Array(n).keys()], [...ranked].reverse()];
  let best = starts[0], bestScore = -Infinity;
  for (const st of starts) { const r = search(st), t = total(r); if (t > bestScore) { bestScore = t; best = r; } }
  return best;
}

function topDown(boxes) {
  const cy = boxes.map(b => (b[1] + b[3]) / 2);
  const hs = boxes.map(b => b[3] - b[1]).sort((a, b) => a - b);
  const med = hs[hs.length >> 1] || 1;
  return [...Array(boxes.length).keys()].sort((i, j) =>
    (Math.round(cy[i] / (med * 0.5)) - Math.round(cy[j] / (med * 0.5))) || (boxes[i][0] - boxes[j][0]));
}


/* ------------------------------------------------------------ Markdown */

function toMarkdown(lines, clsTensor) {
  if (!lines.length) return "";
  const NC = BLOCK_CLASSES.length;
  const kindOf = (i) => {
    if (!clsTensor) return "Text";
    const idx = lines[i]?.origIdx ?? i;
    let best = 0;
    for (let c = 1; c < NC; c++) if (clsTensor[idx * NC + c] > clsTensor[idx * NC + best]) best = c;
    return BLOCK_CLASSES[best];
  };
  // 版块分类对合成页面不太稳，用几何再兜一层底：明显更大的一行当作标题，
  // 行间距明显变大当作分段。
  const hs = lines.map(l => l.box[3] - l.box[1]).sort((a, b) => a - b);
  const medH = hs[hs.length >> 1] || 1;
  const gaps = [];
  for (let i = 1; i < lines.length; i++) gaps.push(Math.max(0, lines[i].box[1] - lines[i-1].box[3]));
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const medGap = sortedGaps.length ? sortedGaps[sortedGaps.length >> 1] : 0;

  const out = [];
  let para = [];
  const flush = () => { if (para.length) { out.push(para.join(" ")); para = []; } };
  let table = null;                                  // 连续的表格行并成一段
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
    // 同一栏、行距正常才续写成一段；换栏或间距变大就断开
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

/* ------------------------------------------------------------- 模型加载 */

async function fetchWithProgress(url, onByte) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url}`);
  const total = Number(r.headers.get("content-length")) || 0;
  if (!r.body) return new Uint8Array(await r.arrayBuffer());
  const rd = r.body.getReader(); const chunks = []; let got = 0;
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    chunks.push(value); got += value.length; onByte?.(got, total);
  }
  const out = new Uint8Array(got); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

async function loadModels({ localFiles, threads, onProgress, onPhase, onLog } = {}) {
  const t0 = performance.now();
  onLog?.({ level: "info", msg: "runtime" });
  const mod = await import(ORTBASE + "ort.wasm.min.mjs");
  ort = mod.default ?? mod;
  ort.env.wasm.wasmPaths = ORTBASE;
  ort.env.wasm.numThreads = Math.max(1, Math.min(maxThreads(), threads || maxThreads()));
  ort.env.logLevel = "error";

  const bytes = {};
  const progressMap = new Map();
  for (const name of NEEDED) progressMap.set(name, { got: 0, total: 0 });

  const reportProgress = (name) => {
    let sumGot = 0, sumTotal = 0, finished = 0;
    for (const [_, p] of progressMap) {
      sumGot += p.got;
      sumTotal += p.total;
      if (p.total > 0 && p.got >= p.total) finished++;
    }
    const effectiveTotal = sumTotal > 10 * 1024 * 1024 ? sumTotal : 18.5 * 1024 * 1024;
    const frac = Math.min(1, Math.max(finished / NEEDED.length, sumGot / effectiveTotal));
    onProgress?.({ file: name, got: sumGot, total: sumTotal, frac, done: frac });
  };

  // 并行下载全部模型文件（HTTP/2 多路复用并行请求）
  await Promise.all(
    NEEDED.map(async (name) => {
      const local = localFiles?.[name];
      onLog?.({ level: "info", msg: (local ? "local " : "fetch ") + name, file: name });
      if (local) {
        const ab = await local.arrayBuffer();
        bytes[name] = new Uint8Array(ab);
        progressMap.set(name, { got: ab.byteLength, total: ab.byteLength });
        reportProgress(name);
      } else {
        bytes[name] = await fetchWithProgress(HF + name, (got, total) => {
          progressMap.set(name, { got, total });
          reportProgress(name);
        });
      }
    })
  );
  META = JSON.parse(new TextDecoder().decode(bytes["meta.json"]));

  // 编译会话这段没有任何进度信号，界面上就是一段死白；按文件报出来
  const COMPILE = ["det.onnx","rec.onnx","rec_cjk.onnx","script.onnx","order.onnx"];
  for (let k = 0; k < COMPILE.length; k++) {
    const name = COMPILE[k];
    onLog?.({ level: "info", msg: "compile " + name, file: name });
    onPhase?.({ file: name, done: k / COMPILE.length });
    S[name] = await ort.InferenceSession.create(bytes[name], { executionProviders: ["wasm"] });
  }
  onPhase?.({ file: "", done: 1 });
  return {
    meta: { longSide: META.det_long_side, recHeight: META.rec_height,
            latin: JSON.parse(META.vocab).chars.length, cjk: JSON.parse(META.vocab_cjk).chars.length },
    threads: ort.env.wasm.numThreads,
    ms: Math.round(performance.now() - t0),
  };
}

function setOpts(o) { Object.assign(OPT, o || {}); }
function setAbort(v) { abortFlag = !!v; }

/* ------------------------------------------------------------- Worker 端
   同一个核心既跑在 Worker 里（默认，推理不占主线程），也能被主线程
   直接 import 作为回退（Worker 创建失败时）。 */

const isWorker = typeof WorkerGlobalScope !== "undefined" && globalThis instanceof WorkerGlobalScope;

if (isWorker) {
  const post = (m, transfer) => self.postMessage(m, transfer || []);
  self.onmessage = async (e) => {
    const { id, type, payload } = e.data || {};
    // tag 用来区分并发页：多引擎同时推进时，事件必须知道属于哪一页
    const tag = payload?.tag || "";
    const ev = {
      stage: (name, info) => post({ id, tag, type: "stage", name, info }),
      mark: (name, ms) => post({ id, tag, type: "mark", name, ms }),
      boxes: (bs) => post({ id, tag, type: "boxes", boxes: bs }),
      line: (l) => post({ id, tag, type: "line", line: l }),
    };
    try {
      if (type === "load") {
        setOpts(payload.opts);
        const info = await loadModels({
          localFiles: payload.local,
          threads: payload.threads,
          onProgress: (p) => post({ id, type: "progress", ...p }),
          onPhase: (p) => post({ id, type: "phase", ...p }),
          onLog: (m) => post({ id, type: "log", ...m }),
        });
        post({ id, type: "result", result: info });
      } else if (type === "opts") {
        setOpts(payload.opts);
      } else if (type === "page") {
        setAbort(false);
        const img = payload.bitmap;
        const r = await ocrPage(img, ev);
        img.close?.();
        post({ id, type: "page", result: { lines: r.lines, md: r.md, time: r.time, det: r.det } });
      } else if (type === "abort") {
        setAbort(true);
      }
    } catch (err) {
      post({ id, type: "error", error: String((err && err.stack) || err) });
    }
  };
}

export { loadModels, ocrPage, toMarkdown, setOpts, setAbort, tick, maxThreads,
         OUT_STRIDE, PAD_Y, PAD_X, WIDTH_MULTIPLE, BLOCK_CLASSES, NEEDED, OPT, isWorker,
         xycut, topDownOf, topDown, decodeOrder, cluster, lineFeatures };

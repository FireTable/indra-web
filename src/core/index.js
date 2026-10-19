import {
  ORT_VER, ORTBASE, HF, NEEDED, BLOCK_CLASSES, OPT, OUT_STRIDE, PAD_Y, PAD_X, WIDTH_MULTIPLE,
  setOpts, setAbort, isAborted, tick, maxThreads, isWorker
} from "./constants.js";
import { toGray } from "./image.js";
import { components, decodeDet, detectAdaptive } from "./detection.js";
import { cropLine, padBatch, widthBatches, runRec } from "./recognition.js";
import { lineFeatures, cluster, xycut, topDownOf, topDown, decodeBlocksOrder, readingOrder, decodeOrder } from "./order.js";
import { toMarkdown } from "./markdown.js";

let ort = null;
let S = {};
let META = null;

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

export const ORIENT_SIDE = 768;
export const ORIENT_MIN = 0.95;

/**
 * Preprocess grayscale image into 768x768 ink map (1.0 = ink, 0.0 = background)
 */
export function orientInput(gray, w, h, side = ORIENT_SIDE) {
  const s = side / Math.max(h, w);
  const sw = Math.max(1, Math.round(w * s));
  const sh = Math.max(1, Math.round(h * s));

  const out = new Float32Array(side * side);
  const xRatio = w / sw;
  const yRatio = h / sh;

  for (let y = 0; y < sh; y++) {
    const srcY = Math.min(h - 1, Math.floor(y * yRatio));
    const rowOffset = y * side;
    const srcRowOffset = srcY * w;
    for (let x = 0; x < sw; x++) {
      const srcX = Math.min(w - 1, Math.floor(x * xRatio));
      const val = gray[srcRowOffset + srcX];
      out[rowOffset + x] = 1.0 - val / 255.0;
    }
  }
  return { data: out, dims: [1, 1, side, side] };
}

export async function detectOrientation(session, ort, gray, w, h) {
  if (!session) return 0;
  const inp = orientInput(gray, w, h);
  const out = await session.run({
    x: new ort.Tensor("float32", inp.data, inp.dims)
  });
  const outName = session.outputNames[0];
  const p = Array.from(out[outName].data);
  let k = 0;
  for (let i = 1; i < 4; i++) {
    if (p[i] > p[k]) k = i;
  }
  return (p[k] > ORIENT_MIN) ? k : 0;
}

export function rotateGray(gray, w, h, k) {
  if (k === 0) return { gray, w, h };
  if (k === 1) { // 90° CCW turned -> rotate 90° CW to upright
    const nw = h, nh = w;
    const out = new Uint8Array(nw * nh);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = h - 1 - y;
        const ny = x;
        out[ny * nw + nx] = gray[y * w + x];
      }
    }
    return { gray: out, w: nw, h: nh };
  }
  if (k === 2) { // 180° turned -> rotate 180° to upright
    const nw = w, nh = h;
    const out = new Uint8Array(nw * nh);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = w - 1 - x;
        const ny = h - 1 - y;
        out[ny * nw + nx] = gray[y * w + x];
      }
    }
    return { gray: out, w: nw, h: nh };
  }
  if (k === 3) { // 270° CCW turned -> rotate 90° CCW (270° CW) to upright
    const nw = h, nh = w;
    const out = new Uint8Array(nw * nh);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = y;
        const ny = w - 1 - x;
        out[ny * nw + nx] = gray[y * w + x];
      }
    }
    return { gray: out, w: nw, h: nh };
  }
  return { gray, w, h };
}

export async function loadModels({ localFiles, threads, onProgress, onPhase, onLog } = {}) {
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

  let maxFrac = 0;
  const reportProgress = (name) => {
    let sumGot = 0, sumTotal = 0, finished = 0;
    for (const [_, p] of progressMap) {
      sumGot += p.got;
      sumTotal += p.total;
      if (p.total > 0 && p.got >= p.total) finished++;
    }
    const effectiveTotal = Math.max(sumTotal, 19.0 * 1024 * 1024);
    const frac = Math.min(1, Math.max(maxFrac, Math.max(finished / NEEDED.length, sumGot / effectiveTotal)));
    maxFrac = frac;
    onProgress?.({ file: name, got: sumGot, total: effectiveTotal, frac, done: frac });
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

  const COMPILE = ["det.onnx", "rec.onnx", "rec_cjk.onnx", "script.onnx", "order.onnx", "orient.onnx"];
  for (let k = 0; k < COMPILE.length; k++) {
    const name = COMPILE[k];
    onLog?.({ level: "info", msg: "compile " + name, file: name });
    onPhase?.({ file: name, done: k / COMPILE.length });
    S[name] = await ort.InferenceSession.create(bytes[name], { executionProviders: ["wasm"] });
  }
  onPhase?.({ file: "", done: 1 });
  return {
    meta: {
      longSide: META.det_long_side,
      recHeight: META.rec_height,
      latin: JSON.parse(META.vocab).chars.length,
      cjk: JSON.parse(META.vocab_cjk).chars.length
    },
    threads: ort.env.wasm.numThreads,
    ms: Math.round(performance.now() - t0),
  };
}

export async function ocrPage(img, ev = {}) {
  const t0 = performance.now();
  let { g, w, h } = toGray(img);
  const height = META.rec_height;

  let rotation = 0;
  if (OPT.orient && S["orient.onnx"]) {
    ev.stage?.("orient");
    const tOrient = performance.now();
    const k = await detectOrientation(S["orient.onnx"], ort, g, w, h);
    ev?.mark?.("orient", performance.now() - tOrient);
    if (k > 0) {
      rotation = k * 90;
      const rot = rotateGray(g, w, h, k);
      g = rot.gray;
      w = rot.w;
      h = rot.h;
      ev.orient?.({ k, rotation });
    }
    await tick();
  }

  ev.stage?.("detect");
  const det = await detectAdaptive(S["det.onnx"], ort, g, w, h, { longSide: OPT.longSide, adaptive: OPT.adaptive }, ev);
  await tick();
  const { pi, boxes } = det;
  if (!boxes.length) return { lines: [], md: "", time: performance.now() - t0, det, rotation };

  const boxesPx = boxes.map(b => [b[0]/pi.scale, b[1]/pi.scale, b[2]/pi.scale, b[3]/pi.scale, b[4]]);
  ev.boxes?.(boxesPx);
  const crops = boxesPx.map(b => cropLine(g, w, h, b, height));

  ev.stage?.("script", { lines: crops.length });
  const latin = JSON.parse(META.vocab).chars;
  const isCjk = new Array(crops.length).fill(false);
  const tScript = performance.now();
  if (S["script.onnx"] && crops.length) {
    for (const sel of widthBatches(crops.map(c => c.w), 64, 1.3, 64, 64 * 640)) {
      const pb = padBatch(sel.map(i => crops[i]), height);
      const so = await S["script.onnx"].run({
        x: new ort.Tensor("float32", pb.x, pb.dims),
        widths: new ort.Tensor("int64", pb.widths, [pb.widths.length])
      });
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

  ev.stage?.("recognize", { lines: crops.length, cjk: idxC.length });
  let tRec = performance.now();
  if (idxL.length) {
    const r = await runRec(S["rec.onnx"], ort, ["ids","conf","lengths"], idxL.map(i => crops[i]), height, latin, stream);
    idxL.forEach((i, k) => { if (r[k]) { texts[i] = r[k].text; confs[i] = r[k].conf; } });
  }
  if (idxC.length) {
    const cjk = JSON.parse(META.vocab_cjk).chars;
    const r = await runRec(S["rec_cjk.onnx"], ort, ["ids","conf","lengths"], idxC.map(i => crops[i]), height, cjk, stream);
    idxC.forEach((i, k) => { if (r[k]) { texts[i] = r[k].text; confs[i] = r[k].conf; } });
  }
  ev?.mark?.("rec", performance.now() - tRec);

  ev.stage?.("order", { lines: crops.length });
  let tOrd = performance.now();
  const keep = crops.map((_, i) => i).filter(i => texts[i].trim() && confs[i] >= OPT.minConf);
  const B = keep.map(i => boxesPx[i]);
  const T = keep.map(i => texts[i]);
  await tick();
  const { order, cls } = await readingOrder(S["order.onnx"], ort, B, T, w, h);
  ev?.mark?.("order", performance.now() - tOrd);

  ev.stage?.("markdown");
  const lines = order.map(i => ({ box: B[i], text: T[i], conf: +confs[keep[i]].toFixed(4), origIdx: i }));
  const md = toMarkdown(lines, cls);
  await tick();
  return { lines, md, time: performance.now() - t0, det, rotation };
}

// Worker message handler
if (isWorker) {
  const post = (m, transfer) => self.postMessage(m, transfer || []);
  self.onmessage = async (e) => {
    const { id, type, payload } = e.data || {};
    const tag = payload?.tag || "";
    const ev = {
      stage: (name, info) => post({ id, tag, type: "stage", name, info }),
      mark: (name, ms) => post({ id, tag, type: "mark", name, ms }),
      orient: (info) => post({ id, tag, type: "orient", ...info }),
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
        post({ id, type: "page", result: { lines: r.lines, md: r.md, time: r.time, det: r.det, rotation: r.rotation } });
      } else if (type === "abort") {
        setAbort(true);
      }
    } catch (err) {
      post({ id, type: "error", error: String((err && err.stack) || err) });
    }
  };
}

export {
  toMarkdown, setOpts, setAbort, tick, maxThreads, isWorker,
  OUT_STRIDE, PAD_Y, PAD_X, WIDTH_MULTIPLE, BLOCK_CLASSES, NEEDED, OPT,
  xycut, topDownOf, topDown, decodeOrder, cluster, lineFeatures,
  components, decodeDet, cropLine, padBatch, widthBatches
};

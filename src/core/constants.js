export const ORT_VER = "1.22.0";
export const ORTBASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/`;
export const HF = "https://huggingface.co/datalab-to/indra-ocr/resolve/main/";

export const OUT_STRIDE = 2;
export const INPUT_MULTIPLE = 32;
export const CORE_X_SHRINK = 0.15;
export const PAD_Y = 0.2;
export const PAD_X = 0.3;
export const WIDTH_MULTIPLE = 8;

// 自适应重检测：行高（检测输入像素）低于 MIN 就提高分辨率重跑，对齐 indra_ocr/pipeline.py
export const ADAPTIVE_MIN_H = 9.0;
export const ADAPTIVE_TARGET_H = 12.0;
export const ADAPTIVE_MAX_SIDE = 2048;

export const BLOCK_CLASSES = [
  "Text", "Section-Header", "Page-Header", "Page-Footer", "List-Group",
  "Table", "Caption", "Footnote", "Table-Of-Contents", "Form"
];

export const NEEDED = [
  "det.onnx", "rec.onnx", "rec_cjk.onnx", "script.onnx", "order.onnx", "orient.onnx", "meta.json"
];

// 运行时可调项
export const OPT = { longSide: 1024, adaptive: true, minConf: 0.5, orient: true };

export function setOpts(o) { Object.assign(OPT, o || {}); }

let abortFlag = false;
export function setAbort(v) { abortFlag = !!v; }
export function isAborted() { return abortFlag; }

/* 把线程还给事件循环，流式展示的前提。
   scheduler.yield 在 Worker 里可能永不 resolve，这里一律用 MessageChannel 通道，
   在主线程与 Worker 中行为一致，且比 setTimeout(0) 的钳制更轻。 */
const _yieldChan = new MessageChannel();
export const tick = () => new Promise((resolve) => {
  _yieldChan.port1.onmessage = () => resolve();
  _yieldChan.port2.postMessage(0);
});

/* 可用时开多线程 WASM（需要 SharedArrayBuffer，即跨源隔离）。
   核心只负责「能不能多线程」；用几个线程由上层控制。 */
export const maxThreads = () =>
  (typeof SharedArrayBuffer !== "undefined" && globalThis.crossOriginIsolated)
    ? Math.max(1, navigator.hardwareConcurrency || 4) : 1;

export const isWorker = typeof WorkerGlobalScope !== "undefined" && globalThis instanceof WorkerGlobalScope;

/* =========================================================================
   应用层：i18n · 文件工作流 · 流式渲染 · PDF（pdf.js）
   推理核心在 Web Worker 里跑，主线程只管界面，所以上传后能逐行出结果。
   ========================================================================= */

const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.mjs";
const PDFW  = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs";
const PDF_DPI = 200;

import coreRaw from "../../build/core.js?raw";
import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

/* --------------------------------------------------------------- i18n */
const I18N = {
  zh: {
    brand: "INDRA OCR", brandSub: "端侧文档解析",
    veilTitle: "拖到任意位置", veilSub: "松手即可识别，文件不会上传",
    pipeline: "识别流程", settings: "设置", log: "运行日志",
    logStartup: "加载模型", logClear: "清空", logCleared: "日志已清空",
    zoomOut: "−", zoomIn: "+", zoomFit: "适应窗口", close: "关闭", theme: "主题",
    themeAuto: "跟随系统", themeLight: "浅色", themeDark: "深色",
    optRes: "检测分辨率", auto: "自动",
    optConf: "灵敏度", strict: "严格", normal: "标准", loose: "宽松", vloose: "很宽松",
    optThr: "引擎线程", thrAuto: "自动",
    optText: "电子版 PDF 读文本层", optBoxes: "显示检测框",
    run: "开始识别", stop: "停止",
    rerun: "重新识别",
    mdTitle: "Markdown", rawTitle: "识别内容",
    mdPreview: "渲染视图", mdSource: "源码",
    open: "选择文件", changeFile: "换文件",
    settingPending: "设置已改，本次运行不采用；跑完点「重新识别」生效", copy: "复制", download: "下载",
    tabPages: "版面视图", tabMd: "Markdown", tabTxt: "文本", tabJson: "JSON",
    idle: "等待文件",
    st_intake: "解析文件", st_render: "渲染页面", st_orient: "倾斜纠偏", st_detect: "行检测",
    st_script: "字形分流", st_recognize: "文字识别", st_order: "阅读顺序",
    st_markdown: "结构化输出", st_textlayer: "读取文本层", st_done: "完成",
    st_pages: "逐页识别",
    streaming: "识别中",
    mk_orient: "纠偏", mk_resize: "缩放", mk_det: "检测", mk_decode: "解码", mk_script: "分流",
    mk_rec: "识别", mk_order: "阅读顺序",
    badgeOrient: "↺ 纠偏 {deg}°",
    mkAvg: "逐段平均",
    eta: "约剩 {x}", sec: "秒", min: "分钟",
    pageFailed: "第 {n} 页失败", pagesFailed: "{n} 页失败", allFailed: "所有页都失败了，可能是文件损坏",
    pageFailedShort: "这一页没读出来",
    cardFailed: "失败：{n}",
    runFailed: "运行中断",
    line: "行",
    bootBadge: "100% 端侧隐私安全 · 零文件上传",
    bootTitle: "端侧文档智能识别", bootBody: "无需后端服务器。图片和 PDF 100% 在您的浏览器内端侧处理，不上传任何字节，断网亦可使用。",
    capImg: "毫秒端侧推理", capImgD: "WASM 多线程加速", capPdf: "流式多页支持", capPdfD: "逐页边渲边出结果",
    capText: "电子版 PDF 直读", capTextD: "零等待毫秒取文本层",
    capMd: "结构化输出", capMdD: "Markdown / JSON 还原",
    bootDrop: "拖入图片 / PDF 文档，或点击浏览选择", bootPaste: "支持 PNG / JPG / PDF · ⌘V / Ctrl+V 可直接粘贴截图",
    bootLoad: "正在准备模型", bootCompile: "正在编译模型",
    bootReady: "模型就绪", bootWait: "约 18 MB，只需一次，之后由浏览器缓存",
    bootGo: "可以开始识别了", bootMs: "耗时",
    engineLoading: "初始化中", engineReady: "引擎就绪", engineMain: "主线程",
    workerOn: "Worker 推理", workerOff: "主线程推理",
    textOn: "文本层可用", textOff: "文本层关闭",
    resHint: "自动：行高不足 9px 时升分辨率重检。行高已够大时调高反而会过度切分。",
    langNote: "语言",
    kbdOpen: "选择文件", kbdRun: "开始识别", kbdStop: "停止", kbdZoom: "点预览放大",
    thrTip: "当前只有 <b>1 个线程</b>。请用 <code>npm run dev</code> 启动，可自动开启跨源隔离与多线程加速，实测性能提升 3～14 倍。",
    copied: "已复制", noFile: "请先拖入一个文件", notLoaded: "模型仍在加载",
    emptyPage: "未检出文字",
    srcText: "PDF 文本层", srcOcr: "OCR", lines: "行", page: "页",
    conf: "置信度", lowConf: "低置信", localCount: "已选 {n}/6 个本地文件", localSwitch: "正在切换到离线模型…",
    localFail: "本地模型加载失败：{e}",
    loadingModels: "加载模型 {name} {pct}%",
    modelReady: "模型就绪（{ms}，{th} 线程）",
    modelReady1: "模型就绪（{ms}，单线程）",
    copiedFail: "复制失败", saved: "已下载",
    copyOf: "复制 {x}", downloadOf: "下载 .{x}", copyAs_md: "Markdown", copyAs_txt: "文本", copyAs_json: "JSON",
    nothingToCopy: "还没有可复制的结果",
    modelLoadFailed: "模型加载失败，请检查网络连接后刷新重试",
  },
  en: {
    brand: "INDRA OCR", brandSub: "on-device document parsing",
    veilTitle: "Drop anywhere", veilSub: "release to recognise — the file is never uploaded",
    pipeline: "Pipeline", settings: "Settings", log: "Log",
    logStartup: "Loading Models", logClear: "Clear", logCleared: "Log cleared",
    zoomOut: "−", zoomIn: "+", zoomFit: "Fit", close: "Close", theme: "Theme",
    themeAuto: "System", themeLight: "Light", themeDark: "Dark",
    optRes: "Detect resolution", auto: "Auto",
    optConf: "Sensitivity", strict: "Strict", normal: "Normal", loose: "Loose", vloose: "Very loose",
    optThr: "Engine threads", thrAuto: "Auto",
    optText: "Read text layer for digital PDFs", optBoxes: "Show boxes",
    run: "Run", stop: "Stop",
    rerun: "Re-run",
    mdTitle: "Markdown", rawTitle: "Recognised lines",
    mdPreview: "Preview", mdSource: "Source",
    open: "Open file", changeFile: "Change file",
    settingPending: "Setting changed — this run keeps the old one; hit Re-run to apply", copy: "Copy", download: "Download",
    tabPages: "Layout", tabMd: "Markdown", tabTxt: "Text", tabJson: "JSON",
    idle: "Waiting for a file",
    st_intake: "Parse file", st_render: "Render page", st_orient: "Orientation", st_detect: "Line detection",
    st_script: "Script routing", st_recognize: "Text recognition", st_order: "Reading order",
    st_markdown: "Structure output", st_textlayer: "Read text layer", st_done: "Done",
    st_pages: "Per-page OCR",
    streaming: "Recognising",
    mk_orient: "orient", mk_resize: "resize", mk_det: "detect", mk_decode: "decode", mk_script: "script",
    mk_rec: "recognise", mk_order: "order",
    badgeOrient: "↺ Orient {deg}°",
    mkAvg: "avg per page",
    eta: "about {x} left", sec: "s", min: "min",
    pageFailed: "page failed: {n}", pagesFailed: "{n} page(s) failed", allFailed: "every page failed — the file may be corrupt",
    pageFailedShort: "this page could not be read",
    cardFailed: "failed: {n}",
    runFailed: "run interrupted",
    line: "line",
    halted: "stopped",
    bootBadge: "100% On-Device · Zero Data Upload",
    bootTitle: "On-device document parsing", bootBody: "Images and PDFs are processed in this browser only — completely private, nothing is uploaded.",
    capImg: "Fast Inference", capImgD: "WASM multi-threaded", capPdf: "Streamed PDF", capPdfD: "rendered page-by-page",
    capText: "Digital PDF", capTextD: "direct text layer extraction",
    capMd: "Structured Output", capMdD: "Markdown / JSON synthesis",
    bootDrop: "Drop an image or PDF here, or click to browse", bootPaste: "Supports PNG / JPG / PDF · ⌘V / Ctrl+V to paste screenshot",
    bootLoad: "Preparing models", bootCompile: "Compiling models",
    bootReady: "Models ready", bootWait: "about 18 MB, once — cached by the browser after that",
    bootGo: "ready to recognise", bootMs: "took",
    engineLoading: "Initialising", engineReady: "Engine ready", engineMain: "Main thread",
    workerOn: "Worker inference", workerOff: "Main-thread inference",
    textOn: "Text layer available", textOff: "Text layer off",
    resHint: "Auto: raises resolution when median line height is under 9 px. Raising it manually on an already-large page over-segments.",
    langNote: "Language",
    kbdOpen: "Open file", kbdRun: "Run", kbdStop: "Stop", kbdZoom: "Click preview to zoom",
    thrTip: "Running on a single thread. Run <code>npm run dev</code> to enable cross-origin isolation and multi-threading (measured 3–14× faster).",
    copied: "Copied", noFile: "Drop a file first", notLoaded: "Models are still loading",
    emptyPage: "No text detected",
    srcText: "PDF text layer", srcOcr: "OCR", lines: "lines", page: "page",
    conf: "Confidence", lowConf: "low conf", localCount: "{n}/6 local files chosen", localSwitch: "Switching to offline models…",
    localFail: "Failed to load local models: {e}",
    loadingModels: "Loading {name} {pct}%",
    modelReady: "Models ready ({ms}, {th} threads)",
    modelReady1: "Models ready ({ms}, single thread)",
    copiedFail: "Copy failed", saved: "Saved",
    copyOf: "Copy {x}", downloadOf: "Download .{x}", copyAs_md: "Markdown", copyAs_txt: "text", copyAs_json: "JSON",
    nothingToCopy: "Nothing to copy yet",
    modelLoadFailed: "Failed to load models. Please check network connection and retry.",
  },
};
const LS = { lang: "indra.lang", theme: "indra.theme", opts: "indra.opts", rail: "indra.rail", settings: "indra.settings" };
let LANG = localStorage.getItem(LS.lang) || "zh";

/* 深浅色默认**跟着设备走**。
   以前 CSS 的 :root 就是深色板，只有手动点过按钮、localStorage 里有值才会切，
   于是设备是浅色的用户一打开就是黑的——该跟系统的地方没跟。
   现在三态：auto（跟随系统，默认）/ light / dark。
   auto 时监听系统变化，日夜切换后开着这个页面的人也跟着变，不用刷新。
   已经手动选过的用户仍然按他选的来，不会被系统改动覆盖回去。 */
let themePref = localStorage.getItem(LS.theme) || "auto";
const SCHEME = matchMedia("(prefers-color-scheme: light)");
const THEME_ICON = {
  auto:  '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  dark:  '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
};
function applyTheme() {
  const v = themePref === "auto" ? (SCHEME.matches ? "light" : "dark") : themePref;
  const de = document.documentElement;
  de.dataset.theme = v;
  de.dataset.themePref = themePref;
  const b = $("#btnTheme");
  if (b) {
    b.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"`
      + ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${THEME_ICON[themePref]}</svg>`;
    b.title = `${t("theme")} · ${t("theme" + themePref[0].toUpperCase() + themePref.slice(1))}`;
    b.setAttribute("aria-label", b.title);
  }
}
SCHEME.addEventListener("change", () => { if (themePref === "auto") applyTheme(); });
const t = (k, vars) => {
  let s = (I18N[LANG] && I18N[LANG][k]) ?? k;
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.replaceAll("{" + a + "}", b);
  return s;
};
function applyI18n() {
  document.documentElement.lang = LANG === "zh" ? "zh-Hans" : "en";
  for (const n of document.querySelectorAll("[data-i18n]")) n.textContent = t(n.dataset.i18n);
  for (const n of document.querySelectorAll("[data-i18n-title]")) n.title = t(n.dataset.i18nTitle);
  $("#btnClearLog").textContent = t("logClear");
  applyTheme();   // 图标和「跟随系统 / 浅色 / 深色」提示都得跟着语言走，放最后免得被 i18n 覆盖
  refreshLogTitles();
  document.title = LANG === "zh" ? "INDRA OCR · 端侧文档识别" : "INDRA OCR · On-device document parsing";
  buildSteps();
  $("#resHint").textContent = t("resHint");
  retitle();          // applyI18n 会用 data-i18n 盖掉按钮文案，这里补回来
  refreshDynamic();
}

/* 卡片徽章、页码、耗时单位都是建卡时写死的，语言切换时要重刷 */
function refreshDynamic() {
  for (const p of pages) {
    const c = p.__card; if (!c) continue;
    c.el.src.textContent = p.source === "text" ? t("srcText") : t("srcOcr");
    c.el.ms.textContent = `${p.lines.length} ${t("lines")} · ${fmtMs(p.time)}`;
    if (p.pageNo) c.el.t.textContent = pageLabel(p.pageNo, p.pageTotal);
  }
}

/* --------------------------------------------------------------- 工具 */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
/* 毫秒走千分位（1,234 ms）。切秒的阈值放在 10 s —— 放在 1 s 的话
   千分位永远轮不到出现，而「1.23 s」本来也比「1,234 ms」好读；
   放到 10 s 之后两边都照顾得到：一秒以上看秒，秒数太长再退回毫秒。 */
const fmtMs = (v) => v >= 10000
  ? (v / 1000).toFixed(v >= 60000 ? 0 : 1) + " s"
  : Math.round(v).toLocaleString("en-US") + " ms";
const fmtBytes = (v) => v > 1048576 ? (v / 1048576).toFixed(1) + " MB" : Math.round(v / 1024) + " KB";

/* 日志按「一次运行」分组：当前展开，历史自动折叠，
   否则连续跑几份文件后日志会长成一堵墙，把整条侧栏占满。 */
const logEl = $("#log");
let logGroup = null, logRunIdx = 0, logCount = 0;
const LOG_MAX_PER_RUN = 90;

/* 标题只存结构化数据，文案一律在 applyI18n 时重绘，
   否则切换语言后历史分组会停在切换前那一种语言。 */
/* 折叠标记 = 全应用唯一的一份。
   以前设置 / 日志分组 / 识别内容各写一遍 `::before{content:"▸"}` + rotate(90deg)，
   「离线模型」干脆漏了隐藏原生三角的那条，于是同一个左栏里两种折叠长得不一样；
   四份实现谁也说不准三角有多宽，正文只能各写各的 padding-left 去补。
   现在标记由这个函数注入，尺寸/间距/缩进统一走 CSS 里的 --fold* 三个变量。
   图标是 lucide 的 chevron-down，内联 SVG（和顶栏太阳图标同一套做法，
   不引外部 CDN，也就不会多一个会挂的依赖）。 */
const FOLD_SVG = '<svg class="foldi" width="14" height="14" viewBox="0 0 24 24" fill="none"'
  + ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
  + ' aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
function foldMark(sum) {
  if (!sum || sum.querySelector(":scope > .foldi")) return;
  sum.classList.add("fold");
  sum.insertAdjacentHTML("afterbegin", FOLD_SVG);
}
function foldAll(root = document) {
  for (const s of root.querySelectorAll("summary")) foldMark(s);
}

function paintSum(sum) {
  const d = sum.dataset;
  sum.textContent = "";
  foldMark(sum);   // 标题每次都整块重建，标记得跟着补回来
  if (d.key === "startup") { sum.append(document.createTextNode(t("logStartup"))); return; }
  const name = document.createElement("span");
  name.className = "nm";
  if (d.file) {
    // 文件名和时间分开截断：挤在一起时省略号会吃掉分隔点，变成 "foo.png ·…"
    const fn = document.createElement("span");
    fn.className = "fn";
    fn.textContent = d.file;
    const tm = document.createElement("span");
    tm.className = "tm";
    tm.textContent = d.time;
    name.append(fn, tm);
    name.title = `${d.file} · ${d.time}`;
  }
  sum.append(name);
  if (d.pages) {
    const tail = document.createElement("em");
    tail.className = "tail";
    /* 摘要行只留「页数 · 耗时」。行数在正文第一行（total … N 行）和卡片头上都有，
       这里重复一遍只是为了把统计列撑到 148px，而日志面板一共才 311px——
       固定列宽之后文件名只剩九个字。去掉它，两列都能对齐，名字也还看得全。 */
    tail.textContent = `${d.pages} ${t("page")} · ${d.ms}`;
    sum.append(tail);
  }
}

function newLogGroup(title, data) {
  const d = document.createElement("details");
  d.className = "rungrp";
  d.open = true;
  const sum = document.createElement("summary");
  Object.assign(sum.dataset, data || {});
  paintSum(sum);
  d.append(sum);
  const body = document.createElement("div");
  body.className = "runbody";
  d.append(body);
  logEl.prepend(d);
  for (const prev of logEl.querySelectorAll("details[open]")) if (prev !== d) prev.open = false;
  logGroup = body;
  logCount = 0;
  return d;
}

function log(msg, cls) {
  if (!logGroup) newLogGroup("", { key: "startup" });
  const d = document.createElement("div");
  d.className = "logline" + (cls ? " " + cls : "");
  const ts = new Date().toTimeString().slice(0, 8);
  d.textContent = `${ts}  ${msg}`;
  logGroup.append(d);
  // 单次运行内也限量，丢最旧的
  while (++logCount > LOG_MAX_PER_RUN && logGroup.firstChild) { logGroup.firstChild.remove(); logCount--; }
  const g = logGroup.closest("details");
  // 日志组不再自己滚动，贴着底部要滚的是 #log
  if (g?.open) logEl.scrollTop = logEl.scrollHeight;
}

function beginRun(file, time) {
  return newLogGroup(file, { file, time });
}
function endRun(pages, lines, ms) {
  const sum = logGroup?.closest("details")?.querySelector("summary");
  if (sum) { Object.assign(sum.dataset, { pages, lines, ms }); paintSum(sum); }
}
function refreshLogTitles() {
  for (const sum of logEl.querySelectorAll(".rungrp > summary")) paintSum(sum);
}
function clearLog() { logEl.innerHTML = ""; logGroup = null; logCount = 0; }

/* ------------------------------------------------- 推理核心（Worker） */
const coreText = document.getElementById("ocr-core")?.textContent?.trim() || coreRaw;
const coreURL = URL.createObjectURL(new Blob([coreText], { type: "text/javascript" }));

/* ------------------------------------------------------------ 引擎池
   每个引擎 = 一个 Web Worker（各自持有一份模型）。多页文档可以并行推进，
   页面多了体验差别很明显；单页文档只起一个，免得白等一次模型加载。
   事件带 tag，并发时才知道属于哪一页。 */

let core = null, modelInfo = null, modelLoading = null, useWorker = true;
let seq = 0;
/** @type {{worker:Worker|null, pending:Map, busy:boolean, ready:boolean, label:string}[]} */
const engines = [];

function makeEngine(worker, label) {
  const eng = { worker, pending: new Map(), busy: false, ready: false, label };
  if (worker) worker.onmessage = (e) => emit(eng, e.data);
  return eng;
}

function emit(eng, m) {
  if (["stage", "line", "mark", "boxes", "progress", "phase", "log"].includes(m.type)) { handleEvent(m); return; }
  const p = eng.pending.get(m.id);
  if (!p) return;
  eng.pending.delete(m.id);
  m.type === "error" ? p.reject(new Error(m.error)) : p.resolve(m.result);
}

function engineSend(eng, type, payload, transfer) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    eng.pending.set(id, { resolve, reject });
    const msg = { id, type, payload };
    if (eng.worker) eng.worker.postMessage(msg, transfer || []);
    else coreDispatch(eng, msg).then(resolve).catch(reject);
  });
}

/* Worker 不可用时，同一份核心直接在主线程跑（此时只有一个引擎） */
async function coreDispatch(eng, msg) {
  const { id, type, payload } = msg;
  const tag = payload?.tag || "";
  const ev = {
    stage: (name, info) => emit(eng, { id, tag, type: "stage", name, info }),
    mark: (name, ms) => emit(eng, { id, tag, type: "mark", name, ms }),
    boxes: (bs) => emit(eng, { id, tag, type: "boxes", boxes: bs }),
    line: (l) => emit(eng, { id, tag, type: "line", line: l }),
  };
  try {
    if (type === "load") {
      core.setOpts(payload.opts);
      return core.loadModels({ localFiles: payload.local, threads: payload.threads,
        onProgress: (p) => emit(eng, { id, tag, type: "progress", ...p }),
        onPhase: (p) => emit(eng, { id, tag, type: "phase", ...p }),
        onLog: (m) => emit(eng, { id, tag, type: "log", ...m }) });
    }
    if (type === "opts") { core.setOpts(payload.opts); return null; }
    if (type === "page") {
      core.setAbort(false);
      const r = await core.ocrPage(payload.bitmap, ev);
      payload.bitmap.close?.();
      return r;
    }
    if (type === "abort") { core.setAbort(true); return null; }
  } catch (e) {
    emit(eng, { id, tag, type: "error", error: String((e && e.stack) || e) });
    throw e;
  }
}

/* 让出线程：不能用 requestAnimationFrame —— 标签页切到后台时 rAF 不触发，
   会把整个流水线卡死。MessageChannel 在任何上下文都会立刻让出。 */
const nextTick = () => new Promise((r) => {
  const c = new MessageChannel();
  c.port1.onmessage = () => { c.port1.close(); r(); };
  c.port2.postMessage(0);
});

/* 并发：结构上支持（引擎池 + tag 路由），但实测为负收益，默认关闭。
   每多开一个引擎就要重新加载约 18 MB 权重（约 6–10 s），而单页 OCR 只要 0.3–0.4 s；
   实测 8 页文档开并发后从 3 s 变成 149 s 仍未跑完。要启用把下面改成 > 0。 */
const CONCURRENCY = 0;
const PARALLEL_MIN_PAGES = 20;
let spawning = null;
/* 关掉并发时引擎池就只留一个，别为串行白白多开 */

/** 预热备用引擎：不等它，跑第 1 页的同时在后台把模型装起来 */
function prewarmEngines(n) {
  for (let i = 0; i < n; i++) {
    if (engines.length >= maxEngines() || spawning) break;
    spawnOne();
  }
}

/* 有界队列 + 固定数量的消费循环。
   一次性 Promise.all 把所有页派发出去会让多出来的页在 acquireEngine 里空转，
   空转的 nextTick 会把主线程吃光，反而拖慢正在跑的引擎。

   more 是可选的「现做一页」工厂：预渲染上限之外的页在这里边渲边算。
   没有它的话，200 页的 PDF 只认前 12 页，却把「12 页」当成全部报出去 —— 静默截断。 */
async function runQueue(jobs, useText, more, total) {
  const N = total ?? jobs.length;
  const CONC = CONCURRENCY > 0 && N >= PARALLEL_MIN_PAGES
    ? Math.min(CONCURRENCY, maxEngines(), N) : 1;
  if (CONC > 1) prewarmEngines(CONC - 1);
  const queue = jobs.slice();
  const tQueue = performance.now();
  let done = 0, drained = false, pulling = null;
  /* 这里试过「预取下一页」：把取页 / 栅格化 / 拷贝给 Worker 整段
     藏到当前页推理的时间里。实测**没有收益**（200 页 57.9 s → 57.2 s，
     噪声范围内），所以撤掉了。原因是那段活其实只有 ~17 ms
     （getPage 0.3 + 栅格化 15 + 拷贝 1.5），页间看起来的 98 ms 空档
     绝大部分是「检测跑完之前本来就出不了框」的固有延迟；
     而主线程在推理期间多干一份栅格化，反过来把 DOM 更新拖慢了。
     真正的瓶颈在 Worker 那 ~190 ms/页，主线程只有 ~17 ms。 */
  const nextJob = async () => {
    if (queue.length) return queue.shift();
    if (!more || drained) return null;
    if (!pulling) pulling = Promise.resolve().then(more).finally(() => { pulling = null; });
    const j = await pulling;
    if (!j) drained = true;
    return j;
  };
  const loop = async () => {
    for (;;) {
      if (stopped) return;
      const j = await nextJob();
      if (!j) return;
      await runJob(j, useText);
      // 「逐页识别」这一步的页码跟着队列走，只增不减
      done++;
      setStageCount(done, N);
      setProgress(`${done} / ${N}`);
      setTrack((done / N) * 100);
      setEta(done, N, tQueue);
      trimBitmaps();
    }
  };
  await Promise.all(Array.from({ length: CONC }, loop));
  return done;
}

/* 位图是整页 200 DPI 的原始像素，一张 A4 约 15 MB。200 页全留着就是 3 GB，
   浏览器会直接 OOM。所以只保留最近 BITMAP_KEEP 张原图，其余的放掉，
   滚回去时按 pdf 页重新栅格化（~100 ms，看不出来）。缩略图在放掉之前就画好了，
   所以总览条不会变空白。 */
const BITMAP_KEEP = 24;
let allCards = [];
function trimBitmaps() {
  let live = 0;
  for (const c of allCards) if (c.bitmap) live++;
  let excess = live - BITMAP_KEEP;
  if (excess <= 0) return;
  // 从最早的页开始放，正在看的不动 —— 放掉之后立刻要重画反而更卡
  for (const c of allCards) {
    if (excess <= 0) break;
    if (!c.bitmap || !c.finished || c.visible) continue;
    paintNav(c);          // 缩略图先画下来，它比原图便宜得多，放原图不影响总览
    c.releaseBitmap();
    excess--;
  }
}

/* WASM 线程数。实测：机器空闲时 8 线程最快，但机器繁忙时线程过度订阅
   会剧烈抖动（同一份输入在 0.45 s 与 19 s 之间跳）。所以让用户可调。 */
function wasmThreads() {
  const want = Number(localStorage.getItem("indra.threads") || 0);
  const cores = navigator.hardwareConcurrency || 4;
  if (want > 0) return Math.max(1, Math.min(want, cores));
  return Math.max(1, Math.min(4, cores));            // 实测 4 最优：8 线程反而与单线程相当
}
function maxEngines() {
  if (CONCURRENCY <= 0) return 1;
  return Math.max(1, Math.min(CONCURRENCY, (navigator.hardwareConcurrency || 4) - 1));
}

/** 取一个空闲引擎；没有就按需开一个，全忙则真正等待（不空转） */
async function acquireEngine() {
  for (;;) {
    const free = engines.find((e) => e.ready && !e.busy);
    if (free) return free;
    if (engines.length < maxEngines()) {
      await spawnOne();
      continue;
    }
    await new Promise((r) => setTimeout(r, 30));
    if (stopped) return engines.find((e) => e.ready) || engines[0];
  }
}

/* 引擎状态收成一行等宽小字，不再是三枚彩色胶囊。
   分段包 span 是为了窄屏能只留线程数 —— 顶栏高度是固定的，
   一旦换行整条就会顶出 46px 的 header。 */
function paintEngineMeta(threads) {
  const el = $("#engineMeta");
  if (!el) return;
  const n = threads ?? modelInfo?.threads;
  el.className = n > 1 ? "on" : "";
  el.textContent = "";
  const lead = document.createElement("span");
  lead.textContent = n ? `${n}×` : "…";
  const rest = document.createElement("span");
  rest.className = "rest";
  rest.textContent = ` · ${useWorker ? "worker" : "main"} · ${crossOriginIsolated ? "isolated" : "no-isolation"}`;
  el.append(lead, rest);
}

/* 开一个新引擎，全局同一时刻只允许一个在开。
   bootEngine 和 acquireEngine 必须共用这道闸：冷启动时两者会同时触发，
   各自开一个 Worker，两份 18 MB 权重抢同一条带宽，反而更慢。 */
function spawnOne() {
  if (spawning) return spawning;
  spawning = spawnEngine(`#${engines.length + 1}`)
    .catch((e) => { log(`engine spawn failed: ${e.message}`, "warn"); return null; })
    .finally(() => { spawning = null; });
  return spawning;
}

async function bootEngine() {
  try {
    core = await import(coreURL);
  } catch (e) {
    useWorker = false;
    log("Worker unavailable, falling back to main thread: " + e.message, "warn");
  }
  if (!engines.some((e) => e.ready)) await spawnOne();   // 首个引擎必须就绪才能跑
  paintEngineMeta();
}

/* 开一个新引擎并把模型装进去 */
async function spawnEngine(label) {
  const tLoad = performance.now();
  let worker = null;
  if (useWorker) {
    try {
      worker = new Worker(coreURL, { type: "module" });
      worker.onerror = (e) => log(`worker ${label}: ${e.message}`, "err");
    } catch (e) {
      useWorker = false;
      worker = null;
      log(`Worker unavailable, falling back to main thread: ${e.message}`, "warn");
    }
  }
  const eng = makeEngine(worker, label);
  engines.push(eng);
  const info = await engineSend(eng, "load", { opts: readOpts(), local: localModelsForEngine, threads: wasmThreads() });
  eng.ready = true;
  if (engines.length === 1) {
    modelInfo = info;
    autoStart();      // 用户可能在模型还在下的时候就选好了文件
    paintEngineMeta(info.threads);
    log(t(info.threads > 1 ? "modelReady" : "modelReady1", { ms: fmtMs(info.ms), th: info.threads }), "ok");
    bootState("ready", 1, t("bootReady"),
      `${t("bootGo")} · ${info.threads}× · ${t("bootMs")} ${fmtMs(performance.now() - tLoad)}`);
    /* 单线程时明确告诉用户怎么开——实测能快 3～14 倍 */
    const tip = $("#thrTip");
    if (tip) {
      tip.hidden = info.threads > 1;
      if (info.threads <= 1) tip.innerHTML = t("thrTip");
    }
  } else {
    log(`engine ${label} ready (${fmtMs(info.ms)})`, "ok");
  }
  $("#btnRun").disabled = !current;
  $("#btnRun").hidden = !current;
  return eng;
}

async function loadEngine(local) {
  localModelsForEngine = local;
  if (modelLoading) return modelLoading;
  // 已经有装好的引擎就直接复用：每次换文件都重开一个 Worker 会白占一份权重内存
  if (!local && engines.some((e) => e.ready) && modelInfo) return modelInfo;
  modelLoading = bootEngine()
    .then(() => { $("#resHint").textContent = t("resHint"); return modelInfo; })
    .catch((e) => {
      log("model load failed: " + e.message, "err");
      bootState("error", 1, t("modelLoadFailed"), e.message);
      throw e;
    })
    .finally(() => { modelLoading = null; });
  return modelLoading;
}
let localModelsForEngine = null;

/* 设置变更要同步给所有引擎 */
async function pushOpts() {
  const o = readOpts();
  await Promise.all(engines.filter((e) => e.ready).map((e) => engineSend(e, "opts", { opts: o }).catch(() => {})));
}

/* ------------------------------------------------------------- 设置 */
function readOpts() {
  const res = $("#selRes").value;
  return {
    longSide: res === "auto" ? 1024 : Number(res),
    adaptive: res === "auto",
    minConf: Number($("#selConf").value),
  };
}
function saveOpts() {
  localStorage.setItem(LS.opts, JSON.stringify({
    res: $("#selRes").value, conf: $("#selConf").value,
    text: $("#ckText").checked, box: $("#ckBox").checked,
  }));
}
function restoreOpts() {
  try {
    const o = JSON.parse(localStorage.getItem(LS.opts) || "{}");
    if (o.res) $("#selRes").value = o.res;
    if (o.conf) $("#selConf").value = o.conf;
    if (o.text !== undefined) $("#ckText").checked = o.text;
    if (o.box !== undefined) $("#ckBox").checked = o.box;
  } catch {}
}

/* ------------------------------------------------------------ 工作流 */
/* 工作流是**文档级**的，不跟着单页来回跳。
   早期把「行检测 / 文字识别 / 阅读顺序」这三个逐页阶段直接映射到步骤下标，
   于是 12 页 PDF 走到第 2 页时高亮又退回「行检测」，再一路爬上去 ——
   来回切，看着像卡住了。现在合并成一个「逐页识别」步骤，只进不退；
   单页此刻在做什么放到 #overall 里，不影响步骤的高亮。 */
const STAGES = ["intake", "render", "pages", "done"];
const STAGE_LABEL = { intake: "st_intake", render: "st_render", pages: "st_pages", done: "st_done" };
/* 逐页阶段（检测 / 分流 / 识别 / 排序 / 文本层）都落在「逐页识别」这一步上 */
const STAGE_IDX = { intake: 0, render: 1, orient: 2, detect: 2, recognize: 2, script: 2, order: 2,
                    textlayer: 2, markdown: 3, done: 3 };
/* 单页此刻在做什么，写给 #overall 看的细活，不参与步骤高亮 */
const ACT_LABEL = { render: "st_render", orient: "st_orient", detect: "st_detect", script: "st_script",
                    recognize: "st_recognize", order: "st_order", markdown: "st_markdown",
                    textlayer: "st_textlayer" };
const PAGE_CHIPS = ["render", "detect", "recognize", "order", "done"];

let stepEls = [];
function buildSteps() {
  const box = $("#steps");
  // 切换语言会重建整个列表，先把上一轮的页码 / 耗时捞出来，重建后放回去
  const keep = stepEls.map((el) => el.querySelector(".tm")?.textContent || "");
  box.innerHTML = "";
  stepEls = STAGES.map((s) => {
    const d = document.createElement("div");
    d.className = "step";
    d.innerHTML = `<span class="dot"></span><span class="nm">${t(STAGE_LABEL[s])}</span><span class="tm"></span>`;
    box.append(d);
    return d;
  });
  renderSteps(lastStageIdx, true);
  stepEls.forEach((el, i) => { if (keep[i]) el.querySelector(".tm").textContent = keep[i]; });
}
let lastStageIdx = -1;
/* force=true 用于新建一次运行（允许回到 0）；正常推进只进不退 */
function renderSteps(idx, force) {
  if (!force && idx < lastStageIdx) return;
  const fresh = force;
  lastStageIdx = idx;
  stepEls.forEach((el2, i) => {
    el2.classList.toggle("done", i < idx);
    el2.classList.toggle("active", i === idx);
    const tm = el2.querySelector(".tm");
    if (fresh) tm.textContent = "";              // 新一次运行，上一轮的页码和耗时一并清掉
    if (i < idx && !tm.textContent) tm.textContent = "✓";
  });
}
/* 「逐页识别」这步的右侧是页码进度，不是 ✓ —— 所以别让它被 ✓ 覆盖掉 */
function setStageCount(done, total) {
  if (superseded) return;
  const el2 = stepEls[STAGES.indexOf("pages")];
  if (el2 && total) el2.querySelector(".tm").textContent = `${done} / ${total}`;
}
function stageDone(i, ms) {
  const el2 = stepEls[i];
  if (!el2) return;
  el2.classList.remove("active"); el2.classList.add("done");
  if (ms != null) el2.querySelector(".tm").textContent = fmtMs(ms);
}

/* 进度条只有一个写入口，顺手管落点和满格样式 */
function setTrack(pct) {
  if (superseded) return;
  const bar = $("#trackBar"), box = $("#track");
  if (!bar) return;
  const v = Math.max(0, Math.min(100, pct));
  if (v === 0) {
    bar.style.transition = "none";
    bar.style.width = "0%";
    box?.classList.remove("on", "full");
    requestAnimationFrame(() => { bar.style.transition = ""; });
    return;
  }
  bar.style.width = v + "%";
  box?.classList.toggle("on", v > 0);
  box?.classList.toggle("full", v >= 100);
}

const pageLabel = (i, n) => `${t("page")} ${i}/${n}`;
const pageName = (f) => f?.name || "";

let current = null;         // File
let pages = [];             // 结果页
let localModels = {}, localTimer = null;

/* 并发时用 tag 找卡片；找不到 tag 再退回当前页 */
function handleEvent(m) {
  /* 模型下载 / 编译这两类事件发生在「还没有任何页面卡片」的阶段，
     必须放在卡片早退之前 —— 冷启动那几秒正好没有卡片，
     早退会把进度整个吞掉，空状态面板永远停在 0%。
     注意**不要**顺手 setTrack()：工作流那条 bar 的语义是「这份文档处理到哪了」，
     模型下载是它的前置条件、不是它的一部分。曾经两边一起写，
     结果刚打开页面、一份文件都还没拖进来，工作流进度条就爬到了 67%，
     看上去像有东西正在处理。模型进度只报在空状态面板上。 */
  if (m.type === "progress") {
    // Stage 1: 模型权重并行下载 (0% ~ 75%)
    const p = Math.min(0.75, (m.done ?? 0) * 0.75);
    const totalBytes = Math.max(m.total || 0, 19.0 * 1024 * 1024);
    bootState("load", p, `${t("bootLoad")} · ${m.file}`,
      m.got ? `${fmtMB(m.got)} / ${fmtMB(totalBytes)}` : t("bootWait"));
    return;
  }
  if (m.type === "phase") {
    // Stage 2: WASM 会话编译 (75% ~ 99%)
    const p = 0.75 + Math.min(0.24, (m.done ?? 0) * 0.24);
    bootState("compile", p, `${t("bootCompile")}${m.file ? " · " + m.file : ""}`, m.file ? `${m.file} (WASM)` : "");
    return;
  }
  if (m.type === "log") { log(m.msg); return; }

  const cur = (m.tag && cardsByTag.get(m.tag)) || activePage;
  if (!cur) return;
  if (m.type === "stage") {
    cur.setStage(m.name);
    // 步骤只推进到「逐页识别」这一步为止；当前页在做什么只更新 #overall
    if (m.name === "detect" || m.name === "orient") renderSteps(STAGES.indexOf("pages"));
    setProgress(null, m.name);
  } else if (m.type === "orient") {
    if (m.k > 0 && cur.bitmap && !cur.rotated) {
      cur.rotated = true;
      cur.rotation = m.rotation;
      rotateBitmap(cur.bitmap, m.k).then((newB) => {
        if (newB) {
          const oldB = cur.bitmap;
          cur.bitmap = newB;
          oldB.close?.();
          drawPreview(cur, cur.live || [], "idle");
        }
      });
    }
  } else if (m.type === "line") {
    cur.addLine(m.line);
  } else if (m.type === "boxes") {
    cur.showBoxes(m.boxes);
  } else if (m.type === "mark") {
    cur.mark?.(m.name, m.ms);
  }
}

/* 长文档要跑好几分钟，界面上不能只有一个慢慢爬的数字。
   识别是单页最大的一块开销且不可压缩（实测两轮优化都判定为无用），
   那就至少让等待**可预期**：跑过几页之后按实测速率给出剩余时间。
   少于 3 页不出（样本太少，估不准），用 EMA 平滑（逐页速率抖动很大）。 */
let etaMs = 0;
/* 秒 → 「40 秒」/「3 分钟」；只到分钟，不假装精确 */
const humanDuration = (s) => s < 60 ? `${s} ${t("sec")}` : `${Math.round(s / 60)} ${t("min")}`;
function setEta(done, total, startedAt) {
  const el = $("#summary");
  if (!el) return;
  if (done < 3 || done >= total) return;
  const rate = (performance.now() - startedAt) / done;
  etaMs = etaMs ? etaMs * 0.7 + rate * 0.3 : rate;
  const left = Math.max(0, Math.round(etaMs * (total - done) / 1000));
  el.textContent = `${done} / ${total} ${t("page")} · ${t("eta", { x: humanDuration(left) })}`;
}

/* --------------------------------------------------- 单页卡片（流式） */
let activePage = null;
function makePageCard(label, src) {
  const wrap = document.createElement("article");
  wrap.className = "pg";
  wrap.innerHTML = `
    <div class="hd">
      <span class="t"></span>
      <span class="src${src === "text" ? " text" : ""}"></span>
      <span class="ms"></span>
    </div>
    <div class="p2"><i></i></div>
    <div class="body">
      <div class="prev"><canvas hidden></canvas><span class="scan"></span></div>
      <div class="side">
        <div class="mdblock" hidden><div class="mdhead" data-i18n="mdTitle">Markdown</div><div class="md-card-body"></div></div>
        <details class="rawdet" open><summary class="fold"><span data-i18n="rawTitle">识别内容</span><em class="cnt"></em></summary>
          <div class="lines"></div>
        </details>
      </div>
    </div>`;
  foldAll(wrap);                       // 卡片的折叠标记走同一个组件（设置/日志/识别内容一致）
  bootShow(false);                     // 一旦有卡片，空状态就让位
  $("#pages").append(wrap);
  const prevBox = $(".prev", wrap);
  prevBox.addEventListener("click", () => {
    if (!card) return;
    // 位图可能已被放掉：点开前先补回来，补完自动进灯箱
    if (card.bitmap) return openLightbox(card);
    if (card.repage) card.repage(true);
  });
  prevBox.style.cursor = "zoom-in";
  /* 画布 → 正文：鼠标扫过检测框，正文里对应那一行点亮并滚进视野。
     以前只有「正文 → 画布」这一个方向（在 .ln 上悬停点亮框），
     画布上只能整块点开放大，两边对不上。坐标换算要和 drawPreview 完全一致：
     画布上是 (0,0)-(W,H)，对应位图上裁剪区 (cr.x, cr.y, cr.w, cr.h)。 */
  prevBox.addEventListener("mousemove", (e) => {
    if (!card.bitmap) return;
    const cr = card.crop || { x: 0, y: 0, w: card.bitmap.width, h: card.bitmap.height };
    const cv = $("canvas", wrap);
    const r = cv.getBoundingClientRect();
    if (!r.width || !cv.width) return;
    // 屏幕 CSS px → 画布后备缓冲 px → 位图像素
    const k = cv.width / r.width;
    const cx = (e.clientX - r.left) * k;
    const cy = (e.clientY - r.top) * k;
    const sc = cr.w / cv.width;
    const ix = cr.x + cx * sc, iy = cr.y + cy * sc;
    const rows = card.el.lines.querySelectorAll(".ln");
    const ls = card.live;
    // 行数对不上时不猜（流式阶段 live 还在增长），宁可不高亮
    let idx = -1;
    if (rows.length === ls.length) {
      for (let i = 0; i < ls.length; i++) {
        const bx = ls[i].box;
        if (ix >= bx[0] && ix <= bx[2] && iy >= bx[1] && iy <= bx[3]) { idx = i; break; }
      }
    }
    if (idx === card.hoverIdx) return;
    card.hoverIdx = idx;
    prevBox.style.cursor = idx >= 0 ? "pointer" : "zoom-in";
    if (idx < 0) return card.highlight(null);
    card.highlight(rows[idx]);
    // 让那一行进入视野，否则正文列可能停在别处，看着像没反应
    rows[idx].scrollIntoView({ block: "nearest" });
  });
  prevBox.addEventListener("mouseleave", () => { card.hoverIdx = -1; card.highlight(null); });
  const stageBar = $(".p2 > i", wrap);
  const stageNames = $(".p2", wrap);
  const card = {
    root: wrap, bitmap: null, live: [], visible: true,
    el: {
      t: $(".t", wrap), src: $(".src", wrap), ms: $(".ms", wrap),
      lines: $(".lines", wrap), prev: $(".prev", wrap), canvas: $("canvas", wrap),
      mdblock: $(".mdblock", wrap), mdhead: $(".mdhead", wrap), pre: $(".md-card-body", wrap),
      rawdet: $(".rawdet", wrap), rawsum: $(".rawdet > summary", wrap), rawcnt: $(".rawdet .cnt", wrap),
      stage: stageNames,
    },
    rows: new Map(),
    marks: {},
    boxes: null, lines2: [],
    mark(name, ms) { this.marks[name] = Math.round(ms); },
    painted: false, pending: null,
    /* 页面位图一拿到就先铺上，不等推理。离屏的先记账，滚到附近再画——
       几十页文档一次性铺满 canvas 会明显卡。 */
    /* 裁剪范围只依赖位图，所以**拿到位图这一刻就算出来**，而不是等检测框。
       以前等检测框是为了省一次扫描，可代价是：首帧先按整页画出来，
       检测框到了再裁到有字那块——画布宽度和列宽都得重新布局，
       用户看到的就是一次「打开图片时放大缩小」。把扫描提前 2 ms 换掉那次变形很划算。
       顺带一提：这一条修的是渲染出来的宽度，`cv.style.width` 一改就到位，
       量它看不出问题，得看 getBoundingClientRect 或者列宽。 */
    showPreview() {
      if (this.bitmap && !this.crop) this.crop = inkBox(this.bitmap);
      this.repaint([], "idle");
    },
    /* 一律按可见性绘制：几十页文档全铺 canvas 会卡。
       画过「最终态」之后就不再观察了。首页默认立即绘制，绝不阻断。 */
    repaint(lines, mode, hi = -1) {
      this.pending = { lines, mode };
      if (!this.bitmap) return;
      if (!this.visible && (this.dotIdx || 0) > 0) { this.root.classList.add("deferred"); return; }
      this.paintPending(hi);
    },
    paintPending(hi = -1) {
      const pd = this.pending;
      if (!pd || !this.bitmap) return;
      this.pending = null;
      this.root.classList.remove("deferred");
      drawPreview(this, pd.lines, pd.mode, hi);
      if (pd.mode === "done") { this.painted = true; cardIO?.unobserve(this.root); }
    },
    setVisible(v) {
      this.visible = v;
      if (!v) return;
      syncNavActive(); paintNav(this);
      // 位图被内存回收器放掉过（长文档），重新栅格化这一页；完成时 repage 自己会重画
      if (!this.bitmap && this.repage) { this.repage(); return; }
      this.paintPending();
    },
    /* 交出整页原图（几百页文档时 200 DPI 的位图会把内存吃光）。
       canvas 上已经画好的那一份留着不动，所以屏幕上看着没变化；
       重新拿到位图后 paintPending 会按最新状态重画。 */
    releaseBitmap() {
      const b = this.bitmap;
      this.bitmap = null;
      b?.close?.();
    },
    repage: null,
    /* 检测一结束就先画框，识别完再叠文字与置信度 */
    showBoxes(bs) {
      this.boxes = bs;
      // 墨迹裁剪通常在拿到位图时就定了（见 showPreview）；定不出来的才在这里退回检测框
      if (!this.crop) this.crop = contentBox(bs, this.bitmap);
      wrap.classList.add("has-boxes");
      if (this.bitmap) drawPreview(this, [], "boxes");
    },
    /* 失败要看得见。以前只加了个 .failed 类，而 CSS 里根本没有这条规则，
       失败页和正常页长得一模一样，用户只会以为「这页没内容」。 */
    fail(msg) {
      wrap.classList.add("failed");
      // 日志那句是「第 X 页失败」（X 是页号），卡片头上这里 X 是错误原因，
      // 套同一个模板会读成「第 内存不足 页失败」
      card.el.ms.textContent = t("cardFailed", { n: msg });
      card.el.ms.title = msg;
      $(".p2 > i", wrap).style.background = "var(--err)";
      $(".p2", wrap).style.background = "var(--line)";
      const note = document.createElement("div");
      note.className = "failnote";
      const mark = document.createElement("b");
      mark.textContent = "!";
      note.append(mark, t("pageFailedShort"));
      note.title = msg;
      $(".prev", wrap).append(note);
      this.finished = true;
    },
    /* 悬停某一行时在预览上把对应的框点亮 */
    highlight(node) {
      const rows = [...card.el.lines.querySelectorAll(".ln")];
      const idx = node ? rows.indexOf(node) : -1;
      if (idx === this.hi) return;
      this.hi = idx;
      rows.forEach((r, i) => r.classList.toggle("hi", i === idx));
      card.repaint(card.live.length ? card.live : [], mode_of(card), idx);
    },
    /* 阶段用一条细进度线表示，比五枚胶囊安静得多 */
    setStage(name) {
      this.stage = name;
      const map = { render: 1, detect: 2, script: 3, recognize: 3, order: 4, markdown: 5, done: 6 };
      const i = map[name];
      if (i == null) return;
      wrap.classList.toggle("busy", name !== "done");
      stageBar.style.width = (i / 6 * 100) + "%";
      stageBar.title = t(ACT_LABEL[name] || name);   // 卡片是单页的，逐页阶段在这里才是对的信息
    },
    addLine(l) {
      const conf = typeof l.conf === "number" ? l.conf : 0;
      if (!l.text.trim() || conf < readOpts().minConf) return;
      const box = card.el.lines;
      // 已经在底部才跟着滚。用户往上翻的时候别把他拽回来。
      const stick = box.scrollHeight - box.scrollTop - box.clientHeight < 28;
      box.append(makeLn(l, false, card));
      if (stick) box.scrollTop = box.scrollHeight;
      card.live.push(l);
      /* 预览重画按时间节流。原来是每 6 行一次：138 行就是 23 次全画布
         drawImage（800×1000 起步），主线程要为此空出几百毫秒，
         反而把流式本身拖慢。按时间卡更稳。 */
      const now = performance.now();
      if (card.bitmap && now - (this._paintAt || 0) > 70) {
        this._paintAt = now;
        drawPreview(card, card.live, "live");
      }
      /* 卡片头一直有一行可读的状态：此刻在做什么 + 已经出了多少行。
         行可能在折叠线以下，但这个数字一直看得见。 */
      card.el.ms.textContent = `${t(ACT_LABEL[card.stage] || "streaming")} · ${card.live.length}`;
      this.pendingCount = (this.pendingCount || 0) + 1;
    },
    finish(res) {
      this.pendingCount = 0;
      this.finished = true;      // 内存回收器只放已经跑完、且不在视口里的页
      // 流式只负责“边跑边看”，最终以权威结果对账重建一次（阅读顺序此刻才确定）
      const box = card.el.lines;
      const keepScroll = box.scrollTop;
      box.innerHTML = "";
      res.lines.forEach((l) => box.append(makeLn(l, true, card)));
      // 重建是整列换掉，别把用户翻到的位置弹回顶部
      box.scrollTop = keepScroll;
      box.classList.add("settle");
      setTimeout(() => box.classList.remove("settle"), 420);
      wrap.classList.remove("busy");
      stageBar.style.width = "100%";
      card.el.ms.textContent = `${res.lines.length} ${t("lines")} · ${fmtMs(res.time)}`;
      card.el.rawcnt.textContent = `${res.lines.length} ${t("lines")}`;
      {
        const mk = Object.entries(card.marks);
        card.el.ms.title = mk.length ? mk.map(([k, v]) => `${t("mk_" + k)} ${fmtMs(v)}`).join(" · ") : "";
      }
      card.el.src.textContent = res.source === "text" ? t("srcText") : t("srcOcr");
      if (res.rotation && !card.el.hd.querySelector(".rot-pill")) {
        const badge = document.createElement("span");
        badge.className = "src rot-pill";
        badge.textContent = t("badgeOrient", { deg: res.rotation });
        card.el.src.parentElement.insertBefore(badge, card.el.src.nextSibling);
      }
      if (res.det) {
        const long = Math.max(res.det.pi.dims[2], res.det.pi.dims[3]);
        card.el.src.title = `det long side ${long}, median line ${res.det.medH?.toFixed(1) ?? "-"} px`;
      }
      // 逐段耗时**不逐页写日志**了：一页一行、每页都一样的内容，
      // 跑 200 页就是 200 行噪音。把这一页的分解留给卡片头的悬停提示，
      // 整次运行结束后再汇总一行，记进 marksAll。
      const mk = Object.entries(card.marks);
      for (const [k, v] of mk) marksAll[k] = (marksAll[k] || 0) + v;
      card.live = res.lines;
      wrap.classList.add("done");
      card.repaint(res.lines, "done");
      if (res.md) {
        card.el.mdblock.hidden = false;   // 常驻，不折叠
        try { card.el.pre.innerHTML = marked.parse(res.md); }
        catch { card.el.pre.textContent = res.md; }
      }
      renderOutputs();
    },
  };
  card.el.t.textContent = label;
  card.el.src.textContent = src === "text" ? t("srcText") : "";
  wrap.__card = card;
  card.dotIdx = dotSeq++;              // 点已全部建好，只能用独立计数器
  cardIO?.observe(wrap);               // 进视口才画预览
  allCards.push(card);                 // 内存回收器按这个顺序从最早的页开始放位图
  wrap.__card = card;
  return card;
}

/* 三种绘制状态：
   idle  —— 只有页面图；boxes —— 叠检测框；live —— 边识别边叠文字；done —— 叠完并标置信度 */
function makeLn(l, reorder, card) {
  const conf = typeof l.conf === "number" ? l.conf : 0;
  const d = document.createElement("div");
  // reorder = 对账重建的那一批：138 行一起换掉，不能每行都放一遍动画
  d.className = "ln" + (reorder ? " reorder" : " stream") + (l.cjk ? " cjk" : "") + (conf < 0.8 ? " low" : "");
  d.innerHTML = `<span class="cf">${conf.toFixed(2)}</span><span class="tx"></span>`;
  $(".tx", d).textContent = l.text;
  d.addEventListener("mouseenter", () => card && card.highlight(d));
  d.addEventListener("mouseleave", () => card && card.highlight(null));
  return d;
}

/* 点预览放大：默认适应窗口，可缩放与滚动；低置信度的行标成琥珀色
 *
 * 画布**只画一次**，画到「位图原始像素」那一档，缩放交给 CSS。
 * 以前每按一次 +/- 都把后备缓冲换个尺寸、drawImage 整页、再把所有框和
 * 置信度重描一遍。重画本身其实不贵（实测中位 0.7–1.5 ms），真正的毛病是
 * `lbZoom` 能一路加到 6：缩放超过 100% 时画布涨到 4000×4700（19 Mpx ≈ 76 MB），
 * 而 100% 以上本来就一个像素的新信息都没有——纯白花内存，手机上容易把标签页搞崩。
 * 现在：后备缓冲固定不变，缩放只是两个 CSS 数字；
 * 放大封顶在 100%（取不到更多细节就别假装），内存有上限。
 * 高亮改成 DOM 覆盖层，于是「按方向键逐行走」也不用重画整页了。 */
let lbZoom = 1, lbFitScale = 1, lbMaxZoom = 1, lbCard = null, lbHi = -1;
const LB_STORE_MAX = 6000;      // 位图边长上限，防止异常大的图把缓冲撑爆
/* 贵的那一步：把整页和所有框画进后备缓冲。只在换页 / 开关检测框时做。 */
function renderLightbox() {
  const cv = $("#lbCanvas"), b = lbCard?.bitmap;
  if (!b) return false;                     // 位图被回收了还没补回来，别拿空图硬画
  // 画进缓冲的那一档：正常就是原始像素（1:1），超大图才按比例降一降
  const k = Math.min(1, LB_STORE_MAX / Math.max(b.width, b.height));
  const W = Math.max(1, Math.round(b.width * k)), H = Math.max(1, Math.round(b.height * k));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const cx = cv.getContext("2d");
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.clearRect(0, 0, W, H);
  cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = "high";
  cx.drawImage(b, 0, 0, W, H);
  const rows = lbRows(), hi = lbHi;
  if (!$("#ckBox").checked) return true;
  cx.lineWidth = Math.max(1, 1.6 * k);
  cx.font = `${Math.max(11, 11 * k)}px ui-monospace,monospace`;
  for (let i = 0; i < rows.length; i++) {
    const l = rows[i], [x0, y0, x1, y1] = l.box || l;
    const conf = l.conf;
    const amber = conf !== undefined && conf < 0.8;
    cx.strokeStyle = conf === undefined ? "rgba(34,211,238,.85)" : amber ? "rgba(245,158,11,.95)" : "rgba(236,72,72,.85)";
    cx.strokeRect(x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k);
    if (conf !== undefined && conf < 1 && i !== hi) {
      cx.fillStyle = amber ? "rgba(180,83,9,.95)" : "rgba(210,32,32,.95)";
      cx.fillText(conf.toFixed(2), x0 * k, Math.max(11, y0 * k - 3));
    }
  }
  return true;
}
/* 便宜的那一步：只改显示尺寸和高亮位置。缩放、适应窗口、逐行走都走这里。 */
function layoutLightbox() {
  if (!lbCard) return;
  const cv = $("#lbCanvas"), b = lbCard.bitmap;
  if (!b) return;
  const W = Math.max(320, innerWidth - 96), H = Math.max(320, innerHeight - 170);
  lbFitScale = Math.min(W / b.width, H / b.height, 1);
  // 100% 就是位图的原始像素，再放大也取不到新信息，所以封在这里
  lbMaxZoom = lbFitScale > 0 ? Math.max(1, 1 / lbFitScale) : 1;
  if (lbZoom > lbMaxZoom) lbZoom = lbMaxZoom;
  const scale = lbFitScale * lbZoom;
  cv.style.width = Math.max(1, Math.round(b.width * scale)) + "px";
  cv.style.height = Math.max(1, Math.round(b.height * scale)) + "px";
  $("#lbZoom").textContent = Math.round(scale * 100) + "%";
  // 标题跟着高亮走：页名 · 第 k / n 行
  const tot = lbRows().length;
  $("#lbTitle").textContent = lbCard.el.t.textContent
    + (lbHi >= 0 && tot ? ` · ${t("line")} ${lbHi + 1} / ${tot}` : "");
  // 高亮是 DOM 覆盖层：跟着画布一起缩放，不用碰画布，也永远是清晰的 1px 边
  const hi = $("#lbHi"), rows = lbRows();
  const l = lbHi >= 0 && lbHi < rows.length ? rows[lbHi] : null;
  if (!l) { hi.hidden = true; return; }
  const q = l.box || l;
  hi.hidden = false;
  hi.style.left = (q[0] * scale) + "px";
  hi.style.top = (q[1] * scale) + "px";
  hi.style.width = Math.max(2, (q[2] - q[0]) * scale) + "px";
  hi.style.height = Math.max(2, (q[3] - q[1]) * scale) + "px";
  const lb = l.text || "";
  hi.dataset.text = lb;
  hi.textContent = "";
  if (lb && (q[2] - q[0]) * scale > lb.length * 7) hi.textContent = lb;   // 太窄就只画框
}
/* 换页或开关检测框要重画；只缩放就不要 */
function paintLightbox(repaint) {
  if (!lbCard) return;
  if (repaint && !renderLightbox()) return;
  layoutLightbox();
}
/* 灯箱里的「行」跟正文那一列必须是同一份，否则高亮对不上 */
const lbRows = () => (lbCard?.live?.length ? lbCard.live : lbCard?.boxes || []);
/* 在灯箱里逐行走：正文那一列同步高亮并滚到可见。
   只挪覆盖层，不重画画布——以前每按一次方向键都要重画整页。 */
function lbStep(d) {
  if (!lbCard) return;
  const rows = lbRows();
  if (!rows.length) return;
  lbHi = lbHi < 0 ? (d > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, lbHi + d));
  lbCard.highlight(lbCard.el.lines.querySelectorAll(".ln")[lbHi] || null);
  layoutLightbox();
  const l = rows[lbHi];
  // 把这一行滚进视野，否则在一整页的缩放视图里根本不知道高亮在哪
  const st = $(".lbstage");
  if (l) {
    const k = (st.querySelector(".lbframe")?.getBoundingClientRect().width || 0) / (lbCard.bitmap?.width || 1);
    st.scrollTo({ top: Math.max(0, (l.box ? l.box[1] : l[1]) * k - st.clientHeight / 2), behavior: "smooth" });
  }
}
function openLightbox(card) {
  lbCard = card; lbZoom = 1; lbHi = -1;
  $("#lbTitle").textContent = card.el.t.textContent;
  $("#lightbox").hidden = false;
  paintLightbox(true);
}
/* 关掉就把后备缓冲还回去：光 hidden 只是藏起来，画布那几十 MB 还占着。
   200 DPI 的一页 2550×3583 就是 36 MB，灯箱关着还占着没有道理。 */
function closeLightbox() {
  $("#lightbox").hidden = true;
  const cv = $("#lbCanvas");
  cv.width = 0; cv.height = 0;
  lbCard = null; lbHi = -1;
}
addEventListener("resize", () => {
  if (lbCard && !$("#lightbox").hidden) layoutLightbox();
  for (const c of allCards) {
    if (c.visible && c.bitmap && c.live?.length) drawPreview(c, c.live, "done");
  }
});

/* 按位图的**实际墨迹**求裁剪范围。
   原来裁剪只信检测框，而检测是模型输出、会漏：samples/sample.png 里最大的一行
   「标题 Title」就没进检测框，于是右栏列 5 行、预览只画得出 4 个框，
   漏掉的那行整个被裁到了画布外（灯箱看整页，所以一直是对的，很难发现）。
   墨迹不会漏，所以改成扫图本身。
   做法：缩到 256 宽再扫，约 6.5 万像素、不到 1 ms。
   背景不假定是白的——用亮度中位数当背景，深色底的文档同样成立。
   墨迹占比过高（照片、整版底纹、扫描噪点）时裁了也没意义，返回 null 退回检测框。 */
function inkBox(bmp) {
  if (!bmp) return null;
  const w = 256;
  const h = Math.max(1, Math.min(1024, Math.round((bmp.height / bmp.width) * w)));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bmp, 0, 0, w, h);
  let d;
  try { d = g.getImageData(0, 0, w, h).data; } catch { return null; }

  const lum = new Float32Array(w * h);
  const opaque = new Uint8Array(w * h);
  const hist = new Uint32Array(256);
  let nOpaque = 0;
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    if (d[i + 3] < 24) continue;          // 透明像素不是墨：PDF 页没有背景，不能算成满页内容
    const L = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    lum[p] = L; opaque[p] = 1; hist[L | 0]++; nOpaque++;
  }
  if (!nOpaque) return null;
  let acc = 0, bg = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= nOpaque / 2) { bg = v; break; } }

  const thr = 42;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, ink = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!opaque[p] || Math.abs(lum[p] - bg) <= thr) continue;
      ink++;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < x0 || ink / nOpaque > 0.55) return null;   // 满版内容，裁剪没意义

  const sx = bmp.width / w, sy = bmp.height / h;
  const pad = Math.max(8, Math.round(Math.max((x1 - x0) * sx, (y1 - y0) * sy) * 0.02));
  const bx0 = Math.max(0, Math.floor(x0 * sx) - pad);
  const by0 = Math.max(0, Math.floor(y0 * sy) - pad);
  const bx1 = Math.min(bmp.width, Math.ceil((x1 + 1) * sx) + pad);
  const by1 = Math.min(bmp.height, Math.ceil((y1 + 1) * sy) + pad);
  if (bx1 - bx0 < 8 || by1 - by0 < 8) return null;
  return { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 };
}

/* 页面预览只画有字的那块：整页 A4 里内容常常只占顶部三分之一，
   把空白一起画出来既难看又挤占版面。灯箱仍看整页。 */
function contentBox(boxes, bmp) {
  if (!bmp || !boxes?.length) return null;
  // 丢掉零碎误检：它们通常又小又散，会把包围盒撑到整页
  const area = boxes.map((l) => { const b = l.box || l; return (b[2] - b[0]) * (b[3] - b[1]); })
                     .sort((a, b) => a - b);
  const floor = area[Math.floor(area.length * 0.35)] || 0;
  const keep = boxes.filter((l) => { const b = l.box || l; return (b[2] - b[0]) * (b[3] - b[1]) >= floor; });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of (keep.length ? keep : boxes)) {
    const b = l.box || l;
    x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]);
    x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
  }
  const pad = Math.max(10, Math.round(Math.max(x1 - x0, y1 - y0) * 0.03));
  x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad));
  x1 = Math.min(bmp.width, Math.ceil(x1 + pad)); y1 = Math.min(bmp.height, Math.ceil(y1 + pad));
  if (x1 - x0 < 8 || y1 - y0 < 8) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

async function rotateBitmap(bitmap, k) {
  if (!bitmap || !k) return bitmap;
  const is90 = k === 1 || k === 3;
  const dstW = is90 ? bitmap.height : bitmap.width;
  const dstH = is90 ? bitmap.width : bitmap.height;
  const angle = (k === 1 ? 90 : (k === 2 ? 180 : 270)) * Math.PI / 180;

  if (typeof OffscreenCanvas !== "undefined") {
    const oc = new OffscreenCanvas(dstW, dstH);
    const ctx = oc.getContext("2d");
    ctx.translate(dstW / 2, dstH / 2);
    ctx.rotate(angle);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    return oc.transferToImageBitmap();
  } else {
    const cv = document.createElement("canvas");
    cv.width = dstW;
    cv.height = dstH;
    const ctx = cv.getContext("2d");
    ctx.translate(dstW / 2, dstH / 2);
    ctx.rotate(angle);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    return createImageBitmap(cv);
  }
}

/* 预览绘制。按 devicePixelRatio 放大后备缓冲，否则在 Retina 上
   一张 400px 宽的画布铺到 400 CSS px 上会被拉伸糊掉。
   mode: idle 只有图 / boxes 只有检测框 / live 边识别边叠 / done 最终态 */
const DPR = () => Math.min(3, Math.max(1, Math.round((devicePixelRatio || 1) * 2) / 2));

function drawPreview(card, lines, mode = "done", hi = -1) {
  const b = card.bitmap;
  if (!b) return;
  const box = card.el.canvas.parentElement;   // 只用来取消 .deferred 占位，不再拿它算宽度
  const availH = 620;                       // 竖版 A4 按宽度缩会只剩一条，按高度再夹一次
  const PREVW_MAX = 420;                    // 预览列的宽度上限
  const PAD = 20;                           // 列内两侧留白
  const cr = card.crop || { x: 0, y: 0, w: b.width, h: b.height };
  /* 目标宽度**只由内容和上限算出来**，不能拿当前列宽反推。
     以前这里用 availW = box.clientWidth − 20，而 .prev 自带 1px 右边框，
     clientWidth 已经把它吃掉了，于是
        cssW = 列宽 − 1 − 20 = 列宽 − 21
        want = ceil(cssW) + 20 = 列宽 − 1
     每重画一次就少 1px 的单向棘轮：鼠标在画布和正文之间来回，
     画布就一路缩水到下限。（之前注释里说「不动点」只在高度先卡住时成立，
     而这批文档几乎都是宽度先卡住，所以必然衰减。） */
  /* 上限还要再夹一层**卡片实际宽度**。≥1100px 时两栏排版，420 就够了；
     窄屏是单列（.body 的 grid 只有一列，--prevw 根本不生效），
     420 宽的画布会顶出卡片、被 overflow:hidden 切掉右边一截——
     390 宽的手机上实测最多切掉 25px，右边几个字直接看不见。
     取**卡片外宽**而不是 .prev 的宽度：.prev 在宽屏下宽度来自 --prevw，
     拿它当上限就是拿自己量自己，回到上面那条棘轮。 */
  const cardW = card.root.getBoundingClientRect().width;
  const capW = Math.max(120, Math.min(PREVW_MAX, cardW ? cardW - 22 : PREVW_MAX));
  const fit = Math.min(1, (capW - PAD) / cr.w, availH / cr.h);
  const cssW = Math.max(1, Math.round(cr.w * fit));
  const cssH = Math.max(1, Math.round(cr.h * fit));
  /* 列宽跟着画布走：写死 420px 时窄长内容（长截图）只用到 374px，
     每页白占几十像素、全从正文那栏扣。 */
  const want = Math.min(PREVW_MAX, Math.ceil(cssW) + PAD);
  if (card._prevw !== want) {
    card._prevw = want;
    card.root.style.setProperty("--prevw", want + "px");
  }
  const cv = card.el.canvas;
  cv.style.width = cssW + "px";
  cv.style.height = cssH + "px";
  // 建卡时 canvas 是 hidden 的：元素默认 300×150 会先亮一帧再变成实际尺寸，
  // 那一下同样被看成「图片自己动了一下」。定完尺寸再放出来。
  cv.hidden = false;
  const r = DPR();
  const W = Math.round(cssW * r), H = Math.round(cssH * r);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const cx = cv.getContext("2d");
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.clearRect(0, 0, W, H);
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = "high";
  cx.drawImage(b, cr.x, cr.y, cr.w, cr.h, 0, 0, W, H);

  const showText = mode === "done" || mode === "live";
  if (mode === "boxes" || showText) {
    const showBoxes = $("#ckBox") ? $("#ckBox").checked : true;
    const boxes = showText ? lines : card.boxes || [];
    if (boxes?.length) {
      /* 必须和上面 drawImage 的源→目标缩放一致：那里画的是**裁剪区**
         (cr.x, cr.y, cr.w, cr.h) → (0,0,W,H)，所以缩放是 W/cr.w。
         原来这里写 W/b.width（整张图的缩放），只要裁剪生效就不一致——
         框会整体偏；灯箱画的是整张图、用的也是整张图的缩放，所以全屏反而是对的。 */
      const sx = W / cr.w;
      cx.lineWidth = Math.max(1, 1.2 * sx * r);
      for (let i = 0; i < boxes.length; i++) {
        const on = hi === i;
        if (!showBoxes && !on) continue;
        // boxes 阶段拿到的是裸数组，live/done 阶段才是 {box} —— 两种都得吃
        const l = boxes[i], [x0, y0, x1, y1] = l.box || l;
        // 只给「需要注意」的行上色：读对的行保持中性，页面才不会变成一片红
        const low = l.conf !== undefined && l.conf < 0.8;
        cx.strokeStyle = on ? "rgba(34,211,238,1)"
          : low ? "rgba(245,158,11,.95)"
          : showText ? "rgba(236,72,72,.65)" : "rgba(34,211,238,.85)";
        cx.lineWidth = on ? Math.max(2, 2.4 * sx * r) : Math.max(1, (low ? 1.6 : 1.2) * sx * r);
        cx.strokeRect((x0 - cr.x) * sx, (y0 - cr.y) * sx, (x1 - x0) * sx, (y1 - y0) * sx);
      }
    }
    /* 置信度只标「需要核对」的行。全标等于没标：41 行就是 41 个红数字糊成一片，
       反而把真正可疑的那 3 行淹掉。低分行在正文里本来就标成琥珀色。 */
    if (showText && $("#ckBox").checked) {
      const sx = W / cr.w;
      cx.font = `${Math.max(9, 9 * sx * r)}px ui-monospace,monospace`;
      cx.fillStyle = "rgba(180,83,9,.95)";
      cx.textBaseline = "bottom";
      lines.forEach((l) => {
        if (l.conf === undefined || l.conf >= 0.8) return;
        const b = l.box || l;
        cx.fillText(l.conf.toFixed(2), (b[0] - cr.x) * sx, Math.max(9, (b[1] - cr.y) * sx - 1));
      });
      cx.textBaseline = "alphabetic";
    }
  }
  box.hidden = false;
}

/* --------------------------------------------------- 复制 / 下载 */
/* 都按**当前激活的那个结果页**来，而不是永远拿 Markdown —— 按钮就摆在
   页签旁边，在「文本」页签点复制却拿到 Markdown 已经很别扭了。 */
const activeTab = () => $("#tabs button[aria-selected=true]")?.dataset.tab || "pages";
const TAB_OUT = { md: ["#md", "text/markdown", "md"], txt: ["#txt", "text/plain", "txt"],
                  json: ["#json", "application/json", "json"] };
const outText = () => {
  const cur = activeTab();
  // 停在工作流页签上但已经有结果时，按 Markdown 算 —— 默认导出就是它，
  // 不然跑完按钮一直不出现，切到 Markdown 页签才冒出来，像是坏了
  const tab = TAB_OUT[cur] ? cur : (pages.length ? "md" : null);
  if (!tab) return null;
  return { text: RAW[tab], mime: TAB_OUT[tab][1], ext: TAB_OUT[tab][2], tab };
};
/* 一次性反馈：按钮上闪一下，确认完自己退回去 */
function flash(btn, key, ms = 1400) {
  const was = btn.textContent;
  btn.textContent = t(key);
  btn.classList.add("done");
  clearTimeout(btn._ft);
  btn._ft = setTimeout(() => { btn.textContent = was; btn.classList.remove("done"); }, ms);
}
/* 按钮上**只写动词**，格式放进悬停提示。
   原来写的是「复制 Markdown / 复制 文本 / 复制 JSON」——同一个按钮的宽度
   在 49px 和 113px 之间跳（2.3 倍），每切一次页签整条按钮栏就横向抖一下；
   而当前是哪个格式，旁边的页签已经说得很清楚，不必再写一遍。 */
function retitle() {
  const o = outText();
  // 工作流页签上没有可导出的东西：按钮得真的变灰，不能只是点了没反应
  const on = !!(o && o.text) && pages.length > 0;
  const c = $("#btnCopy"), d = $("#btnDl");
  c.textContent = t("copy");
  d.textContent = t("download");
  c.disabled = d.disabled = !on;
  // 还没有结果时，灰着的复制 / 下载和停止一样是纯噪音，直接不占位
  c.hidden = d.hidden = !on;
  c.title = on ? t("copyOf", { x: t("copyAs_" + o.tab) }) : t("nothingToCopy");
  d.title = on ? t("downloadOf", { x: o.ext }) : t("nothingToCopy");   // 扩展名保持小写
}
async function copyActive() {
  const o = outText();
  if (!o?.text) return log(t("nothingToCopy"), "warn");
  try { await navigator.clipboard.writeText(o.text); flash($("#btnCopy"), "copied"); }
  catch { log(t("copiedFail"), "warn"); flash($("#btnCopy"), "copiedFail"); }
}
function downloadActive() {
  const o = outText();
  if (!o?.text) return log(t("nothingToCopy"), "warn");
  const url = URL.createObjectURL(new Blob([o.text], { type: o.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = (current?.name || "ocr").replace(/\.[^.]+$/, "") + "." + o.ext;
  a.click();
  // 不 revoke 的话 blob 挂在文档上直到关页面，连跑几次就是几个大字符串
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  flash($("#btnDl"), "saved");
}

/* ------------------------------------------------------- 空状态 / 冷启动 */
/* 首次打开要下 18 MB 权重、编译 5 个会话。原来这段时间里按钮是灰的、
   右半屏全黑、日志空的 —— 用户看到的是「坏了」。这个面板把这段时间
   变成一件看得见的事：在下哪个文件、多少、还要多久，以及文件不会被上传。 */
const bootEl = { root: null, stat: null, label: null, pct: null, bar: null, note: null };
function bootInit() {
  bootEl.root = $("#boot"); bootEl.stat = $("#bootStat"); bootEl.label = $("#bootLabel");
  bootEl.pct = $("#bootPct"); bootEl.bar = $("#bootBar > i"); bootEl.note = $("#bootNote");
  $("#bootDrop").onclick = () => $("#file").click();
  for (const t of ["dragenter", "dragover"])
    $("#bootDrop").addEventListener(t, (e) => { e.preventDefault(); $("#bootDrop").classList.add("over"); });
  for (const t of ["dragleave", "drop"])
    $("#bootDrop").addEventListener(t, () => $("#bootDrop").classList.remove("over"));
}
const fmtMB = (b) => (b / 1048576).toFixed(1) + " MB";
let maxBootPct = 0;
/* phase: "load" 下载权重 / "compile" 编译会话 / "ready" 就绪 */
function bootState(phase, pct, label, note) {
  if (!bootEl.root) return;
  if (phase === "ready") {
    maxBootPct = 1;
    pct = 1;
  } else if (pct != null) {
    maxBootPct = Math.max(maxBootPct, pct);
    pct = maxBootPct;
  }
  bootEl.stat.className = "bstat " + (phase === "ready" ? "ready" : "loading");
  bootEl.label.textContent = label;
  bootEl.pct.textContent = phase === "ready" ? "" : (pct != null ? Math.round(pct * 100) + "%" : "");
  bootEl.bar.style.width = Math.round((pct ?? (phase === "ready" ? 1 : 0)) * 100) + "%";
  bootEl.note.textContent = note ?? "";
}
/* 有文件在结果区了就让位；没有就回来 */
function bootShow(v) { if (bootEl.root) bootEl.root.hidden = !v; }

/* ------------------------------------------------------- 文本层提取 */
/* 电子版 PDF 直接读嵌入文本：几乎零误差、零推理时间，
   与官方 indra 的 --mode auto 策略一致；扫描件没有文本层，自动回退 OCR。 */
/* PDF 的 text transform 里 y 是自页面底边向上量的，与 xycut 假设的「y 向下」相反，
   这里统一翻成自顶向下，否则整篇顺序会反过来。 */
const deKangxi = (str) => str.replace(/[\u2F00-\u2FD5]/g, (c) => c.normalize("NFKC"));
/* 只对康熙部首做单字 NFKC：整串 NFKC 会把全角标点（，：（））压成半角，中文会被毁掉。 */

async function pdfTextPage(pdfPage) {
  const vp1 = pdfPage.getViewport({ scale: 1 });
  const pageH = vp1.height, pageW = vp1.width;
  if (!Number.isFinite(pageH) || !Number.isFinite(pageW) || pageH <= 0 || pageW <= 0) return null;
  const tc = await pdfPage.getTextContent();
  const rows = new Map();
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4], y = pageH - it.transform[5], h = it.transform[0] || it.height || 10;
    const key = Math.round(y / (h * 0.4));
    let r = rows.get(key);
    if (!r) { r = { y, h, parts: [] }; rows.set(key, r); }
    r.parts.push({ x, w: it.width || 0, s: deKangxi(it.str), h });
    r.y = Math.max(r.y, y);
  }
  // 不按列沟切行：同一页里表格的单元格间距和分栏的列沟量级相同，切了会把表格也拆散，
  // 代价大于收益。两栏 PDF 在这里会左右交错，但两栏各自的文字完整、纵向顺序正确。
  const lines = [];
  for (const r of rows.values()) {
    r.parts.sort((a, b) => a.x - b.x);
    const h = Math.max(...r.parts.map((p) => p.h));
    let text = "", end = -Infinity;
    for (const part of r.parts) {
      const gap = part.x - end;
      // 间距超过半个字宽就补分隔符：表格里相邻单元格通常没有实际空格
      if (text && gap > h * 0.28 && !/\s$/.test(text) && !/^\s/.test(part.s)) {
        text += gap > h * 1.2 ? "  |  " : " ";
      }
      text += part.s;
      end = Math.max(end, part.x + part.w);
    }
    const x0 = Math.min(...r.parts.map((p) => p.x));
    const x1 = Math.max(...r.parts.map((p) => p.x + p.w));
    const t = text.replace(/\s+/g, " ").trim();
    if (t) lines.push({ box: [x0, r.y - h * 0.8, x1, r.y + h * 0.25], text: t });
  }
  if (!lines.length) return null;
  // 借用核心里的 XY-cut 做分栏排序
  const order = core.xycut(lines.map((l) => l.box), lines.map((_, i) => i));
  return order.map((i) => ({ ...lines[i], conf: 1 }));
}

function textToMarkdown(lines) {
  if (!lines.length) return "";
  const hs = lines.map((l) => l.box[3] - l.box[1]).sort((a, b) => a - b);
  const medH = hs[hs.length >> 1] || 1;
  const out = []; let para = [];
  const flush = () => { if (para.length) { out.push(para.join(" ")); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const t2 = lines[i].text;
    const tall = (lines[i].box[3] - lines[i].box[1]) > medH * 1.3;
    if (tall && t2.length < 80) { flush(); out.push("## " + t2); continue; }
    if (i > 0 && para.length) {
      const gap = lines[i].box[1] - lines[i-1].box[3];
      if (gap > medH * 0.9 || Math.abs(lines[i].box[0] - lines[i-1].box[0]) > medH * 0.6) flush();
    }
    para.push(t2);
  }
  flush();
  return out.join("\n\n");
}

/* ------------------------------------------------------------- 运行 */
/* 运行代号。换文件会让在跑的那次作废，它收尾时不能再碰界面 ——
   否则上一份文档的汇总会盖到新文件头上。 */
let runToken = 0;
let superseded = false;      // 被换文件作废（区别于用户主动停止）
let isRunning = false;       // 是否正在推理中
function stopRun() {
  stopped = true;
  isRunning = false;
  for (const e of engines) engineSend(e, "abort", {}).catch(() => {});
}
function supersedeRun() {
  runToken++;
  stopRun();
  superseded = true;
}

/* 把结果区清成「一份文档还没跑」的状态。
   换文件和「重新识别」都要走这里 —— 以前只有 ingest 清，run() 自己不清，
   于是点一下「重新识别」会把上一次的页留在原地：
   1 页 17 行 → 变成 2 页 34 行，同一份文档出现两遍。 */
function resetDoc() {
  pages = []; $("#overall").textContent = ""; $("#summary").textContent = "";
  setTrack(0); allCards = []; etaMs = 0;
  // 总览条现在随卡片逐个建，不清就会留着上一份的缩略图
  $("#docNav").innerHTML = ""; $("#docNav").hidden = true;
  $("#pages").innerHTML = ""; $("#docDots").hidden = true;
  $("#md").textContent = ""; $("#txt").textContent = ""; $("#json").textContent = "";
  renderSteps(0, true);          // 新一次运行，允许把高水位落回 0
  $("#btnRun").hidden = !current;
  $("#btnRun").textContent = t("rerun");
  retitle();
}

async function ingest(file) {
  // 正在跑就换文件是很自然的动作（发现拖错了）。原来这里不清 run，
  // 旧的那次会继续往已经清空的 pages 里塞结果，
  // 于是**上一份文档的页面会出现在新文件名下**。
  if (isRunning) supersedeRun();
  current = file;
  bootShow(false);
  resetDoc();
  log(`file ${file.name} · ${fmtBytes(file.size)}`);
  if (!modelInfo) await loadEngine();
  $("#btnRun").hidden = false;
  $("#btnRun").disabled = !modelInfo;
  autoStart();          // 模型已就绪 → 直接开跑；没就绪 → 下完再补
}

/* 选好文件就直接开跑，不用再点一次「开始」——
   这是一个只做一件事的工具，丢进去就是想看结果。
   走 #btnRun.click() 而不是直接调 run()：那个 click 里会把 stopped 复位，
   所以「上一轮手动停过，这次又选了新文件」也能正常开跑。 */
/* 跑着的时候改过设置 —— 已经提示过一次了吗 */
let staleHinted = false;
function autoStart() {
  if (!current || !modelInfo) return;       // 还没选文件，或模型没就绪
  if (isRunning) return;                    // 正在跑，别叠一次
  $("#btnRun").click();
}

/* 预渲染上限：一次性把所有页栅格化，卡片立刻可见；超出的页退回边渲边算 */
const PREPASS_MAX = 12;

async function run() {
  if (!current) return log(t("noFile"), "warn");
  if (!modelInfo) return log(t("notLoaded"), "warn");
  const my = ++runToken;               // 本次运行的代号
  superseded = false;                   // 新的一次开始，重新接管界面
  const stale = () => my !== runToken; // 已被换文件 / 重新开始作废
  const t0 = performance.now();
  activePage = null;
  // 「重新识别」不经过 ingest，这里必须自己清，否则上一次的页会叠上来
  if (pages.length || allCards.length) resetDoc();
  staleHinted = false;
  const useText = $("#ckText").checked;
  failedPages = 0; marksAll = {};
  beginRun(pageName(current), new Date().toTimeString().slice(0, 8));
  $("#btnRun").disabled = true; isRunning = true;
  renderSteps(1);
  /* 整个流程包在 try/catch/finally 里。缺了 finally 时任何意外
     （损坏的 PDF 页、Worker 崩了、内存吃紧）都会把界面永远留在
     「运行中」：开始按钮灰着、停止按钮亮着、步骤卡在中途、
     也没有汇总 —— 用户只能刷新，整份文档白跑。
     单页失败已经不会中断整份文档（见 runJob），这里兜的是
     连「一页都跑不完」的那种级别的意外。 */
  try {
  const isPdf = current.type === "application/pdf" || /\.pdf$/i.test(current.name);
  const jobs = [];                       // { card, bitmap, pdfPage, page, i, n, done }
  let more = null, docTotal = 1;         // more：预渲染上限之外的页，边渲边算
  // 窄屏上左栏占满一屏，点开始后直接带到结果，手机上不用往下翻
  const jump = matchMedia("(max-width:1000px)").matches;

  if (!isPdf) {
    let bmp;
    try {
      bmp = await createImageBitmap(current, { imageOrientation: "from-image" });
    } catch {
      bmp = await createImageBitmap(current);
    }
    buildDots(1);
    const card = makePageCard(pageName(current), "ocr");
    card.bitmap = bmp; card.showPreview();
    jobs.push({ card, bitmap: bmp, page: null, tag: "p0" });
    docTotal = 1;
  } else {
    const pdfjs = await import(PDFJS);
    pdfjs.GlobalWorkerOptions.workerSrc = PDFW;
    const doc = await pdfjs.getDocument({ data: await current.arrayBuffer() }).promise;
    log(`PDF ${doc.numPages} ${t("page")}`, "ok");
    const n = doc.numPages;
    docTotal = n;
    buildDots(n);                       // 必须在建卡之前，卡片靠 dotIdx 对应到自己的点
    // 建一张卡 + 栅格化一页的活抽出来，预渲染和边渲边算共用
    const makeJob = async (i) => {
      /* 栅格化本身也可能失败（损坏的页、内存吃紧）。先把卡片建出来，
         失败时才有地方标「这一页没读出来」；直接 throw 的话整份文档
         到此为止，而卡片连痕迹都没留下。 */
      const pg = await doc.getPage(i);
      const card = makePageCard(pageLabel(i, n), "ocr");
      let bmp;
      try {
        bmp = await renderPage(pg);
      } catch (e) {
        card.fail(e?.message || String(e));
        failedPages++;
        log(t("pageFailed", { n: e?.message || e }), "err");
        return null;
      }
      /* 换文件时会有已经在飞的这一页，它落地时整份运行已经作废了。
         不拦一下的话，会往已经清空的总览条里塞进上一份文档的缩略图。 */
      if (stopped) { card.root.remove(); bmp.close?.(); return null; }
      card.bitmap = bmp; card.showPreview(); addNavItem(card, n);
      // 位图被回收后，滚回来 / 点开时按这一页重新栅格化
      card.repage = async (thenLightbox) => {
        const again = await renderPage(pg);
        card.bitmap = again;
        card.paintPending();
        if (thenLightbox) openLightbox(card);
      };
      return { card, bitmap: bmp, page: pg, pdfPage: pg, i, n, tag: "p" + i };
    };
    // 先把头几页一次性铺开，让第一屏立刻有东西；超出的页在队列里边渲边算
    const pass = Math.min(n, PREPASS_MAX);
    for (let i = 1; i <= pass; i++) {
      if (stopped) break;
      stageNow("render"); setProgress(`${i} / ${n}`, "render");
      const j = await makeJob(i);
      if (j) jobs.push(j);
      await tickUI();
    }
    let cursor = pass;
    more = async () => {
      if (cursor >= n || stopped) return null;
      setProgress(`${cursor} / ${n}`, "render");
      const j = await makeJob(++cursor);
      if (!j) return more();               // 这一页废了，接着做下一页
      return j;
    };
    if (!stopped && n > pass) log(`prepass ${pass}/${n}`, "warn");
  }

  if (jump && jobs[0]?.card?.root) { await tickUI(); jobs[0].card.root.scrollIntoView({ behavior: "smooth", block: "start" }); }

  const done = await runQueue(jobs, useText, more, docTotal);
  if (stale()) return;
  const partial = stopped || done < docTotal;
  /* 被中断的页停在半路，卡片头上不能还写着「识别中」——
     那是在骗人。改成「已停止 · N 行」，并把行数按已收到的算。 */
  if (partial) {
    for (const c of allCards) {
      if (c.finished || !c.root) continue;
      c.root.classList.remove("busy");
      c.el.ms.textContent = `${t("halted")} · ${c.live.length} ${t("lines")}`;
    }
  }

  buildNav(pages.map((p) => p.__card).filter(Boolean));
  renderSteps(STAGES.length - 1);
  stageDone(STAGES.length - 1, performance.now() - t0);
  setTrack(partial ? (done / docTotal) * 100 : 100); setProgress("");
  etaMs = 0;
  $("#btnRun").disabled = false; isRunning = false;
  for (const id of ["#btnCopy", "#btnDl"]) { $(id).disabled = !pages.length; $(id).hidden = !pages.length; }
  renderOutputs(true);
  retitle();
  const totalMs = performance.now() - t0;
  const lines = pages.reduce((a, p) => a + p.lines.length, 0);
  const low = pages.reduce((a, p) => a + p.lines.filter((l) => l.conf < 0.8).length, 0);
  // 侧栏只报规模，顶栏再补上耗时和低置信数 —— 两处原本写同一串字，白白重复一遍。
  // 没跑完就把分母写出来，别让 200 页的文档报成「12 页」还像跑完了。
  const scope = partial ? `${done} / ${docTotal} ${t("page")}` : `${pages.length} ${t("page")}`;
  $("#overall").textContent = `${scope} · ${lines} ${t("lines")}`;
  $("#summary").textContent = `${scope} · ${lines} ${t("lines")} · ${fmtMs(totalMs)}${low ? ` · ${low} ${t("lowConf")}` : ""}`;
  if (failedPages) log(t("pagesFailed", { n: failedPages }), "err");
  if (partial) log(`${stopped ? "stopped" : "incomplete"}: ${done}/${docTotal} ${t("page")}`, "warn");
  log(`total ${fmtMs(totalMs)} · ${pages.length} ${t("page")} · ${lines} ${t("lines")}`, "ok");
  {
    const n = pages.length || 1;
    const mk = Object.entries(marksAll);
    if (mk.length > 1) log(`${t("mkAvg")} ` + mk.map(([k, v]) => `${t("mk_" + k)} ${fmtMs(v / n)}`).join(" · "));
  }
  endRun(pages.length, lines, fmtMs(totalMs));
  } catch (e) {
    log(`${t("runFailed")}: ${e?.message || e}`, "err");
    if (!pages.length) log(t("allFailed"), "err");
    if (!$("#summary").textContent) {
      const n = pages.length;
      $("#summary").textContent = n
        ? `${n} ${t("page")} · ${pages.reduce((a, p) => a + p.lines.length, 0)} ${t("lines")} · ${t("runFailed")}`
        : t("runFailed");
    }
  } finally {
    isRunning = false;
    if (stale()) return;               // 已经作废：界面归新的那次管，别去抢
    // 无论怎么收场，按钮和步骤都要回到可用的状态
    $("#btnRun").disabled = !current;
    $("#btnRun").hidden = !current;
    $("#btnRun").textContent = t("rerun");
    etaMs = 0;
    for (const c of allCards) {
      if (c.finished || !c.root || c.root.classList.contains("failed")) continue;
      c.root.classList.remove("busy");
      if (!c.el.ms.textContent) c.el.ms.textContent = t("halted");
    }
    if (!pages.length && !allCards.length) renderSteps(0, true);
    else { renderSteps(STAGES.length - 1); stageDone(STAGES.length - 1, performance.now() - t0); }
    retitle();
  }
}

async function renderPage(pg) {
  const vp = pg.getViewport({ scale: PDF_DPI / 72 });
  const off = new OffscreenCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const g = off.getContext("2d", { willReadFrequently: true });
  g.fillStyle = "#fff"; g.fillRect(0, 0, off.width, off.height);
  await pg.render({ canvasContext: g, viewport: vp }).promise;
  return createImageBitmap(off);
}

/* 一页的完整流程：文本层优先，否则送 Worker 跑 OCR */
let failedPages = 0;                      // 本次运行里失败的页数
let marksAll = {};                         // 本次运行逐段耗时的累计（跑完汇总一行）
async function runJob(job, useText) {
  const { card, bitmap, page, i, n } = job;
  const tPage = performance.now();
  const label = card.el.t.textContent;

  if (page && useText) {
    let tl = null;
    try { tl = await pdfTextPage(page); } catch { /* 文本层不可用则回退 OCR */ }
    if (tl && tl.length) {
      if (superseded) return;            // 同上：别把上一份文档的结果带过来
      const md = textToMarkdown(tl);
      // 文本层的框是 PDF 点（72 DPI），位图是 200 DPI 渲染的，统一换算到位图像素坐标系
      const k = PDF_DPI / 72;
      const tlPx = tl.map((l) => ({
        ...l,
        box: [Math.round(l.box[0] * k), Math.round(l.box[1] * k), Math.round(l.box[2] * k), Math.round(l.box[3] * k)],
        cjk: true
      }));
      const res = { label, pageNo: i, pageTotal: n, lines: tlPx, md, time: performance.now() - tPage, source: "text", det: null };
      pages.push(res); res.__card = card; job.done = true;
      cardsByTag.set(job.tag, card);
      card.crop = inkBox(card.bitmap) || contentBox(tlPx, card.bitmap);   // 同样按内容裁掉页边空白
      card.exact = true;                            // 文本层是精确结果：置信度 1.0
      card.root.classList.add("exact");
      card.setStage("done"); card.finish(res);
      bumpDot(job.tag, true);
      cardsByTag.delete(job.tag);
      return;
    }
  }

  // 页码进度由 runQueue 统一维护（已完成 / 总数），这里不再抢着写，
  // 否则同一个位置一会儿「3 / 12」一会儿「2 / 12」，数字会来回跳
  cardsByTag.set(job.tag, card);
  /* 整段都要在 try 里。传 Worker 的那份副本是 200 DPI 的一整页十几 MB，
     内存吃紧时 createImageBitmap 自己就会抛 —— 以前它在 try 外面，
     这种失败直接冲出 runJob，整份文档跟着完蛋。 */
  let send = null, eng = null;
  try {
    send = await createImageBitmap(bitmap);            // 传给 Worker 的是副本
    eng = await acquireEngine();
    eng.busy = true;
    activePage = card;
    const res = await engineSend(eng, "page", { bitmap: send, tag: job.tag }, [send]);
    /* 换文件之后这一页才回来：结果属于上一份文档，绝不能进新文档的 pages
       （会出现「1 页的 telegram 报成 2 页」）。 */
    if (superseded) return;
    job.done = true;
    if (res.rotation && card.bitmap && !card.rotated) {
      const k = Math.round(res.rotation / 90) % 4;
      if (k > 0) {
        const oldB = card.bitmap;
        card.bitmap = await rotateBitmap(oldB, k);
        card.rotated = true;
        oldB.close?.();
      }
    }
    const out = { label, pageNo: i, pageTotal: n, ...res, source: "ocr" };
    pages.push(out); out.__card = card;
    card.setStage("done");
    card.finish(out);
    bumpDot(job.tag, true);
  } catch (e) {
    /* 单页失败**不能拖垮整份文档**。以前这里直接 throw，一页坏了
       200 页的 PDF 就整体中断，而且 run() 没有 try/finally 兜底，
       按钮停在运行态、步骤卡在中途、也没有汇总 —— 只能刷新。
       现在标记这一页、记一笔，继续跑下一页。 */
    card.fail(e.message);
    bumpDot(job.tag, true);
    failedPages++;
    log(t("pageFailed", { n: e.message }), "err");
  } finally {
    if (eng) eng.busy = false;
    send?.close?.();
    cardsByTag.delete(job.tag);
  }
}

/* 页面总览：几十页文档也能一眼看完全文，点缩略图跳转。
   缩略图条目随卡片一起建，而不是全部跑完再补 —— 长文档跑完之后
   内存回收器早就把绝大多数页的位图放掉了，那时候再补就只有空白格子。 */
let navIO = null;
const NAV_MIN = 4;               // 少于这么多页就不摆总览条
function addNavItem(card, total) {
  if (total != null && total < NAV_MIN) return null;
  const nav = $("#docNav");
  if (nav.hidden) nav.hidden = false;
  const b = document.createElement("button");
  b.className = "navitem";
  b.title = card.el.t.textContent;
  const cv = document.createElement("canvas");
  cv.width = 108; cv.height = 144;
  const lab = document.createElement("span");
  lab.textContent = card.el.t.textContent;
  b.append(cv, lab);
  b.onclick = () => {
    card.root.scrollIntoView({ behavior: "smooth", block: "start" });
    // 目标页本来就在视口里的话 IntersectionObserver 不会再触发，
    // 高亮会留在旧的那页上——点一下没反应比不动更糟
    markNavActive(card);
  };
  nav.append(b);
  card.navBtn = b;
  card.navCanvas = cv;
  paintNav(card);
  return b;
}
function buildNav(cards) {
  const nav = $("#docNav");
  if (cards.length < NAV_MIN) { nav.hidden = true; return; }
  nav.hidden = false;
  // 补建：所有卡片都该有缩略图，缺哪个补哪个（老路径下这里会留下空格子）
  for (const c of cards) if (!c.navCanvas) addNavItem(c, cards.length);
}
/* 总览缩略图画整页，不裁剪。卡片里的预览裁到有字的那块（见 contentBox），
   但缩略图的职责是「这是第几页、长什么样」，裁掉页边就认不出了。 */
function paintNav(card) {
  if (card.navPainted || !card.bitmap || !card.navCanvas) return;
  card.navPainted = true;
  const cx = card.navCanvas.getContext("2d");
  const b = card.bitmap;
  cx.fillStyle = "#fff"; cx.fillRect(0, 0, 108, 144);
  const s = Math.min(108 / b.width, 144 / b.height);
  const w = b.width * s, h = b.height * s;
  cx.drawImage(b, (108 - w) / 2, (144 - h) / 2, w, h);
  card.navBtn?.classList.add("ready");
}
function markNavActive(card) {
  const btn = card.navBtn;
  if (!btn) return;
  // 一次滚动要触发十几次，页数多时每次全表清类纯属浪费
  if (btn.classList.contains("active")) { keepNavInView(btn); return; }
  for (const c of document.querySelectorAll(".navitem.active")) c.classList.remove("active");
  btn.classList.add("active");
  keepNavInView(btn);
}
function keepNavInView(btn) {
  /* 200 页的文档总览条要横着滚两屏，滚到第 150 页时条上还停在第 1 页。
     把当前页带进视野 —— 只动总览条自己的 scrollLeft，不带动正文。 */
  const nav = $("#docNav");
  if (!nav || nav.scrollWidth <= nav.clientWidth + 4) return;
  const b = btn.getBoundingClientRect(), n = nav.getBoundingClientRect();
  if (b.left >= n.left + 8 && b.right <= n.right - 8) return;   // 已经在视野里就别动
  nav.scrollTo({ left: btn.offsetLeft - (nav.clientWidth - b.width) / 2, behavior: "smooth" });
}

/* 当前页高亮原来跟着「刚进入观察范围的那张卡」走，而观察器有 600px 的预热边距，
   最后进来的一张自然比真实视口靠前 —— 8 页文档实测恒定领先 2 页：
   滚到顶时总览条停在「页 3/8」，眼前却是第 1 页；滚到 60% 时是 7，真实是 5。
   改成每次从全部卡片里挑**还在视口内、且最靠上**的那一张。 */
let navSyncQueued = false;
function syncNavActive() {
  if (navSyncQueued) return;
  navSyncQueued = true;
  requestAnimationFrame(() => {
    navSyncQueued = false;
    const root = $("#views");
    if (!root || !allCards.length) return;
    const top = root.getBoundingClientRect().top;
    let best = null;
    for (const c of allCards) {
      const r = c.root.getBoundingClientRect();
      if (r.bottom <= top + 1) continue;      // 已经滚过去了
      if (!best || r.top < best.top) best = { card: c, top: r.top };
    }
    if (best) markNavActive(best.card);
  });
}

/* 页面进度点：一眼看出整体推进到哪 */
const cardsByTag = new Map();
let dotRoot = null, dotSeq = 0;
/* 页码圆点。几百页时一排 200 个点是没法看的，也塞不进顶栏 ——
   超过阈值就整个不画，页码进度改由「逐页识别」那一步右侧的 n / N 承担，
   页面总览条也还在，两者都不受影响。 */
const DOTS_MAX = 40;
function buildDots(total) {
  const box = $("#docDots");
  box.innerHTML = "";
  dotRoot = []; dotSeq = 0;
  box.hidden = total <= 1 || total > DOTS_MAX;
  if (box.hidden) return;
  for (let i = 0; i < total; i++) {
    const d = document.createElement("i");
    d.className = "dot2";
    box.append(d);
    dotRoot.push(d);
  }
}
function bumpDot(tag, done) {
  const el = dotRoot?.[cardsByTag.get(tag)?.dotIdx];
  if (el) el.classList.add(done ? "fin" : "run");
}

const mode_of = (c) => (c.root.classList.contains("done") ? "done" : (c.boxes ? "live" : "boxes"));
/* 卡片进视口才画预览：几十页文档一次性铺满 canvas 会明显卡 */
let cardIO = null;
function initCardObserver() {
  if (cardIO) return;
  cardIO = new IntersectionObserver((es) => {
    for (const e of es) e.target.__card?.setVisible(e.isIntersecting);
  }, { root: $("#views"), rootMargin: "600px 0px" });
}
const tickUI = nextTick;
/* 步骤高亮只表示文档走到哪一步；单页此刻在做什么写在这一行里。
   两者分开，进度条才只会往前不会往回。 */
function setProgress(v, stage) {
  if (superseded) return;              // 作废的那次不许再动界面
  const el = $("#overall");
  if (el) el.textContent = [v, stage && ACT_LABEL[stage] && t(ACT_LABEL[stage])].filter(Boolean).join(" · ");
  // v 为 null 表示「只更新细活，别动进度点」；传 "" 才是收尾
  const box = $("#docDots");
  if (box && v !== null && v !== undefined) box.hidden = !v;
}

function stageNow(name) {
  renderSteps(STAGE_IDX[name] ?? 0);
}

/* 三个结果页的**原始文本**。屏幕上是加了结构着色的版本，
   但复制 / 下载必须逐字节拿到这里存的这份 —— 着色只是呈现，不能改内容。 */
const RAW = { md: "", txt: "", json: "" };

/* JSON 一行一个文本对象。原来 JSON.stringify(…, null, 1) 会把每个 box 的
   5 个坐标各占一行，188 行就是 900 多行坐标把内容埋掉；现在每行文本一行、
   坐标收在同一行里，密度高 5 倍，仍是合法 JSON。
   坐标保留两位小数：模型吐出的是 16 位有效数字，而这是 200 DPI 下的
   像素坐标，0.01 px 远比任何人会用到的精度细，留着只会让每行长一倍、
   把真正要看的文字挤出视野。 */
function buildJson() {
  const one = (p) =>
    "    {\n" +
    `      "page": ${JSON.stringify(p.label)}, "ms": ${Math.round(p.time)}, "source": ${JSON.stringify(p.source)},\n` +
    '      "lines": [\n' +
    p.lines.map((l) =>
      `        { "box": [${l.box.map((n) => +n.toFixed(2)).join(", ")}], ` +
      `"text": ${JSON.stringify(l.text)}, "conf": ${l.conf} }`
    ).join(",\n") +
    "\n      ]\n" +
    "    }";
  return "[\n" + pages.map(one).join(",\n") + "\n]\n";
}

function renderOutputs(force = false) {
  if (!pages.length) return;
  const multi = pages.length > 1;
  const head = (p) => (multi ? `## ${p.label}\n\n` : "");
  RAW.md = pages.map((p) => head(p) + p.md).join("\n\n");
  RAW.txt = pages.map((p) => (multi ? p.label + "\n" : "") + p.lines.map((l) => l.text).join("\n")).join("\n\n");
  RAW.json = buildJson();

  // 若处于流式处理且停留在工作流页签，暂不生成成千上万个高亮 DOM 节点，避免主线程卡顿
  const cur = activeTab();
  if (force || cur === "md") paintMd($("#md"), RAW.md);
  if (force || cur === "json") paintJson($("#json"), RAW.json);
  if (force || cur === "txt") $("#txt").textContent = RAW.txt;
}


/* 结果页的结构着色。只改呈现，不改内容 —— 逐字符用 textContent 写，
   不拼 innerHTML，OCR 出来的文字里带尖括号也安全。 */
const span = (cls, text) => { const s = document.createElement("span"); s.className = cls; s.textContent = text; return s; };

/* Markdown：采用 marked 开源库进行完整规范的 CommonMark/GFM 渲染 */
function paintMd(el, text) {
  if (!text) {
    el.innerHTML = "";
    const s = $("#mdSource");
    if (s) s.textContent = "";
    return;
  }
  try {
    el.innerHTML = marked.parse(text);
  } catch (err) {
    el.textContent = text;
  }
  const s = $("#mdSource");
  if (s) s.textContent = text;
}

/* JSON：键 / 字符串 / 数字 / 标点分层。38 KB 全部同色时根本读不动。 */
const JSON_RE = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)|([{}\[\],])/g;
function paintJson(el, text) {
  el.textContent = "";
  let last = 0, m;
  JSON_RE.lastIndex = 0;
  while ((m = JSON_RE.exec(text))) {
    if (m.index > last) el.append(document.createTextNode(text.slice(last, m.index)));
    const cls = m[1] ? "jk" : m[2] ? "js" : m[3] ? "jn" : "jp";
    el.append(span(cls, m[0]));
    last = m.index + m[0].length;
  }
  if (last < text.length) el.append(document.createTextNode(text.slice(last)));
}

let stopped = false;

/* --------------------------------------------------------------- 交互 */
/* 上传入口统一到**中间那块**（空状态面板里的拖入框），侧栏那个删掉了。
   顶栏留一个常驻的「选择文件」，因为空状态跑完就隐藏了，
   那时如果只有中间那块，就再也没有地方能换文档（手机上侧栏默认折叠）。
   拖放绑在整个窗口上 —— 拖到侧栏或结果区上也应该接住，
   以前只绑在一个小方框上，拖错地方毫无反应，看着像坏了。 */
function initDrop() {
  const veil = $("#dropveil"), input = $("#file"), dropZone = $("#bootDrop");
  dropZone.onclick = () => input.click();
  input.onchange = (e) => { e.target.files[0] && ingest(e.target.files[0]); input.value = ""; };

  let depth = 0;                                  // 拖过子元素会反复触发 dragleave，用计数配平
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  addEventListener("dragenter", (e) => { if (!hasFiles(e)) return; e.preventDefault(); if (++depth === 1) veil.hidden = false; });
  addEventListener("dragover", (e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } });
  addEventListener("dragleave", (e) => {
    if (!hasFiles(e)) return;
    // 拖出窗口时浏览器不一定补齐 dragleave，relatedTarget 为空就说明人已经走了
    if (e.relatedTarget === null) { depth = 0; veil.hidden = true; return; }
    if (--depth > 0) return;
    depth = 0; veil.hidden = true;
  });
  addEventListener("dragend", () => { depth = 0; veil.hidden = true; });
  addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); depth = 0; veil.hidden = true;
    const f = e.dataTransfer.files[0];
    if (f) ingest(f);
  });
  addEventListener("paste", (e) => {
    const f = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"))?.getAsFile();
    if (f) ingest(f);
  });
  $("#btnRun").onclick = () => {
    if (!current) return $("#file").click();     // 没有文件时，这枚按钮就是入口
    if (isRunning) return;
    stopped = false;
    runToken++;                        // 上一次（若有）就此作废
    setTrack(0);
    renderSteps(1);
    run().catch((e) => { log("run failed: " + e.message, "err"); isRunning = false; });
  };
  $("#btnCopy").onclick = copyActive;
  $("#btnDl").onclick = downloadActive;
  retitle();                 // 一上来就把两个按钮摁灰：还没有任何结果可导
  // 设置默认收起，但要记住用户的选择（改过灵敏度的人不该每次都要重新展开）
  const setSec = $("#secSettings");
  if (setSec) {
    const saved = localStorage.getItem(LS.settings);
    if (saved !== null) setSec.open = saved === "1";
    setSec.addEventListener("toggle", () => localStorage.setItem(LS.settings, setSec.open ? "1" : "0"));
  }
  $("#ckBox").onchange = () => {
    for (const p of pages) { if (p.__card?.bitmap) drawPreview(p.__card, p.lines); }
    // 灯箱里的框是画进缓冲的，开关变了要重画一次（缩放不重画）
    if (lbCard && !$("#lightbox").hidden) paintLightbox(true);
    saveOpts();
  };
  /* 设置是**下次运行**才生效的。选好文件会自动开跑，所以「跑着的时候改设置」
     是一件很自然会做的事，不提示的话就是「我改了，怎么没反应」。
     只提示一次，等用户重跑完自然消失（清在 run() 开头）。 */
  ["#selRes", "#selConf", "#ckText"].forEach((s) => $(s).addEventListener("change", () => {
    saveOpts();
    pushOpts();
    if (staleHinted || !isRunning) return;   // 没在跑就不必提示
    staleHinted = true;
    log(t("settingPending"), "warn");
  }));
  $("#btnRail").onclick = () => {
    document.body.classList.toggle("rail-off");
    localStorage.setItem(LS.rail, document.body.classList.contains("rail-off") ? "0" : "1");
    requestAnimationFrame(() => { for (const p of pages) p.__card?.repaint(p.lines, "done"); });
  };
  /* 手机上默认收栏：侧栏一屏装满「拖入框 + 工作流 + 设置 + 快捷键」，
     把标题、拖入框和模型进度全挤到折叠线以下。空状态自己带一个拖入框，
     所以折叠起来不丢功能。用户手动开合过的就按他的选择走。 */
  const railSaved = localStorage.getItem(LS.rail);
  if (railSaved !== null) document.body.classList.toggle("rail-off", railSaved === "0");
  else document.body.classList.toggle("rail-off", matchMedia("(max-width:760px)").matches);
  $("#lang").value = LANG;
  $("#lang").onchange = (e) => { LANG = e.target.value; localStorage.setItem(LS.lang, LANG); applyI18n(); };
  $("#btnTheme").onclick = () => {
    themePref = themePref === "auto" ? "light" : themePref === "light" ? "dark" : "auto";
    localStorage.setItem(LS.theme, themePref);
    applyTheme();
  };
  $("#btnClearLog").onclick = () => { clearLog(); newLogGroup("", { key: "startup" }); log(t("logCleared"), "ok"); };
  $("#lbClose").onclick = () => closeLightbox();
  // 缩放只是改画布的 CSS尺寸，不重画；上限是 100%（位图原始像素），
  // 再往上没有新信息，以前却能一路加到 6 倍，白占几十 MB 画布内存
  $("#lbIn").onclick = () => { lbZoom = Math.min(lbMaxZoom || 1, lbZoom * 1.3); layoutLightbox(); };
  $("#lbOut").onclick = () => { lbZoom = Math.max(0.15, lbZoom / 1.3); layoutLightbox(); };
  $("#lbFit").onclick = () => { lbZoom = 1; layoutLightbox(); };
  $("#lightbox").onclick = (e) => { if (e.target.id === "lightbox") closeLightbox(); };
  addEventListener("keydown", (e) => {
    // 灯箱打开时，方向键是逐行走而不是翻页 —— 放大看就是为了核对某一行
    if (lbCard && !$("#lightbox").hidden) {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); lbStep(1); return; }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); lbStep(-1); return; }
    }
    if (e.key === "Escape") { if (lbCard) closeLightbox(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); if (!$("#btnRun").disabled) $("#btnRun").click(); }
    if ((e.metaKey || e.ctrlKey) && (e.key === "u" || e.key === "U" || e.key === "o" || e.key === "O")) { e.preventDefault(); $("#file").click(); }
  });
  // 手机/触屏没有物理键盘，这一行是噪音；⌘ 也要按平台换成 Ctrl
  const mod = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl+";
  // ⌘↵ 开始识别 已经没意义了：选好文件会自动跑，只留还真实存在的两条
  $("#kbdHint").innerHTML = [
    [mod + "U", t("kbdOpen")],
  ].map(([k, v]) => `<span><b>${k}</b> ${v}</span>`).join("");

  $("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $$("#tabs button").forEach((x) => x.setAttribute("aria-selected", x === b));
    ["pages", "md", "txt", "json"].forEach((k) => ($("#tab-" + k).hidden = k !== b.dataset.tab));
    if (b.dataset.tab === "pages") {
      for (const c of allCards) {
        c.visible = true;
        if (!c.bitmap && c.repage) c.repage();
        else if (c.pending) c.paintPending();
        else if (c.bitmap && c.live?.length) drawPreview(c, c.live, "done");
      }
    }
    renderOutputs(true);
    retitle();
  });

  $("#mdModeSeg")?.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $$("#mdModeSeg button").forEach((x) => x.setAttribute("aria-selected", x === b));
    const isSrc = b.dataset.mode === "source";
    $("#md").hidden = isSrc;
    $("#mdSource").hidden = !isSrc;
  });
}

function init() {
  initCardObserver();
  foldAll();                          // 折叠组件初始化
  /* 当前页高亮跟**滚动**走，不跟 IntersectionObserver 走：
     卡片画完就被 unobserve 了（省资源），那一路事件从此不再来，
     高亮会冻在最后一次触发的那一页，滚到哪儿都不动了。 */
  $("#views").addEventListener("scroll", syncNavActive, { passive: true });
  applyTheme();
  restoreOpts();
  applyI18n();
  bootInit();
  bootShow(true);
  bootState("load", 0, t("bootLoad"), t("bootWait"));
  initDrop();
  $("#resHint").textContent = t("resHint");
  bootEngine().then(() => loadEngine());
}
init();

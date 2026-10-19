# INDRA OCR Web · In-Browser Document Recognition & Parsing

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Model Weights](https://img.shields.io/badge/Model-OpenRAIL--M-orange.svg)](https://huggingface.co/datalab-to/indra-ocr)
[![ONNX Runtime Web](https://img.shields.io/badge/ORT_Web-v1.22.0-purple.svg)](https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/)
[![Zero Upload](https://img.shields.io/badge/Privacy-100%25_On--Device-success.svg)](#)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Cloudflare_Workers-F38020.svg)](https://indra-web.firetable.tech)

> 🌐 **Language / 语言**: **[English Documentation](#english)** · **[中文完整技术文档](#中文文档)**
>
> 🚀 **Live Demo**: [https://indra-web.firetable.tech](https://indra-web.firetable.tech) · Worker Mirror: [https://indra-web.firetable.workers.dev](https://indra-web.firetable.workers.dev)
>
> 💡 **Mission**: Built to give developers, researchers, and users the **fastest, zero-barrier way to experience Datalab's [Indra OCR](https://github.com/datalab-to/indra)** directly in any browser — zero Python setup, zero CUDA dependencies, and 100% client-side privacy.

---

<a id="english"></a>
## English

> [!IMPORTANT]
> **Community Port & Upstream Attribution**:
> This repository is an unofficial, community-driven in-browser port of [Indra OCR](https://github.com/datalab-to/indra), created by **[Datalab](https://github.com/datalab-to)** (Vik Paruchuri et al.).
> - **Upstream Python Engine**: [github.com/datalab-to/indra](https://github.com/datalab-to/indra)
> - **Official Model Weights**: [huggingface.co/datalab-to/indra-ocr](https://huggingface.co/datalab-to/indra-ocr)
> - **Purpose of this Project**: Upstream Indra requires a full Python 3.10+ and PyTorch/ONNX runtime setup. This web port packages the entire pipeline into WebAssembly so anyone can immediately test and evaluate Indra OCR's layout-aware parsing on images and PDFs in 5 seconds.

### ⚡ 3 Ways to Experience Indra OCR Web

1. **🌐 Instant Web Demo (Fastest & Zero Setup)**:
   - Visit **[https://indra-web.firetable.tech](https://indra-web.firetable.tech)**.
   - All neural models run locally in your browser via multi-threaded WebAssembly. Documents and images are **never uploaded** to any server.
2. **📦 Offline Single-File HTML (Portable & Air-Gapped)**:
   - Download the prebuilt **[`indra-ocr.html`](dist/index.html)** (~112 KB single file).
   - Serve it via any local static server (e.g. `npx serve` or `python3 serve.py`). Combined with local model weights, it operates completely air-gapped without internet access.
3. **💻 Developer Quickstart (Modern Vite Pipeline)**:
   - Clone this repo, run `npm install && npm run dev`, and start building or customizing your in-browser document processing pipeline.

```
┌────────────────────────────────────────────────────────┐
│                   Main Browser Thread                  │
│  UI Cards · Streaming Progress · Markdown/JSON Views   │
│  PDF.js Vector Text Layer (3 ms instant fast path)     │
└──────────────────────────┬─────────────────────────────┘
                           │ postMessage (RPC / Events)
┌──────────────────────────▼─────────────────────────────┐
│                    Dedicated Web Worker                │
│  ONNX Runtime Web (WASM + Multi-threading SAB)         │
│  det.onnx ➔ script.onnx ➔ rec.onnx / rec_cjk ➔ order   │
└────────────────────────────────────────────────────────┘
```

### Highlights & Key Capabilities

- **100% Private & Zero-Upload**: Complete client-side document processing. Ideal for confidential contracts, financial statements, medical records, and NDAs. Strictly zero telemetry, trackers, or remote storage.
- **WASM Multi-Threading via SharedArrayBuffer**: Enabled by `Cross-Origin-Embedder-Policy: credentialless`, achieving up to **23× speedup** with 4 CPU threads over single-threaded WebAssembly.
- **Full 5-Model Neural Architecture in Web Worker**:
  1. `det.onnx`: DBNet-based line text detection.
  2. `script.onnx`: Adaptive script classifier (routes Latin vs. CJK characters).
  3. `rec.onnx` & `rec_cjk.onnx`: CRNN recognition with dynamic width binning.
  4. `order.onnx`: Graph-based reading order and layout cluster sorting.
- **Dual-Engine Strategy**: Instant extraction from vector PDF text layers (0-inference, ~3 ms) with automatic fallback to full neural OCR for scanned pages.
- **Interactive Visual Verification**:
  - Bidirectional hover linking between recognized text lines and bounding boxes on the document canvas.
  - Confidence-score color highlights (amber warnings for low-confidence tokens).
  - High-performance lightbox with keyboard navigation (`↑`/`↓`/`←`/`→`) and CSS-transform viewport scaling (capped memory footprint).
- **Scale-Tested on 200-Page Enterprise Documents**: Stream-and-recycle bitmap pipeline keeping peak JS heap usage under ~41 MB.
- **Production Edge Deployment**: Ready for Cloudflare Workers / Cloudflare Pages with zero backend dependencies.

---

### Quickstart

#### Option 1: Modern Vite Pipeline (Recommended)

```bash
# Install dependencies
npm install

# Start local dev server with HMR and Cross-Origin Isolation headers (port 8792)
npm run dev

# Build production single-file bundle (dist/index.html, indra-ocr.html, index.html)
npm run build

# Preview production build locally with isolation headers
npm run preview

# Run automated engineering test suite
npm test

# Build Cloudflare Worker deployment bundle
npm run build:worker
```

#### Option 2: Native Python (Legacy Fallback)

> **Note**: Modern engineering uses Vite (`npm run dev` / `npm run build`). Python scripts are preserved solely as a fallback for environments without Node.js.

```bash
# Start local isolated server
python3 serve.py

# Legacy string concat build
python3 build/build.py
```

> **Why do we need a dedicated local server if the production build is pure static HTML?**
>
> In production, this project is a **100% static single-file web application**. However, when opening files locally via `file://`, modern browsers block Web Workers and WASM module instantiation for security reasons. Furthermore, multi-threaded WebAssembly (`SharedArrayBuffer`) strictly mandates two Cross-Origin Isolation HTTP headers:
> ```http
> Cross-Origin-Opener-Policy: same-origin
> Cross-Origin-Embedder-Policy: credentialless
> ```
> Both `npm run dev` (Vite) and `python3 serve.py` serve static files with these required isolation headers — **they contain zero server-side OCR or backend application logic**.

---

### Pipeline Architecture

```
                       Input File (Image or PDF)
                                   │
                    ┌──────────────┴──────────────┐
                    │ Is Digital PDF (Text Layer) │
                    └──────┬───────────────┬──────┘
                   Yes (3ms)               No (Scan / Image)
                           │               │
                 pdf.js Extraction         ▼
                           │        Rasterize at 200 DPI
                           │               │
                           │        det.onnx (Text Detection)
                           │               │
                           │        inkBox Auto-Crop & Bounding Boxes
                           │               │
                           │        script.onnx (CJK vs. Latin Routing)
                           │               │
                           │        rec.onnx / rec_cjk.onnx (Batched CRNN)
                           │               │
                           │        order.onnx (Reading Order Clustering)
                           │               │
                           └───────►───────┴────────┐
                                                    ▼
                                          Markdown / Text / JSON
```

---

### Performance Benchmarks

Measured on Apple Silicon / modern x86 workstation:

| Mode / Workload | Single Thread (Standard HTTP) | 4-Thread WASM (`credentialless`) | Speedup |
|---|---|---|---|
| Dual-Column Document (138 lines) | 14,500 ms | **620 ms** | **23.4×** |
| Chinese Essay (41 lines) | 4,200 ms | **371 ms** | **11.3×** |
| Digital PDF (3 pages, text layer) | 3 ms | **3 ms** | Instant |
| 200-Page Enterprise PDF (streaming) | — | **57.3 s** | ~285 ms/page |

---

### Repository Structure

```
indra-web/
├── .github/workflows/      # Automated CI/CD pipelines
│   └── ci.yml              # Multi-version Node.js build & test workflow
├── src/                    # Modern modular source code
│   ├── core/               # Pure neural OCR pipeline (zero DOM, ESM)
│   │   ├── index.js        # Pipeline coordinator & Web Worker dispatcher
│   │   ├── detection.js    # DBNet connected components & adaptive scaling
│   │   ├── recognition.js  # CRNN batching & width-binning inference
│   │   ├── order.js        # Reading order clustering & XY-cut algorithms
│   │   ├── image.js        # OpenCV INTER_AREA/LINEAR scaling simulation
│   │   ├── markdown.js     # Block classification to Markdown synthesis
│   │   └── constants.js    # Model constants, thresholds, and event yields
│   └── types/              # Complete TypeScript declarations
│       └── index.d.ts      # Full types for OCRLine, OCRPageResult, OCROptions
├── test/                   # Automated engineering test suite
│   └── run-tests.mjs       # Artifact validation & algorithm unit tests
├── vite.config.mjs     # Vite configuration (viteSingleFile & COOP/COEP isolation headers)
├── scripts/
│   └── sync-dist.mjs   # Synchronizes dist/index.html to root HTML and deploy/html.js
├── dist/
│   └── index.html      # Production standalone single-file bundle (112 KB, minified)
├── deploy/             # Cloudflare Worker edge deployment
│   ├── worker.js       # Lightweight edge router (injects COOP/COEP headers)
│   ├── build.mjs       # Bundles indra-ocr.html into deploy/html.js
│   └── wrangler.toml   # Cloudflare Worker & route configuration
├── serve.mjs           # Node.js development server with cross-origin isolation
├── serve.py            # Python fallback development server
├── manifest.webmanifest# PWA Web App Manifest (installable on desktop & mobile)
├── package.json        # Modern npm scripts, exports, and metadata
├── LICENSE             # Apache 2.0 License + OpenRAIL-M weight attribution
├── CITATION.cff        # Citation metadata for academic and engineering use
└── index.html          # Standalone self-contained web application (dist sync)
```

---

### Programmatic Library Usage

In addition to the turnkey web UI, the core OCR engine can be imported directly into your own web applications or workers:

```javascript
import { loadModels, ocrPage, toMarkdown } from 'indra-web';

// 1. Initialize models with onnxruntime-web
await loadModels({
  threads: 4,
  onProgress: ({ file, done }) => console.log(`Loading ${file}: ${(done * 100).toFixed(0)}%`),
});

// 2. Perform OCR on any ImageBitmap, Canvas, or Image element
const result = await ocrPage(imageBitmap, {
  boxes: (boxes) => console.log(`Detected ${boxes.length} text lines`),
  line: ({ text, conf }) => console.log(`Recognized: ${text} (${conf.toFixed(2)})`),
});

console.log("Structured Markdown:\n", result.md);
console.log("Lines in Reading Order:\n", result.lines);
```

---

### Licensing & Compliance Analysis

This project adheres to the highest open-source licensing standards. Below is an exhaustive breakdown of our licensing architecture:

#### 1. Source Code (`indra-web`)
- **License**: **Apache License, Version 2.0**.
- **Scope**: All original JavaScript/TypeScript port code, build scripts, interface templates, CSS, and edge deployment scripts in this repository.
- **Third-Party Code Components**:
  - `pdfjs-dist`: Apache License 2.0 (Copyright Mozilla & contributors).
  - `onnxruntime-web`: MIT License (Copyright Microsoft Corporation).
  - Inline SVG icons: ISC License (Lucide project).

#### 2. Upstream Indra OCR & Model Weights
- **Upstream Repository**: [`datalab-to/indra`](https://github.com/datalab-to/indra) (Apache License 2.0).
- **Model Weights Repository**: [`datalab-to/indra-ocr`](https://huggingface.co/datalab-to/indra-ocr) on Hugging Face (`det.onnx`, `script.onnx`, `rec.onnx`, `rec_cjk.onnx`, `order.onnx`).
- **Weights License**: **Modified OpenRAIL-M** by Datalab:
  - **Free of charge** for academic research, personal use, and commercial entities with annual revenue or aggregate funding **under $20,000,000 USD**.
  - **Restriction**: Must not be used to create or operate a commercial service competing directly with Datalab's cloud API offerings.
  - Entities exceeding $20M USD or requiring unrestricted commercial rights must contact Datalab directly for a commercial license.

#### 3. Why Our Web Port Complies Fully
1. **Zero Weight Redistribution**: This repository **never bundles, mirrors, or redistributes** any `.onnx` weight files or vocabulary binaries. The git repository is strictly source code.
2. **Direct Client-Side Runtime Fetch**: When a user launches the web interface, the client browser directly fetches the original model weights from the official Hugging Face repository (`https://huggingface.co/datalab-to/indra-ocr`) into the local browser cache.
3. **Open-Source Non-Commercial Port**: This repository is a technical demonstration showcasing in-browser WebAssembly AI inference. It does not operate a paid or competing cloud service.
4. **Explicit Downstream Disclaimer**: Downstream commercial adopters are explicitly notified of Datalab's OpenRAIL-M terms in both `LICENSE` and this documentation.

---

### Citation

If you use or reference this project in your research or engineering, please cite:

```bibtex
@software{indra_web_2026,
  title        = {INDRA OCR Web: In-Browser Client-Side Document Recognition & Parsing},
  author       = {FireTable and Contributors},
  year         = {2026},
  url          = {https://indra-web.firetable.tech},
  note         = {Port of Datalab Indra OCR to ONNX Runtime Web}
}
```

---

<a id="中文文档"></a>
## 中文文档

# INDRA OCR Web · 纯浏览器端文档识别与版面解析

> **项目初衷**：上游 Datalab 推出的 [Indra OCR](https://github.com/datalab-to/indra) 是一个具备前沿版面感知、阅读顺序聚类与高精 CRNN 识别的优秀开源模型。然而，原版基于 Python / PyTorch / CUDA 运行，需要繁琐的环境配置与依赖安装。  
> **本项目旨在让所有开发者、研究者与普通用户，能够「零门槛、免配环境、秒级体验」Indra OCR 的端侧运行版本**——将完整的 5-模型神经推理管线搬进浏览器 WebAssembly 运行时，单文件轻量运行，文档 100% 不离开本机！

---

### 🤝 上游致谢与血统声明 (防坑必读 · 开源合规)

为确保开源项目的透明度与法律合规，特在此作清晰说明（拒绝一切模棱两可与版权风险）：

1. **官方上游归属**：
   - 本项目为**非官方社区纯前端移植版**。
   - 模型架构、训练权重与核心算法均归属于 **[Datalab](https://github.com/datalab-to)** 团队（原作者 Vik Paruchuri 等）。在此向 Datalab 团队在开源文档智能领域的开创性工作致以最高敬意！
   - 官方 Python 核心仓库：[`https://github.com/datalab-to/indra`](https://github.com/datalab-to/indra)
   - 官方 Hugging Face 权重：[`https://huggingface.co/datalab-to/indra-ocr`](https://huggingface.co/datalab-to/indra-ocr)
2. **零模型转存 / 零权重打包**：
   - 本 GitHub 仓库**绝不包含、不转存、不镜像分发**任何 Datalab 官方的 `.onnx` 权重文件或词典文件（仓库体积仅为纯源码级别）。
   - 用户打开应用后，由浏览器直接通过 HTTPS 从 Hugging Face 官方地址拉取模型并保存在本地 IndexedDB / Cache 存储中。
3. **模型商业许可协议 (Modified OpenRAIL-M)**：
   - Datalab 官方模型权重采用**修改版 OpenRAIL-M** 协议。
   - 高校科研、个人学习以及**年营收或累计融资金额在 2,000 万美元以下**的企业可**免费**使用。
   - **严格禁止**用于搭建与 Datalab 官方商业 API 存在直接竞争关系的云端付费识别服务。年营收超过 2,000 万美元或需要完全无限制商业权利的企业，须联系 Datalab 获得官方授权。
4. **功能移植边界与差异说明**：
   - ✅ **已完全移植**：DBNet 行文本检测（`det.onnx`）、汉字/西文自适应路由（`script.onnx`）、分桶 CRNN 行识别（`rec.onnx` / `rec_cjk.onnx`）、图聚类阅读顺序（`order.onnx`）、PDF.js 矢量文本层秒级提取（~3 ms）。
   - ⚠️ **暂未移植**：官方 Python 版本的公式识别（`--math`）及倾斜纠偏（`orient.onnx`）；复杂表格当前按单元格行序输出，未组合为 Markdown 表格栅格。

---

### 🚀 三种极速体验方式

无论你是想快速试用效果、离线内网部署，还是进行二次开发，都有对应路径：

| 体验路径 | 适用场景 | 获取/运行方式 |
|---|---|---|
| **🌐 在线即开即用** *(最推荐)* | 免安装、免配置，任何设备即开即用 | 访问正式域名 **[https://indra-web.firetable.tech](https://indra-web.firetable.tech)**（备用：[indra-web.firetable.workers.dev](https://indra-web.firetable.workers.dev)） |
| **📦 离线单文件运行** | 内网断网、离线涉密、独立交付 | 下载打包产物 **[`indra-ocr.html`](dist/index.html)**（约 112 KB），通过本地静态服务器（如 `python3 serve.py` 或 `npx serve`）即可启动，设置中可直接加载本地模型文件 |
| **💻 现代化前端工程开发** | 二次开发、调试、贡献代码 | 本地克隆后运行 `npm install && npm run dev`（内置 Vite HMR 与跨源隔离响应头） |

---

### 快速上手与本地运行

```bash
# 方式一：现代 Vite 工具链（推荐，极速开发与高压缩比打包）
npm install                 # 安装依赖
npm run dev                 # 启动 Vite 开发服务（端口 8792，自带 HMR 与跨源隔离头）
npm run build               # Vite 现代化打包：AST 解析、Tree-shaking、CSS/JS 深度压缩（由 184 KB 优化至 112 KB）
npm run preview             # 本地预览构建完成的独立单文件 HTML
npm test                    # 运行自动化工程测试套件（验证构建一致性、安全响应头与核心算法）
npm run build:worker        # 编译 Cloudflare Worker 边缘部署代码

# 方式二：Python（历史遗留兼容）
python3 serve.py            # 启动本地隔离服务器
python3 build/build.py      # 简易字符串替换构建（产物未压缩，约 184 KB）
```

> **为什么上线是纯静态，但本地需要专用服务器？**  
> 本项目在线上是 **100% 纯静态单文件**。但在本地通过 `file://` 协议访问时，现代浏览器的沙箱安全策略会拦截 Web Worker 与 WASM 加载。此外，ONNX Runtime Web 依赖 `SharedArrayBuffer` 才能开启 CPU 多线程并发（速度快 3～23 倍），而现代浏览器强制要求提供两个跨源隔离响应头（COOP 与 COEP）：
> ```http
> Cross-Origin-Opener-Policy: same-origin
> Cross-Origin-Embedder-Policy: credentialless
> ```
> `npm run dev`（Vite）与 `python3 serve.py` 的唯一作用就是带上这两个响应头，**不含任何后端业务逻辑**。  
> ⚠️ **不要用 `python3 -m http.server`**（缺少跨源隔离头，WASM 将退化为单线程）。

---

## 深入设计与交互调优实录

### 1. 首次加载与状态感知

**首次打开要先下约 18 MB 模型权重**（只下一次，之后走浏览器缓存）。
这段进度**只报在空状态面板上**，不会去动侧栏的工作流进度条——那条 bar 的语义是「这份文档处理到哪了」，模型下载是它的前置条件而不是它的一部分。
曾经两边一起写，结果刚打开页面、一份文件都还没拖进来，工作流进度条就爬到了 67%，看上去像有东西正在处理。

现在打开就是一个说明清楚的落地页 —— 标题、"文件不上传"的承诺、四张核心能力卡、拖入框，以及一行**实时进度**：正在下哪个文件、下了多少字节、百分比。下完还要编译 5 个推理会话，这段也单独报出来。就绪后同一行变成绿色的「模型就绪 · 可以开始识别了 · 4× · 耗时 6.9 s」。

**侧栏是「工作流 → 设置（折叠）→ 运行日志」三段**，日志吃满剩余高度。设置默认收起（展开状态记在 localStorage 里，改过灵敏度的人不用每次重新展开），离线模型折叠在设置里面。**三段之间各有一道分割线**（`#rail > .split`）：原来顶层三块只靠 14px 的间距隔开，只有嵌套在设置里的「离线模型」有分割线，于是设置和运行日志看着像同一组的延续，读起来很乱。

### 2. 折叠标记只有一个实现

全应用有四处折叠——左栏的「设置」「离线模型」、运行日志的每一次运行分组、
页面卡片里的「识别内容」——以前是**四份各写各的**：`content:"▸"` 加 `rotate(90deg)`，
而「离线模型」漏了隐藏浏览器原生三角的那一条。同一个左栏里两种折叠长得不一样，
尺寸、旋转方向、缩进宽度全不一致；正文为了对齐那个 11px 的三角，
只能各写各的 `padding-left` 去补。

现在收敛成一个组件：标记由 JS 注入（`app.js` 的 `foldMark`），
图标是 lucide 的 `chevron-down` 内联 SVG——和顶栏那个太阳图标同一套做法，
不引外部 CDN，也就不会多一个会挂的依赖。尺寸与缩进统一走三个变量：

```css
--foldsize:14px; --foldgap:6px; --foldind:20px;   /* --foldind = 图标 + 间距 */
```

`.logline` 的缩进从写死的 `11px` 改成 `var(--foldind)`，
和 summary 里文件名的起点对得上（Range 实测两者文字左缘都是 34px，差 0）。

**`data-i18n` 必须挂在内层 span 上，不能挂在 `<summary>` 本身。**
`applyI18n` 是 `textContent = …` 整块替换，挂在外层的话切一次语言就把图标一起抹掉了；
同理运行日志的 summary 每次 `retitle` 都 `textContent=""` 重建，
`paintSum` 里也得补一次 `foldMark`。实测中 / 英各切一轮，
24 个 summary 每个都恰好一个图标、没有原生三角。

**顶栏只留下此刻能用的按钮。** 主按钮有两种身份：没有文件时是「选择文件」，
有文件后变成「重新识别」；停止只在跑的时候出现，复制 / 下载只在有结果时出现。
空状态下顶栏就只剩一个「选择文件」，不再摆三枚灰着的按钮。
快捷键提示也只留真实存在的两条（⌘O 选择文件 / Esc 停止）——
选好文件已经自动跑，⌘↵ 开始识别 没有意义了。

**上传入口只有一处**：空状态面板中间那个拖入框。侧栏原来也有一个，内容完全重复，
删掉之后侧栏干净多了——但不能就此删干净：空状态跑完就隐藏，那时中间那块也没了，
所以顶栏留了一个常驻的「选择文件 / 换文件」按钮（手机上侧栏默认折叠，更需要它）。

**拖放绑在整个窗口上**：以前只绑在侧栏那个小方框上，拖到结果区或设置区毫无反应，
看起来像坏了。现在拖到页面任何位置都会浮出「拖到任意位置 · 松手即可识别，
文件不会上传」的覆盖层，投放即识别。

**选好文件就直接开跑**，不用再点一次「开始」——这是一个只做一件事的工具，
丢进去就是想看结果。模型还没下完就先记着，下完自动补跑（冷启动那几秒正好不浪费）。
跑完按钮变成「重新识别」，改了设置再点一下就行。

跑一半可以随时停；停了之后再选新文件会自动重新开跑。

拖入图片或 PDF（也可 ⌘V 粘贴截图），右上角切语言与主题。
左上角折叠侧栏；**手机默认折叠**——侧栏一屏塞满「拖入框 + 工作流 + 设置 + 快捷键」，
会把落地页整个挤到折叠线以下，而落地页自己就带拖入框，折叠不丢功能。手动开合过就记住。
`samples/` 里有样例图、样例 PDF、官方仓库的 4 张示例图和期望输出。

---

## 架构

```
┌─ 主线程 ────────────────────────────┐   ┌─ Web Worker ──────────────┐
│ pdf.js 渲染 / 文本层提取             │   │ 同一份 core.js              │
│ 工作流卡片 · 流式渲染 · i18n         │◄─►│ det → script → rec → order │
│ pdf.js 文本层：3 ms 直接出结果       │ msg│ ONNX Runtime Web           │
└─────────────────────────────────────┘   └────────────────────────────┘
```

- **推理在 Web Worker 里跑**，主线程只管界面，所以上传后能逐行出结果、界面不卡。
  Worker 创建失败时自动回退到主线程推理（顶栏徽章会标出当前用的是哪种）。
- **核心只有一份**：从 `<script id="ocr-core">` 取出源码，生成 Blob URL ——
  既是 Worker（`type: "module"`），也是主线程 `import()` 的回退路径。不复制代码。
- 消息用 `id` 配对成 RPC；`stage` / `line` / `mark` 是流式事件，`result` 才 resolve 那个 Promise。

## 工作流

**大文档先给全局视图，再逐页推进。** 结果区顶部有一条**页面总览**：每一页一张缩略图 + 页码，
点一下直接跳过去。总览在 ≥4 页时出现，横向滚动；读到第 150 页时总览条会自己跟过去
（只动它自己的 `scrollLeft`，不带动正文）。

**高亮跟着滚动走，而且要跟「视口里最靠上的那张卡」一致。** 这里错了两轮：

| | 原来 | 现在 |
|---|---|---|
| 触发源 | IntersectionObserver 的 `isIntersecting` | `#views` 的 `scroll`（rAF 合并） |
| 选哪一页 | 最后进入观察范围的那张 | 全部卡片里**还在视口内、最靠上**的那张 |
| 8 页文档实测 | 恒定领先 2 页：滚到顶是「页 3/8」，眼前是第 1 页 | 8 个滚动位置逐点一致 |

两个坑：观察器有 `600px` 的预热边距，所以「刚进来」的那张本来就比视口靠前；
而卡片画完就被 `unobserve` 了（省资源），那一路事件从此不再来——
只挂观察器的话，高亮会**冻在最后一次触发的那一页**，滚到哪儿都不动。
点缩略图时额外 `markNavActive` 一次：目标页本来就在视口里的话观察器不会再触发，
点一下没反应比不动更糟。

代价：每帧扫全部卡片的 `getBoundingClientRect`，**200 张卡 0.13 ms**（中位），
且只在当前页真的变了时才动 class。

顶栏那一排**页码圆点**只在 ≤40 页时画 —— 一排 200 个点既塞不进顶栏也看不清，
再往上页码进度由「逐页识别」那一步右侧的 `n / N` 承担，总览条也还在。

文档**先铺开头几页，再逐页推进**。 PDF 会先把头 12 页栅格化，卡片连同缩略图立刻出现；
超出的页在队列里边渲边算：

```
第1页 图片就位 · … · 第12页 图片就位        ← 第一屏立刻有东西
第1页 推理 → 出框 → 出字 → 完成
第13页 渲染 → 推理 → …                        ← 后面的页接着补进来
```

单页内部也是三段式：**页面图 → 检测框 → 文字**。框在识别之前就先画出来，
不用等整页识别完才知道版面对不对。

每页一张卡片：

| 阶段 | 说明 |
|---|---|
| 解析文件 | 读文件、判定类型 |
| 渲染页面 | pdf.js 光栅化（200 DPI）；图片直接解码 |
| 行检测 | `det.onnx`：墨迹图 → 概率图 → 4-连通域 → 按上下距离 logit 还原行框 |
| 字形分流 | `script.onnx` 逐行判断是否含汉字，送往对应的识别器 |
| 文字识别 | `rec.onnx` / `rec_cjk.onnx`，按宽度分桶批处理，逐批回调 |
| 阅读顺序 | `order.onnx`：同块 logit 平均连接聚类 → 块内 XY-cut → 块间成对排序 |
| 结构化 | 版面分类 + 行高行距兜底 → Markdown |

### 侧栏的工作流是文档级的

侧栏那四步（解析文件 / 渲染页面 / **逐页识别** / 完成）描述的是**整份文档**走到哪一步，
**只进不退**。中间那一大步的右侧是页码进度 `3 / 12`。

早先的版本把「行检测 / 文字识别 / 阅读顺序」这三个**逐页**阶段直接映射到步骤下标，
于是 12 页 PDF 走到第 2 页时高亮又退回「行检测」，再一路爬回顶部——每页来回切一次，
看起来像卡住了。现在逐页阶段合并成一个步骤，页码由队列统一维护（只增不减），
单页此刻在做什么写到标题右侧那一行（`3 / 12 · 文字识别`），**不再影响步骤高亮**。
`renderSteps(idx, force)` 里那道 `idx < lastStageIdx` 的早退就是防回退的，
只有 `force`（新建一次运行）才允许把高水位落回 0。

页面卡片内部保留的是**逐页**的五个阶段——卡片本来就是单页的，
在那儿显示逐页阶段才是对的信息，两处各司其职。

**预览画布从头到尾只定一次尺寸。** 这条改了三轮才对：

| | 做法 | 用户看到 |
|---|---|---|
| 一开始 | 首帧按整页画，检测框到了再裁，加 220 ms 过渡 | 一次「推近」，被报成"变形" |
| 二轮 | `.first` 类只挡首帧（300×150 → 整页那次） | 整页 → 裁剪那次照旧缓，**还在** |
| 现在 | 裁剪提前到拿到位图那一刻算，加过渡整个删掉 | 没有动画 |

关键在于**裁剪范围只依赖位图，不需要等检测框**（见下面 `inkBox`）。
以前把它挂在 `showBoxes` 上是为了省一次 2.2 ms 的扫描，代价却是整页先画一遍、
再重新布局一次——用户看到的正是那次重新布局。早算 2 ms 换掉它很划算。

两处配套：

- **canvas 建出来就是 `hidden`**，定完尺寸再放出来。元素默认 300×150，
  即使首帧和定尺寸在同一个任务里，中间也可能被采样到一帧 150px 的白块。
- **量的时候要看渲染出来的宽度**。`cv.style.width` 是内联目标值，一改就到位，
  量它永远看不到动画；要看 `getBoundingClientRect()` 或列宽。
  这是第二轮误判"已经修好了"的原因——talltest 明明在缓，采样却显示"只有一跳"。

逐帧采样（16 ms 一次，约 2.2 s）：

| | 修复前 | 现在 |
|---|---|---|
| 长截图 | `242 → 354 → 262 → 269 → … → 374`（列宽 13 帧） | `354/374` 一种尺寸 ×137 次采样 |
| 细字号 | `167 → 392`，列宽 187 → 412 十二帧 | `392/412` ×137 |
| 8 页 PDF | — | **8 页全程无一页改过尺寸** |

**卡片右栏的顺序是「结构在上、明细在下」。** Markdown 是这一页的结构化结论，
**常驻在上、不折叠**（正文限高 230px 自己滚）；下面是逐行的识别结果（带置信度），
**可折叠**，标题上带行数，默认展开。

流式到达的文字会先逐行显示；**阅读顺序此刻才确定，结束时用权威结果对账重建一次**，
所以看到的过程可以「有感」，最终结果一定是准的。

实测 138 行那一页（`official-multi_column.png`）的到达节奏：

```
149ms 首批行 → 之后每 ~25 ms 一小批、每批 ~7 行，逐行渗出 → 575ms 对账重建
```

粒度本来就不粗，**缺的是让到达看得见**：所以每一条流式行都带一个 180 ms 的
淡入上浮，而对账重建那一批（`.reorder`）**不放动画** —— 138 行一起放就是一片噪点，
只在整列上闪一下底色表示「顺序变了」。卡片头同时长出 `识别中 · 42`，
行可能在折叠线以下，但这个数字一直看得见。

预览的「边识别边叠框」按**时间节流**（70 ms 一次）而不是按行数：原来每 6 行全画布
重画一次，138 行就是 23 次 800×1000 的 drawImage，主线程要为此空出几百毫秒，
反而把流式本身拖慢。

文本列的自动滚动改成**只在用户本来就贴着底部时**才跟；往上翻的时候别把人拽回来。
对账重建也不再把滚动位置弹回顶部。

交互上做了五件让结果「可核对」的事：

- **悬停任意一行**，预览图上对应的框会加粗点亮——文字和位置直接对上
- **反过来也通**：鼠标扫过预览图里的检测框，正文对应那一行同样点亮并滚进视野。
  以前只有「正文 → 画布」一个方向，画布上只能整块点开放大，两边对不上。
  坐标换算和 `drawPreview` 用同一套（画布后备缓冲 px ↔ 位图裁剪区），
  实测窄长文档（预览列自适应缩到 394px）下逐行命中仍然准确
- **点预览放大**到全屏（`+` / `−` / 适应，可滚动）。**灯箱里方向键逐行走**（`↑` `↓` `←` `→`）：
  高亮框加粗加深，正文那一列同步高亮并滚进视野，标题显示「第 k / n 行」
- **低置信度的行标成琥珀色**。实测很准：那张截图里读错的 `3/Jট`(0.91) 和
  `Very 屈`(0.92) 正好就是两条琥珀色的行——错在哪一眼就能看出来，不必逐字比对
- **预览图上只给低分行加琥珀框和置信度数字**。早期版本给每一行都标了红色框和数字，
  一页 41 行就是 41 个红数字糊成一片，反而把真正可疑的那 3 行淹掉——满屏标注等于没有标注。
  现在读对的行只留一道极淡的框当位置参考，出问题的那几行才跳出来。

**中途停止不会骗人。** 被中断的页停在半路，卡片头上不会还写着「识别中」，
改成 `已停止 · N 行`。

**一页坏掉不会毁掉整份文档。** 三处曾经会「一票否决」：

- `runJob` 的 catch 里原来直接 `throw`，一页失败整份 PDF 中断；
- `run()` **整个函数没有 `try`/`finally`**，任何意外（损坏的页、Worker 崩了、内存吃紧）
  都会把界面永远留在运行中：开始按钮灰着、停止按钮亮着、步骤卡在中途、也没有汇总——
  用户只能刷新，整份文档白跑；
- 给 Worker 拷贝位图那一步（200 DPI 一整页十几 MB，内存吃紧时它自己就会抛）
  写在 `try` 外面，这种失败直接冲出 `runJob`。

现在三层都兜住了：`runJob` 标记这一页、记一笔、继续跑下一页；
`run()` 的 `finally` 保证按钮和步骤无论如何都回到可用状态；
栅格化失败也在预渲染阶段就地标记，不往上抛。

失败页**要看得见**——以前只加了个 `.failed` 类，而 CSS 里根本没有这条规则，
失败页和正常页长得一模一样，用户只会以为「这页没内容」。现在卡片描红边、
头部写明原因、预览区盖一个「这一页没读出来」，日志记「1 页失败」，
汇总照实说 `2 / 3 页 · 38 行`。实测：3 页 PDF 的第 2 页拷贝失败，
另两页正常出 19 行，汇总 `2 / 3 页`，按钮自动恢复。

顶栏实时显示「第 i / n 页」，完成后给出总汇总（页数 · 行数 · 耗时 · 低置信行数）；
侧栏只报规模（页数 · 行数），不重复同一串字。

**卡片里的预览会裁到有字的那块**。整页 A4 里内容常常只占顶部三分之一，
把空白一起画出来既难看又挤占版面。灯箱和顶部页面总览仍看整页——它们的职责是「这是第几页」。

**裁剪范围按位图的墨迹算，不按检测框算。** 原来用检测框的并集当裁剪范围，
而检测是模型输出、**会漏**：`samples/sample.png` 里最大的一行「标题 Title」
就没进检测框，于是右栏列了 5 行、预览只画得出 4 个框，
漏掉的那行整个被裁到了画布外——图上根本看不见。灯箱画的是整页、所以一直是对的，
这就是为什么这种错误能一直藏着。

现在改成扫图本身（`inkBox`）：缩到 256 宽、约 4.4 万像素，
**中位 2.2 ms**（200 页共 0.44 s，可以忽略）。
背景不假定是白的，用亮度**中位数**当背景，深色底的文档同样成立；
透明像素不算墨（PDF 页本身没有背景，不然整页都会被当成内容）；
墨迹占比超过 55%（照片、整版底纹、扫描噪点）时裁了也没意义，返回 `null` 退回检测框。

| | 修复前 | 修复后 |
|---|---|---|
| `sample.png` 画布 | 800×306 | 800×400 |
| 画布上的文字带 / 框 | 4 / 4 | **5 / 5** |
| 逐行框 x 范围 vs 墨迹 x 范围 | — | 差 2–6 px |

检测框那条路仍然留着当兜底（墨迹判不出来时才走 `contentBox`），
`contentBox` 里按面积分位数丢掉零碎误检的逻辑也还在。
墨迹扫描放在 `showPreview()` 里，也就是**拿到位图那一刻**就做完，
这样首帧直接按最终尺寸画，画布尺寸一辈子不变。

**预览是按设备像素比渲染的**（419 CSS px 的画布在 Retina 上用 838 px 后备缓冲），
否则一张缩到几百像素的页面图铺上去会被拉伸糊掉，点进灯箱也看不清。
点预览进灯箱后可 `+` / `−` / 适应，滚轮范围内自由缩放。

**灯箱的画布只画一次，缩放全交给 CSS。** 以前每按一次 `+` / `−` 都要把后备缓冲
换个尺寸、`drawImage` 整页、再把所有检测框和置信度文字重描一遍。重画本身其实不贵
（实测中位 0.7–1.5 ms），真正的毛病是 `lbZoom` 能一路加到 6 倍：
缩放超过 100% 时画布涨到 **4000×4700（19 Mpx ≈ 76 MB）**，
而 100% 以上本来就一个像素的新信息都没有——纯白花内存，手机上容易把标签页搞崩。

现在后备缓冲固定画到「位图原始像素」那一档，缩放只是两个 CSS 数字：

| | 以前 | 现在 |
|---|---|---|
| 连续放大 12 次后的缓冲 | 3667×4746 → **69 MB** | 1700×2200 恒定 → **15 MB** |
| 放大上限 | 600%（纯虚张声势） | **100%**（= 位图原始像素） |
| 单次缩放 | 0.7–1.5 ms（整页重画） | **0.12–0.92 ms**（只改 CSS） |
| 方向键逐行走 | 每按一次重画整页 + 38 个框 | **0.15 ms**，只挪覆盖层 |
| 关掉灯箱 | 画布还占着几十 MB | **缓冲归零** |

高亮从「画在画布上」改成 **DOM 覆盖层**（`#lbHi`，挂在贴着画布的 `.lbframe` 里），
坐标直接用「框 × 显示比例」。这样它跟着画布缩放、边永远是清晰的 1px，
而且逐行走不用碰画布。缩放 / 适应窗口 / 逐行走都只走 `layoutLightbox()`，
只有换页和开关「检测框」才走贵的 `renderLightbox()`。

关闭时必须**显式把缓冲归零**——`hidden` 只是藏起来，那几十 MB 照样占着；
200 DPI 的一页 2550×3583 就是 36 MB，灯箱关着还占着没有道理。

**卡片预览懒渲染**：只有滚进视口附近（上下各 600px）才真正画 canvas，离屏的先显示微光占位。
几十页文档一次性铺满 canvas 会明显卡，这一条能把它降到可接受。

**正文两栏的比例是算出来的，不是写死的。** 预览列原本固定 420px，但窄长内容
（长截图、聊天记录）总是先被 620px 的高度卡住，画布只用得上 374px —— **白占几十像素，
而且是从正文那栏扣的**。现在列宽跟着内容实际需要的宽度走（上限仍是 420px）：

| 文档 | 裁剪框 | 预览列 | 正文列 |
|---|---|---|---|
| 竖版 A4 / 手机截图（0.7:1，宽度先卡住） | 873×1102 | 420 | 650 |
| 长截图（0.6:1，高度先卡住） | 895×1483 | **394** | **676** |

**目标宽度只能由内容和上限算出来，绝不能拿当前列宽反推。** 这条是踩出来的：
最早写成 `availW = box.clientWidth − 20` 再 `want = ceil(cssW) + 20`，
而 `.prev` 自带 1px 右边框，`clientWidth` 已经把它吃掉了，于是

```
cssW = 列宽 − 1(边框) − 20 = 列宽 − 21
want = ceil(cssW) + 20     = 列宽 − 1
```

每重画一次少 1px 的**单向棘轮**——鼠标在画布和正文之间来回，画布就一路缩水到下限。
当时注释里写的"不动点"只在**高度**先卡住时成立，而这批文档几乎都是**宽度**先卡住，
所以必然衰减。现在 `fit` 用的是 `min(PREVW_MAX, 卡片外宽 − 22) − PAD` 和 `availH`，
与当前列宽无关，是真正的不动点（12 次连续重绘实测恒为 `420 / 400px`）。

**上限里那一项「卡片外宽」是窄屏补的。** `≥1100px` 是两栏排版，420 够用；
但窄屏下 `.body` 只有一列（`--prevw` 根本不生效），420 宽的画布会顶出卡片、
被 `.pg{overflow:hidden}` 切掉右边一截——390 宽的手机上实测**最多切掉 25px**，
右边几个字直接看不见，而 `documentElement.scrollWidth` 一点异常都不报
（溢出被容器吃掉了）。现在上限取**卡片外宽**而不是 `.prev` 的宽度：
后者在宽屏下宽度来自 `--prevw`，拿它当上限就是拿自己量自己，又回到那条棘轮。

| 390×844 手机 | 修复前 | 修复后 |
|---|---|---|
| 画布尺寸（长截图 / 细字号 / 混排） | 354 / 392 / 400 px | **311**（三例一致） |
| 画布右缘超出视口 | +25 px（被切） | **−44 px（完整）** |

桌面不受影响：长截图仍是 `354×620 / 列宽 374`，混排样例仍是 `400×200 / 列宽 420`。

实测三个文档各悬停 60 次、检测框开关 20 次、侧栏折叠 10 次，**漂移 0 px**。

**复制 / 下载跟着当前页签走。** 按钮就摆在页签旁边，在「文本」页签点复制却拿到
Markdown 是很别扭的，所以它复制/下载的就是当前激活的那一份。在工作流页签或还没跑
的时候，两个按钮是真的变灰，不是点了没反应。下载按页签给对应的 MIME 与扩展名，
并且 4 秒后 `revokeObjectURL` —— 不回收的话 blob 会挂在文档上直到关页面。
按下时按钮闪一下「已复制 / 已下载」，1.4 秒后自己退回去。

**按钮上只写动词，格式放进悬停提示。** 曾经写成「复制 Markdown / 复制 文本 /
复制 JSON」来表明格式，实测同一个按钮宽度在 **49px 和 113px 之间跳（2.3 倍）**，
每切一次页签整条按钮栏就横向抖一下；而当前是哪个格式，旁边的页签已经说清楚了。
现在按钮恒为 49px，悬停提示写「复制 Markdown」「下载 .md」。
切语言时必须补一次 `retitle()` —— `applyI18n()` 会用 `data-i18n` 盖掉 `textContent`，
不补的话在 JSON 页签切语言会显示「下载 .md」，实际下的是 `.json`。

**着色只改呈现，不改内容。** 三个结果页的原始文本另存在 `RAW` 里，
复制和下载取的是那份，不碰 DOM。所以屏幕上的着色怎么变都不影响导出。

**屏幕上全选复制 == 点按钮复制**，逐字节相同。Markdown 视图是一行一个 `div`，
块级元素之间的空白不参与排版（看不出来），但换行必须留在 `textContent` 里，
否则用户在屏幕上全选会拿到一整篇连成一行的东西。

### 结果页可读性

三个结果页原来全是同一种灰的等宽字，一屏读不出结构。

**Markdown**：标题 / 表格行 / 列表项分开，竖线压暗、表格行给一条底色带。
表格目前是逐单元格输出的（见「已知限制」），一屏全是 `|`，分开之后至少能看出
哪几行是一张表的。

**JSON**：`JSON.stringify(…, null, 1)` 会把每个 `box` 的 5 个坐标各占一行，
188 行文本就是 **900 多行坐标把内容埋掉**。改成一行一个文本对象：

```json
{ "box": [311.45, 30.82, 352.56, 41.91, 0.8], "text": "Section", "conf": 0.9996 }
```

同一份数据 **196 行**（原来约 1100 行），仍是合法 JSON。
坐标保留两位小数：模型吐出的是 16 位有效数字，而这是 200 DPI 下的像素坐标，
0.01 px 远比任何人会用到的精度细，留着只会让每行长一倍、把真正要看的文字挤出视野。
键 / 字符串 / 数字 / 标点分层着色。

快捷键：`⌘O`（Windows/Linux 上为 `Ctrl+O`）选文件、`Esc` 停止。
灯箱打开时方向键改为逐行走。
这一行只在「有精确指针的桌面环境」显示——手机上没有物理键盘，显示出来只是噪音。

日志里的 `resize 27ms · det 85ms · decode 8ms` 是逐阶段耗时。

## 界面

配色是**中性墨色**（`--bg:#0a0a0b`），渐变、辉光、网格底纹全部去掉。
颜色只用来表达含义：琥珀 = 低置信待核对，绿 = 完成，红 = 失败。别的都是灰。
圆角收到 8px，等宽字体只用在数字和代码上，正文用无衬线。

**没有引入组件库，这是刻意的。** 逐个查过 CDN 可用性与体积：
Shoelace autoloader 1.5 KB + 主题 19.5 KB、Tailwind browser 282 KB、Pico CSS 83 KB。
问题不在体积，在于：

1. 任何 CDN 组件库都会破坏「单文件、离线可用」这条主线；
2. 这个界面约七成的部件——页面卡片、流式进度线、置信度行、检测框覆盖层——
   在上述任何一个库里都没有对应物，最后还是得自己写；
3. 套上现成库的默认观感，正是「一眼 AI 味」的来源。

所以样式是一套手写 token（`shell.html` 顶部），改主题只改 `:root` 里的几个变量。

## 深浅色跟着设备走

以前 CSS 的 `:root` 就是深色板，只有手动点过主题按钮、localStorage 里有值才会切到浅色——
**设备是浅色系统的用户一打开就是黑的**，该跟系统的地方完全没跟。
现在三态：跟随系统（默认）/ 浅色 / 深色，按钮按顺序循环，图标跟着换
（lucide 的 `monitor` / `sun` / `moon`），提示文字也跟着换语言。

| | 行为 |
|---|---|
| 没选过（默认） | 读 `prefers-color-scheme`；系统日夜切换后**开着页面也会跟着变**，不用刷新 |
| 手动选过 | 按选的来，系统变天不变；刷新后仍然是它 |
| 隐私模式 | `localStorage` 会抛，try 兜住，退回深色 |

**首帧不闪。** `:root` 是深色，而浅色设备要等模块脚本跑完才切 `data-theme`，
中间会黑一下——在浅色屏幕上尤其扎眼。所以 `<head>` 里有一段内联脚本
（位置在 `<body>` 之前，构建产物里可查），
在解析阶段就按同一套规则把主题定好；模块里的 `applyTheme()` 负责之后同步。

几处布局上的取舍：

- 侧栏可折叠（左上角），折叠后结果区拿回 340px
- 顶栏固定 46px，引擎状态写成一行等宽小字；窄屏只留线程数，
  否则这串字一换行就会顶出 46px 的 header
- 文本列超过一屏时上下出现**滚动阴影**（纯 CSS 的 `local` / `scroll` 背景层），
  滚到头或尾阴影自动消失——否则 41 行挤在 430px 里像被硬切掉
- 运行日志标题里文件名和时间分成两个元素各自截断；挤在一起时省略号会吃掉分隔点，
  变成 `foo.png ·…`

时间一律走 `fmtMs()`：**毫秒带千分位**（`1,710 ms`），切秒的阈值放在 10 s。
卡片头、日志、步骤耗时全部走这一个函数。

进度条写成 3px 而不是 2px：2px 在侧栏里更像一条分隔线，看不出它是进度。
填充端有一个落点小圆点，让「走到哪」有个明确位置；0% 和 100% 时隐藏。
卡片上的那条更安静：不加落点，跑完淡成普通分隔线。

## 时间花在哪

补齐 `script / rec / order` 三个计时之后，
`official-chinese_essay.png`（41 行）一页 371 ms 的分布是：

| 阶段 | 耗时 | 占比 |
|---|---|---|
| 缩放 resize | 22 ms | 6% |
| 检测 det | 31 ms | 8% |
| 解码 decode | 7 ms | 2% |
| 字形分流 script | 12 ms | 3% |
| **识别 rec** | **271 ms** | **73%** |
| 阅读顺序 order | 6 ms | 2% |

**识别是绝对大头**，而 resize + det 合计才 14%。以后要提速，先看这张表。

**逐段耗时不再逐页写日志。** 这一页的分解只挂在**卡片头耗时数字的悬停提示**上，
整次运行结束后在日志里汇总一行：

```
PDF 8 页
total 18.8 s · 8 页 · 88 行
逐段平均 缩放 302 ms · 检测 459 ms · 解码 15 ms · 分流 59 ms · 识别 1,075 ms · 阅读顺序 12 ms
```

### 预取下一页的实测结论

200 页文档的页间空档看起来有 98 ms 中位数，试过预取下一页。
**实测没有收益**（200 页 57.9 s → 57.2 s，噪声范围内），已撤回。
瓶颈在 Worker 那 ~190 ms/页，主线程只有 ~17 ms，主线程多干一份栅格化反而把 DOM 拖慢。

### 批大小与置信度过滤的实测实验

- **批大小**：把 `maxBatch` 从 8 提到 16，行多的文档受益，行少像素密的变差，没有全局更优解，保持 8。
- **置信度过滤**：检测本来就只出文本行，`minConf` 是识别之后才起作用，省不掉前向计算。
- **长文档预估时间**：跑过 3 页后给出 EMA 平滑的剩余时间，让等待可预期。

## 提速

### 多线程 WASM（最大的一项）

`serve.mjs` / `serve.py` 发送两个核心隔离头：

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

没有它们浏览器就不给 `SharedArrayBuffer`，onnxruntime-web 只能单线程：

| 线程数 | 双栏长页 138 行 ×6 | 中位数 |
|---|---|---|
| 1（`http.server`，无隔离） | 15202 / 13928 / 16237 / 14498 / 14445 / 14594 ms | 14.5 s |
| **4（默认）** | 623 / 614 / 618 / 614 / 617 / 621 ms | **0.62 s** |
| 8 | 16912 / 14592 / 16597 / 18061 / 16786 / 15800 ms | 16.4 s |

**4 线程比单线程快 23 倍，且方差极小；8 线程反而退化**（线程过度订阅）。默认封顶 4 线程。

**电子版 PDF 直接读嵌入文本层**，不经过 OCR：

| 通道 | 耗时 | 结果 |
|---|---|---|
| 文本层 | **3 ms** | 22 行，文字零错误 |
| OCR | 7.8–8.6 s（单线程） | 38 行，有识别误差 |

## 运行日志

日志按「一次运行」分组，当前展开，历史折叠。文件名吃掉多余宽度，时间定宽贴右：

```
▾ talltest.png        12:15:22    1 页 · 171 ms
▾ official-chinese…  12:15:21    1 页 · 368 ms
▾ big.pdf            12:15:18    8 页 · 1,789 ms
```

单次运行上限 90 条，`#log` 吃满侧栏剩余高度作为唯一滚动容器（可用高度 416px）。

## 设置

- **检测分辨率** — 默认「自动」：先按长边 1024 检测，中位行高不足 9px 自动升分辨率重检，上限 2048。
- **灵敏度** — `MIN_CONF`，官方默认 0.5，可放宽到 0.3 捞回低置信度的行。
- **文本层** — 电子版 PDF 是否走快速通道。
- **离线模型** — 选齐 6 个本地文件后对 Hugging Face 的网络请求为 0。

## 复刻细节

- **缩放**按 `cv2.INTER_AREA` / `INTER_LINEAR` 自己实现（可分离两遍）。
- **预览画框的缩放必须用 `W / cr.w`**，不能写 `W / b.width`。
- **XY-cut 兜底分支**要传行号而不是框坐标。
- onnxruntime-web 多个输出张量可能共享同一块 wasm 内存，读 order 模型结果时在 `run()` 之后立刻拷贝副本。
- 不要设 `ort.env.wasm.proxy`：在 wasm 后端已初始化后再改会让推理静默挂死。
- `boxes` 事件带裸数组 `[x0,y0,x1,y1,h]`，坐标读取统一兼容 `l.box || l`。
- `bootEngine` 与 `acquireEngine` 共用 `spawning` 闸，防止重复拉取 18 MB 权重。

## 对照验证

以官方 `indra_ocr` 的 Python 跑同一张图为基准：

- 检测输入张量逐元素一致：非零像素数 24694 相同，ink 总和 10357.216 vs 10357.170。
- 检测框逐位一致：`[116.55, 94.46, 325.95, 116.43]`。
- 13 个回归用例行数与基线完全一致，零失败页、零未捕获异常：

| 用例 | 页 | 行 |
|---|---|---|
| 8 页 PDF（OCR） | 8 | 88 |
| 3 页 PDF（OCR / 文本层） | 3 | 57 / 32 |
| 电子版 PDF（文本层 / OCR） | 1 | 22 / 38 |
| 手机截图 / 长截图 / 混排样例 | 1 | 17 / 18 / 5 |
| 细字号 / 双栏长页 | 1 | 49 / 138 |
| 官方示例：中文页 / 表格 / 旋转信 / 双栏 | 1 | 41 / 188 / 98 / 138 |
| **200 页 PDF（规模 / 内存 / 回收）** | **200** | **2200** |

## 长文档内存管理

- **边渲边算**：先栅格化头 12 页，其余在队列中现渲现算现丢。
- **位图回收**：保留最近 `BITMAP_KEEP = 24` 张原图，更早的通过 `ImageBitmap.close()` 释放，总览缩略图（108×144）常驻。
- 实测 200 页文档：**200 页 · 2025 行 · 9.3 s，JS 堆峰值仅 41 MB**。

## 已知限制

- **emoji 和图标读不出来**，会变成杂字符（词典覆盖的是印刷文字）。
- 公式（`--math`）与页面纠偏（`orient.onnx`）未移植。
- 表格按单元格逐行输出，不合并成 Markdown 列结构。
- 复杂分栏版式建议关掉文本层、走 OCR 通道（OCR 通道有 order 模型，能正确分栏）。

## 现代工程化架构

本项目采用双重工程化组织方式：既支持单文件零依赖的绿色运行，又提供完备的现代前端模块化与测试体系：

```bash
# 现代 Vite 工程化构建与测试
npm run build                 # Vite 深度压缩打包并同步至 index.html 与 indra-ocr.html
npm test                      # 运行工程自动化测试（23 项单测与产物校验全部通过）
npm run build:worker          # 同步更新 deploy/html.js
npm run preview               # 本地预览生产构建产物

# 历史遗留 Python 备份
python3 build/build.py        # 文本替换备用脚本
python3 deploy/build.py       # 同步更新 deploy/html.js
```

| 目录 / 文件 | 职责说明 |
|---|---|
| `src/core/` | 现代纯 ESM 模块化推理核心（零 DOM 依赖，可直接作为 npm 库导入） |
| `src/types/index.d.ts` | 完整的 TypeScript 类型定义（支持下游 TS 项目代码提示与静态校验） |
| `test/run-tests.mjs` | 自动化工程测试套件（覆盖构建工件、单文件完整性、连通域与 XY-cut 算法验证） |
| `.github/workflows/ci.yml` | GitHub Actions 自动化持续集成流（多版本 Node.js 矩阵测试） |
| `manifest.webmanifest` | PWA 桌面与移动端应用清单（支持免安装直接保存为桌面/手机独立应用） |
| `build/shell.html` | 结构、样式、PWA 声明与 SEO/Geo 元数据 |
| `deploy/worker.js` | Cloudflare Worker 边缘路由与跨源隔离注入 |

### 作为第三方库程序化引入

除了直接使用开箱即用的网页版 UI 外，底层推理核心亦可直接在其他前端项目或 Web Worker 中引入：

```javascript
import { loadModels, ocrPage, toMarkdown } from 'indra-web';

// 1. 初始化模型权重
await loadModels({ threads: 4 });

// 2. 传入任何 Canvas、ImageBitmap 或 Image 进行端侧推理
const result = await ocrPage(imageBitmap);
console.log("Markdown 导出:\n", result.md);
console.log("阅读顺序文本行:\n", result.lines);
```

## 部署到 Cloudflare

`deploy/` 下是一套完整的 Worker，把 `indra-ocr.html` 发到 `indra-web.firetable.tech`：

```bash
npm run build:worker          # 打包单文件并生成 deploy/html.js
cd deploy && wrangler deploy  # 部署到 Cloudflare
```

核心响应头：
```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

使用 `credentialless` 而非 `require-corp`：避免阻止来自 jsDelivr（wasm）和 Hugging Face（权重）的跨源加载。

## 许可与合规说明

1. **源码许可**：本项目前端代码使用 **Apache License 2.0** 授权，遵循与上游代码一致的开源协议。
2. **模型权重许可**：Indra 官方 ONNX 权重属于 Datalab，采用**修改版 OpenRAIL-M** 协议：
   - 科研、个人学习及**年营收 / 累计融资 2,000 万美元以下**的企业完全免费。
   - 禁止用于构建与 Datalab 官方商业 API 直接竞争的服务。
   - 超过规模门槛或需完全不受限商用权利的企业，需向 Datalab 申请商业授权。
3. **分发合规性保证**：
   - 本仓库**不内置、不转存、不分发**任何 ONNX 模型权重文件。
   - 浏览器在客户端运行时直接从 Hugging Face 官方地址拉取模型权重。
   - 第三方运行时组件版权属于各自权利人：onnxruntime-web 属 Microsoft（MIT），pdf.js 属 Mozilla（Apache 2.0）。

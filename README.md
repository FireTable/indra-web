# INDRA OCR Web · In-Browser Document Recognition & Parsing

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Model Weights](https://img.shields.io/badge/Model-OpenRAIL--M-orange.svg)](https://huggingface.co/datalab-to/indra-ocr)
[![ONNX Runtime Web](https://img.shields.io/badge/ORT_Web-v1.22.0-purple.svg)](https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/)
[![Zero Upload](https://img.shields.io/badge/Privacy-100%25_On--Device-success.svg)](#)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Cloudflare_Workers-F38020.svg)](https://indra-web.firetable.tech)

> 🌐 **Language**: **English** · **[简体中文文档](README_zh.md)**
>
> 🚀 **Live Demo**: [https://indra-web.firetable.tech](https://indra-web.firetable.tech)
>
> 💡 **Mission**: Built to give developers, researchers, and users the **fastest, zero-barrier way to experience Datalab's [Indra OCR](https://github.com/datalab-to/indra)** directly in any browser — zero environment setup, zero server uploads, and 100% client-side privacy.

---

> [!IMPORTANT]
> **Community Port & Upstream Attribution**:
> This repository is an unofficial, community-driven in-browser port of [Indra OCR](https://github.com/datalab-to/indra), created by **[Datalab](https://github.com/datalab-to)** (Vik Paruchuri et al.).
> - **Upstream Engine**: [github.com/datalab-to/indra](https://github.com/datalab-to/indra)
> - **Official Model Weights**: [huggingface.co/datalab-to/indra-ocr](https://huggingface.co/datalab-to/indra-ocr)
> - **Purpose of this Project**: Upstream Indra is designed for server/CLI environments with heavy neural dependencies. This web port packages the entire pipeline into WebAssembly so anyone can immediately test and evaluate Indra OCR's layout-aware parsing on images and PDFs in 5 seconds.

### ⚡ 3 Ways to Experience Indra OCR Web

1. **🌐 Instant Web Demo (Fastest & Zero Setup)**:
   - Visit **[https://indra-web.firetable.tech](https://indra-web.firetable.tech)**.
   - All neural models run locally in your browser via multi-threaded WebAssembly. Documents and images are **never uploaded** to any server.
2. **📦 Offline Single-File HTML (Portable & Air-Gapped)**:
   - Download the prebuilt **[`indra-ocr.html`](dist/index.html)** (~112 KB single file).
   - Serve it via any local static server (e.g. `npx serve`). Combined with local model weights, it operates completely air-gapped without internet access.
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
- **Full 6-Model Neural Architecture in Web Worker**:
  1. `orient.onnx`: Page orientation classifier & automatic 90°/180°/270° deskewing.
  2. `det.onnx`: DBNet-based line text detection with adaptive multi-scale re-detection.
  3. `script.onnx`: Adaptive script classifier (routes Latin vs. CJK characters).
  4. `rec.onnx` & `rec_cjk.onnx`: CRNN recognition with dynamic width binning.
  5. `order.onnx`: Graph-based reading order and layout cluster sorting.
- **2D Table Grid Synthesis**: Geometric cell clustering and column band alignment, assembling multi-column Markdown tables (`| Col 1 | Col 2 |`) with title extraction and pipe escaping.
- **Dual-Engine Strategy**: Instant extraction from vector PDF text layers (0-inference, ~3 ms) with automatic fallback to full neural OCR for scanned pages.
- **Interactive Visual Verification**:
  - Bidirectional hover linking between recognized text lines and bounding boxes on the document canvas.
  - Confidence-score color highlights (amber warnings for low-confidence tokens).
  - High-performance lightbox with keyboard navigation (`↑`/`↓`/`←`/`→`) and CSS-transform viewport scaling (capped memory footprint).
- **Scale-Tested on 200-Page Enterprise Documents**: Stream-and-recycle bitmap pipeline keeping peak JS heap usage under ~41 MB.
- **Production Edge Deployment**: Ready for Cloudflare Workers / Cloudflare Pages with zero backend dependencies.

---

### Quickstart

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

> **Why do we need a dedicated local dev server if the production build is pure static HTML?**
>
> In production, this project is a **100% static single-file web application**. However, when opening files locally via `file://`, modern browsers block Web Workers and WASM module instantiation for security reasons. Furthermore, multi-threaded WebAssembly (`SharedArrayBuffer`) strictly mandates two Cross-Origin Isolation HTTP headers:
> ```http
> Cross-Origin-Opener-Policy: same-origin
> Cross-Origin-Embedder-Policy: credentialless
> ```
> `npm run dev` (Vite) serves static files with these required isolation headers — **it contains zero server-side OCR or backend application logic**.

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
│   │   ├── markdown.js     # 2D Table reconstruction & Markdown synthesis
│   │   └── constants.js    # Model constants, thresholds, and event yields
│   └── types/              # Complete TypeScript declarations
│       └── index.d.ts      # Full types for OCRLine, OCRPageResult, OCROptions
├── test/                   # Automated engineering test suite
│   └── run-tests.mjs       # Artifact validation & algorithm unit tests
├── vite.config.mjs         # Vite configuration (viteSingleFile & COOP/COEP isolation headers)
├── scripts/
│   └── sync-dist.mjs       # Synchronizes dist/index.html to root HTML and deploy/html.js
├── dist/
│   └── index.html          # Production standalone single-file bundle (~170 KB, minified)
├── deploy/                 # Cloudflare Worker edge deployment
│   ├── worker.js           # Lightweight edge router (injects COOP/COEP headers)
│   ├── build.mjs           # Bundles indra-ocr.html into deploy/html.js
│   └── wrangler.toml       # Cloudflare Worker & route configuration
├── manifest.webmanifest    # PWA Web App Manifest (installable on desktop & mobile)
├── package.json            # Modern npm scripts, exports, and metadata
├── LICENSE                 # Apache 2.0 License + OpenRAIL-M weight attribution
├── CITATION.cff            # Citation metadata for academic and engineering use
├── indra-ocr.html          # Standalone single-file HTML application
└── index.html              # Standalone self-contained web application (dist sync)
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

console.log("Automatic Deskew Angle:", result.rotation); // 0, 90, 180, 270
console.log("Structured Markdown (with 2D tables):\n", result.md);
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

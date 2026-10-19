# INDRA OCR Web · 纯浏览器端文档识别与版面解析

> **100% 浏览器端侧运行 · 零数据上传 · WebAssembly 多线程加速 · 结构化 Markdown 输出**  
> 🌐 **在线体验**：[https://indra-web.firetable.tech](https://indra-web.firetable.tech) | 📖 [English Documentation](README.md)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![CI & Engineering Verification](https://github.com/FireTable/indra-web/actions/workflows/ci.yml/badge.svg)](https://github.com/FireTable/indra-web/actions/workflows/ci.yml)
[![Node.js LTS](https://img.shields.io/badge/Node.js-20.x%20%7C%2022.x-green.svg)](https://nodejs.org/)
[![Deploy: Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare%20Edge-F38020.svg)](https://workers.cloudflare.com/)

---

### 💡 项目介绍

**INDRA OCR Web** 是 Datalab 官方 [indra](https://github.com/datalab-to/indra) 深度学习 OCR 与文档版面解析引擎的**纯前端浏览器端侧移植版**。

通过 **WebAssembly** 与 **ONNX Runtime Web**，将原本依赖 Python 与服务端的 6 个神经网络模型全部移至浏览器端运行。用户上传的合同、财报、病历、证件等敏感文档**绝对不会上传至任何服务器**，实现真正的数据物理隔离与端侧秒级推理。

#### ✨ 核心特性

- 🔒 **100% 端侧隐私安全**：图片与 PDF 全部在浏览器内处理，无任何数据外发，断网离线亦可运行。
- ⚡ **WASM 多线程极速推理**：借助 `SharedArrayBuffer` 与跨源隔离（COOP/COEP），相比单线程提速高达 **23 倍**。
- ↺ **倾斜与倒置自动纠偏**：内置官方 `orient.onnx` 模型，对 90°/180°/270° 旋转拍图自动判断并扶正画面。
- 📊 **2D 表格 Markdown 栅格重组**：按单元格几何坐标聚类行列，直接生成标准多列 Markdown 表格（`| 列1 | 列2 |`）。
- 📑 **双引擎快速通道**：电子版 PDF 矢量文本层秒级提取（~3 ms），扫描件自动进入深度神经网络 OCR。
- 📦 **零依赖便携单文件**：打包产物为单个 `indra-ocr.html`（~170 KB），配合静态服务器开箱即用。

---

### 🚀 三种体验方式

| 体验路径 | 适用场景 | 获取/运行方式 |
|---|---|---|
| **🌐 在线体验** | 快速评测效果、零安装配置 | 直接访问 **[indra-web.firetable.tech](https://indra-web.firetable.tech)** |
| **📦 离线单文件** | 企业内网、安全隔离沙箱 | 下载仓库中的 **[`indra-ocr.html`](indra-ocr.html)**，通过静态服务器打开 |
| **💻 开发者二次开发** | 深度定制、功能扩展、嵌入现有系统 | `git clone` 本仓库，运行 `npm run dev` 启动 |

---

### 🛠️ 快速上手

```bash
# 1. 安装项目依赖
npm install

# 2. 启动本地开发服务器（端口 8792，自动注入跨源隔离头）
npm run dev

# 3. 生产打包（生成 dist/index.html 与独立单文件 indra-ocr.html）
npm run build

# 4. 本地预览生产构建产物
npm run preview

# 5. 运行工程与算法自动化测试套件
npm test
```

---

### 🏗️ 技术架构

整个系统分为**主线程交互层**与 **Web Worker 推理层**，两者通过结构化克隆（`postMessage`）进行异步通信，保证复杂页面 OCR 时 UI 依然保持 60 FPS 流畅响应：

```
┌────────────────────────────────────────────────────────┐
│                   浏览器主线程 (UI Thread)              │
│  UI 卡片流式渲染 · 坐标高亮联动 · Markdown/JSON 视图   │
│  PDF.js 矢量文本层直读 (3 ms 极速通道)                  │
└──────────────────────────┬─────────────────────────────┘
                           │ postMessage (Events & ArrayBuffer)
┌──────────────────────────▼─────────────────────────────┐
│                 Dedicated Web Worker (计算层)          │
│  ONNX Runtime Web (WASM + 多线程 SharedArrayBuffer)     │
│                                                        │
│  ① orient.onnx    ➔ 页面倾斜/倒置检测与自动纠偏         │
│  ② det.onnx       ➔ DBNet 文本行边界检测 (自适应重检测) │
│  ③ script.onnx    ➔ 汉字 / 西文字形路由分类             │
│  ④ rec/cjk.onnx   ➔ 动态分桶 CRNN 字符识别             │
│  ⑤ order.onnx     ➔ 图聚类版面阅读顺序重建             │
│  ⑥ layout_post    ➔ 2D 表格栅格化与结构化 Markdown 还原 │
└────────────────────────────────────────────────────────┘
```

---

### 📦 核心模型清单

所有权重直接从 Hugging Face 官方仓库动态拉取并缓存在浏览器本地存储中（总计约 19 MB）：

| 模型文件名 | 架构 / 算法 | 模型作用 | 体积 |
|---|---|---|---|
| `orient.onnx` | 轻量方向分类网络 | 0° / 90° / 180° / 270° 旋转检测 | 371 KB |
| `det.onnx` | DBNet (MobileNetV3) | 稠密行文本检测 (自适应高分辨率放大) | 4.7 MB |
| `script.onnx` | 字形分类路由网络 | 判断行文本为西文还是中日韩字符 | 1.2 MB |
| `rec.onnx` | CRNN + CTC | 西文字符识别 (带动态宽度分桶) | 5.5 MB |
| `rec_cjk.onnx` | CRNN + CTC | 中日韩多语言文字识别 (7,000+ 字符集) | 5.7 MB |
| `order.onnx` | 图神经网络 (Graph Cluster) | 复杂排版与多栏阅读顺序重建 | 1.2 MB |
| `meta.json` | 词典与预处理元数据 | 字符映射表与模型归一化配置 | 280 KB |

> 📌 **进阶功能说明**：原厂公式识别转 LaTeX（`--math`）涉及自回归解码器与约 20 MB 增量模型，规划作为可选插件扩展接入。

---

### 💻 程序化调用 (API 指南)

你可以将 `indra-web` 直接当作模块引入到你自己的现代前端项目中：

```javascript
import { loadModels, ocrPage, toMarkdown } from "./src/core/index.js";

// 1. 初始化并加载模型（支持多线程）
const info = await loadModels({
  threads: 4,
  onProgress: ({ file, frac }) => {
    console.log(`正在下载 ${file}: ${(frac * 100).toFixed(1)}%`);
  }
});

// 2. 识别图片或 Canvas
const result = await ocrPage(imageBitmap, {
  stage: (name) => console.log("当前阶段:", name),
  boxes: (boxes) => console.log("检测到行框数:", boxes.length)
});

// 3. 读取识别产物
console.log("倾斜扶正角度:", result.rotation); // 0, 90, 180, 270
console.log("识别文本行:", result.lines);      // [{ box, text, conf }]
console.log("结构化 Markdown:\n", result.md);  // 含标题、列表与 2D 表格
```

#### `ocrPage` 返回值结构 (`OCRPageResult`)

```typescript
interface OCRPageResult {
  lines: Array<{
    box: [number, number, number, number]; // [x0, y0, x1, y1]
    text: string;                          // 识别文本内容
    conf: number;                          // 置信度 (0.0 ~ 1.0)
  }>;
  md: string;        // 解析合成的结构化 Markdown
  rotation: number;  // 自动纠偏顺时针旋转角度 (0, 90, 180, 270)
  time: number;      // 页面处理耗时 (毫秒)
  source: "ocr" | "text"; // "text" 代表来自电子 PDF 文本层
}
```

---

### 🚀 生产部署要点 (必须配置跨源隔离)

由于 WASM 多线程依赖浏览器的 `SharedArrayBuffer`，部署托管静态页面的服务器（如 Nginx、Vercel、Cloudflare、Netlify）必须配置以下两条安全响应头：

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

本项目已包含开箱即用的 Cloudflare Worker 部署代码（见 `deploy/worker.js`），运行以下命令即可快速部署到全球边缘节点：

```bash
npm run deploy:worker
```

---

### ⚖️ 开源协议与合规说明

1. **项目源码许可**：
   本项目前端工程代码采用 **Apache-2.0** 许可证开源，允许自由修改、集成与商业化。
2. **上游模型授权**：
   官方模型权重由 Datalab 发布，采用**修改版 OpenRAIL-M** 协议：高校科研、个人学习以及**年营收或累计融资金额在 2,000 万美元以下**的企业可**免费商业使用**。
3. **致谢与声明**：
   本项目模型权重与算法思想源自 [Datalab Indra OCR](https://github.com/datalab-to/indra)。本项目不镜像转存任何二进制模型权重文件，均通过用户客户端直接向官方托管地址请求。

---

### 📝 引用

```bibtex
@software{indra_web_2026,
  author = {FireTable},
  title = {INDRA OCR Web: Client-side In-Browser Document Parsing and Layout Reconstruction},
  url = {https://github.com/FireTable/indra-web},
  year = {2026}
}
```

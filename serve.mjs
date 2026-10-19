#!/usr/bin/env node
/**
 * 本地静态服务器（Node.js 原生，零依赖）
 * 关键特性：强制注入跨源隔离头，开启 SharedArrayBuffer 多线程 WASM 推理
 *
 * 用法：
 *   node serve.mjs
 *   node serve.mjs 8080
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.argv[2]) || 8792;
const root = resolve(__dirname);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const server = createServer((req, res) => {
  // 跨源隔离头 —— WASM 多线程的硬依赖
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-cache");

  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  let filePath = join(root, urlPath === "/" ? "index.html" : urlPath);

  if (!existsSync(filePath)) {
    if (urlPath === "/" && existsSync(join(root, "indra-ocr.html"))) {
      filePath = join(root, "indra-ocr.html");
    } else {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("404 Not Found");
      return;
    }
  }

  if (statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
    if (!existsSync(filePath)) {
      res.statusCode = 404;
      res.end("404 Not Found");
      return;
    }
  }

  const ext = extname(filePath).toLowerCase();
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");

  createReadStream(filePath).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`\n⚡ INDRA OCR 本地服务已启动`);
  console.log(`➜ 本地地址:  http://127.0.0.1:${port}/`);
  console.log(`➜ 跨源隔离:  COOP=same-origin, COEP=credentialless (WASM 多线程已激活)\n`);
});

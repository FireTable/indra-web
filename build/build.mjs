#!/usr/bin/env node
/**
 * 把 build/ 下的三段源码合成为自包含的 index.html 与 indra-ocr.html
 * 纯 Node.js ESM，零依赖，跨平台（macOS / Linux / Windows）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const shell = readFileSync(resolve(__dirname, "shell.html"), "utf8");
const core = readFileSync(resolve(__dirname, "core.js"), "utf8");
const app = readFileSync(resolve(__dirname, "app.js"), "utf8");

if (!shell.includes("/*__CORE__*/") || !shell.includes("/*__APP__*/")) {
  console.error("错误：shell.html 中缺失 /*__CORE__*/ 或 /*__APP__*/ 占位符");
  process.exit(1);
}

const html = shell
  .replace("/*__CORE__*/", core)
  .replace("/*__APP__*/", app);

// 输出 indra-ocr.html 与 index.html（便于静态托管）
const outOcr = resolve(root, "indra-ocr.html");
const outIndex = resolve(root, "index.html");

writeFileSync(outOcr, html, "utf8");
writeFileSync(outIndex, html, "utf8");

const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
console.log(`✓ 构建完成：${outOcr} (${kb} KB)`);
console.log(`✓ 构建完成：${outIndex} (${kb} KB)`);

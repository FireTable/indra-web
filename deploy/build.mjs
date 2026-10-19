#!/usr/bin/env node
/**
 * 把 ../indra-ocr.html 打包成 Worker 能 import 的 ./html.js
 * 纯 Node.js ESM，零依赖
 */
import { readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, "../indra-ocr.html");

if (!existsSync(htmlPath)) {
  console.error(`找不到 ${htmlPath}，请先执行 npm run build 或 node build/build.mjs`);
  process.exit(1);
}

const src = readFileSync(htmlPath, "utf8");
const outPath = resolve(__dirname, "html.js");

const content =
  "// 自动生成，请勿手改：改页面请改 build/ 下的源码，然后跑 npm run build\n" +
  `// 来源：indra-ocr.html (${Buffer.byteLength(src, "utf8")} 字节)\n` +
  "export default " + JSON.stringify(src) + ";\n";

writeFileSync(outPath, content, "utf8");

const size = (statSync(outPath).size / 1024).toFixed(1);
console.log(`✓ 构建完成：${outPath} (${size} KB)`);

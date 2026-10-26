/* Cloudflare Worker：把单文件版 indra-ocr 发出去。
 *
 * 关键只有一件事：**必须带跨源隔离头**。
 *   Cross-Origin-Opener-Policy: same-origin
 *   Cross-Origin-Embedder-Policy: credentialless
 * 少了这两个，浏览器就不给 SharedArrayBuffer，onnxruntime-web 只能单线程跑，
 * 18 MB 权重每页要慢好几倍。本地 serve.py 也是发这两条，线上必须一样，
 * 否则「本地 4 线程、线上单线程」会让人以为部署坏了。
 *
 * 用 credentialless 而不是 require-corp：后者会拦掉没有 CORP 头的跨源资源，
 * 而页面本来就要从 jsDelivr 取 wasm、从 Hugging Face 取权重。
 *
 * 模型和 wasm 不经过 Worker——页面直接从公网取，这里只发一个 HTML，
 * 所以流量成本几乎全在静态文件上。
 */
import HTML from "./html.js";

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "index, follow",
  /* 浏览器每次都回源校验（max-age=0），边缘缓存 5 分钟。
     页面本身改得少，真正的大头是模型和 wasm，那部分不归这里管。 */
  "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
};

const ROBOTS_TXT = `User-agent: *
Allow: /
Sitemap: https://indra-web.firetable.tech/sitemap.xml
`;

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://indra-web.firetable.tech/</loc>
    <lastmod>2026-10-19</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://indra-web.firetable.tech/indra-ocr.html</loc>
    <lastmod>2026-10-19</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
`;

const FAVICON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='4' y1='4' x2='60' y2='60' gradientUnits='userSpaceOnUse'><stop offset='0%' stop-color='%23FFFFFF'/><stop offset='45%' stop-color='%23F4F4F6'/><stop offset='100%' stop-color='%23A1A1AA'/></linearGradient></defs><rect x='4' y='4' width='56' height='56' rx='12' fill='url(%23g)'/><rect x='18' y='18' width='28' height='28' rx='6' fill='%2309090B'/></svg>`;

const MANIFEST_JSON = JSON.stringify({
  name: "INDRA OCR Web",
  short_name: "INDRA OCR",
  description: "100% On-Device Neural Document OCR and Parsing",
  start_url: "/",
  display: "standalone",
  background_color: "#0a0a0b",
  theme_color: "#0a0a0b",
  icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }]
}, null, 2);

// 老书签、常见拼法都还给应用，不至于 404
const APP_PATHS = new Set(["/", "/index.html", "/indra-ocr.html"]);

export default {
  async fetch(req) {
    const url = new URL(req.url);

    // 探活：部署完先 curl 这个，别去猜页面是不是活的
    if (url.pathname === "/healthz") {
      return new Response("ok", { headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    // OpenGraph 社交卡片分享图
    if (url.pathname === "/og.png") {
      return fetch("https://cdn.firetable.tech/blog/global/og_fashion_indra.png");
    }

    // SEO: robots.txt
    if (url.pathname === "/robots.txt") {
      return new Response(ROBOTS_TXT, {
        headers: { "content-type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
      });
    }

    // SEO: sitemap.xml
    if (url.pathname === "/sitemap.xml") {
      return new Response(SITEMAP_XML, {
        headers: { "content-type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=86400" },
      });
    }

    // Favicon 与 Apple Touch Icon 请求统一返回 SVG 图标，杜绝 404 日志噪音
    if (url.pathname === "/favicon.ico" || url.pathname === "/favicon.svg" || url.pathname === "/apple-touch-icon.png" || url.pathname === "/apple-touch-icon-precomposed.png") {
      return new Response(FAVICON_SVG, {
        headers: { "content-type": "image/svg+xml", "Cache-Control": "public, max-age=604800, immutable" },
      });
    }

    // PWA Manifest
    if (url.pathname === "/manifest.webmanifest" || url.pathname === "/manifest.json") {
      return new Response(MANIFEST_JSON, {
        headers: { "content-type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=86400" },
      });
    }

    if (!APP_PATHS.has(url.pathname)) {
      return new Response("404 Not Found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("405 Method Not Allowed", {
        status: 405,
        headers: { "content-type": "text/plain; charset=utf-8", allow: "GET, HEAD" },
      });
    }

    // HEAD 不带 body，省掉 160 KB 的下行
    return new Response(req.method === "HEAD" ? null : HTML, { headers: HTML_HEADERS });
  },
};

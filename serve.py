#!/usr/bin/env python3
"""带跨源隔离头的本地静态服务器。

注意：在现代工程化开发中，推荐直接运行 `npm run dev`（基于 Vite，自带 HMR 与相同的隔离头）。
此脚本保留用于纯 Python 环境下的简易本地调试。

普通 `python3 -m http.server` 不发这两个响应头，浏览器就不会给
SharedArrayBuffer，onnxruntime-web 只能单线程跑推理。这里补上：

    Cross-Origin-Opener-Policy: same-origin
    Cross-Origin-Embedder-Policy: credentialless

用 credentialless 而不是 require-corp：后者会拦掉没有 CORP 头的跨源资源，
而我们本来就要从 jsDelivr 取 wasm、从 Hugging Face 取权重。credentialless
同样能开 SharedArrayBuffer，且对 CORS 资源放行。

    python3 serve.py [端口]        # 默认 8792，只绑本机
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HEADERS = {
    # 跨源隔离 → SharedArrayBuffer 可用 → WASM 多线程
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "credentialless",
    # 别让浏览器缓存住半成品
    "Cache-Control": "no-cache",
}


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        for k, v in HEADERS.items():
            self.send_header(k, v)
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8792
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"indra-ocr  →  http://127.0.0.1:{port}/indra-ocr.html")
    print("  已开启跨源隔离，WASM 多线程可用（看顶栏「引擎」徽章上的 ×N）\n")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")


if __name__ == "__main__":
    main()

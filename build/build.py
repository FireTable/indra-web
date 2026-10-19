#!/usr/bin/env python3
"""[DEPRECATED] 历史遗留文本拼接脚本。

注意：现代构建请使用 Vite 工作流：`npm run build`
Vite 构建集成了 AST 解析、Tree-shaking、CSS/JS 压缩，产出的单文件由 184 KB 优化至 112 KB。
此脚本仅保留作为无 Node 环境下的向后兼容备份。
"""
from pathlib import Path
here = Path(__file__).parent
out = (here.parent / "indra-ocr.html")
html = (here / "shell.html").read_text(encoding="utf-8")
assert "/*__CORE__*/" in html and "/*__APP__*/" in html, "占位符缺失"
html = html.replace("/*__CORE__*/", (here / "core.js").read_text(encoding="utf-8"))
html = html.replace("/*__APP__*/", (here / "app.js").read_text(encoding="utf-8"))
out.write_text(html, encoding="utf-8")
(here.parent / "index.html").write_text(html, encoding="utf-8")
print(f"built {out} and index.html ({len(html.encode())/1024:.1f} KB)")

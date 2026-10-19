#!/usr/bin/env python3
"""把 ../indra-ocr.html 打包成 Worker 能 import 的 ./html.js

页面本身是构建产物（build/build.py 生成的），每次改完代码要按这个顺序跑：

    python3 build/build.py        # 三段源码 → indra-ocr.html
    python3 deploy/build.py       # indra-ocr.html → deploy/html.js

拆成两个文件而不是把 HTML 塞进 worker.js，是为了让 worker.js 保持成普通的
可读源码：手写逻辑要能直接编辑、能被 git diff 出来。

用 json.dumps 输出而不是模板字符串：页面里有 `</script>`、反引号、`${}` 和
大量非 ASCII，模板字符串转义起来很容易漏一处，漏了就是线上白屏。
JSON 字符串字面量是 JS 的子集，json.dumps 处理得更严密。
"""
import json
from pathlib import Path

here = Path(__file__).parent
html = (here.parent / "indra-ocr.html")
if not html.exists():
    raise SystemExit(f"找不到 {html}，先跑 python3 build/build.py")

src = html.read_text(encoding="utf-8")
out = here / "html.js"
out.write_text(
    "// 自动生成，别手改：改页面请改 build/ 下的源码，然后跑 build/build.py 和 deploy/build.py\n"
    "// 来源：indra-ocr.html（%d 字节）\n" % len(src.encode("utf-8"))
    + "export default " + json.dumps(src, ensure_ascii=False) + ";\n",
    encoding="utf-8",
)
print(f"built {out}  ({out.stat().st_size/1024:.1f} KB)")

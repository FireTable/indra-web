#!/usr/bin/env python3
"""给「干净克隆」补齐两个回归用例的样例。

为什么需要这个：`telegram.png` / `talltest.png` 是真实账号的招聘帖截图，
里面有别人的 handle、昵称、公司和具体薪资，已经进 `.gitignore`，
所以克隆下来的仓库没有这两个文件。

这个脚本用**纯合成内容**画两张同规格的聊天截图：
`telegram.png` 是手机截图（1084×1280，小字号，基线 17 行），
`talltest.png` 是长截图（920×2360，同一段内容拉长，基线 18 行）。
两张图走的是同一段文本，所以基线行数应当接近原图；
行数对不上也没关系——回归看的是**同一份文件每次结果一致**，
不是跟某个绝对数字对齐。真要对齐绝对数字，看 `regenerate.py` 末尾打印的实测值，
把它填进 README 的用例表即可。

依赖：Pillow。只用系统字体，找不到中文字体时会退回默认位图字体，
那时汉字会变成方块，识别行数自然不同——脚本会提示。

输出目录是 `samples/`（整个目录在 `.gitignore` 里，所以生成物不会进仓库）。
"""
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("需要 Pillow：pip install pillow")

here = Path(__file__).resolve().parent.parent / "samples"
here.mkdir(parents=True, exist_ok=True)

# 纯合成内容，不指向任何真人、公司或真实招聘
LINES = [
    ("合成样例 · 示例账号", 0),
    ("这是一段用于回归测试的合成文本。", 0),
    ("第一项：编号 1234567890 的清单条目。", 0),
    ("第二项：mixed text with 中文 and English.", 0),
    ("第三项：标点，。！？（）「」—— 都在。", 0),
    ("第四项：金额 500 与比例 12.5% 的混排。", 0),
    ("第五项：链接样式的 example.invalid/path。", 0),
    ("第六项：这是一行比较长的合成文本，用来验证长句在窄列里会不会被错误地切断。", 0),
    ("第七项：数字 9876543210 反过来读一遍。", 0),
    ("第八项：括号 (parentheses) 与方括号 [brackets]。", 0),
    ("第九项：全角ＡＢＣ与半角 ABC 对照。", 0),
    ("第十项：结束语 synthetic sample ends here.", 0),
]


def find_font(size):
    for p in (
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    ):
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return None


def render(w, h, path, chrome):
    """chrome=True 画一条标题栏（模拟 App 截图）；否则整页纯文字（长截图）"""
    img = Image.new("RGB", (w, h), "#ffffff")
    d = ImageDraw.Draw(img)
    body = find_font(28)
    if body is None:
        print("!! 找不到中文字体，汉字会变成方块，识别行数会不同")
        body = ImageFont.load_default()
    title = find_font(30) or body
    y = 40
    if chrome:
        d.rectangle([0, 0, w, 110], fill="#f2f3f5")
        d.rectangle([0, 108, w, 110], fill="#d8d9dd")
        d.text((30, 38), "合成样例账号 · 4小时前", font=title, fill="#111111")
        y = 150
    d.text((36, y), LINES[0][0], font=title, fill="#111111")
    y += 62
    for text, _ in LINES[1:]:
        d.text((36, y), text, font=body, fill="#1a1a1a")
        y += 54
    img.save(path)
    print(f"已生成 {path}  ({w}×{h})")


if __name__ == "__main__":
    # 手机截图：带标题栏的小图，小字号，行少
    render(1084, 1280, here / "telegram.png", chrome=True)
    # 长截图：同一段内容、纯文字、更长
    render(920, 2360, here / "talltest.png", chrome=False)
    print("\n跑一遍回归，把实际行数填进 README 的用例表（README 里 17 / 18 那两行）。")

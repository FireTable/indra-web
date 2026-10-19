# 样例文件（不随仓库分发）

回归用例的输入。**整个 `samples/` 目录都在 `.gitignore` 里**，
这份清单和 `tools/regenerate-samples.py` 是仓库里仅有的相关文件。。每个文件对应主 README「对照验证」里的一行。

## 可以公开的

| 文件 | 对应用例 | 来源 |
|---|---|---|
| `official-chinese_essay.png` | 中文页 41 行 | indra 官方示例（上游仓库自带） |
| `official-table_pmc.png` | 表格 188 行 | 同上 |
| `official-rotated_letter.png` | 旋转信 98 行 | 同上，Goldman Sachs 2022 年报的一页，公开财报，无个人信息 |
| `official-multi_column.png` | 双栏 138 行 | 同上 |
| `official-expected-output.md` | 官方 Python 实现的期望输出，用来对拍 | 同上 |
| `sample.png` / `sample.pdf` | 混排样例 5 行 / 电子版 PDF 38·22 行 | 本项目自造 |
| `multipage.pdf` | 3 页 57·32 行 | 本项目自造 |
| `big.pdf` / `many.pdf` | 8 页 88 行 / 200 页 2200 行 | 本项目自造 |
| `finetext.png` | 细字号 49 行 | 本项目生成的合成表格 |
| `sample.html` 系列 | 上面几个 PDF / PNG 的排版源文件 | 本项目自造 |

## **不能公开的**

| 文件 | 为什么 |
|---|---|
| `telegram.png` | 真实 X 账号的招聘帖截图，含认证 handle、昵称、公司名和具体薪资 |
| `talltest.png` | 同一张帖子的长截图 |
| `talltest.html` | 同一段文字的 HTML 源（文本可 grep，最容易漏掉） |

这三个已经写进本目录的 `.gitignore`：本机照常保留、照常跑回归
（「手机截图 17 行」「长截图 18 行」），但不会进仓库。
推到公开仓库等于把别人的身份和这条内容永久挂上去并让搜索引擎索引，
事后删文件撤不回（fork、缓存、第三方镜像都留着）。

## 在干净克隆里补齐

```bash
python3 tools/regenerate-samples.py
```

用纯合成内容画两张同规格的聊天截图，中文字体正常（实测 1084×1280 与 920×2360，
渲染出的汉字是真字形不是方块）。实测行数：

| 文件 | 行 | 耗时 |
|---|---|---|
| `telegram.png` | **13** | 216 ms |
| `talltest.png` | **12** | 176 ms |

和原图（17 / 18）不同是正常的——回归看的是**同一份文件每次结果一致**，
不是跟某个绝对数字对齐。想让主 README 的用例表和公开仓库对得上，
把上表两行替换掉原来那两行即可。

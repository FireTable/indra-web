# 部署到 Cloudflare

把 `indra-ocr.html` 这一个文件发到 `indra-web.firetable.tech`。没有后端、没有数据库、
没有环境变量——推理全在浏览器里跑，模型权重直接从 Hugging Face 拉，Worker 只负责
把那段 HTML 递出去，并且**带上跨源隔离响应头**。

## 当前状态

| | |
|---|---|
| Worker | `indra-web`，已部署（本机 Cloudflare 账号） |
| 可用地址 | <https://indra-web.firetable.workers.dev> |
| 生产域名 | `indra-web.firetable.tech` 的 **route 已配置** |

**生效前提**：把 `indra-web` 这条 DNS 记录**在 Cloudflare 控制台添加并开启代理（橙色云朵）**。

在 Cloudflare 控制台 → `firetable.tech` 的 DNS 页 → 添加 CNAME 或 A 记录：
- 类型：`CNAME`，名称：`indra-web`，目标：`indra-web.firetable.workers.dev`（或现有根域）
- 代理状态：必须为**「已代理」（橙色云朵）**。
配置后，Cloudflare 会自动为 `https://indra-web.firetable.tech` 签发边缘 SSL 证书。

> 部署用的 wrangler OAuth 只有 `workers` 和 `workers_routes` 写权限，没有 DNS 写权限，
> 所以这一步只能你在控制台点一下。

## 文件

| 文件 | 作用 | 要不要手改 |
|---|---|---|
| `worker.js` | Worker 本体，纯手写源码 | 改逻辑才动 |
| `html.js` | 页面内容，**自动生成** | 别动 |
| `build.py` | `indra-ocr.html` → `html.js` | 一般不动 |
| `wrangler.toml` | Worker 名、域名路由 | 换域名才动 |
| `pages/_headers` | 如果你用 Pages 而不是 Workers | Pages 路线才用 |

## 改完代码怎么发

页面源码在 `../build/`，所以顺序是固定的：

```bash
# 推荐单命令（纯前端一键构建与部署）：
npm run deploy:worker

# 或手动单步执行：
node build/build.mjs                    # build/{core,app}.js + shell.html → indra-ocr.html & index.html
node deploy/build.mjs                   # indra-ocr.html → deploy/html.js
cd deploy && wrangler deploy            # 发上去
```

跳过第一步直接 `deploy/build.py` 会把**上一次的**页面发上去——很容易发生，
因为看起来「我只是改了 deploy 的东西」。

## 第一次部署

```bash
cd deploy
wrangler login          # 浏览器里授权，注意是哪个账号
wrangler whoami         # 确认账号
wrangler deploy         # 第一次会问要不要建 Worker，同意
```

发完会同时给两个地址：

- `https://indra-web.<你的子域>.workers.dev` —— 立刻能用，和自定义域名无关
- `https://indra-web.firetable.tech` —— 取决于 `wrangler.toml` 里的路由有没有生效

## 域名配置

`wrangler.toml` 里用的是 **custom_domain** 与 **route**：

```toml
[[routes]]
pattern = "indra-web.firetable.tech"
custom_domain = true

[[routes]]
pattern = "indra-web.firetable.tech/*"
zone_name = "firetable.tech"
```

适用于 `firetable.tech` 整个 zone 已经在 Cloudflare 上，`indra-web` 是它的一个子域。
只接管 `indra-web` 这一个子域，zone 里别的东西不受影响。
`custom_domain = true` 会由 Cloudflare 自动创建 DNS 记录并申请 SSL 证书。

### route 和 custom_domain 的区别

| | route | custom_domain |
|---|---|---|
| 前提 | 子域解析到 Cloudflare 且**已代理** | 域名本身托管在 Cloudflare，Cloudflare 自动建 DNS |
| DNS 要不要手改 | 要，拨成橙色云朵 | 不要 |
| 证书 | Cloudflare 自动 | Cloudflare 自动 |
| 适合 | 子域（现在这种） | 独立 zone |

注意 route **不等于** Cloudflare 帮你把 DNS 拨到代理状态。DNS 还停在「仅 DNS」的话，
请求根本到不了 Cloudflare，route 形同虚设——这就是当前的状态。

## 发完先验这三个

```bash
curl -I https://indra-web.firetable.tech | grep -i cross-origin
```

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
curl -s https://indra-web.firetable.tech/healthz      # → ok
curl -s https://indra-web.firetable.tech/nope -o /dev/null -w '%{http_code}\n'   # → 404
```

然后**在浏览器里**打开页面，看顶栏那枚徽章：

```
4× · worker · isolated
```

- 显示 `4×` → 多线程正常
- 显示 `1×` 或没有 `isolated` → 跨源隔离头没生效，最常见的原因是域名上的
  Cloudflare 规则（缓存规则 / Transform Rules）把响应头改掉了。
  在控制台里对这个域名检查有没有覆盖响应头的规则。

控制台里也可以直接验，不用打开页面：

```js
crossOriginIsolated          // 必须是 true
typeof SharedArrayBuffer     // 必须是 "function"
```

## 容易踩的坑

**这两个头不能少。** 少了 `Cross-Origin-Opener-Policy: same-origin` 和
`Cross-Origin-Embedder-Policy: credentialless`，浏览器就不给 `SharedArrayBuffer`，
onnxruntime-web 只能单线程跑，18 MB 权重每页慢好几倍。
本地 `serve.py` 发的是同两条，线上必须一样——否则会出现「本地 4 线程、线上 1 线程」，
看起来像部署坏了，其实只是少了两个头。

**为什么是 `credentialless` 而不是 `require-corp`。** 后者会拦掉没有
`Cross-Origin-Resource-Policy` 头的跨源资源，而页面本来就要从 jsDelivr 取 wasm、
从 Hugging Face 取 18 MB 权重，那些资源不带 CORP 头。`credentialless` 同样能开
`SharedArrayBuffer`，但对 CORS 资源放行。

**缓存。** HTML 本身 5 分钟边缘缓存、浏览器始终回源校验。发完新版本别人可能要等
几分钟才看到，调试时用 `?v=2` 之类加个查询串绕过。

**wrangler 版本。** 本机装的 wrangler 会提示版本旧，不影响部署，
但 `npm i -g wrangler@4` 之后行为更稳。

## 不想用 Workers：用 Pages

把 `pages/_headers` 和 `indra-ocr.html`（改名 `index.html`）一起丢进 Pages 项目，
效果完全一样——`_headers` 里写的就是 Worker 发的那几个头。
Pages 项目的自定义域名在控制台里绑，不用改任何配置。

# 随行 Codex（验证初版）

手机启动页 + Codespaces 中转 + 本地连接程序。没有购买云服务器。

## 当前状态

- 静态启动页在 `launcher/`，支持跳转 GitHub 登录后启动环境，也支持个人访问令牌直接调用 GitHub 的启动、状态、停止 API。令牌只在页面内存中保留，不能把令牌提交到仓库。
- `.github/workflows/pages.yml` 自动测试并发布启动页到 GitHub Pages。它不发布聊天记录，不会自动创建、启动 Codespaces，也不会部署本地连接程序。
- 中转和聊天页面可运行，基础鉴权、请求转发测试通过。
- 本地 Codex 的列表、历史、测试对话收发已实测；用户已确认手机连接成功。手机审批和桌面当前对话的同时接管仍未完整验证。
- 本地连接程序暂为 Node.js 验证实现。用户要求的 Java + WebSocket 版本尚未实现。目前电脑每秒轮询，页面约 3.5 秒刷新。
- 不承诺完整复用桌面应用的专用工具。被桌面占用的线程可能无法从独立 app-server 恢复；应先使用独立测试对话。

## 免费与启动

GitHub Free 每月 Codespaces 120 核小时（双核约 60 小时）、15 GB 存储额度，与其他环境共享。不是无限免费托管。

在 GitHub Billing 中确认剩余额度，并禁止超额付费后再创建或启动 Codespaces。应用不设置预算、不购买额度、不绕过闲置休眠。默认闲置 30 分钟停止；网页访问不保证被识别为活动。

手机可打开 https://github.com/codespaces 启动；静态启动页不会随 Codespace 停止。GitHub 登录会话不等于授权自建页面调用 API；一键启动需要单独授权令牌。细粒度令牌只授予本项目 Codespaces 读取和 Codespaces lifecycle admin 写入权限。

## Codespaces 中转配置

1. 用此仓库创建双核 Codespace。
2. 为此仓库设置 Codespaces Secrets：`POCKET_BROWSER_TOKEN`、`POCKET_HOST_TOKEN`，各自为不同的至少 24 字符随机密钥。
3. 环境启动后 `postStartCommand` 启动中转。端口 8787 由 Ports 面板提供访问地址。
4. 本地电脑需要访问转发端口。若设为 Public，入口由本项目的两种访问密钥分别保护。不要公开 app-server 原始端口。
5. 把 Ports 的 HTTPS 地址填入手机启动页和电脑端 `POCKET_RELAY_URL`。

## 本地验证

需要 Node.js 22+ 和已登录的 Codex CLI。

在终端分别启动：

```powershell
$env:POCKET_BROWSER_TOKEN = '自行生成的手机访问密钥'
$env:POCKET_HOST_TOKEN = '另一个不同的电脑访问密钥'
npm start
```

```powershell
$env:POCKET_HOST_TOKEN = '与中转相同的电脑访问密钥'
$env:POCKET_RELAY_URL = 'http://127.0.0.1:8787'
npm run agent
```

浏览器打开 http://127.0.0.1:8787 ，输入手机访问密钥。连接云端时把地址改为 Ports 中的 HTTPS 地址。

## 已知边界

临时任务保存在内存，重启不保留。电脑离线时拒绝发送；交付后超时需先查看记录，不自动重发。仅支持文字；非支持类型的工具授权不能在手机上直接批准。当前运行状态仅反映连接程序接管的任务。

使用 HTTPS 和独立密钥；中转能看到消息内容，这不是端到端加密。Codespaces 停止后电脑只重试连接，不会自动唤醒并消耗额度。

## 手机登录与密钥

登录时可以选择记住当前浏览器 30 天，凭证使用 Secure、HttpOnly、SameSite=Strict Cookie，不读取硬件机器码。5 分钟无操作会锁定；页面自动刷新不延长会话。回来时凭证仍有效的浏览器自动恢复，其他浏览器需要密钥。手机解锁后持有者也可能访问，这不等于指纹或人脸认证。

右上角“安全设置”可以修改密钥（16–128 字符），需要输入旧密钥。修改后旧密钥、其他会话和已信任设备全部失效，可选择重新信任当前手机。还可取消所有设备信任，或者退出并忘记当前手机。普通关闭页面不触发退出。

新密钥的加盐哈希和设备凭证哈希保存于 `.local/auth.json`，普通停止/启动会保留；不要上传、公开或删除该文件。更改后 Codespaces Secret 中的初始手机密钥不会自动同步；日常登录使用新密钥。如果删除整个环境或认证文件，会丢失这次修改及信任记录，重新创建会使用 Secrets 的初始密钥，需要重新配对。电脑连接密钥不随手机密钥修改。

云端源码更新需在 Codespaces 中执行 `git pull --ff-only` 后运行 `bash scripts/restart-cloud.sh`。GitHub Pages 自动部署只更新入口页。更新期间中转短暂中断，已发送的任务不要自动重发。

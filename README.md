# CreatKey

TapNow 风格的 AI 工作流创作平台，包含纯前端 `frontend` 和 Node.js 后端 `backend`。

## 本地启动

1. 复制环境变量：`cp .env.example .env`
2. 启动 PostgreSQL、Redis 和 MinIO：`npm run docker:up`
3. 安装依赖：`npm install`
4. 初始化数据库：`npm run db:push`
5. 开发运行：`npm run dev`

默认启用模拟短信和模拟支付，短信登录支持 `+86` 中国大陆手机号，开发万能验证码为 `888888`。

## AI 工作流与百炼

工作流中的文本、图片、音频和视频输入会保存到 `LOCAL_UPLOAD_DIR`（默认项目根目录下的
`uploads`），Docker 环境由 `uploads_data` 数据卷在 API 与 Worker 之间共享。媒体存储通过统一
Provider 接口访问，后续可直接增加阿里云 OSS 实现。

调用阿里云百炼前，在 `.env` 中配置：

```bash
DASHSCOPE_API_KEY="新创建的 API Key"
DASHSCOPE_BASE_URL="创建 API Key 时显示的 OpenAI compatible API Host"
```

新版 `sk-ws` Key 应使用其业务空间专属 API Host。请勿把 API Key 写入源码或提交到 Git。
图生视频要求百炼能够访问来源图片；本地开发时需要把 `PUBLIC_API_URL` 配置为可公网访问的 API
地址，上线切换 OSS 后由 OSS URL 自动满足该条件。

点击“执行全部”后，后端会校验数据库中的工作流 JSON 并通过 `activeRunId` 锁定工作流；锁定期间
API 会拒绝保存，画布只允许查看、缩放和取消执行。BullMQ 按 DAG 依赖调度节点，独立分支最多
并行执行 8 个任务。失败节点的后代会标记为 `SKIPPED`，无关分支继续执行。节点运行记录保存
输入、输出、开始/结束时间、毫秒耗时和清理后的错误详情。运行成功、失败、取消或超过
`WORKFLOW_RUN_TIMEOUT_MS` 后会自动解除编辑锁。

工作流定义直接保存在数据库的 `Workflow.definition` JSON 字段中，不为每次运行创建快照；用户
可以在画布顶部导入或导出同一格式的 JSON 文件。

## 运营后台

运营后台是与 `frontend` 同级的独立 `manage` 应用，开发地址为
`http://localhost:5174`。首次启动时，后端会在空管理员表中根据 `.env` 的
`ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 创建管理员。开发默认账号为 `admin`，密码为
`CreatKey@2026`，生产部署前必须修改。运营后台提供数据概览、用户与 Keys 管理、工作流运行记录、充值套餐配置和订单查询。

## Docker 部署

```bash
cp .env.example .env
npm run docker:up
```

项目内置的 Docker 包装脚本会自动使用当前 Docker Context（包括 Colima），并规避本机失效的
`docker-credential-desktop` 或缺失 buildx 插件导致的构建失败。代码更新后若需要强制重建全部
应用容器，运行：

```bash
npm run docker:refresh
```

可使用 `npm run docker:ps` 查看容器状态，使用 `npm run docker:logs` 跟踪 API 与 Worker 日志。

容器包含前端、NestJS API、BullMQ Worker、PostgreSQL、Redis 和 MinIO。数据库结构由一次性 `migrate` 容器初始化。云端部署时请替换 `.env` 中所有密码、Pepper、支付证书和短信供应商配置。

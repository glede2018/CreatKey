# CreatKey

TapNow 风格的 AI 工作流创作平台，包含纯前端 `frontend` 和 Node.js 后端 `backend`。

## 本地启动

1. 复制环境变量：`cp .env.example .env`
2. 启动 PostgreSQL、Redis 和 MinIO：`npm run docker:up`
3. 安装依赖：`npm install`
4. 初始化数据库：`npm run db:push`
5. 开发运行：`npm run dev`

默认启用模拟短信和模拟支付，短信登录支持 `+86` 中国大陆手机号，开发万能验证码为 `888888`。

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

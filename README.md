# CreatKey

TapNow 风格的 AI 工作流创作平台，包含纯前端 `frontend` 和 Node.js 后端 `backend`。

## 本地启动

1. 复制环境变量：`cp .env.example .env`
2. 启动 PostgreSQL、Redis 和 MinIO：`docker-compose up -d`
3. 安装依赖：`npm install`
4. 初始化数据库：`npm run db:push`
5. 开发运行：`npm run dev`

默认启用模拟短信和模拟支付，短信登录支持 `+86` 中国大陆手机号，开发万能验证码为 `888888`。

## Docker 部署

```bash
cp .env.example .env
docker-compose up -d --build
```

容器包含前端、NestJS API、BullMQ Worker、PostgreSQL、Redis 和 MinIO。数据库结构由一次性 `migrate` 容器初始化。云端部署时请替换 `.env` 中所有密码、Pepper、支付证书和短信供应商配置。

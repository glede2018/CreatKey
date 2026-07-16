import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";

/** 创建 HTTP API，注册全局中间件与 Swagger，并监听配置端口。 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // 头像会以 Base64 JSON 提交；2MB 原图编码后约 2.7MB。
  app.useBodyParser("json", { limit: "3mb" });
  app.setGlobalPrefix("api");
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cookieParser());
  const allowedOrigins = [
    process.env.FRONTEND_URL ?? "http://localhost:5173",
    process.env.MANAGE_URL ?? "http://localhost:5174",
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const config = new DocumentBuilder()
    .setTitle("CreatKey API")
    .setVersion("1.0")
    .addCookieAuth("ck_session")
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, config));
  await app.listen(Number(process.env.PORT ?? 3000));
}
bootstrap();

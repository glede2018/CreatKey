import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import type { RedisOptions } from "ioredis";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { DatabaseModule } from "./database/database.module";
import { ExecutionsModule } from "./executions/executions.module";
import { PaymentsModule } from "./payments/payments.module";
import { WorkflowsModule } from "./workflows/workflows.module";

/** 将 REDIS_URL 转换为 BullMQ/ioredis 使用的连接参数。 */
export function redisConnection(): RedisOptions {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../.env", ".env"] }),
    DatabaseModule,
    BullModule.forRoot({ connection: redisConnection() }),
    AuthModule,
    BillingModule,
    ExecutionsModule,
    WorkflowsModule,
    PaymentsModule,
  ],
})
export class AppModule {}

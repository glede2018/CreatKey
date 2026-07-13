import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Worker } from "bullmq";
import { AppModule, redisConnection } from "./app.module";
import { ExecutionsService } from "./executions/executions.service";

/** 启动独立 BullMQ Worker，并在退出信号到来时优雅关闭连接。 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });
  const executions = app.get(ExecutionsService);
  const worker = new Worker(
    "workflow-nodes",
    (job) => executions.executeNode(job.data.runId, job.data.nodeKey),
    { connection: redisConnection(), concurrency: 8 },
  );
  worker.on("failed", (job, error) => console.error(`Job ${job?.id} failed`, error));
  const close = async () => {
    await worker.close();
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", close);
  process.on("SIGINT", close);
}
bootstrap();

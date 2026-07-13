import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { ExecutionsController } from "./executions.controller";
import { ExecutionsService } from "./executions.service";
@Module({
  imports: [BullModule.registerQueue({ name: "workflow-nodes" }), BillingModule],
  controllers: [ExecutionsController],
  providers: [ExecutionsService],
  exports: [ExecutionsService],
})
export class ExecutionsModule {}

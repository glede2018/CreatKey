import { Module } from "@nestjs/common";
import { ExecutionsModule } from "../executions/executions.module";
import { WorkflowsController } from "./workflows.controller";
import { WorkflowsService } from "./workflows.service";
@Module({
  imports: [ExecutionsModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}

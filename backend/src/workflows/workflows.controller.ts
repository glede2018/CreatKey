import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { ExecutionsService } from "../executions/executions.service";
import { WorkflowsService } from "./workflows.service";
@Controller("workflows")
@UseGuards(AuthGuard)
export class WorkflowsController {
  constructor(
    private readonly workflows: WorkflowsService,
    private readonly executions: ExecutionsService,
  ) {}

  /** 列出当前用户的工作流。 */
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.workflows.list(user.id);
  }

  /** 获取当前用户拥有的指定工作流。 */
  @Get(":id") get(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.workflows.findOwned(id, user.id);
  }

  /** 创建并校验新的工作流定义。 */
  @Post() create(@Body() body: any, @CurrentUser() user: AuthUser) {
    return this.workflows.create(user.id, body);
  }

  /** 更新当前用户拥有的工作流。 */
  @Put(":id") update(@Param("id") id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    return this.workflows.update(id, user.id, body);
  }

  /** 锁定工作流并开始完整 DAG 或指定节点及其上游依赖的运行。 */
  @Post(":id/runs") run(
    @Param("id") id: string,
    @Body() body: { nodeId?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.executions.start(id, user.id, body.nodeId);
  }
}

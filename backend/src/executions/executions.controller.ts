import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { ExecutionsService } from "./executions.service";
@Controller("runs")
@UseGuards(AuthGuard)
export class ExecutionsController {
  constructor(private readonly executions: ExecutionsService) {}

  /** 查询属于当前用户的工作流运行详情。 */
  @Get(":id") get(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.executions.get(id, user.id);
  }

  /** 取消尚未结束的工作流运行。 */
  @Post(":id/cancel") cancel(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.executions.cancel(id, user.id);
  }
}

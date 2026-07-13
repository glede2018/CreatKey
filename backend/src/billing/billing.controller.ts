import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { PointsService } from "./points.service";
@Controller("billing")
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly points: PointsService) {}

  /** 查询当前用户的点数账户。 */
  @Get("account") account(@CurrentUser() user: AuthUser) {
    return this.points.account(user.id);
  }

  /** 查询当前用户最近 100 条点数流水。 */
  @Get("ledger") ledger(@CurrentUser() user: AuthUser) {
    return this.points.ledger(user.id);
  }
}

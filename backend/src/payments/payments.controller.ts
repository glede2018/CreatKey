import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** 返回当前可购买的 Keys 套餐。 */
  @Get("packages") packages() {
    return this.payments.packages();
  }

  /** 创建微信扫码充值订单。 */
  @Post("orders") @UseGuards(AuthGuard) create(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.payments.create(user.id, body);
  }

  /** 查询属于当前用户的充值订单状态。 */
  @Get("orders/:id") @UseGuards(AuthGuard) get(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.get(id, user.id);
  }

  /** 仅在模拟支付模式下确认订单，用于本地开发。 */
  @Post("orders/:id/dev-confirm") @UseGuards(AuthGuard) confirm(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.devConfirm(id, user.id);
  }

  /** 用户关闭支付弹窗时取消并关闭待支付订单。 */
  @Post("orders/:id/cancel") @UseGuards(AuthGuard) cancel(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.cancel(id, user.id);
  }

  /** 验证支付宝异步通知并完成充值。 */
  @Post("alipay/notify") async alipay(@Body() body: Record<string, string>) {
    if (!this.payments.gatewayService().verifyAlipay(body) || body.trade_status !== "TRADE_SUCCESS")
      return "failure";
    await this.payments.complete(body.out_trade_no, body.trade_no, body);
    return "success";
  }

  /** 验证、解密微信支付通知并完成充值。 */
  @Post("wechat/notify") async wechat(
    @Req() request: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string>,
  ) {
    const data = this.payments.gatewayService().parseWechat(request.rawBody!, headers);
    if (data.trade_state === "SUCCESS")
      await this.payments.complete(data.out_trade_no, data.transaction_id, data);
    return { code: "SUCCESS", message: "成功" };
  }
}

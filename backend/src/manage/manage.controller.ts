import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ManageAuthGuard } from "./manage-auth.guard";
import { ManageService } from "./manage.service";

@Controller("manage")
@UseGuards(ManageAuthGuard)
export class ManageController {
  constructor(private readonly manage: ManageService) {}

  @Get("overview") overview() {
    return this.manage.overview();
  }

  @Get("users") users(@Query("query") query?: string, @Query("page") page?: string) {
    return this.manage.users(query, Number(page));
  }

  @Post("users/:id/points") adjustPoints(@Param("id") id: string, @Body() body: any) {
    return this.manage.adjustPoints(id, body);
  }

  @Patch("users/:id/role") updateUserRole(@Param("id") id: string, @Body() body: any) {
    return this.manage.updateUserRole(id, body);
  }

  @Get("runs") runs(@Query("status") status?: string, @Query("page") page?: string) {
    return this.manage.runs(status, Number(page));
  }

  @Get("payments") payments(@Query("status") status?: string, @Query("page") page?: string) {
    return this.manage.payments(status, Number(page));
  }

  @Get("recharge-packages") rechargePackages() {
    return this.manage.rechargePackages();
  }

  @Post("recharge-packages") createRechargePackage(@Body() body: any) {
    return this.manage.createRechargePackage(body);
  }

  @Patch("recharge-packages/:id") updateRechargePackage(
    @Param("id") id: string,
    @Body() body: any,
  ) {
    return this.manage.updateRechargePackage(id, body);
  }
}

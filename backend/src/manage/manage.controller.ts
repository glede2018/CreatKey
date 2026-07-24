import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
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

  @Get("models") models(
    @Query("query") query?: string,
    @Query("capability") capability?: string,
    @Query("page") page?: string,
  ) {
    return this.manage.models(query, capability, Number(page));
  }

  @Get("model-invocations") modelInvocations(
    @Query("page") page?: string,
    @Query("modelId") modelId?: string,
    @Query("status") status?: string,
  ) {
    return this.manage.modelInvocations(Number(page), modelId, status);
  }

  @Get("assets/products") assetProducts(
    @Query("query") query?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
  ) {
    return this.manage.assetProducts(query, status, Number(page));
  }

  @Get("assets/characters") assetCharacters(
    @Query("query") query?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
  ) {
    return this.manage.assetCharacters(query, status, Number(page));
  }

  @Patch("assets/:type/:id/status") updateAssetStatus(
    @Param("type") type: string,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    return this.manage.updateAssetStatus(type, id, body);
  }

  @Get("product-categories") productCategories() {
    return this.manage.productCategories();
  }

  @Post("product-categories") createProductCategory(@Body() body: any) {
    return this.manage.createProductCategory(body);
  }

  @Patch("product-categories/:id") updateProductCategory(
    @Param("id") id: string,
    @Body() body: any,
  ) {
    return this.manage.updateProductCategory(id, body);
  }

  @Delete("product-categories/:id") deleteProductCategory(@Param("id") id: string) {
    return this.manage.deleteProductCategory(id);
  }

  @Patch("models/:id/status") updateModelStatus(@Param("id") id: string, @Body() body: any) {
    return this.manage.updateModelStatus(id, body);
  }

  @Patch("models/:id/costs") updateModelCosts(@Param("id") id: string, @Body() body: any) {
    return this.manage.updateModelCosts(id, body);
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

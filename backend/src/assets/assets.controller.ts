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
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { AssetsService } from "./assets.service";

@Controller("assets")
@UseGuards(AuthGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get("categories") categories() {
    return this.assets.categories();
  }

  @Get("products") products(
    @CurrentUser() user: AuthUser,
    @Query("query") query?: string,
    @Query("categoryId") categoryId?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
  ) {
    return this.assets.products(user.id, { query, categoryId, status, page: Number(page) });
  }

  @Post("products") createProduct(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.assets.createProduct(user.id, body);
  }

  @Patch("products/:id") updateProduct(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: any,
  ) {
    return this.assets.updateProduct(id, user.id, body);
  }

  @Delete("products/:id") deleteProduct(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.assets.deleteProduct(id, user.id);
  }

  @Get("characters") characters(
    @CurrentUser() user: AuthUser,
    @Query("query") query?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
  ) {
    return this.assets.characters(user.id, { query, status, page: Number(page) });
  }

  @Get("characters/generation-config") characterGenerationConfig() {
    return this.assets.characterGenerationConfig();
  }

  @Post("characters/generate") generateCharacter(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.assets.generateCharacter(user.id, body);
  }

  @Post("characters") createCharacter(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.assets.createCharacter(user.id, body);
  }

  @Patch("characters/:id") updateCharacter(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: any,
  ) {
    return this.assets.updateCharacter(id, user.id, body);
  }

  @Post("characters/:id/default") setDefaultCharacter(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assets.setDefaultCharacter(id, user.id);
  }

  @Delete("characters/:id") deleteCharacter(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assets.deleteCharacter(id, user.id);
  }
}

import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthRequest } from "./auth.types";

/** 从鉴权守卫处理后的请求中读取当前登录用户。 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthRequest>().user,
);

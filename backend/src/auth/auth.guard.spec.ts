import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AuthGuard } from "./auth.guard";

const contextFor = (request: any) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;
const session = (version: number, sessionVersion: number) => ({
  id: "session-1",
  version,
  expiresAt: new Date(Date.now() + 60_000),
  user: {
    id: "user-1",
    nickname: "测试",
    avatarUrl: null,
    roles: ["CREATOR"],
    sessionVersion,
    pointAccount: { balance: 100 },
  },
});

describe("single-session auth guard", () => {
  it("accepts the current session version", async () => {
    const prisma: any = {
      session: { findUnique: vi.fn().mockResolvedValue(session(3, 3)), delete: vi.fn() },
    };
    const request: any = { cookies: { ck_session: "token" } };
    await expect(new AuthGuard(prisma).canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user.id).toBe("user-1");
  });
  it("rejects an old session immediately after a newer login", async () => {
    const prisma: any = {
      session: {
        findUnique: vi.fn().mockResolvedValue(session(2, 3)),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    };
    await expect(
      new AuthGuard(prisma).canActivate(contextFor({ cookies: { ck_session: "old-token" } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

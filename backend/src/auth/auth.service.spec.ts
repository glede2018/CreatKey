import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuthService } from "./auth.service";

const service = new AuthService(
  {} as any,
  { get: (_key: string, fallback: unknown) => fallback } as any,
  {} as any,
);
describe("mainland China mobile validation", () => {
  it.each(["13800138000", "19912345678", "16612345678"])("accepts %s", async (phone) => {
    const prisma: any = {
      smsVerificationCode: {
        findFirst: async () => null,
        count: async () => 0,
        create: async () => ({}),
      },
    };
    const sms: any = { send: async () => undefined };
    await expect(
      new AuthService(
        prisma,
        { get: (_key: string, fallback: unknown) => fallback } as any,
        sms,
      ).sendCode({ countryCode: "+86", phone }),
    ).resolves.toMatchObject({ sent: true });
  });
  it.each(["12800138000", "1380013800", "138001380000", "abc"])("rejects %s", async (phone) => {
    await expect(service.sendCode({ countryCode: "+86", phone })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it("rejects non +86 country codes", async () => {
    await expect(
      service.sendCode({ countryCode: "+1", phone: "13800138000" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

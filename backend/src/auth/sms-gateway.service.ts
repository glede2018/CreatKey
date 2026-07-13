import { BadGatewayException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface SmsMessage {
  countryCode: string;
  phone: string;
  code: string;
  expiresInMinutes: number;
}
@Injectable()
export class SmsGatewayService {
  private readonly logger = new Logger(SmsGatewayService.name);
  constructor(private readonly config: ConfigService) {}

  /** 通过 mock 或预留的 HTTP 短信供应商发送验证码。 */
  async send(message: SmsMessage) {
    const provider = this.config.get("SMS_PROVIDER", "mock");
    if (provider === "mock") {
      this.logger.log(`Mock SMS queued for ${message.countryCode}${message.phone}`);
      return;
    }
    const url = this.config.getOrThrow<string>("SMS_API_URL");
    const apiKey = this.config.getOrThrow<string>("SMS_API_KEY");
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...message, templateId: this.config.get("SMS_TEMPLATE_ID", "") }),
    });
    if (!response.ok) throw new BadGatewayException("短信服务发送失败");
  }
}

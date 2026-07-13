import { BadGatewayException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentChannel } from "@prisma/client";
import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  randomBytes,
} from "node:crypto";

export interface GatewayOrder {
  orderNo: string;
  amountFen: number;
  description: string;
  notifyUrl: string;
}
@Injectable()
export class PaymentGatewayService {
  constructor(private readonly config: ConfigService) {}

  /** 判断当前是否使用无需真实资金流的本地模拟支付。 */
  isMock() {
    return this.config.get("PAYMENT_MOCK", "true") === "true";
  }

  /** 按支付渠道创建 Native 扫码订单并返回二维码内容。 */
  async create(channel: PaymentChannel, order: GatewayOrder) {
    if (this.isMock()) return `creatkey://pay/${channel.toLowerCase()}/${order.orderNo}`;
    return channel === PaymentChannel.WECHAT ? this.createWechat(order) : this.createAlipay(order);
  }

  /** 从环境变量读取并解析支付平台 RSA 私钥。 */
  private privateKey(name: string) {
    return createPrivateKey(this.config.getOrThrow<string>(name).replaceAll("\\n", "\n"));
  }

  /** 调用微信支付 Native 下单接口。 */
  private async createWechat(order: GatewayOrder) {
    const mchid = this.config.getOrThrow<string>("WECHAT_PAY_MCH_ID");
    const appid = this.config.getOrThrow<string>("WECHAT_PAY_APP_ID");
    const serial = this.config.getOrThrow<string>("WECHAT_PAY_SERIAL_NO");
    const path = "/v3/pay/transactions/native";
    const body = JSON.stringify({
      appid,
      mchid,
      description: order.description,
      out_trade_no: order.orderNo,
      notify_url: order.notifyUrl,
      amount: { total: order.amountFen, currency: "CNY" },
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(16).toString("hex");
    const signer = createSign("RSA-SHA256");
    signer.update(`POST\n${path}\n${timestamp}\n${nonce}\n${body}\n`);
    const signature = signer.sign(this.privateKey("WECHAT_PAY_PRIVATE_KEY"), "base64");
    const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serial}",signature="${signature}"`;
    const response = await fetch(`https://api.mch.weixin.qq.com${path}`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "CreatKey/1.0",
      },
      body,
    });
    const result: any = await response.json();
    if (!response.ok || !result.code_url)
      throw new BadGatewayException(result.message ?? "微信支付下单失败");
    return result.code_url;
  }

  /** 调用支付宝当面付预下单接口。 */
  private async createAlipay(order: GatewayOrder) {
    const params: Record<string, string> = {
      app_id: this.config.getOrThrow("ALIPAY_APP_ID"),
      method: "alipay.trade.precreate",
      format: "JSON",
      charset: "utf-8",
      sign_type: "RSA2",
      timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
      version: "1.0",
      notify_url: order.notifyUrl,
      biz_content: JSON.stringify({
        out_trade_no: order.orderNo,
        total_amount: (order.amountFen / 100).toFixed(2),
        subject: order.description,
        timeout_express: "15m",
      }),
    };
    const content = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&");
    const signer = createSign("RSA-SHA256");
    signer.update(content, "utf8");
    params.sign = signer.sign(this.privateKey("ALIPAY_PRIVATE_KEY"), "base64");
    const response = await fetch(
      this.config.get("ALIPAY_GATEWAY", "https://openapi.alipay.com/gateway.do"),
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: new URLSearchParams(params),
      },
    );
    const result: any = await response.json();
    const payload = result.alipay_trade_precreate_response;
    if (!payload?.qr_code)
      throw new BadGatewayException(payload?.sub_msg ?? payload?.msg ?? "支付宝下单失败");
    return payload.qr_code;
  }

  /** 使用支付宝公钥验证异步通知签名。 */
  verifyAlipay(payload: Record<string, string>) {
    const { sign, sign_type: _type, ...fields } = payload;
    const content = Object.keys(fields)
      .filter((key) => fields[key] !== "")
      .sort()
      .map((key) => `${key}=${fields[key]}`)
      .join("&");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(content, "utf8");
    return verifier.verify(
      createPublicKey(this.config.getOrThrow<string>("ALIPAY_PUBLIC_KEY").replaceAll("\\n", "\n")),
      sign,
      "base64",
    );
  }

  /** 验证微信支付通知签名并使用 API v3 密钥解密资源数据。 */
  parseWechat(rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
    const timestamp = String(headers["wechatpay-timestamp"] ?? "");
    const nonce = String(headers["wechatpay-nonce"] ?? "");
    const signature = String(headers["wechatpay-signature"] ?? "");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${timestamp}\n${nonce}\n${rawBody.toString("utf8")}\n`);
    if (
      !verifier.verify(
        createPublicKey(
          this.config.getOrThrow<string>("WECHAT_PAY_PLATFORM_PUBLIC_KEY").replaceAll("\\n", "\n"),
        ),
        signature,
        "base64",
      )
    )
      throw new Error("微信支付回调验签失败");
    const payload: any = JSON.parse(rawBody.toString("utf8"));
    const resource = payload.resource;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(this.config.getOrThrow("WECHAT_PAY_API_V3_KEY")),
      Buffer.from(resource.nonce),
    );
    decipher.setAuthTag(Buffer.from(resource.ciphertext, "base64").subarray(-16));
    decipher.setAAD(Buffer.from(resource.associated_data ?? ""));
    const ciphertext = Buffer.from(resource.ciphertext, "base64");
    const plain = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]);
    return JSON.parse(plain.toString("utf8"));
  }
}

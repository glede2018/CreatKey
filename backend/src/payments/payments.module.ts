import { Module } from "@nestjs/common";
import { PaymentGatewayService } from "./payment-gateway.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
@Module({ controllers: [PaymentsController], providers: [PaymentGatewayService, PaymentsService] })
export class PaymentsModule {}

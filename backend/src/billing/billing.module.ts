import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { PointsService } from "./points.service";
@Module({ controllers: [BillingController], providers: [PointsService], exports: [PointsService] })
export class BillingModule {}

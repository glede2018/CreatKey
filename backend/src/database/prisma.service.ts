import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /** Nest 模块初始化时建立数据库连接。 */
  async onModuleInit() {
    await this.$connect();
  }

  /** Nest 模块销毁时主动断开数据库连接。 */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

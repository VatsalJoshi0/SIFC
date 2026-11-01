import { prisma } from "../db/client.js";
import type { AuditLog, Prisma } from "@prisma/client";

export class AuditRepository {
  async createLog(data: {
    actorType: string;
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    beforeJson?: string | null;
    afterJson?: string | null;
    ipHash?: string | null;
  }): Promise<AuditLog> {
    return prisma.auditLog.create({
      data: {
        actorType: data.actorType,
        actorId: data.actorId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        beforeJson: data.beforeJson,
        afterJson: data.afterJson,
        ipHash: data.ipHash
      }
    });
  }

  async search(filter: {
    actorId?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
  }): Promise<AuditLog[]> {
    const where: Prisma.AuditLogWhereInput = {};
    if (filter.actorId) where.actorId = filter.actorId;
    if (filter.entityType) where.entityType = filter.entityType;
    if (filter.entityId) where.entityId = filter.entityId;

    return prisma.auditLog.findMany({
      where,
      take: filter.limit ?? 50,
      orderBy: { createdAt: "desc" }
    });
  }
}

export const auditRepository = new AuditRepository();

import { PrismaClient } from "@prisma/client";
import { getEnv } from "../config/env.js";

const env = getEnv();

declare global {
  var __prismaClient: PrismaClient | undefined;
}

export function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    datasourceUrl: env.DATABASE_URL,
    log: env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });

  // Enable foreign keys for SQLite on every connection (P1c)
  client.$executeRawUnsafe("PRAGMA foreign_keys = ON;").catch((err) => {
    console.error("Failed to enable foreign_keys pragma in SQLite:", err);
  });

  return client;
}

export const prisma = global.__prismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prismaClient = prisma;
}

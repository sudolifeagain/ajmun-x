import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    __botPrisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.__botPrisma ?? new PrismaClient();

globalForPrisma.__botPrisma = prisma;

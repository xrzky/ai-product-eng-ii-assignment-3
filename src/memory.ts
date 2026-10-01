import { PrismaMemoryStore } from "@anvia/memory-prisma/v8";
import { db } from "../prisma/db";

export const memoryStore = new PrismaMemoryStore({
  client: db,
});

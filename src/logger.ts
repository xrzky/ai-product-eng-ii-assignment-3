import { createPinoLogger } from "@anvia/logger";

export const logger = createPinoLogger({
  name: "order-api",
  level: "info",
  pinoOptions: {
    transport: {
      target: "pino-pretty",
    },
  },
});

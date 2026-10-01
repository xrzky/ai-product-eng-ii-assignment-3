import { Agent, createSummaryMemoryCompactor, type AnyTool } from "@anvia/core";
import { getModel } from "./model";
import { BASE_INSTRUCTIONS } from "./prompts";
import { memoryStore } from "./memory";
import { createLoggerObserver } from "@anvia/logger";
import { logger } from "./logger";
import { createOrder, getOrder, refundOrder } from "./tools/order-tools";

const memoryCompactor = createSummaryMemoryCompactor({
  model: getModel(),
});

export function createAgent() {
  return new Agent({
    id: "assistant",
    model: getModel(),
    instructions: BASE_INSTRUCTIONS,
    tools: [getOrder, refundOrder, createOrder],
    observability: {
      observers: {
        logger: createLoggerObserver({ logger }),
      },
    },
    memory: {
      store: memoryStore,
      savePolicy: "turn",
      compaction: {
        compactor: memoryCompactor,
        trigger: {
          afterTokens: 5000,
        },
      },
    },
  });
}

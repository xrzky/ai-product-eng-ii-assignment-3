import { createTool } from "@anvia/core";
import z from "zod";

interface OrderStatus {
  orderId: string;
  itemId: string;
  qty: number;
  status: string;
  note?: string;
}

const ORDERS: Record<string, OrderStatus> = {
  "1001": {
    orderId: "1001",
    itemId: "ITEM-90915",
    qty: 2,
    status: "delayed",
    note: "out of stock",
  },
  "1002": {
    orderId: "1002",
    itemId: "ITEM-04465",
    qty: 1,
    status: "delivered",
  },
};

export const getOrder = createTool({
  name: "get-order",
  description:
    "Read-only. Fetch the current status of an existing order by its orderId. Call this first to check the order state before refunding or reordering",
  inputSchema: z.object({
    orderId: z.string(),
  }),
  execute: async (args) => {
    const order = ORDERS[args.orderId];
    if (!order) return { found: false, orderId: args.orderId };
    return { found: true, ...order };
  },
});

export const refundOrder = createTool({
  name: "refund-order",
  description:
    "Request a refund for an existing order. Only valid when the order status is 'delayed'. Requires human approval before it executes.",
  inputSchema: z.object({
    orderId: z.string(),
    reason: z.string(),
  }),
  execute: async (args) => {
    const order = ORDERS[args.orderId];
    if (!order) throw new Error(`Order ${args.orderId} does not exist.`);
    if (order.status !== "delayed") {
      throw new Error(
        `Order ${args.orderId} cannot be refunded: status is '${order.status}', expected 'delayed'.`,
      );
    }
    order.status = "refunded";
    order.note = args.reason;
    return { refunded: true, ...order };
  },
});

export const createOrder = createTool({
  name: "create-order",
  description:
    "Create a new order for a specific item and quantity. Use this to reorder an item after a refund",
  inputSchema: z.object({
    itemId: z.string(),
    qty: z.number(),
  }),
  execute: async (args) => {
    const orderId = String(1001 + Object.keys(ORDERS).length);
    const order: OrderStatus = {
      orderId,
      itemId: args.itemId,
      qty: args.qty,
      status: "pending",
      note: "",
    };
    ORDERS[orderId] = order;
    return { created: true, ...order };
  },
});

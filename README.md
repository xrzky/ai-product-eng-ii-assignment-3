# Anvia Order Support Agent

A customer-support agent for a small order system, built on the Anvia agent framework. You chat with it in Anvia Studio; it decides on its own which tool to call to look up an order, refund it, or place a replacement. Every turn is saved to PostgreSQL, so a conversation keeps its context across restarts.

## Features

- Three order tools the agent chooses between: `get-order` (read-only), `refund-order`, and `create-order`
- Refunds are policy-guarded: only orders with status `delayed` can be refunded, and the agent declines the rest on its own
- Real model calls through [anvia.dev](https://anvia.dev)
- Every turn is persisted to PostgreSQL, so a session keeps its context across an agent restart
- Automatic memory compaction: once a session passes 5,000 tokens, older history is summarized by the same model
- Runs are traced in Studio with token usage, and streamed to the console through pino

## Tech Stack

- [Anvia](https://anvia.dev) (`@anvia/core`) for the agent, tools, and memory
- [Anvia Studio](https://www.npmjs.com/package/@anvia/studio) for the chat UI and HTTP runtime
- PostgreSQL (16) with Prisma ORM 8 as the ORM
- [Zod](https://zod.dev) for tool input validation
- TypeScript (ESM) executed with `tsx`
- pnpm as the package manager

## How It Works

```
You send a message in Studio
              ↓
   The agent reads the tool descriptions
              ↓
  get-order / refund-order / create-order
              ↓
  Reply, and the whole turn is written to
  AgentMemorySession + AgentMemoryMessage
```

The agent has no hardcoded script. The tool **descriptions** are what steer it — `get-order` says it is read-only and should be called first, `refund-order` says it is only valid when the status is `delayed`, and `create-order` says to use it to reorder after a refund.

## Prerequisites

- Node.js 24+ (per the Prisma ORM 8 docs; this project also runs on Node 22)
- pnpm 12.8.1 (pinned in `package.json`)
- Docker and Docker Compose
- An API key from anvia.dev

## Setup

**1. Clone the repo and install dependencies**

```bash
git clone <your-repo-url>
cd assignment-3
pnpm install
```

**2. Configure environment variables**

```bash
cp .env.example .env
```

Then fill in `.env`:

```dotenv
DATABASE_URL="postgresql://anvia:anvia@localhost:55432/anvia"
OPENAI_API_KEY=<your API key>
OPENAI_BASE_URL=<your base URL>
```

> `DATABASE_URL` must match the user, password, and database name in `docker-compose.yml`, and the port must be `55432` — that is the host port mapped to Postgres's `5432`.

**3. Start the database and other services with Docker**

```bash
docker compose up -d
```

This starts Postgres on `localhost:55432` and Adminer on `localhost:8085`.

> Start the database **before** the app. If `pnpm dev` boots while Postgres is down, every run fails with `Database error while reading contract marker`, and restarting the app is required even after the database comes back.

**4. Set up the database tables**

Make sure the PostgreSQL container is running, then run:

```bash
pnpm prisma contract emit
pnpm prisma db migrate
```

- `pnpm prisma contract emit` generates `contract.json` and `contract.d.ts` from the Prisma contract.
- `pnpm prisma db init` creates the tables in the database based on the contract.

> Run `pnpm prisma contract emit` again whenever `prisma/contract.prisma` changes.

## Running the App

```bash
pnpm dev
```

The console prints the Studio URL:

```
Studio UI: http://localhost:4021/playground
```

Open it, select the **assistant** agent, and start chatting. To use a different port, set `RUNNER_PORT`:

```bash
RUNNER_PORT=4041 pnpm dev
```

## Demo Flow

The project ships with two fixture orders in `src/tools/order-tools.ts`:

| Order  | Item         | Qty | Status      |
| ------ | ------------ | --- | ----------- |
| `1001` | `ITEM-90915` | 2   | `delayed`   |
| `1002` | `ITEM-04465` | 1   | `delivered` |

**Tools run in Studio**

1. Ask: *"What is the status of order 1001?"*
2. The agent calls `get-order` and replies: *"Order 1001 is delayed because the item is out of stock. It contains 2 units of item ITEM-90915."*
3. In the Studio UI the run trace shows the `get-order` call and the token usage.

**Refund and reorder**

1. Ask: *"Order 1001 is late. Refund it and send me a replacement."*
2. The agent calls `get-order`, then `refund-order`, then `create-order`
3. Reply: order 1001 was refunded and replacement order **1003** was created with status `pending`

**Refused refund (policy guard)**

1. Ask: *"Refund order 1002 for me."*
2. Order 1002 is `delivered`, not `delayed`, so the agent declines without calling the tool: *"Order 1002 has been delivered, so it isn't eligible for a refund under the current policy."*

**Repeated chats land in the memory session**

1. Have a two-message conversation in one session
2. Each exchange adds a row to the memory tables — a run with one tool call writes 4 rows (`user`, `assistant`, `tool`, `assistant`)
3. Check it in the Studio UI under **Memory**, which lists the conversations from the Prisma store, or straight from the database:

```bash
docker compose exec db psql -U anvia -d anvia -c \
  'select s."sessionId", count(m.id) as messages
     from "AgentMemorySession" s
     join "AgentMemoryMessage" m on m."memorySessionId" = s.id
    group by 1 order by messages desc;'
```

4. Stop the app with `Ctrl+C`, start it again with `pnpm dev`, and send another message with the same `sessionId` — the agent still remembers the earlier turns

## Order Statuses

| Status      | Meaning                                             |
| ----------- | --------------------------------------------------- |
| `delayed`   | The order is late; the only status that can be refunded |
| `delivered` | The order arrived; a refund is refused              |
| `pending`   | A newly created order, e.g. a replacement           |
| `refunded`  | The order was refunded by `refund-order`            |

## Project Structure

```
assignment-3/
├── src/
│   ├── index.ts              # entry point — creates the agent and starts Studio
│   ├── agents.ts             # agent definition: model, instructions, tools, memory
│   ├── model.ts              # model client and model selection
│   ├── prompts.ts            # system instructions
│   ├── memory.ts             # Prisma-backed memory store
│   ├── logger.ts             # pino logger for the observability observer
│   └── tools/
│       └── order-tools.ts    # get-order / refund-order / create-order
├── prisma/
│   ├── contract.prisma       # data contract — memory tables
│   ├── contract.json         # compiled contract (generated, committed)
│   ├── contract.d.ts         # contract types    (generated, committed)
│   └── db.ts                 # typed Postgres client
├── migrations/               # on-disk migration packages and snapshots
├── prisma.config.ts          # Prisma CLI config (contract path + DATABASE_URL)
├── docker-compose.yml        # Postgres 16 (55432) + Adminer (8085)
└── package.json
```
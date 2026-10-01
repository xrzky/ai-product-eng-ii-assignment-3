import { Studio } from "@anvia/studio";
import { createAgent } from "./agents.js";

const agent = createAgent();

const studio = new Studio([agent]).start();

// Back-compat shim: the provider-agnostic chat client now lives in
// ./gateway.server.ts (multi-provider gateway with routing + failover).
export { chat, type ChatMessage, type ChatOptions, type ContentPart } from "./gateway.server";

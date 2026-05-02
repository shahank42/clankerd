import { Schema } from "effect"

export class TelegramError extends Schema.TaggedErrorClass<TelegramError>()("TelegramError", {
  message: Schema.String
}) {}

export class AgentError extends Schema.TaggedErrorClass<AgentError>()("AgentError", {
  message: Schema.String
}) {}

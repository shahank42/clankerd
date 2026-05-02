import { Schema } from "effect"

export class TelegramError extends Schema.TaggedErrorClass<TelegramError>()("TelegramError", {
  message: Schema.String,
}) {}

export class AgentError extends Schema.TaggedErrorClass<AgentError>()("AgentError", {
  message: Schema.String,
}) {}

export class ConfigNotFound extends Schema.TaggedErrorClass<ConfigNotFound>()("ConfigNotFound", {
  path: Schema.String,
}) {}

export class SetupError extends Schema.TaggedErrorClass<SetupError>()("SetupError", {
  message: Schema.String,
}) {}

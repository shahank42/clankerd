import { Schema } from "effect"

export class TelegramError extends Schema.TaggedErrorClass<TelegramError>()("TelegramError", {
  message: Schema.String
}) {}

import { Schema } from "effect"

export class ConfigNotFound extends Schema.TaggedErrorClass<ConfigNotFound>()("ConfigNotFound", {
  path: Schema.String
}) {}

export class SetupError extends Schema.TaggedErrorClass<SetupError>()("SetupError", {
  message: Schema.String
}) {}

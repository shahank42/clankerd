import { Schema } from "effect"

export class MemoryReadError extends Schema.TaggedErrorClass<MemoryReadError>()("MemoryReadError", {
  path: Schema.String,
  message: Schema.String
}) {}

export class MemoryWriteError extends Schema.TaggedErrorClass<MemoryWriteError>()(
  "MemoryWriteError",
  {
    path: Schema.String,
    message: Schema.String
  }
) {}

export const MemoryError = Schema.Union([MemoryReadError, MemoryWriteError])
export type MemoryError = typeof MemoryError.Type

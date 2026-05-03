import { Schema } from "effect"

const getBaseDir = (): string => {
  if (process.env.CLANKERD_DEV === "1") {
    return `${process.cwd()}/.clankerd-dev`
  }
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "/tmp"
  return `${home}/.config/clankerd`
}

export const getMemoryDir = (): string => getBaseDir()

export const getStateDir = (): string => `${getMemoryDir()}/state`

export const getMemoryLogsDir = (): string => `${getMemoryDir()}/memory`

export const getSkillsDir = (): string => `${getMemoryDir()}/skills`

export class Session extends Schema.Class<Session>("Session")({
  version: Schema.Literal("1"),
  startedAt: Schema.Number,
  lastInteractionAt: Schema.Number,
  messages: Schema.Array(Schema.Unknown)
}) {}

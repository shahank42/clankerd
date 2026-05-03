import { Schema } from "effect"

const HomeDir = () => process.env.HOME ?? process.env.USERPROFILE ?? "/tmp"

export const getMemoryDir = (): string => `${HomeDir()}/.clankerd`

export const getStateDir = (): string => `${getMemoryDir()}/state`

export const getMemoryLogsDir = (): string => `${getMemoryDir()}/memory`

export const getSkillsDir = (): string => `${getMemoryDir()}/skills`

export class Session extends Schema.Class<Session>("Session")({
  version: Schema.Literal("1"),
  startedAt: Schema.Number,
  lastInteractionAt: Schema.Number,
  messages: Schema.Array(Schema.Unknown)
}) {}

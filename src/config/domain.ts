import { Schema } from "effect"

export class ConfigFile extends Schema.Class<ConfigFile>("ConfigFile")({
  llmProvider: Schema.String,
  llmModel: Schema.String,
  apiKey: Schema.String,
  telegramToken: Schema.String,
  allowedUsername: Schema.String
}) {}

const getBaseDir = (): string => {
  if (process.env.CLANKERD_DEV === "1") {
    return `${process.cwd()}/.clankerd-dev`
  }
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "/tmp"
  return `${home}/.config/clankerd`
}

export const getConfigPath = (): string => {
  return `${getBaseDir()}/config.json`
}

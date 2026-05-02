import { Schema } from "effect"

export class ConfigFile extends Schema.Class<ConfigFile>("ConfigFile")({
  llmProvider: Schema.String,
  llmModel: Schema.String,
  apiKey: Schema.String,
  telegramToken: Schema.String,
  allowedUsername: Schema.String
}) {}

export const getConfigPath = (): string => {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "/tmp"
  return `${home}/.config/clankerd/config.json`
}

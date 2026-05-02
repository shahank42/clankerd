import { Effect, Layer, Redacted, Schema } from "effect"
import * as Context from "effect/Context"
import { FileSystem } from "effect/FileSystem"
import { ConfigNotFound } from "./errors.js"

const ConfigFileSchema = Schema.Struct({
  llmProvider: Schema.String,
  llmModel: Schema.String,
  apiKey: Schema.String,
  telegramToken: Schema.String,
  allowedUsername: Schema.String,
})

type ConfigFile = typeof ConfigFileSchema.Type

export const getConfigPath = (): string => {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "/tmp"
  return `${home}/.config/clankerd/config.json`
}

export class AppConfig extends Context.Service<
  AppConfig,
  {
    readonly telegramToken: Redacted.Redacted
    readonly allowedUsername: string
    readonly llmProvider: string
    readonly llmModel: string
    readonly apiKey: Redacted.Redacted
  }
>()("@app/AppConfig") {
  static readonly layer = Layer.effect(
    AppConfig,
    Effect.gen(function* () {
      const fs = yield* FileSystem
      const configPath = getConfigPath()

      const exists = yield* fs.exists(configPath)
      if (!exists) {
        return yield* new ConfigNotFound({ path: configPath })
      }

      const raw = yield* fs.readFileString(configPath)
      const data: ConfigFile = Schema.decodeUnknownSync(Schema.fromJsonString(ConfigFileSchema))(raw)

      return {
        telegramToken: Redacted.make(data.telegramToken),
        allowedUsername: data.allowedUsername,
        llmProvider: data.llmProvider,
        llmModel: data.llmModel,
        apiKey: Redacted.make(data.apiKey),
      }
    })
  )
}

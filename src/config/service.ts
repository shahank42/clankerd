import { Effect, Redacted, Schema } from "effect"
import * as Context from "effect/Context"
import { FileSystem } from "effect/FileSystem"
import { ConfigFile, getConfigPath } from "./domain.js"
import { ConfigNotFound } from "./errors.js"
import { runInteractiveSetup } from "./setup.js"

const encodeConfig = Schema.encodeSync(Schema.fromJsonString(ConfigFile))

const writeConfig = (config: ConfigFile) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem
    const configPath = getConfigPath()
    const dir = configPath.substring(0, configPath.lastIndexOf("/"))

    yield* fs.makeDirectory(dir, { recursive: true })
    yield* fs.writeFileString(configPath, encodeConfig(config))
    yield* Effect.log(`Config saved to ${configPath}`)
  })

export class AppConfig extends Context.Service<AppConfig>()("@app/AppConfig", {
  make: Effect.gen(function* () {
    const fs = yield* FileSystem
    const configPath = getConfigPath()

    const exists = yield* fs.exists(configPath)
    if (!exists) {
      if (!process.stdin.isTTY) {
        return yield* new ConfigNotFound({ path: configPath })
      }
      const config = yield* runInteractiveSetup()
      yield* writeConfig(config)
    }

    const raw = yield* fs.readFileString(configPath)
    const data = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(ConfigFile))(raw).pipe(
      Effect.orDie
    )

    return {
      telegramToken: Redacted.make(data.telegramToken),
      allowedUsername: data.allowedUsername,
      llmProvider: data.llmProvider,
      llmModel: data.llmModel,
      apiKey: Redacted.make(data.apiKey)
    }
  })
}) {}

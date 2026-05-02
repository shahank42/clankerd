import { Effect, Layer, Schema } from "effect"
import { BunFileSystem } from "@effect/platform-bun"
import { BunRuntime } from "@effect/platform-bun"
import { FileSystem } from "effect/FileSystem"
import { AgentService } from "./src/agent.js"
import { AppConfig, getConfigPath } from "./src/config.js"
import { program } from "./src/program.js"
import { runInteractiveSetup } from "./src/setup.js"
import { TelegramBot } from "./src/telegram.js"

const ConfigFileSchema = Schema.Struct({
  llmProvider: Schema.String,
  llmModel: Schema.String,
  apiKey: Schema.String,
  telegramToken: Schema.String,
  allowedUsername: Schema.String,
})

const encodeConfig = Schema.encodeSync(Schema.fromJsonString(ConfigFileSchema))

const writeConfig = (config: Schema.Schema.Type<typeof ConfigFileSchema>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem
    const configPath = getConfigPath()
    const dir = configPath.substring(0, configPath.lastIndexOf("/"))

    yield* fs.makeDirectory(dir, { recursive: true })
    yield* fs.writeFileString(configPath, encodeConfig(config))
    yield* Effect.log(`Config saved to ${configPath}`)
  })

const setupIfNeeded = Effect.gen(function* () {
  const fs = yield* FileSystem
  const configPath = getConfigPath()
  const exists = yield* fs.exists(configPath)

  if (!exists) {
    if (!process.stdin.isTTY) {
      return yield* Effect.die(
        "Config not found and not in an interactive terminal. " +
          "Please run `bun run start` in an interactive terminal first to set up config."
      )
    }
    const config = yield* runInteractiveSetup()
    yield* writeConfig(config)
  }
}).pipe(Effect.provide(BunFileSystem.layer))

const appLayer = Layer.merge(AgentService.layer, TelegramBot.layer).pipe(
  Layer.provideMerge(AppConfig.layer),
  Layer.provideMerge(BunFileSystem.layer)
)

const main = Effect.gen(function* () {
  yield* Effect.log("Starting clankerd...")
  yield* program
}).pipe(Effect.provide(appLayer))

const app = setupIfNeeded.pipe(Effect.andThen(main))

BunRuntime.runMain(app)

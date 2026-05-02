import { Effect, Layer } from "effect"
import { AgentService } from "./src/agent.js"
import { AppConfig } from "./src/config.js"
import { program } from "./src/program.js"
import { TelegramBot } from "./src/telegram.js"

const appLayer = Layer.merge(AgentService.layer, TelegramBot.layer).pipe(
  Layer.provideMerge(AppConfig.layer)
)

const main = program.pipe(Effect.provide(appLayer))

Effect.runFork(main)

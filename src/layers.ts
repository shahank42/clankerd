import { Layer } from "effect"
import { BunFileSystem, BunHttpClient } from "@effect/platform-bun"
import { AgentService } from "./agent/service.js"
import { AppConfig } from "./config/service.js"
import { TelegramBot } from "./telegram/service.js"

export const appLayer = Layer.merge(
  Layer.effect(TelegramBot, TelegramBot.make),
  Layer.effect(AgentService, AgentService.make)
).pipe(
  Layer.provideMerge(Layer.effect(AppConfig, AppConfig.make)),
  Layer.provideMerge(BunFileSystem.layer),
  Layer.provideMerge(BunHttpClient.layer)
)

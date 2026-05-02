import { Config, Effect, Layer, Redacted } from "effect"
import * as Context from "effect/Context"

export class AppConfig extends Context.Service<
  AppConfig,
  {
    readonly telegramToken: Redacted.Redacted
    readonly allowedUserId: number
    readonly llmProvider: string
    readonly llmModel: string
  }
>()("@app/AppConfig") {
  static readonly layer = Layer.effect(
    AppConfig,
    Effect.gen(function* () {
      const telegramToken = yield* Config.redacted("TELEGRAM_BOT_TOKEN")
      const allowedUserId = yield* Config.number("ALLOWED_USER_ID")
      const llmProvider = yield* Config.string("LLM_PROVIDER")
      const llmModel = yield* Config.string("LLM_MODEL")

      return { telegramToken, allowedUserId, llmProvider, llmModel }
    })
  )
}

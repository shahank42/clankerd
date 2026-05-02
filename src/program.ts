import { Effect, Ref, Schedule } from "effect"
import { AgentService } from "./agent.js"
import { AppConfig } from "./config.js"
import { TelegramBot } from "./telegram.js"

export const program = Effect.gen(function* () {
  const bot = yield* TelegramBot
  const agent = yield* AgentService
  const config = yield* AppConfig
  const offsetRef = yield* Ref.make(0)

  yield* Effect.repeat(
    Effect.gen(function* () {
      const offset = yield* Ref.get(offsetRef)
      const updates = yield* bot.getUpdates(offset)

      yield* Effect.forEach(
        updates,
        update =>
          Effect.gen(function* () {
            const message = update.message
            if (!message || message.from?.username !== config.allowedUsername) return

            const text = message.text
            if (!text) return

            yield* Effect.log(`Received: ${text}`)
            const reply = yield* agent.run(text)
            yield* bot.sendMessage(message.chat.id, reply)
          }).pipe(Effect.tapError(error => Effect.logError(`Failed to process update: ${error}`))),
        { discard: true }
      )

      const lastUpdate = updates[updates.length - 1]
      if (lastUpdate) {
        yield* Ref.set(offsetRef, lastUpdate.update_id + 1)
      }
    }).pipe(Effect.tapError(error => Effect.logError(`Poll failed: ${error}`))),
    Schedule.spaced("1 second")
  )
})

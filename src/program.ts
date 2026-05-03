import { Effect, Ref, Schedule, Stream } from "effect"
import { AgentService, processEvent } from "./agent/service.js"
import { toolDisplayNames } from "./agent/tools.js"
import { AppConfig } from "./config/service.js"
import { TelegramBot } from "./telegram/service.js"

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

            const draftId = message.message_id

            yield* bot
              .sendMessageDraft(message.chat.id, draftId, "Thinking...")
              .pipe(Effect.catch(error => Effect.logWarning(`Initial draft failed: ${error}`)))

            const result = yield* agent.runStream(text).pipe(
              Stream.tap(event =>
                Effect.gen(function* () {
                  if (event.type === "tool_execution_start") {
                    const displayName = toolDisplayNames[event.toolName]
                    if (displayName) {
                      yield* bot
                        .sendMessageDraft(message.chat.id, draftId, displayName)
                        .pipe(
                          Effect.catch(error => Effect.logWarning(`Draft update failed: ${error}`))
                        )
                    }
                  }
                })
              ),
              Stream.runFoldEffect(() => ({ buffer: "", errorMessage: undefined }), processEvent)
            )

            if (result.errorMessage) {
              yield* bot.sendMessage(message.chat.id, `❌ ${result.errorMessage}`)
            } else {
              yield* bot.sendMessage(message.chat.id, result.buffer)
            }
          }).pipe(Effect.catch(error => Effect.logError(`Failed to process update: ${error}`))),
        { discard: true }
      )

      const lastUpdate = updates[updates.length - 1]
      if (lastUpdate) {
        yield* Ref.set(offsetRef, lastUpdate.update_id + 1)
      }
    }).pipe(Effect.catch(error => Effect.logError(`Poll failed: ${error}`))),
    Schedule.spaced("1 second")
  )
})

import { Effect, Fiber, Ref, Schedule, Stream } from "effect"
import { AgentService } from "./agent/service.js"
import { AppConfig } from "./config/service.js"
import { TelegramBot } from "./telegram/service.js"
import { initialState, transition, type MessageAction } from "./stream-processor.js"

export const program = Effect.gen(function* () {
  const bot = yield* TelegramBot
  const agent = yield* AgentService
  const config = yield* AppConfig

  const offsetRef = yield* Ref.make(0)
  const messageIdsRef = yield* Ref.make<ReadonlyArray<number>>([])

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

            const chatId = message.chat.id
            const draftId = message.message_id

            yield* Ref.update(messageIdsRef, ids => [...ids, message.message_id])

            if (text === "/new") {
              const ids = yield* Ref.get(messageIdsRef)
              yield* Effect.forEach(
                ids,
                id =>
                  bot.deleteMessage(chatId, id).pipe(
                    Effect.tapError(error =>
                      Effect.logWarning(`Delete failed for msg ${id}: ${error}`)
                    ),
                    Effect.orElseSucceed(() => undefined)
                  ),
                { discard: true }
              )
              yield* agent.newSession()
              const freshId = yield* bot.sendMessage(chatId, "Fresh start.").pipe(
                Effect.tapError(error => Effect.logWarning(`Send failed: ${error}`)),
                Effect.orElseSucceed(() => undefined)
              )
              yield* Ref.set(messageIdsRef, freshId !== undefined ? [freshId] : [])
              return
            }

            if (text === "/respawn" || text === "/start") {
              const ids = yield* Ref.get(messageIdsRef)
              yield* Effect.forEach(
                ids,
                id =>
                  bot.deleteMessage(chatId, id).pipe(
                    Effect.tapError(error =>
                      Effect.logWarning(`Delete failed for msg ${id}: ${error}`)
                    ),
                    Effect.orElseSucceed(() => undefined)
                  ),
                { discard: true }
              )
              yield* agent.respawn()
              const freshId = yield* bot.sendMessage(chatId, "Respawned.").pipe(
                Effect.tapError(error => Effect.logWarning(`Send failed: ${error}`)),
                Effect.orElseSucceed(() => undefined)
              )
              yield* Ref.set(messageIdsRef, freshId !== undefined ? [freshId] : [])
              return
            }

            const executeAction = (action: MessageAction): Effect.Effect<number | undefined> =>
              Effect.gen(function* () {
                switch (action._tag) {
                  case "SendMessage": {
                    return yield* bot.sendMessage(chatId, action.text)
                  }
                  case "UpdateDraft": {
                    yield* bot.sendMessageDraft(chatId, draftId, action.text)
                    return undefined
                  }
                  case "SendError": {
                    return yield* bot.sendMessage(chatId, action.text)
                  }
                }
              }).pipe(
                Effect.tapError(error => Effect.logWarning(`Action failed: ${error}`)),
                Effect.orElseSucceed(() => undefined)
              )

            const typingFiber = yield* Effect.repeat(
              bot.sendChatAction(chatId, "typing"),
              Schedule.spaced("4 seconds")
            ).pipe(Effect.forkDetach)

            const stream = yield* agent.runStream(text)
            const finalState = yield* stream.pipe(
              Stream.runFoldEffect(
                () => initialState,
                (state, event) =>
                  Effect.gen(function* () {
                    if (event.type === "tool_execution_start") {
                      yield* Effect.log(
                        `Tool start: ${event.toolName}(${JSON.stringify(event.args)})`
                      )
                    }
                    if (event.type === "tool_execution_update") {
                      yield* Effect.log(`Tool update: ${event.toolName}`)
                    }
                    if (event.type === "tool_execution_end") {
                      yield* Effect.log(`Tool end: ${event.toolName} (error: ${event.isError})`)
                    }

                    const [newState, actions] = transition(state, event)
                    const sentIds = yield* Effect.forEach(actions, executeAction, {
                      discard: false
                    })
                    yield* Ref.update(messageIdsRef, ids => [
                      ...ids,
                      ...sentIds.filter((id): id is number => id !== undefined)
                    ])
                    return newState
                  })
              ),
              Effect.ensuring(Fiber.interrupt(typingFiber)),
              Effect.tap(() => agent.persist()),
              Effect.tap(() => agent.appendDailyLog())
            )

            if (finalState.segmentText.length > 0) {
              const finalId = yield* bot.sendMessage(chatId, finalState.segmentText).pipe(
                Effect.tapError(error => Effect.logWarning(`Final flush failed: ${error}`)),
                Effect.orElseSucceed(() => undefined)
              )
              if (finalId !== undefined) {
                yield* Ref.update(messageIdsRef, ids => [...ids, finalId])
              }
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

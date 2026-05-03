import { Agent, type AgentEvent, type AgentMessage } from "@mariozechner/pi-agent-core"
import { getModel, getModels, getProviders } from "@mariozechner/pi-ai"
import type { KnownProvider } from "@mariozechner/pi-ai"
import { Cause, Effect, Option, Queue, Redacted, Stream } from "effect"
import * as Context from "effect/Context"
import { AppConfig } from "../config/service.js"
import { MemoryService } from "../memory/service.js"
import { AgentError } from "./errors.js"
import { buildSystemPrompt } from "./prompt.js"
import { createTools, toolDescriptions, toolNames } from "./tools.js"

export class AgentService extends Context.Service<AgentService>()("@app/AgentService", {
  make: Effect.gen(function* () {
    const config = yield* AppConfig
    const memory = yield* MemoryService

    const providers = getProviders()
    if (!providers.includes(config.llmProvider as KnownProvider)) {
      return yield* new AgentError({
        message: `Unknown provider "${config.llmProvider}". Known providers: ${providers.join(", ")}`
      })
    }
    const provider = config.llmProvider as KnownProvider

    const models = getModels(provider)
    const modelIds = models.map(m => m.id)
    if (!modelIds.includes(config.llmModel)) {
      return yield* new AgentError({
        message: `Unknown model "${config.llmModel}" for provider "${provider}". Known models: ${modelIds.join(", ")}`
      })
    }

    // getModel is typed with literal generics that require compile-time knowledge
    // of the provider/model pair. Runtime validation above guarantees correctness.
    const model = getModel(provider as any, config.llmModel as any)

    const cwd = process.cwd()
    const tools = [...createTools(cwd)]

    const systemPrompt = buildSystemPrompt({
      cwd,
      date: new Date(),
      toolNames,
      toolDescriptions
    })

    const agent = new Agent({
      initialState: {
        systemPrompt,
        model,
        tools
      },
      getApiKey: (_provider: string) => Redacted.value(config.apiKey)
    })

    const sessionOpt = yield* memory.loadSession()
    if (Option.isSome(sessionOpt)) {
      agent.state.messages = sessionOpt.value.messages as Array<AgentMessage>
      yield* Effect.log(`Hydrated session with ${agent.state.messages.length} messages`)
    }

    const persist = Effect.fn("AgentService.persist")(
      (): Effect.Effect<void> =>
        memory.persistSession(agent.state.messages).pipe(
          Effect.tap(() =>
            Effect.log(`Session persisted (${agent.state.messages.length} messages)`)
          ),
          Effect.catch(error => Effect.logWarning(`Session persist failed: ${error}`))
        )
    )

    const appendDailyLog = Effect.fn("AgentService.appendDailyLog")(
      (): Effect.Effect<void> =>
        memory.appendDailyLog(agent.state.messages).pipe(
          Effect.tap(() => Effect.log("Daily log appended")),
          Effect.catch(error => Effect.logWarning(`Daily log append failed: ${error}`))
        )
    )

    const prepareAgent = Effect.fn("AgentService.prepareAgent")(
      (): Effect.Effect<void> =>
        Effect.gen(function* () {
          const newSystemPrompt = yield* memory.buildSystemPrompt()
          agent.state.systemPrompt = newSystemPrompt

          const maxMessages = 30
          if (agent.state.messages.length > maxMessages) {
            const dropped = agent.state.messages.length - maxMessages
            agent.state.messages = agent.state.messages.slice(-maxMessages)
            yield* Effect.log(
              `Capped messages: dropped ${dropped} old turns (keeping last ${maxMessages})`
            )
          }
        }).pipe(Effect.catch(error => Effect.logWarning(`Failed to prepare agent: ${error}`)))
    )

    const runStream = Effect.fn("AgentService.runStream")(
      (prompt: string): Effect.Effect<Stream.Stream<AgentEvent, AgentError>> =>
        Effect.gen(function* () {
          yield* prepareAgent()

          return Stream.callback<AgentEvent, AgentError>(queue =>
            Effect.sync(() => {
              const unsubscribe = agent.subscribe(event => {
                Queue.offerUnsafe(queue, event)
                if (event.type === "agent_end") {
                  Queue.endUnsafe(queue)
                }
              })

              try {
                agent.prompt(prompt).catch(err => {
                  Queue.failCauseUnsafe(queue, Cause.fail(new AgentError({ message: String(err) })))
                })
              } catch (err) {
                Queue.failCauseUnsafe(queue, Cause.fail(new AgentError({ message: String(err) })))
              }

              return Effect.sync(() => unsubscribe())
            })
          )
        })
    )

    const run = Effect.fn("AgentService.run")(
      (prompt: string): Effect.Effect<string, AgentError> =>
        Effect.gen(function* () {
          yield* Effect.log(`Agent processing prompt (${prompt.length} chars)`)

          const stream = yield* runStream(prompt)
          const result = yield* stream.pipe(
            Stream.runFold(
              () => ({ buffer: "", errorMessage: undefined as string | undefined }),
              (state, event) => {
                if (
                  event.type === "message_update" &&
                  event.assistantMessageEvent.type === "text_delta"
                ) {
                  return { ...state, buffer: state.buffer + event.assistantMessageEvent.delta }
                }
                if (event.type === "agent_end") {
                  const lastMsg = event.messages[event.messages.length - 1]
                  if (
                    lastMsg?.role === "assistant" &&
                    (lastMsg.stopReason === "error" || lastMsg.stopReason === "aborted")
                  ) {
                    return { ...state, errorMessage: lastMsg.errorMessage }
                  }
                }
                return state
              }
            )
          )

          if (result.errorMessage) {
            yield* Effect.logError(`Agent failed: ${result.errorMessage}`)
            return yield* new AgentError({ message: result.errorMessage })
          }

          yield* Effect.log(`Agent completed, reply ${result.buffer.length} chars`)
          return result.buffer
        })
    )

    return { run, runStream, persist, appendDailyLog }
  })
}) {}

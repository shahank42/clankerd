import { Agent, type AgentEvent } from "@mariozechner/pi-agent-core"
import { getModel, getModels, getProviders } from "@mariozechner/pi-ai"
import type { KnownProvider } from "@mariozechner/pi-ai"
import { Cause, Effect, Queue, Redacted, Stream } from "effect"
import * as Context from "effect/Context"
import { AppConfig } from "../config/service.js"
import { AgentError } from "./errors.js"
import { buildSystemPrompt } from "./prompt.js"
import { createTools, toolDescriptions, toolNames } from "./tools.js"

interface AgentRunState {
  readonly buffer: string
  readonly errorMessage: string | undefined
}

/**
 * Fold stepper that processes each AgentEvent incrementally.
 *
 * Handled events:
 * - tool_execution_start / tool_execution_update / tool_execution_end → logged
 * - message_update (text_delta) → accumulated into buffer
 * - agent_end → type-safe error check on the final AssistantMessage
 *
 * Ignored (pass through):
 * - agent_start, turn_start, turn_end, message_start, message_end
 */
const processEvent = (state: AgentRunState, event: AgentEvent): Effect.Effect<AgentRunState> =>
  Effect.gen(function* () {
    if (event.type === "tool_execution_start") {
      yield* Effect.log(`Tool start: ${event.toolName}(${JSON.stringify(event.args)})`)
    }

    if (event.type === "tool_execution_update") {
      yield* Effect.log(`Tool update: ${event.toolName}`)
    }

    if (event.type === "tool_execution_end") {
      yield* Effect.log(`Tool end: ${event.toolName} (error: ${event.isError})`)
    }

    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
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
  })

export class AgentService extends Context.Service<AgentService>()("@app/AgentService", {
  make: Effect.gen(function* () {
    const config = yield* AppConfig

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

    const run = Effect.fn("AgentService.run")(
      (prompt: string): Effect.Effect<string, AgentError> =>
        Effect.gen(function* () {
          yield* Effect.log(`Agent processing prompt (${prompt.length} chars)`)

          const result = yield* Stream.callback<AgentEvent, AgentError>(queue =>
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
          ).pipe(
            Stream.runFoldEffect(() => ({ buffer: "", errorMessage: undefined }), processEvent)
          )

          if (result.errorMessage) {
            yield* Effect.logError(`Agent failed: ${result.errorMessage}`)
            return yield* new AgentError({ message: result.errorMessage })
          }

          yield* Effect.log(`Agent completed, reply ${result.buffer.length} chars`)
          return result.buffer
        })
    )

    return { run }
  })
}) {}

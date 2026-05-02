import { Agent } from "@mariozechner/pi-agent-core"
import { getModel, getModels, getProviders } from "@mariozechner/pi-ai"
import type { KnownProvider } from "@mariozechner/pi-ai"
import { createBashTool } from "@mariozechner/pi-coding-agent"
import { Effect, Redacted } from "effect"
import * as Context from "effect/Context"
import { AppConfig } from "../config/service.js"
import { AgentError } from "./errors.js"

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
    const bashTool = createBashTool(process.cwd())

    const agent = new Agent({
      initialState: {
        systemPrompt:
          "You are a helpful assistant that can run shell commands on the user's laptop. " +
          "Use the bash tool to execute commands and answer the user's questions.",
        model,
        tools: [bashTool]
      },
      getApiKey: (_provider: string) => Redacted.value(config.apiKey)
    })

    const run = Effect.fn("AgentService.run")(
      (prompt: string): Effect.Effect<string, AgentError> =>
        Effect.gen(function* () {
          yield* Effect.log(`Agent processing prompt (${prompt.length} chars)`)
          const reply = yield* Effect.callback<string, AgentError>(resume => {
            let buffer = ""
            let finished = false

            const unsubscribe = agent.subscribe(event => {
              if (
                event.type === "message_update" &&
                event.assistantMessageEvent.type === "text_delta"
              ) {
                buffer += event.assistantMessageEvent.delta
              }

              if (event.type === "agent_end") {
                if (!finished) {
                  finished = true
                  unsubscribe()
                  const lastMsg = event.messages[event.messages.length - 1]
                  if (lastMsg && "errorMessage" in lastMsg && lastMsg.errorMessage) {
                    resume(Effect.fail(new AgentError({ message: lastMsg.errorMessage })))
                  } else {
                    resume(Effect.succeed(buffer))
                  }
                }
              }
            })

            agent.prompt(prompt).catch(err => {
              if (!finished) {
                finished = true
                unsubscribe()
                resume(Effect.fail(new AgentError({ message: String(err) })))
              }
            })

            return Effect.sync(() => unsubscribe())
          })
          yield* Effect.log(`Agent completed, reply ${reply.length} chars`)
          return reply
        })
    )

    return { run }
  })
}) {}

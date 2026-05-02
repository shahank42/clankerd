import { Agent } from "@mariozechner/pi-agent-core"
import { getModel } from "@mariozechner/pi-ai"
import { createBashTool } from "@mariozechner/pi-coding-agent"
import { Effect, Layer, Redacted } from "effect"
import * as Context from "effect/Context"
import { AgentError } from "./errors.js"
import { AppConfig } from "./config.js"

export class AgentService extends Context.Service<
  AgentService,
  {
    readonly run: (prompt: string) => Effect.Effect<string, AgentError>
  }
>()("@app/AgentService") {
  static readonly layer = Layer.effect(
    AgentService,
    Effect.gen(function* () {
      const config = yield* AppConfig

      const model = getModel(config.llmProvider as any, config.llmModel as any)
      const bashTool = createBashTool(process.cwd())

      const agent = new Agent({
        initialState: {
          systemPrompt:
            "You are a helpful assistant that can run shell commands on the user's laptop. " +
            "Use the bash tool to execute commands and answer the user's questions.",
          model,
          tools: [bashTool],
        },
        getApiKey: (_provider: string) => Redacted.value(config.apiKey),
      })

      const run = Effect.fn("AgentService.run")(
        (prompt: string): Effect.Effect<string, AgentError> =>
          Effect.callback(resume => {
            let reply = ""
            let finished = false

            const unsubscribe = agent.subscribe(event => {
              if (
                event.type === "message_update" &&
                event.assistantMessageEvent.type === "text_delta"
              ) {
                reply += event.assistantMessageEvent.delta
              }

              if (event.type === "agent_end") {
                if (!finished) {
                  finished = true
                  unsubscribe()
                  const lastMsg = event.messages[event.messages.length - 1]
                  if (lastMsg && "errorMessage" in lastMsg && lastMsg.errorMessage) {
                    resume(Effect.fail(new AgentError({ message: lastMsg.errorMessage })))
                  } else {
                    resume(Effect.succeed(reply))
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
          })
      )

      return { run }
    })
  )
}

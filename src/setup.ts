import { Effect } from "effect"
import * as clack from "@clack/prompts"
import { getProviders, getModels, getEnvApiKey } from "@mariozechner/pi-ai"
import type { KnownProvider } from "@mariozechner/pi-ai"
import { SetupError } from "./errors.js"

export interface SetupConfig {
  readonly llmProvider: string
  readonly llmModel: string
  readonly apiKey: string
  readonly telegramToken: string
  readonly allowedUsername: string
}

const isCancel = (value: unknown): value is symbol =>
  typeof value === "symbol" && value.toString() === "Symbol(clack.cancel)"

export const runInteractiveSetup = Effect.fn("runInteractiveSetup")(function* () {
  yield* Effect.log("No config found. Let's set up clankerd!")

  const providers = getProviders()
  const providerOptions = providers.map(p => ({ value: p as string, label: p }))

  const providerValue = yield* Effect.promise(() =>
    clack.select({
      message: "Select LLM provider:",
      options: providerOptions,
    })
  )
  if (isCancel(providerValue)) {
    return yield* new SetupError({ message: "Setup cancelled by user" })
  }
  const provider = providerValue

  const models = getModels(provider as KnownProvider)
  const modelOptions = models.map(m => ({ value: m.id, label: m.id }))

  const modelValue = yield* Effect.promise(() =>
    clack.select({
      message: "Select model:",
      options: modelOptions,
    })
  )
  if (isCancel(modelValue)) {
    return yield* new SetupError({ message: "Setup cancelled by user" })
  }
  const model = modelValue

  const envKey = getEnvApiKey(provider as KnownProvider)
  const apiKeyHint = envKey ? ` (found: ${envKey.slice(0, 8)}...)` : ""

  const apiKeyValue = yield* Effect.promise(() =>
    clack.password({
      message: `Enter API key for ${provider}${apiKeyHint}:`,
      validate: value => {
        if (!value || value.length === 0) return "API key is required"
      },
    })
  )
  if (isCancel(apiKeyValue)) {
    return yield* new SetupError({ message: "Setup cancelled by user" })
  }
  const apiKey = apiKeyValue

  const telegramTokenValue = yield* Effect.promise(() =>
    clack.password({
      message: "Enter Telegram bot token:",
      validate: value => {
        if (!value || value.length === 0) return "Bot token is required"
      },
    })
  )
  if (isCancel(telegramTokenValue)) {
    return yield* new SetupError({ message: "Setup cancelled by user" })
  }
  const telegramToken = telegramTokenValue

  const allowedUsernameValue = yield* Effect.promise(() =>
    clack.text({
      message: "Enter your Telegram username (without @):",
      validate: value => {
        if (!value || value.length === 0) return "Username is required"
      },
    })
  )
  if (isCancel(allowedUsernameValue)) {
    return yield* new SetupError({ message: "Setup cancelled by user" })
  }
  const allowedUsername = allowedUsernameValue

  yield* Effect.log("Setup complete!")

  return {
    llmProvider: provider,
    llmModel: model,
    apiKey,
    telegramToken,
    allowedUsername,
  } satisfies SetupConfig
})

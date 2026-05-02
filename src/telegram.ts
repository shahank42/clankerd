import { Effect, Layer, Redacted, Schema } from "effect"
import * as Context from "effect/Context"
import { AppConfig } from "./config.js"
import { TelegramError } from "./errors.js"

interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  username?: string
}

interface TelegramChat {
  id: number
  type: string
}

interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  text?: string
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

interface TelegramResponse<T> {
  ok: boolean
  result?: T
  description?: string
  error_code?: number
}

const SendMessageBody = Schema.Struct({
  chat_id: Schema.Number,
  text: Schema.String,
})

const encodeSendMessageBody = Schema.encodeSync(Schema.fromJsonString(SendMessageBody))

export class TelegramBot extends Context.Service<
  TelegramBot,
  {
    readonly getUpdates: (offset: number) => Effect.Effect<readonly TelegramUpdate[], TelegramError>
    readonly sendMessage: (chatId: number, text: string) => Effect.Effect<void, TelegramError>
  }
>()("@app/TelegramBot") {
  static readonly layer = Layer.effect(
    TelegramBot,
    Effect.gen(function* () {
      const config = yield* AppConfig
      const token = Redacted.value(config.telegramToken)
      const baseUrl = `https://api.telegram.org/bot${token}`

      const getUpdates = Effect.fn("TelegramBot.getUpdates")(
        (offset: number): Effect.Effect<readonly TelegramUpdate[], TelegramError> =>
          Effect.tryPromise({
            try: async () => {
              const url = new URL(`${baseUrl}/getUpdates`)
              url.searchParams.set("offset", String(offset))
              url.searchParams.set("limit", "100")
              const res = await fetch(url)
              const data = (await res.json()) as TelegramResponse<readonly TelegramUpdate[]>
              if (!data.ok) {
                throw new TelegramError({ message: data.description ?? "Unknown Telegram error" })
              }
              return data.result ?? []
            },
            catch: error =>
              error instanceof TelegramError ? error : new TelegramError({ message: String(error) })
          })
      )

      const sendMessage = Effect.fn("TelegramBot.sendMessage")(
        (chatId: number, text: string): Effect.Effect<void, TelegramError> =>
          Effect.tryPromise({
            try: async () => {
              const body = encodeSendMessageBody({ chat_id: chatId, text })
              const res = await fetch(`${baseUrl}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body
              })
              const data = (await res.json()) as TelegramResponse<unknown>
              if (!data.ok) {
                throw new TelegramError({ message: data.description ?? "Unknown Telegram error" })
              }
            },
            catch: error =>
              error instanceof TelegramError ? error : new TelegramError({ message: String(error) })
          })
      )

      return { getUpdates, sendMessage }
    })
  )
}

export type { TelegramUpdate, TelegramMessage }

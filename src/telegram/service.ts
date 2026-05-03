import { Effect, Redacted, Schedule } from "effect"
import * as Context from "effect/Context"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import { AppConfig } from "../config/service.js"
import {
  GetUpdatesResponse,
  OkResponse,
  SendChatActionBody,
  SendMessageBodyMarkdown,
  SendMessageBodyPlain,
  SendMessageDraftBody,
  SendMessageResponse,
  TelegramUpdate
} from "./domain.js"
import { TelegramError } from "./errors.js"
import { sanitizeMarkdownV2 } from "./markdown.js"

export class TelegramBot extends Context.Service<TelegramBot>()("@app/TelegramBot", {
  make: Effect.gen(function* () {
    const config = yield* AppConfig
    const client = yield* HttpClient.HttpClient
    const token = Redacted.value(config.telegramToken)
    const baseUrl = `https://api.telegram.org/bot${token}`

    yield* Effect.log("Telegram bot listener initialized")

    const retryPolicy = Schedule.exponential("1 second").pipe(Schedule.both(Schedule.recurs(3)))

    const getUpdates = Effect.fn("TelegramBot.getUpdates")(
      (offset: number): Effect.Effect<ReadonlyArray<TelegramUpdate>, TelegramError> =>
        Effect.gen(function* () {
          const response = yield* client.get(`${baseUrl}/getUpdates`, {
            urlParams: { offset: String(offset), limit: "100" }
          })
          const data = yield* HttpClientResponse.schemaBodyJson(GetUpdatesResponse)(response)
          if (!data.ok) {
            return yield* new TelegramError({
              message: data.description ?? "Unknown Telegram error"
            })
          }
          const updates = data.result ?? []
          if (updates.length > 0) {
            yield* Effect.log(`Received ${updates.length} Telegram update(s)`)
          }
          return updates
        }).pipe(
          Effect.mapError(error => new TelegramError({ message: String(error) })),
          Effect.tapError(() => Effect.logWarning("Telegram getUpdates failed, retrying...")),
          Effect.retry(retryPolicy)
        )
    )

    const sendMessage = Effect.fn("TelegramBot.sendMessage")(
      (chatId: number, text: string): Effect.Effect<void, TelegramError> =>
        Effect.gen(function* () {
          const safeText = sanitizeMarkdownV2(text)
          const truncated = safeText.length > 4096 ? safeText.slice(0, 4096) : safeText
          yield* Effect.log(`Sending message to chat ${chatId} (${truncated.length} chars)`)

          const sendMarkdown = Effect.gen(function* () {
            const request = yield* HttpClientRequest.post(`${baseUrl}/sendMessage`).pipe(
              HttpClientRequest.schemaBodyJson(SendMessageBodyMarkdown)({
                chat_id: chatId,
                text: truncated,
                parse_mode: "MarkdownV2"
              })
            )
            const response = yield* client.execute(request)
            const data = yield* HttpClientResponse.schemaBodyJson(SendMessageResponse)(response)
            if (!data.ok) {
              return yield* new TelegramError({
                message: data.description ?? "Unknown Telegram error"
              })
            }
          }).pipe(Effect.mapError(error => new TelegramError({ message: String(error) })))

          const sendPlain = Effect.gen(function* () {
            yield* Effect.log(
              `Sending plain text fallback to chat ${chatId} (${truncated.length} chars)`
            )
            const request = yield* HttpClientRequest.post(`${baseUrl}/sendMessage`).pipe(
              HttpClientRequest.schemaBodyJson(SendMessageBodyPlain)({
                chat_id: chatId,
                text: truncated
              })
            )
            const response = yield* client.execute(request)
            const data = yield* HttpClientResponse.schemaBodyJson(SendMessageResponse)(response)
            if (!data.ok) {
              return yield* new TelegramError({
                message: data.description ?? "Unknown Telegram error"
              })
            }
          }).pipe(Effect.mapError(error => new TelegramError({ message: String(error) })))

          yield* sendMarkdown.pipe(
            Effect.catch((error: TelegramError) =>
              Effect.gen(function* () {
                yield* Effect.logWarning(
                  `MarkdownV2 failed: ${error.message}, falling back to plain text`
                )
                yield* sendPlain
              })
            )
          )
        })
    )

    const sendChatAction = Effect.fn("TelegramBot.sendChatAction")(
      (chatId: number, action: string): Effect.Effect<void, TelegramError> =>
        Effect.gen(function* () {
          const request = yield* HttpClientRequest.post(`${baseUrl}/sendChatAction`).pipe(
            HttpClientRequest.schemaBodyJson(SendChatActionBody)({ chat_id: chatId, action })
          )
          const response = yield* client.execute(request)
          const data = yield* HttpClientResponse.schemaBodyJson(OkResponse)(response)
          if (!data.ok) {
            return yield* new TelegramError({
              message: data.description ?? "Unknown Telegram error"
            })
          }
        }).pipe(Effect.mapError(error => new TelegramError({ message: String(error) })))
    )

    const sendMessageDraft = Effect.fn("TelegramBot.sendMessageDraft")(
      (chatId: number, draftId: number, text: string): Effect.Effect<void, TelegramError> =>
        Effect.gen(function* () {
          const request = yield* HttpClientRequest.post(`${baseUrl}/sendMessageDraft`).pipe(
            HttpClientRequest.schemaBodyJson(SendMessageDraftBody)({
              chat_id: chatId,
              draft_id: draftId,
              text
            })
          )
          const response = yield* client.execute(request)
          const data = yield* HttpClientResponse.schemaBodyJson(OkResponse)(response)
          if (!data.ok) {
            return yield* new TelegramError({
              message: data.description ?? "Unknown Telegram error"
            })
          }
        }).pipe(Effect.mapError(error => new TelegramError({ message: String(error) })))
    )

    return { getUpdates, sendMessage, sendChatAction, sendMessageDraft }
  })
}) {}

export type { TelegramUpdate, TelegramMessage } from "./domain.js"

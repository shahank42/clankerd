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
  SendMessageBody,
  SendMessageDraftBody,
  SendMessageResponse,
  TelegramUpdate
} from "./domain.js"
import { TelegramError } from "./errors.js"

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
          yield* Effect.log(`Sending message to chat ${chatId} (${text.length} chars)`)
          const request = yield* HttpClientRequest.post(`${baseUrl}/sendMessage`).pipe(
            HttpClientRequest.schemaBodyJson(SendMessageBody)({ chat_id: chatId, text })
          )
          const response = yield* client.execute(request)
          const data = yield* HttpClientResponse.schemaBodyJson(SendMessageResponse)(response)
          if (!data.ok) {
            return yield* new TelegramError({
              message: data.description ?? "Unknown Telegram error"
            })
          }
        }).pipe(Effect.mapError(error => new TelegramError({ message: String(error) })))
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

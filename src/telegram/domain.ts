import { Schema } from "effect"

export class TelegramUser extends Schema.Class<TelegramUser>("TelegramUser")({
  id: Schema.Number,
  is_bot: Schema.Boolean,
  first_name: Schema.String,
  username: Schema.optional(Schema.String)
}) {}

export class TelegramChat extends Schema.Class<TelegramChat>("TelegramChat")({
  id: Schema.Number,
  type: Schema.String
}) {}

export class TelegramMessage extends Schema.Class<TelegramMessage>("TelegramMessage")({
  message_id: Schema.Number,
  from: Schema.optional(TelegramUser),
  chat: TelegramChat,
  text: Schema.optional(Schema.String)
}) {}

export class TelegramUpdate extends Schema.Class<TelegramUpdate>("TelegramUpdate")({
  update_id: Schema.Number,
  message: Schema.optional(TelegramMessage)
}) {}

export const GetUpdatesResponse = Schema.Struct({
  ok: Schema.Boolean,
  result: Schema.optional(Schema.Array(TelegramUpdate)),
  description: Schema.optional(Schema.String),
  error_code: Schema.optional(Schema.Number)
})

export const SendMessageBody = Schema.Struct({
  chat_id: Schema.Number,
  text: Schema.String
})

export const SendMessageResponse = Schema.Struct({
  ok: Schema.Boolean,
  result: Schema.optional(Schema.Unknown),
  description: Schema.optional(Schema.String),
  error_code: Schema.optional(Schema.Number)
})

export const SendChatActionBody = Schema.Struct({
  chat_id: Schema.Number,
  action: Schema.String
})

export const SendMessageDraftBody = Schema.Struct({
  chat_id: Schema.Number,
  draft_id: Schema.Number,
  text: Schema.String,
  parse_mode: Schema.optional(Schema.String),
  entities: Schema.optional(Schema.Array(Schema.Unknown))
})

export const OkResponse = Schema.Struct({
  ok: Schema.Boolean,
  description: Schema.optional(Schema.String),
  error_code: Schema.optional(Schema.Number)
})

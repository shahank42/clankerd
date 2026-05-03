import { Chunk } from "effect"
import type { AgentEvent } from "@mariozechner/pi-agent-core"
import { toolDisplayNames } from "./agent/tools.js"

export interface MessageState {
  readonly segmentText: string
  readonly activeTools: ReadonlyArray<string>
}

export const initialState: MessageState = {
  segmentText: "",
  activeTools: []
}

export type MessageAction =
  | { readonly _tag: "SendMessage"; readonly text: string }
  | { readonly _tag: "UpdateDraft"; readonly text: string }
  | { readonly _tag: "SendError"; readonly text: string }

export const SendMessage = (text: string): MessageAction => ({ _tag: "SendMessage", text })
export const UpdateDraft = (text: string): MessageAction => ({ _tag: "UpdateDraft", text })
export const SendError = (text: string): MessageAction => ({ _tag: "SendError", text })

const renderDraft = (tools: ReadonlyArray<string>): string =>
  tools.map(t => toolDisplayNames[t] ?? t).join("\n")

export const transition = (
  state: MessageState,
  event: AgentEvent
): [MessageState, Chunk.Chunk<MessageAction>] => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    return [
      { ...state, segmentText: state.segmentText + event.assistantMessageEvent.delta },
      Chunk.empty()
    ]
  }

  if (event.type === "tool_execution_start") {
    const actions: Array<MessageAction> = []
    if (state.segmentText.length > 0) {
      actions.push(SendMessage(state.segmentText))
    }
    const newTools = [...state.activeTools, event.toolName]
    actions.push(UpdateDraft(renderDraft(newTools)))
    return [{ segmentText: "", activeTools: newTools }, Chunk.fromIterable(actions)]
  }

  if (event.type === "tool_execution_end") {
    const newTools = state.activeTools.filter(t => t !== event.toolName)
    if (newTools.length === 0) {
      return [{ ...state, activeTools: newTools }, Chunk.empty()]
    }
    return [{ ...state, activeTools: newTools }, Chunk.of(UpdateDraft(renderDraft(newTools)))]
  }

  if (event.type === "agent_end") {
    const actions: Array<MessageAction> = []
    if (state.segmentText.length > 0) {
      actions.push(SendMessage(state.segmentText))
    }
    const lastMsg = event.messages[event.messages.length - 1]
    if (
      lastMsg?.role === "assistant" &&
      (lastMsg.stopReason === "error" || lastMsg.stopReason === "aborted")
    ) {
      actions.push(SendError(lastMsg.errorMessage ?? "Unknown error"))
    }
    return [{ segmentText: "", activeTools: [] }, Chunk.fromIterable(actions)]
  }

  return [state, Chunk.empty()]
}

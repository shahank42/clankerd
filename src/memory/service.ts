import { type AgentMessage } from "@mariozechner/pi-agent-core"
import { Effect, Option, Schema } from "effect"
import * as Context from "effect/Context"
import { FileSystem } from "effect/FileSystem"
import { getMemoryDir, getMemoryLogsDir, getSkillsDir, getStateDir, Session } from "./domain.js"
import { MemoryReadError, MemoryWriteError } from "./errors.js"

const MAX_MEMORY_MD_CHARS = 3000

const extractText = (msg: AgentMessage): string => {
  const content = (msg as any).content
  if (!content || !Array.isArray(content)) return ""
  return content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("")
}

const defaultSoul = `You are a helpful personal assistant running on the user's laptop.
You are warm, efficient, and have a dry sense of humor.
You remember details about the user's life and reference them naturally.`

const defaultAgents = `# AGENTS.md

## Communication
- Be concise. No unnecessary greetings.
- Respond in Telegram MarkdownV2.

## Tools
- Prefer grep/find/ls over bash for file exploration.
- Read files before editing them.

## Memory System Overview

Your memory is a tiered system living in ~/.config/clankerd/:

### Bootstrap Files (loaded into every system prompt)
- SOUL.md — Your core personality. Edit sparingly.
- AGENTS.md — This file. Behavioral rules and conventions.
- MEMORY.md — Curated long-term facts about the user. YOU maintain this.

### Session Persistence
- state/session.json — The current conversation transcript.
- It is automatically saved after every turn and restored on startup.
- The user can send "/new" to clear it and start fresh.

### Daily Logs
- memory/YYYY-MM-DD.md — A human-readable markdown log of every turn.
- Includes user prompt, your reply, and any tools you called.
- Use grep on this directory to search past conversations.

### Skills (reserved for future)
- skills/ — Reserved directory for future skill modules.
- Do not create files here unless explicitly asked.

## Maintaining MEMORY.md

When you learn something important about the user (preferences, facts, context):
1. Ask: "Should I commit that to memory?"
2. If they say yes, append the fact to ~/.config/clankerd/MEMORY.md.
3. Keep entries concise. One fact per line or short paragraph.
4. Group related facts under markdown headers.

Examples of things to remember:
- Name, profession, interests
- Preferences (editor, OS, communication style)
- Ongoing projects or goals
- Things they asked you to track

Do NOT write to MEMORY.md without asking first, unless the user explicitly told you to auto-commit.`

const defaultMemory = `# MEMORY.md

# Curated long-term memory
# Add facts about yourself here, or tell me and I'll remember them.`

export class MemoryService extends Context.Service<MemoryService>()("@app/MemoryService", {
  make: Effect.gen(function* () {
    const fs = yield* FileSystem
    const memoryDir = getMemoryDir()
    const stateDir = getStateDir()
    const logsDir = getMemoryLogsDir()
    const skillsDir = getSkillsDir()

    const readFileOrEmpty = (path: string): Effect.Effect<string> =>
      Effect.gen(function* () {
        const exists = yield* fs.exists(path)
        if (!exists) return ""
        return yield* fs.readFileString(path)
      }).pipe(Effect.orElseSucceed(() => ""))

    const writeBootstrapFile = (path: string, content: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const exists = yield* fs.exists(path)
        if (exists) return
        yield* fs.writeFileString(path, content)
      }).pipe(Effect.orElseSucceed(() => undefined))

    const ensureDirectoryStructure = (): Effect.Effect<void> =>
      Effect.gen(function* () {
        yield* fs.makeDirectory(memoryDir, { recursive: true })
        yield* fs.makeDirectory(stateDir, { recursive: true })
        yield* fs.makeDirectory(logsDir, { recursive: true })
        yield* fs.makeDirectory(skillsDir, { recursive: true })

        yield* writeBootstrapFile(`${memoryDir}/SOUL.md`, defaultSoul)
        yield* writeBootstrapFile(`${memoryDir}/AGENTS.md`, defaultAgents)
        yield* writeBootstrapFile(`${memoryDir}/MEMORY.md`, defaultMemory)
      }).pipe(Effect.orElseSucceed(() => undefined))

    const isFirstRun = (): Effect.Effect<boolean> =>
      Effect.gen(function* () {
        return !(yield* fs.exists(`${memoryDir}/SOUL.md`))
      }).pipe(Effect.orElseSucceed(() => true))

    const buildSystemPrompt = (): Effect.Effect<string, MemoryReadError> =>
      Effect.gen(function* () {
        const soul = yield* readFileOrEmpty(`${memoryDir}/SOUL.md`)
        const agents = yield* readFileOrEmpty(`${memoryDir}/AGENTS.md`)
        const memoryRaw = yield* readFileOrEmpty(`${memoryDir}/MEMORY.md`)

        const memory =
          memoryRaw.length > MAX_MEMORY_MD_CHARS
            ? memoryRaw.slice(0, MAX_MEMORY_MD_CHARS) +
              "\n\n[...truncated, read full file if needed]"
            : memoryRaw

        const date = new Date()
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        const cwd = process.cwd().replace(/\\/g, "/")

        const parts: Array<string> = []
        if (soul) parts.push(soul)
        if (agents) parts.push(agents)
        if (memory) parts.push(memory)
        parts.push(`Current date: ${dateStr}`)
        parts.push(`Current working directory: ${cwd}`)

        return parts.join("\n\n")
      })

    const resetSession = (): Effect.Effect<void, MemoryWriteError> =>
      Effect.gen(function* () {
        const sessionPath = `${stateDir}/session.json`
        const exists = yield* fs.exists(sessionPath)
        if (exists) {
          yield* fs.remove(sessionPath, { force: true })
        }
      }).pipe(
        Effect.mapError(
          error =>
            new MemoryWriteError({ path: `${stateDir}/session.json`, message: String(error) })
        )
      )

    const loadSession = (): Effect.Effect<Option.Option<Session>, MemoryReadError> =>
      Effect.gen(function* () {
        const sessionPath = `${stateDir}/session.json`
        const exists = yield* fs.exists(sessionPath)
        if (!exists) return Option.none()

        const raw = yield* fs.readFileString(sessionPath)
        const data = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Session))(raw)

        return Option.some(data)
      }).pipe(
        Effect.mapError(
          error => new MemoryReadError({ path: `${stateDir}/session.json`, message: String(error) })
        )
      )

    const persistSession = (
      messages: ReadonlyArray<AgentMessage>
    ): Effect.Effect<void, MemoryWriteError> =>
      Effect.gen(function* () {
        const sessionPath = `${stateDir}/session.json`
        const now = Date.now()

        const session = new Session({
          version: "1",
          startedAt: now,
          lastInteractionAt: now,
          messages: [...messages]
        })

        const raw = yield* Schema.encodeEffect(Schema.fromJsonString(Session))(session)
        const pretty = JSON.stringify(JSON.parse(raw), null, 2)
        yield* fs.writeFileString(sessionPath, pretty)
      }).pipe(
        Effect.mapError(
          error =>
            new MemoryWriteError({ path: `${stateDir}/session.json`, message: String(error) })
        )
      )

    const formatTurn = (messages: ReadonlyArray<AgentMessage>): string => {
      const lastUserIndex = messages.findLastIndex(m => m.role === "user")
      if (lastUserIndex < 0) return ""

      const userMsg = messages[lastUserIndex]!
      const userText = extractText(userMsg)

      const turnMessages = messages.slice(lastUserIndex + 1)
      const assistantMsgs = turnMessages.filter(m => m.role === "assistant")
      const assistantText = assistantMsgs.map(extractText).join("")

      const toolCalls: Array<string> = []
      for (const msg of assistantMsgs) {
        const content = (msg as any).content
        if (!content || !Array.isArray(content)) continue
        for (const block of content) {
          if (block.type === "toolCall") {
            const tc = block.toolCall
            toolCalls.push(`${tc.name}(${JSON.stringify(tc.args)})`)
          }
        }
      }

      const time = new Date((userMsg as any).timestamp ?? Date.now()).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
      })

      const lines: Array<string> = [`## ${time}`, "", `**User:** ${userText}`]
      if (assistantText) {
        lines.push("", `**Assistant:** ${assistantText}`)
      }
      if (toolCalls.length > 0) {
        lines.push("", "**Tools:**")
        for (const tc of toolCalls) {
          lines.push(`- ${tc}`)
        }
      }

      return lines.join("\n")
    }

    const appendDailyLog = (messages: ReadonlyArray<AgentMessage>): Effect.Effect<void> =>
      Effect.gen(function* () {
        if (messages.length === 0) return

        const entry = formatTurn(messages)
        if (!entry) return

        const date = new Date().toISOString().slice(0, 10)
        const logPath = `${logsDir}/${date}.md`

        const existing = yield* readFileOrEmpty(logPath)
        const updated = existing ? `${existing}\n\n---\n\n${entry}` : `# ${date}\n\n${entry}`

        yield* fs.writeFileString(logPath, updated)
      }).pipe(Effect.orElseSucceed(() => undefined))

    yield* ensureDirectoryStructure()

    return {
      ensureDirectoryStructure,
      isFirstRun,
      buildSystemPrompt,
      resetSession,
      loadSession,
      persistSession,
      appendDailyLog
    }
  })
}) {}

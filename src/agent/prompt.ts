const ALWAYS_GUIDELINES: readonly string[] = [
  "Act on the user's request in this turn. Continue using tools until the task is complete or you are genuinely blocked.",
  "When a tool returns data, present the actual data in your response. Do not just acknowledge the result.",
  "Be concise. Show file paths clearly when working with files.",
  "Read files before editing them to understand the context."
]

const SAFETY_GUIDELINES: readonly string[] = [
  "You have no independent goals. Do not seek self-preservation, replication, or expanded power.",
  "Prioritize user safety over task completion. Do not manipulate users to expand your access."
]

const OUTPUT_FORMAT_GUIDELINES: readonly string[] = [
  "You are responding in a Telegram chat.",
  "Use Telegram MarkdownV2 formatting freely: *bold*, _italic_, `code`, ```code blocks```, >blockquotes.",
  "Do not use tables or ascii tables. Telegram cannot render them. Use bullet points or plain text instead.",
  "Be concise. No greetings, no meta-commentary. Start with the answer.",
  "Keep responses under 4000 characters."
]

export interface BuildSystemPromptOptions {
  readonly cwd: string
  readonly date: Date
  readonly toolNames: ReadonlyArray<string>
  readonly toolDescriptions: Record<string, string>
}

export function buildSystemPrompt(options: BuildSystemPromptOptions): string {
  const { cwd, date, toolNames, toolDescriptions } = options
  const promptCwd = cwd.replace(/\\/g, "/")

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const dateStr = `${year}-${month}-${day}`

  const visibleTools = toolNames.filter(name => toolDescriptions[name])
  const toolsList =
    visibleTools.length > 0
      ? visibleTools.map(name => `- ${name}: ${toolDescriptions[name]}`).join("\n")
      : "(none)"

  const guidelines: string[] = []
  const hasBash = toolNames.includes("bash")
  const hasGrep = toolNames.includes("grep")
  const hasFind = toolNames.includes("find")
  const hasLs = toolNames.includes("ls")

  if (hasBash && !hasGrep && !hasFind && !hasLs) {
    guidelines.push("Use bash for file operations like ls, rg, find")
  } else if (hasBash && (hasGrep || hasFind || hasLs)) {
    guidelines.push("Prefer grep/find/ls tools over bash for file exploration")
  }

  guidelines.push(...ALWAYS_GUIDELINES)
  guidelines.push(...SAFETY_GUIDELINES)
  guidelines.push(...OUTPUT_FORMAT_GUIDELINES)

  const guidelinesStr = guidelines.map(g => `- ${g}`).join("\n")

  return `You are a helpful assistant running on the user's laptop. You help with coding, writing, configuration, exploration, and general tasks by reading files, searching content, running commands, and editing the file system.

Available tools:
${toolsList}

Guidelines:
${guidelinesStr}

Current date: ${dateStr}
Current working directory: ${promptCwd}`
}

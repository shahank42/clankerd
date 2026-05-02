import type { AgentTool } from "@mariozechner/pi-agent-core"
import {
  createBashTool,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWriteTool
} from "@mariozechner/pi-coding-agent"

export interface ToolEntry {
  readonly name: string
  readonly description: string
  readonly create: (cwd: string) => AgentTool<any>
}

export const toolRegistry = [
  {
    name: "read",
    description: "Read a file with optional offset and line limit",
    create: createReadTool
  },
  {
    name: "write",
    description: "Write content to a file, creating parent directories as needed",
    create: createWriteTool
  },
  {
    name: "edit",
    description: "Apply a diff-based edit to an existing file",
    create: createEditTool
  },
  {
    name: "grep",
    description: "Search file contents using a pattern",
    create: createGrepTool
  },
  {
    name: "find",
    description: "Find files by name or pattern within a directory",
    create: createFindTool
  },
  {
    name: "ls",
    description: "List files and directories with metadata",
    create: createLsTool
  },
  {
    name: "bash",
    description: "Execute shell commands",
    create: createBashTool
  }
] as const satisfies ReadonlyArray<ToolEntry>

export const createTools = (cwd: string): ReadonlyArray<AgentTool<any>> =>
  toolRegistry.map(t => t.create(cwd))

export const toolNames: ReadonlyArray<string> = toolRegistry.map(t => t.name)

export const toolDescriptions: Record<string, string> = Object.fromEntries(
  toolRegistry.map(t => [t.name, t.description])
)

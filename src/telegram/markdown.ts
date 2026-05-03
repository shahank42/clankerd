const RESERVED_CHARS = "_*[]()~`>#+-=|{}.!"

interface MatchedEntity {
  readonly content: string
  readonly length: number
}

function matchCodeBlock(text: string, start: number): MatchedEntity | undefined {
  if (text.slice(start, start + 3) !== "```") return undefined
  const end = text.indexOf("```", start + 3)
  if (end === -1) return undefined
  return { content: text.slice(start, end + 3), length: end + 3 - start }
}

function matchInlineCode(text: string, start: number): MatchedEntity | undefined {
  if (text[start] !== "`") return undefined
  const end = text.indexOf("`", start + 1)
  if (end === -1) return undefined
  return { content: text.slice(start, end + 1), length: end + 1 - start }
}

function matchLink(text: string, start: number): MatchedEntity | undefined {
  if (text[start] !== "[") return undefined
  const closeBracket = text.indexOf("]", start + 1)
  if (closeBracket === -1 || text[closeBracket + 1] !== "(") return undefined
  const closeParen = text.indexOf(")", closeBracket + 2)
  if (closeParen === -1) return undefined

  const label = text.slice(start + 1, closeBracket)
  const url = text.slice(closeBracket + 2, closeParen)

  // Escape reserved chars inside the label only
  const escapedLabel = label.replace(
    new RegExp(`[${RESERVED_CHARS.replace(/[-\\[\]{}]/g, "\\$&")}]`, "g"),
    "\\$&"
  )

  return {
    content: `[${escapedLabel}](${url})`,
    length: closeParen + 1 - start
  }
}

const FORMATTING_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp
  readonly prefix: number
  readonly content: number
  readonly suffix: number
}> = [
  { pattern: /^(\*\*)([^*\s][^*]*?)(\*\*)/, prefix: 1, content: 2, suffix: 3 }, // **bold**
  { pattern: /^(__)([^_\s][^_]*?)(__)/, prefix: 1, content: 2, suffix: 3 }, // __underline__
  { pattern: /^(~~)([^~\s][^~]*?)(~~)/, prefix: 1, content: 2, suffix: 3 }, // ~~strikethrough~~
  { pattern: /^(\|\|)([^|\s][^|]*?)(\|\|)/, prefix: 1, content: 2, suffix: 3 }, // ||spoiler||
  { pattern: /^(\*)([^*\s][^*]*?)(\*)/, prefix: 1, content: 2, suffix: 3 }, // *bold*
  { pattern: /^(_)([^_\s][^_]*?)(_)/, prefix: 1, content: 2, suffix: 3 } // _italic_
]

function escapeReserved(text: string): string {
  return text.replace(new RegExp(`[${RESERVED_CHARS.replace(/[-\\[\]{}]/g, "\\$&")}]`, "g"), "\\$&")
}

function matchFormatting(text: string, start: number): MatchedEntity | undefined {
  const rest = text.slice(start)
  for (const { pattern, prefix, content, suffix } of FORMATTING_PATTERNS) {
    const match = rest.match(pattern)
    if (match) {
      const pre = match[prefix]
      const cont = match[content]
      const suff = match[suffix]
      if (pre !== undefined && cont !== undefined && suff !== undefined) {
        return {
          content: pre + escapeReserved(cont) + suff,
          length: match[0].length
        }
      }
    }
  }
  return undefined
}

function matchBlockquote(text: string, start: number): MatchedEntity | undefined {
  const atLineStart = start === 0 || text[start - 1] === "\n"
  if (!atLineStart || text[start] !== ">") return undefined
  // Only preserve the > marker; the rest of the line is processed normally
  return { content: ">", length: 1 }
}

/**
 * Sanitize raw text for Telegram MarkdownV2 parse mode.
 *
 * Preserves well-formed entities:
 * - Code blocks (```...```)
 * - Inline code (`...`)
 * - Links ([label](url))
 * - Bold (*...*, **...**)
 * - Italic (_..._)
 * - Underline (__...__)
 * - Strikethrough (~...~, ~~...~~)
 * - Spoiler (||...||)
 * - Blockquote lines (>...)
 *
 * All other reserved characters are escaped with a backslash.
 */
export function sanitizeMarkdownV2(text: string): string {
  let result = ""
  let i = 0

  while (i < text.length) {
    const entity =
      matchCodeBlock(text, i) ??
      matchInlineCode(text, i) ??
      matchLink(text, i) ??
      matchFormatting(text, i) ??
      matchBlockquote(text, i)

    if (entity) {
      result += entity.content
      i += entity.length
      continue
    }

    const ch = text[i]
    if (ch !== undefined && RESERVED_CHARS.includes(ch)) {
      result += "\\"
    }
    result += ch
    i++
  }

  return result
}

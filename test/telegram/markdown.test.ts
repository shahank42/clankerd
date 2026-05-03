import { describe, it } from "vitest"
import { strictEqual } from "node:assert"
import { sanitizeMarkdownV2 } from "../../src/telegram/markdown.js"

const RESERVED = "_*[]()~`>#+-=|{}.!".split("")

describe("sanitizeMarkdownV2", () => {
  describe("plain text", () => {
    it("escapes every reserved character", () => {
      for (const ch of RESERVED) {
        strictEqual(sanitizeMarkdownV2(`x${ch}y`), `x\\${ch}y`)
      }
    })

    it("leaves safe characters untouched", () => {
      strictEqual(sanitizeMarkdownV2("hello world 123"), "hello world 123")
    })
  })

  describe("code blocks", () => {
    it("preserves a complete code block", () => {
      const input = "```ts\nconst x = 1\n```"
      strictEqual(sanitizeMarkdownV2(input), input)
    })

    it("preserves a code block with language tag", () => {
      const input = '```python\nprint("hi")\n```'
      strictEqual(sanitizeMarkdownV2(input), input)
    })

    it("preserves code block and escapes text around it", () => {
      const input = "hello! ```ts\nconst x = 1\n``` world!"
      strictEqual(sanitizeMarkdownV2(input), "hello\\! ```ts\nconst x = 1\n``` world\\!")
    })

    it("escapes unclosed code block opener", () => {
      strictEqual(sanitizeMarkdownV2("```ts\nconst x = 1"), "``\\`ts\nconst x \\= 1")
    })
  })

  describe("inline code", () => {
    it("preserves inline code", () => {
      strictEqual(sanitizeMarkdownV2("`hello`"), "`hello`")
    })

    it("preserves inline code with special chars inside", () => {
      strictEqual(sanitizeMarkdownV2("`hello!world`"), "`hello!world`")
    })

    it("preserves inline code and escapes surrounding text", () => {
      strictEqual(sanitizeMarkdownV2("run `ls -la` now!"), "run `ls -la` now\\!")
    })

    it("escapes unclosed backtick", () => {
      strictEqual(sanitizeMarkdownV2("`hello"), "\\`hello")
    })
  })

  describe("links", () => {
    it("preserves a well-formed link", () => {
      strictEqual(
        sanitizeMarkdownV2("[click here](https://example.com)"),
        "[click here](https://example.com)"
      )
    })

    it("escapes reserved chars inside link label", () => {
      strictEqual(
        sanitizeMarkdownV2("[click *here*!](https://example.com)"),
        "[click \\*here\\*\\!](https://example.com)"
      )
    })

    it("escapes malformed link opener", () => {
      strictEqual(sanitizeMarkdownV2("[hello"), "\\[hello")
    })
  })

  describe("bold", () => {
    it("preserves **bold**", () => {
      strictEqual(sanitizeMarkdownV2("**bold**"), "**bold**")
    })

    it("preserves *bold*", () => {
      strictEqual(sanitizeMarkdownV2("*bold*"), "*bold*")
    })

    it("escapes reserved chars inside bold", () => {
      strictEqual(sanitizeMarkdownV2("*Hello!*"), "*Hello\\!*")
      strictEqual(sanitizeMarkdownV2("**bold!**"), "**bold\\!**")
    })

    it("escapes unclosed *", () => {
      strictEqual(sanitizeMarkdownV2("*hello"), "\\*hello")
    })

    it("escapes * with whitespace at edge", () => {
      strictEqual(sanitizeMarkdownV2("* hello*"), "\\* hello\\*")
    })
  })

  describe("italic", () => {
    it("preserves _italic_", () => {
      strictEqual(sanitizeMarkdownV2("_italic_"), "_italic_")
    })

    it("escapes reserved chars inside italic", () => {
      strictEqual(sanitizeMarkdownV2("_Hello!_"), "_Hello\\!_")
    })

    it("escapes unclosed _", () => {
      strictEqual(sanitizeMarkdownV2("_hello"), "\\_hello")
    })
  })

  describe("underline", () => {
    it("preserves __underline__", () => {
      strictEqual(sanitizeMarkdownV2("__underline__"), "__underline__")
    })

    it("escapes reserved chars inside underline", () => {
      strictEqual(sanitizeMarkdownV2("__Hello!__"), "__Hello\\!__")
    })

    it("escapes unclosed __", () => {
      strictEqual(sanitizeMarkdownV2("__hello"), "\\_\\_hello")
    })
  })

  describe("strikethrough", () => {
    it("preserves ~~strikethrough~~", () => {
      strictEqual(sanitizeMarkdownV2("~~strikethrough~~"), "~~strikethrough~~")
    })

    it("escapes reserved chars inside strikethrough", () => {
      strictEqual(sanitizeMarkdownV2("~~Hello!~~"), "~~Hello\\!~~")
    })

    it("escapes single ~ (not strikethrough)", () => {
      strictEqual(sanitizeMarkdownV2("~hello"), "\\~hello")
      strictEqual(sanitizeMarkdownV2("~2.7 GB~"), "\\~2\\.7 GB\\~")
    })
  })

  describe("spoiler", () => {
    it("preserves ||spoiler||", () => {
      strictEqual(sanitizeMarkdownV2("||spoiler||"), "||spoiler||")
    })

    it("escapes reserved chars inside spoiler", () => {
      strictEqual(sanitizeMarkdownV2("||Hello!||"), "||Hello\\!||")
    })

    it("escapes unclosed ||", () => {
      strictEqual(sanitizeMarkdownV2("||hello"), "\\|\\|hello")
    })
  })

  describe("blockquotes", () => {
    it("preserves blockquote at start of text", () => {
      strictEqual(sanitizeMarkdownV2(">hello"), ">hello")
    })

    it("preserves blockquote after newline", () => {
      strictEqual(sanitizeMarkdownV2("a\n>b"), "a\n>b")
    })

    it("escapes > not at line start", () => {
      strictEqual(sanitizeMarkdownV2("a > b"), "a \\> b")
    })

    it("escapes reserved chars inside blockquote text", () => {
      strictEqual(sanitizeMarkdownV2("> hello!"), "> hello\\!")
    })

    it("escapes dots inside blockquote", () => {
      strictEqual(sanitizeMarkdownV2("> 15.2%"), "> 15\\.2%")
    })
  })

  describe("mixed content", () => {
    it("handles file listing with special chars", () => {
      const input = "- node_modules\n- .config\n- some-folder!"
      const expected = "\\- node\\_modules\n\\- \\.config\n\\- some\\-folder\\!"
      strictEqual(sanitizeMarkdownV2(input), expected)
    })

    it("handles bold next to plain text with !", () => {
      strictEqual(sanitizeMarkdownV2("*bold* hello!"), "*bold* hello\\!")
    })

    it("handles code block surrounded by exclamation", () => {
      strictEqual(
        sanitizeMarkdownV2("look! ```ts\nconst x = 1\n``` wow!"),
        "look\\! ```ts\nconst x = 1\n``` wow\\!"
      )
    })
  })

  describe("regressions", () => {
    it("escapes ! in hi response", () => {
      strictEqual(sanitizeMarkdownV2("hi!"), "hi\\!")
    })

    it("escapes - in file paths", () => {
      strictEqual(sanitizeMarkdownV2("some-folder"), "some\\-folder")
    })

    it("escapes . in file names", () => {
      strictEqual(sanitizeMarkdownV2(".config"), "\\.config")
    })
  })
})

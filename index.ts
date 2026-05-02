import { BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"
import { appLayer } from "./src/layers.js"
import { program } from "./src/program.js"

BunRuntime.runMain(program.pipe(Effect.provide(appLayer)))

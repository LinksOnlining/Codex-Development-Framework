import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import type { AppConfig, ApplicationInput, ApplicationResult, LogLevel } from "../../src/index.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".js") && context.parentURL?.includes("/src/")) {
      try {
        return nextResolve(`${specifier.slice(0, -3)}.ts`, context);
      } catch {
        // Fall through to the normal resolver when the TypeScript source is absent.
      }
    }

    return nextResolve(specifier, context);
  },
});

const api = await import("../../src/index.ts");

test("exports only the stable runtime API", () => {
  assert.deepEqual(Object.keys(api).sort(), ["executeApplication", "identity"]);
  assert.equal(typeof api.executeApplication, "function");
  assert.equal(typeof api.identity, "function");
});

test("exports the stable public types", () => {
  const config: AppConfig = { name: "demo", logLevel: "info", maxRetries: 3 };
  const input: ApplicationInput = { value: "hello" };
  const level: LogLevel = config.logLevel;
  const result: ApplicationResult = {
    value: input.value,
    name: config.name,
    logLevel: level,
    maxRetries: config.maxRetries,
  };

  assert.deepEqual(result, {
    value: "hello",
    name: "demo",
    logLevel: "info",
    maxRetries: 3,
  });
});

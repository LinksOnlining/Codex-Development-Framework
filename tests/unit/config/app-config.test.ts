import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LOG_LEVEL,
  DEFAULT_MAX_RETRIES,
  MAX_RETRIES_RANGE,
  validateAppConfig,
} from "../../../src/config/app-config.ts";

function errorPaths(input: unknown): string[] {
  const result = validateAppConfig(input);

  assert.equal(result.ok, false);
  return result.errors.map(({ path }) => path);
}

test("validates a complete configuration", () => {
  const result = validateAppConfig({ name: "demo", logLevel: "debug", maxRetries: 5 });

  assert.deepEqual(result, {
    ok: true,
    value: { name: "demo", logLevel: "debug", maxRetries: 5 },
  });
});

test("fills defaults when only the required name is provided", () => {
  const result = validateAppConfig({ name: "demo" });

  assert.deepEqual(result, {
    ok: true,
    value: {
      name: "demo",
      logLevel: DEFAULT_LOG_LEVEL,
      maxRetries: DEFAULT_MAX_RETRIES,
    },
  });
});

test("rejects non-object inputs", () => {
  for (const input of [null, undefined, [], "abc", 123]) {
    assert.deepEqual(errorPaths(input), [""]);
  }
});

test("rejects missing, empty, and incorrectly typed names", () => {
  assert.deepEqual(errorPaths({}), ["name"]);
  assert.deepEqual(errorPaths({ name: "" }), ["name"]);
  assert.deepEqual(errorPaths({ name: 123 }), ["name"]);
  assert.deepEqual(errorPaths({ name: null }), ["name"]);
});

test("rejects unsupported log levels and invalid max retries", () => {
  assert.deepEqual(errorPaths({ name: "demo", logLevel: "verbose" }), ["logLevel"]);
  assert.deepEqual(errorPaths({ name: "demo", logLevel: true }), ["logLevel"]);

  for (const maxRetries of [MAX_RETRIES_RANGE.min - 1, MAX_RETRIES_RANGE.max + 1, 2.5, NaN, "2"]) {
    assert.deepEqual(errorPaths({ name: "demo", maxRetries }), ["maxRetries"]);
  }
});

test("rejects unknown keys without silently applying defaults", () => {
  const result = validateAppConfig({ name: "demo", loglevel: "debug" });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map(({ path, code }) => ({ path, code })),
    [{ path: "loglevel", code: "unknown_key" }],
  );
});

test("aggregates errors across fields", () => {
  const result = validateAppConfig({
    name: 123,
    logLevel: "bad",
    maxRetries: 99,
    x: true,
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(({ path }) => path).sort(), [
    "logLevel",
    "maxRetries",
    "name",
    "x",
  ]);
});

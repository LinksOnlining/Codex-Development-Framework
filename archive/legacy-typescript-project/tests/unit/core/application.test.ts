import assert from "node:assert/strict";
import test from "node:test";
import { executeApplication, type ApplicationInput } from "../../../src/core/application.ts";
import type { AppConfig } from "../../../src/types/app-config.ts";

const config: AppConfig = {
  name: "demo",
  logLevel: "info",
  maxRetries: 3,
};

test("returns a result using every configuration value", () => {
  assert.deepEqual(executeApplication(config, { value: "hello" }), {
    value: "hello",
    name: "demo",
    logLevel: "info",
    maxRetries: 3,
  });
});

test("preserves an empty input value", () => {
  assert.deepEqual(executeApplication(config, { value: "" }), {
    value: "",
    name: "demo",
    logLevel: "info",
    maxRetries: 3,
  });
});

test("does not modify its input objects", () => {
  const input: ApplicationInput = { value: "hello" };
  const originalConfig = { ...config };

  executeApplication(config, input);

  assert.deepEqual(input, { value: "hello" });
  assert.deepEqual(config, originalConfig);
});

test("returns the same result for repeated calls", () => {
  const input = { value: "hello" };

  assert.deepEqual(executeApplication(config, input), executeApplication(config, input));
});

test("has no IO dependency", () => {
  const result = executeApplication(config, { value: "pure" });

  assert.equal(result.value, "pure");
});

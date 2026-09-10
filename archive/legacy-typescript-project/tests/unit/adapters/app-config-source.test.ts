import assert from "node:assert/strict";
import test from "node:test";
import { createCliConfigSource } from "../../../src/adapters/app-config-source.ts";

test("creates an app config source", () => {
  const source = createCliConfigSource({ name: "demo" });

  assert.equal(typeof source.read, "function");
});

test("read returns the original CLI input values", () => {
  const input = { name: "demo", logLevel: "info", maxRetries: 3 };
  const source = createCliConfigSource(input);

  assert.deepEqual(source.read(), input);
});

test("multiple reads return consistent values", () => {
  const source = createCliConfigSource({ name: "demo", logLevel: "info", maxRetries: 3 });

  assert.deepEqual(source.read(), source.read());
});

test("does not modify the input object", () => {
  const input = { name: "demo", logLevel: "info", maxRetries: 3 };
  const originalInput = { ...input };
  const source = createCliConfigSource(input);

  source.read();

  assert.deepEqual(input, originalInput);
});

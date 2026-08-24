import assert from "node:assert/strict";
import test from "node:test";
import { createApplicationInputSource } from "../../../src/adapters/application-input-source.ts";

test("application input source returns the positional value", () => {
  const source = createApplicationInputSource(["hello"]);

  assert.deepEqual(source.read(), { value: "hello" });
});

test("undefined positionals produce an empty value", () => {
  const source = createApplicationInputSource(undefined);

  assert.deepEqual(source.read(), { value: "" });
});

test("empty positionals produce a stable empty value", () => {
  const source = createApplicationInputSource([]);

  assert.deepEqual(source.read(), { value: "" });
  assert.deepEqual(source.read(), { value: "" });
});

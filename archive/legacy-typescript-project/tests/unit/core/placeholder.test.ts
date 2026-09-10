import assert from "node:assert/strict";
import test from "node:test";
import { identity } from "../../../src/core/placeholder.ts";

test("identity returns its input unchanged", () => {
  const value = { name: "template" };

  assert.equal(identity(value), value);
  assert.equal(identity("hello"), "hello");
});

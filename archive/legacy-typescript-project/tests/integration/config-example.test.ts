import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { validateAppConfig } from "../../src/config/app-config.ts";

test("the example configuration satisfies the validation contract", async () => {
  const content = await readFile(resolve("config/app.example.json"), "utf8");
  const result = validateAppConfig(JSON.parse(content) as unknown);

  assert.equal(result.ok, true);
});

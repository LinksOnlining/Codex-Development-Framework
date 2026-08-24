import assert from "node:assert/strict";
import { ESLint } from "eslint";
import test from "node:test";

const eslint = new ESLint({ cwd: process.cwd() });

async function lintText(source: string, filePath: string) {
  const [result] = await eslint.lintText(source, { filePath });
  assert.ok(result, `Expected an ESLint result for ${filePath}`);
  return result;
}

test("adapters reject CLI dependencies", async () => {
  const sources = [
    'import "../cli/index.js";',
    'import "./../cli/index.js";',
    'await import("../cli/index.js");',
    'type Cli = import("../cli/index.js");',
    'require("../cli/index.js");',
  ];

  for (const source of sources) {
    const result = await lintText(source, "src/adapters/fixture.ts");
    assert.ok(result.errorCount > 0, `Expected adapters violation for: ${source}`);
  }
});

test("adapters allow core types, shared types, and Node built-ins", async () => {
  const sources = [
    '/* eslint-disable @typescript-eslint/no-unused-vars */ import type { ApplicationInput } from "../core/application.js";',
    '/* eslint-disable @typescript-eslint/no-unused-vars */ import type { AppConfig } from "../types/app-config.js";',
    'import "node:fs";',
  ];

  for (const source of sources) {
    const result = await lintText(source, "src/adapters/fixture.ts");
    assert.equal(result.errorCount, 0, `Expected allowed adapter source: ${source}`);
  }
});

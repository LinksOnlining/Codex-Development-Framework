import assert from "node:assert/strict";
import { ESLint } from "eslint";
import test from "node:test";

const eslint = new ESLint({ cwd: process.cwd() });

async function lintText(source: string, filePath: string) {
  const [result] = await eslint.lintText(source, { filePath });
  assert.ok(result, `Expected an ESLint result for ${filePath}`);
  return result;
}

async function assertCoreViolation(source: string): Promise<void> {
  const result = await lintText(source, "src/core/fixture.ts");

  assert.ok(result.errorCount > 0, `Expected core boundary violation for: ${source}`);
}

test("core rejects imports that escape the layer", async () => {
  await assertCoreViolation('import "../adapters/process-io.js";');
  await assertCoreViolation('import "./../adapters/process-io.js";');
  await assertCoreViolation('import "../index.js";');
  await assertCoreViolation('import type { ProcessIO } from "../adapters/process-io.js";');
  await assertCoreViolation('export * from "../adapters/process-io.js";');
  await assertCoreViolation('export { ProcessIO } from "../adapters/process-io.js";');
  await assertCoreViolation('import "node:fs";');
  await assertCoreViolation('import "third-party-package";');
});

test("core rejects dynamic imports and restricted globals", async () => {
  await assertCoreViolation('await import("../adapters/process-io.js");');
  await assertCoreViolation("process.env.HOME;");
  await assertCoreViolation('fetch("https://example.com");');
  await assertCoreViolation("globalThis.process;");
  await assertCoreViolation('require("node:fs");');
  await assertCoreViolation("__dirname;");
  await assertCoreViolation("__filename;");
  await assertCoreViolation('console.log("forbidden");');
});

test("core allows same-layer relative imports", async () => {
  const sibling = await lintText('import "./sibling.js";', "src/core/fixture.ts");
  const nestedSibling = await lintText('import "./nested/sibling.js";', "src/core/fixture.ts");
  const parentSibling = await lintText('import "../sibling.js";', "src/core/nested/fixture.ts");

  assert.equal(sibling.errorCount, 0);
  assert.equal(nestedSibling.errorCount, 0);
  assert.equal(parentSibling.errorCount, 0);
});

test("core rejects TSImportType paths that escape the layer", async () => {
  await assertCoreViolation('type Process = import("../adapters/process-io.js");');
  await assertCoreViolation('type Process = import("./../adapters/process-io.js");');
  await assertCoreViolation('export type Process = import("../adapters/process-io.js").ProcessIO;');
});

test("adapters can use process IO", async () => {
  const result = await lintText('process.stdout.write("ok");', "src/adapters/fixture.ts");

  assert.equal(result.errorCount, 0);
});

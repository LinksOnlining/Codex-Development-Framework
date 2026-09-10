import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, rmSync, symlinkSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";

const cliPath = resolve("dist/cli/index.js");

test("CLI supports help and writes it to stdout", () => {
  const result = spawnSync(process.execPath, [cliPath, "--help"], { encoding: "utf8" });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: testproject/);
  assert.equal(result.stderr, "");
});

test("CLI runs when the entry file is renamed", () => {
  const renamedPath = join(dirname(cliPath), "testproject.js");

  copyFileSync(cliPath, renamedPath);
  try {
    const result = spawnSync(process.execPath, [renamedPath, "hello"], { encoding: "utf8" });

    assert.equal(result.status, 0);
    assert.equal(result.stdout, "hello\n");
    assert.equal(result.stderr, "");
  } finally {
    rmSync(renamedPath, { force: true });
  }
});

test("CLI runs when the entry file is invoked through a symlink", (t) => {
  const symlinkPath = join(dirname(cliPath), "testproject-link.js");

  try {
    symlinkSync(basename(cliPath), symlinkPath, "file");
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "EACCES" || code === "EPERM") {
      t.skip("creating symlinks is not permitted in this environment");
      return;
    }
    throw error;
  }

  try {
    const result = spawnSync(process.execPath, [symlinkPath, "hello"], { encoding: "utf8" });

    assert.equal(result.status, 0);
    assert.equal(result.stdout, "hello\n");
    assert.equal(result.stderr, "");
  } finally {
    rmSync(symlinkPath, { force: true });
  }
});

test("CLI maps invalid options to exit code 2", () => {
  const result = spawnSync(process.execPath, [cliPath, "--unknown"], { encoding: "utf8" });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Argument error:/);
  assert.equal(result.stdout, "");
});

test("CLI supports machine-readable output", () => {
  const result = spawnSync(process.execPath, [cliPath, "--json", "hello"], { encoding: "utf8" });

  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { value: "hello" });
});

test("CLI reports its version and exits successfully", () => {
  const result = spawnSync(process.execPath, [cliPath, "--version"], { encoding: "utf8" });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^\d+\.\d+\.\d+\n$/);
  assert.equal(result.stderr, "");
});

test("CLI runs the default configuration source without errors", () => {
  const result = spawnSync(process.execPath, [cliPath, "hello"], { encoding: "utf8" });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "hello\n");
  assert.equal(result.stderr, "");
});

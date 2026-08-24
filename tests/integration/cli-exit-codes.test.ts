import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

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

const exitCodeAtImportTime = process.exitCode;

const { runCli } = await import("../../src/cli/index.ts");
const { executeApplication } = await import("../../src/core/application.ts");
const { validateAppConfig } = await import("../../src/config/app-config.ts");
const { createCliConfigSource } = await import("../../src/adapters/app-config-source.ts");
const { createApplicationInputSource } = await import(
  "../../src/adapters/application-input-source.ts"
);

interface Output {
  stdout: string;
  stderr: string;
}

interface RunOptions {
  readonly outputError?: boolean;
  readonly configInput?: unknown;
  readonly configSource?: { read(): unknown };
  readonly inputValue?: string;
}

function runWithOutput(
  argv: readonly string[],
  options: RunOptions = {},
): { code: number; output: Output } {
  const output: Output = { stdout: "", stderr: "" };
  const io = {
    writeStdout(message: string) {
      if (options.outputError === true) {
        throw new Error("output unavailable");
      }
      output.stdout += message;
    },
    writeStderr(message: string) {
      output.stderr += message;
    },
  };

  const configSource =
    options.configSource ??
    ("configInput" in options ? { read: () => options.configInput } : undefined);
  const inputSource =
    "inputValue" in options ? createApplicationInputSource([options.inputValue ?? ""]) : undefined;
  const code = runCli({ argv, io, configSource, inputSource });

  return { code, output };
}

test("importing the CLI module does not execute it", () => {
  assert.equal(exitCodeAtImportTime, process.exitCode);
});

test("successful execution returns exit code 0", () => {
  const result = runWithOutput(["hello"]);

  assert.equal(result.code, 0);
  assert.equal(result.output.stdout, "hello\n");
  assert.equal(result.output.stderr, "");
});

test("argument parsing failures return exit code 2 with usage guidance", () => {
  const result = runWithOutput(["--json=value"]);

  assert.equal(result.code, 2);
  assert.equal(result.output.stdout, "");
  assert.match(result.output.stderr, /^Argument error:/);
  assert.match(result.output.stderr, /Use --help for usage\./);
});

test("execution failures return exit code 1 without usage guidance", () => {
  const result = runWithOutput(["hello"], { outputError: true });

  assert.equal(result.code, 1);
  assert.equal(result.output.stdout, "");
  assert.match(result.output.stderr, /^Error: output unavailable\n$/);
  assert.doesNotMatch(result.output.stderr, /Use --help for usage\./);
});

test("help returns exit code 0 and writes usage to stdout", () => {
  const result = runWithOutput(["--help"]);

  assert.equal(result.code, 0);
  assert.match(result.output.stdout, /^Usage: testproject/);
  assert.equal(result.output.stderr, "");
});

test("version returns exit code 0 and writes only the version to stdout", () => {
  const result = runWithOutput(["--version"]);

  assert.equal(result.code, 0);
  assert.match(result.output.stdout, /^\d+\.\d+\.\d+\n$/);
  assert.equal(result.output.stderr, "");
});

test("json output keeps the documented shape", () => {
  const result = runWithOutput(["--json", "hello"]);

  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(result.output.stdout), { value: "hello" });
  assert.equal(result.output.stdout.endsWith("\n"), true);
  assert.equal(result.output.stderr, "");
});

test("help wins over json and skips configuration handling", () => {
  const result = runWithOutput(["--help", "--json"], {
    configInput: { unknown: true },
    inputValue: "unused",
  });

  assert.equal(result.code, 0);
  assert.match(result.output.stdout, /^Usage: testproject/);
  assert.equal(result.output.stderr, "");
});

test("version wins over json and skips configuration handling", () => {
  const result = runWithOutput(["--version", "--json"], {
    configInput: { unknown: true },
    inputValue: "unused",
  });

  assert.equal(result.code, 0);
  assert.match(result.output.stdout, /^\d+\.\d+\.\d+\n$/);
  assert.equal(result.output.stderr, "");
});

test("output matches the core result for the validated configuration", () => {
  const source = createCliConfigSource({ name: "demo", logLevel: "warn", maxRetries: 7 });
  const validated = validateAppConfig(source.read());
  assert.equal(validated.ok, true);
  if (!validated.ok) {
    return;
  }

  const expected = executeApplication(validated.value, { value: "hello" });
  const result = runWithOutput(["hello"], { configInput: source.read() });

  assert.equal(result.code, 0);
  assert.equal(result.output.stdout, `${expected.value}\n`);
  assert.equal(result.output.stderr, "");
});

test("configuration validated from an adapter source drives a successful run", () => {
  const source = createCliConfigSource({ name: "demo" });
  const result = runWithOutput(["--json", "hello"], { configSource: source });

  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(result.output.stdout), { value: "hello" });
  assert.equal(result.output.stderr, "");
});

test("CLI reads the application input through its adapter", () => {
  const result = runWithOutput(["ignored"], { inputValue: "hello" });

  assert.equal(result.code, 0);
  assert.equal(result.output.stdout, "hello\n");
  assert.equal(result.output.stderr, "");
});

test("invalid configuration returns exit code 1 and writes to stderr", () => {
  const result = runWithOutput(["hello"], { configInput: { name: 42 } });

  assert.equal(result.code, 1);
  assert.equal(result.output.stdout, "");
  assert.match(result.output.stderr, /^Error: invalid configuration\./);
  assert.match(result.output.stderr, /name/);
  assert.doesNotMatch(result.output.stderr, /Use --help for usage\./);
});

test("invalid configuration reports every failing path at once", () => {
  const result = runWithOutput(["hello"], {
    configInput: { name: "", logLevel: "verbose", maxRetries: 99, extra: true },
  });

  assert.equal(result.code, 1);
  assert.equal(result.output.stdout, "");
  for (const path of ["name", "logLevel", "maxRetries", "extra"]) {
    assert.match(result.output.stderr, new RegExp(`\\n  ${path}: `));
  }
});

test("a non-object configuration source returns exit code 1", () => {
  const result = runWithOutput(["hello"], { configInput: null });

  assert.equal(result.code, 1);
  assert.equal(result.output.stdout, "");
  assert.match(result.output.stderr, /^Error: invalid configuration\./);
  assert.match(result.output.stderr, /\n {2}config: /);
});

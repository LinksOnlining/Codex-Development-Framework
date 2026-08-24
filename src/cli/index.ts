#!/usr/bin/env node

import { parseArgs } from "node:util";
import packageJson from "../../package.json" with { type: "json" };
import {
  createApplicationInputSource,
  type ApplicationInputSource,
} from "../adapters/application-input-source.js";
import { createCliConfigSource, type AppConfigSource } from "../adapters/app-config-source.js";
import { processIO, type ProcessIO } from "../adapters/process-io.js";
import { validateAppConfig, type ValidationError } from "../config/app-config.js";
import { executeApplication } from "../core/application.js";

const HELP = `Usage: testproject [options] [value]

Options:
  -h, --help       Show this help message
  -v, --version    Show the package version
      --json       Write the result as JSON
`;

const EXIT_SUCCESS = 0;
const EXIT_RUNTIME_ERROR = 1;
const EXIT_USAGE_ERROR = 2;

function parseCliArgs(argv: readonly string[]) {
  try {
    return {
      ok: true as const,
      value: parseArgs({
        args: [...argv],
        options: {
          help: { type: "boolean", short: "h" },
          version: { type: "boolean", short: "v" },
          json: { type: "boolean" },
        },
        allowPositionals: true,
        strict: true,
      }),
    };
  } catch (error: unknown) {
    return { ok: false as const, error };
  }
}

function formatConfigErrors(errors: readonly ValidationError[]): string {
  const details = errors.map(
    (error) => `  ${error.path === "" ? "config" : error.path}: ${error.message}`,
  );

  return [
    "Error: invalid configuration.",
    ...details,
    "See config/app.example.json for a valid example.",
    "",
  ].join("\n");
}

export interface RunCliOptions {
  readonly argv: readonly string[];
  readonly io?: ProcessIO | undefined;
  readonly configSource?: AppConfigSource | undefined;
  readonly inputSource?: ApplicationInputSource | undefined;
}

export function runCli({ argv, io = processIO, configSource, inputSource }: RunCliOptions): number {
  const parsed = parseCliArgs(argv);
  if (!parsed.ok) {
    const { error } = parsed;
    const message = error instanceof Error ? error.message : "Unknown argument error";
    io.writeStderr(`Argument error: ${message}\nUse --help for usage.\n`);
    return EXIT_USAGE_ERROR;
  }

  try {
    const { values, positionals } = parsed.value;
    if (values.help) {
      io.writeStdout(HELP);
      return EXIT_SUCCESS;
    }

    if (values.version) {
      io.writeStdout(`${packageJson.version}\n`);
      return EXIT_SUCCESS;
    }

    const source = configSource ?? createCliConfigSource({ name: packageJson.name });
    // The source hands back `unknown`; `config` is the only place allowed to narrow it,
    // so the CLI never constructs an AppConfig itself.
    const validated = validateAppConfig(source.read());
    if (!validated.ok) {
      io.writeStderr(formatConfigErrors(validated.errors));
      return EXIT_RUNTIME_ERROR;
    }

    const applicationInput = inputSource ?? createApplicationInputSource(positionals);
    const result = executeApplication(validated.value, applicationInput.read());
    if (values.json) {
      io.writeStdout(`${JSON.stringify({ value: result.value })}\n`);
    } else {
      io.writeStdout(`${result.value}\n`);
    }

    return EXIT_SUCCESS;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown runtime error";
    io.writeStderr(`Error: ${message}\n`);
    return EXIT_RUNTIME_ERROR;
  }
}

if (import.meta.main) {
  process.exitCode = runCli({ argv: process.argv.slice(2) });
}

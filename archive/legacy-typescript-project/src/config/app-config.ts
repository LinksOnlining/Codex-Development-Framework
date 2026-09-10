import type { AppConfig, LogLevel } from "../types/app-config.js";

export type { AppConfig, LogLevel } from "../types/app-config.js";

export const DEFAULT_LOG_LEVEL = "info" as const;
export const DEFAULT_MAX_RETRIES = 3 as const;
export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export const MAX_RETRIES_RANGE = { min: 0, max: 10 } as const;

export interface ValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export type ValidationResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly errors: readonly ValidationError[];
    };

const ALLOWED_KEYS = ["name", "logLevel", "maxRetries"] as const;
type AllowedKey = (typeof ALLOWED_KEYS)[number];
type ConfigKeysAreInSync = [
  Exclude<keyof AppConfig, AllowedKey>,
  Exclude<AllowedKey, keyof AppConfig>,
] extends [never, never]
  ? true
  : never;
const configKeysAreInSync: ConfigKeysAreInSync = true;
void configKeysAreInSync;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function error(path: string, code: string, message: string): ValidationError {
  return { path, code, message };
}

export function validateAppConfig(input: unknown): ValidationResult<AppConfig> {
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [error("", "not_an_object", "Configuration must be a non-null object.")],
    };
  }

  const errors: ValidationError[] = [];
  const inputKeys = new Set(Object.keys(input));
  for (const key of inputKeys) {
    if (!(ALLOWED_KEYS as readonly string[]).includes(key)) {
      errors.push(error(key, "unknown_key", `Unknown configuration key: ${key}.`));
    }
  }

  const name = input.name;
  if (typeof name !== "string") {
    errors.push(error("name", "invalid_type", "name must be a string."));
  } else if (name.length === 0) {
    errors.push(error("name", "invalid_value", "name must not be empty."));
  }

  const rawLogLevel = input.logLevel;
  const logLevel = rawLogLevel === undefined ? DEFAULT_LOG_LEVEL : rawLogLevel;
  if (typeof logLevel !== "string" || !(LOG_LEVELS as readonly string[]).includes(logLevel)) {
    errors.push(error("logLevel", "invalid_value", "logLevel must be a supported log level."));
  }

  const rawMaxRetries = input.maxRetries;
  const maxRetries = rawMaxRetries === undefined ? DEFAULT_MAX_RETRIES : rawMaxRetries;
  if (
    typeof maxRetries !== "number" ||
    !Number.isInteger(maxRetries) ||
    maxRetries < MAX_RETRIES_RANGE.min ||
    maxRetries > MAX_RETRIES_RANGE.max
  ) {
    errors.push(
      error("maxRetries", "invalid_value", "maxRetries must be an integer from 0 to 10."),
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name: name as string,
      logLevel: logLevel as LogLevel,
      maxRetries: maxRetries as number,
    },
  };
}

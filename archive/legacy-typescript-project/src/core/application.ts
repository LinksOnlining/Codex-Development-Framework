import type { AppConfig, LogLevel } from "../types/app-config.js";

export interface ApplicationInput {
  readonly value: string;
}

export interface ApplicationResult {
  readonly value: string;
  readonly name: string;
  readonly logLevel: LogLevel;
  readonly maxRetries: number;
}

export function executeApplication(config: AppConfig, input: ApplicationInput): ApplicationResult {
  return {
    value: input.value,
    name: config.name,
    logLevel: config.logLevel,
    maxRetries: config.maxRetries,
  };
}

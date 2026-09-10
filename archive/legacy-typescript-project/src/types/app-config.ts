export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AppConfig {
  readonly name: string;
  readonly logLevel: LogLevel;
  readonly maxRetries: number;
}

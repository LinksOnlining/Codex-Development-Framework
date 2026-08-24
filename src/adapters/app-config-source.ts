export interface CliConfigInput {
  readonly name: unknown;
  readonly logLevel?: unknown;
  readonly maxRetries?: unknown;
}

export interface AppConfigSource {
  read(): unknown;
}

export function createCliConfigSource(input: CliConfigInput): AppConfigSource {
  return {
    read() {
      return { ...input };
    },
  };
}

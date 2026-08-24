import type { ApplicationInput } from "../core/application.js";

export interface ApplicationInputSource {
  read(): ApplicationInput;
}

export function createApplicationInputSource(
  positionals: readonly string[] | undefined,
): ApplicationInputSource {
  return {
    read() {
      return { value: positionals?.[0] ?? "" };
    },
  };
}

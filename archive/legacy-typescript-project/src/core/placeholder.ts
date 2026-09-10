/**
 * Placeholder domain operation used to keep the template executable.
 * It intentionally has no side effects or dependencies.
 * @deprecated Use executeApplication instead.
 */
export function identity<T>(value: T): T {
  return value;
}

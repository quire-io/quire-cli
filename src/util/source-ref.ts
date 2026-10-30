import { ValidationError } from "../errors.js";
import { resolveTextInput } from "./text-input.js";

/**
 * Resolve `--source-ref` into the JSON object Quire stores with a task, as
 * is. Takes the object itself, `-` for stdin or `@file`; a JSON object never
 * starts with either, so the forms can't clash.
 *
 * Quire caps it at about 2,048 characters, but the check isn't reliable yet
 * (a nested value gets past it), so nothing is measured here.
 */
export async function resolveSourceRef(value: string): Promise<Record<string, unknown>> {
  const text = await resolveTextInput(value);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new ValidationError(`--source-ref is not valid JSON: ${(err as Error).message}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ValidationError(`--source-ref must be a JSON object, not ${Array.isArray(parsed) ? "an array" : String(parsed)}.`);
  }
  return parsed as Record<string, unknown>;
}

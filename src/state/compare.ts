import type { ClassifyInput, RelationState } from "./types.js";

/**
 * Four-state comparison of a related pair.
 *
 * last* is the last reconciled/acknowledged identity. When both last values
 * are missing, the current pair is treated as a baseline (`clean`) rather than
 * a conflict: hashes of different representations are not comparable.
 */
export function classifyRelation(input: ClassifyInput): RelationState {
  const hasLast = input.lastCanonical !== undefined || input.lastExternal !== undefined;
  if (!hasLast) {
    return "clean";
  }
  const canonicalChanged = input.lastCanonical !== input.currentCanonical;
  const externalChanged = input.lastExternal !== input.currentExternal;
  if (!canonicalChanged && !externalChanged) {
    return "clean";
  }
  if (canonicalChanged && externalChanged) {
    return "conflict";
  }
  if (canonicalChanged) {
    return "canonical-changed";
  }
  return "external-changed";
}

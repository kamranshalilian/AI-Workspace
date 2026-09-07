import fs from "node:fs";
import path from "node:path";
import { AI_DIR_NAME, MANIFEST_FILE_NAME } from "../config/constants.js";

export interface ScopeLocation {
  /** Directory that contains `.ai/`. */
  root: string;
  aiDir: string;
  manifestPath: string;
}

export function manifestPathFor(root: string): string {
  return path.join(root, AI_DIR_NAME, MANIFEST_FILE_NAME);
}

export function aiDirFor(root: string): string {
  return path.join(root, AI_DIR_NAME);
}

export function hasManifest(root: string): boolean {
  try {
    return fs.statSync(manifestPathFor(root)).isFile();
  } catch {
    return false;
  }
}

/**
 * Walk upward from `startDir` and return the nearest directory that contains
 * `.ai/manifest.yaml`.
 */
export function discoverScope(startDir: string): ScopeLocation | undefined {
  let current = path.resolve(startDir);
  const { root } = path.parse(current);

  while (true) {
    if (hasManifest(current)) {
      return {
        root: current,
        aiDir: aiDirFor(current),
        manifestPath: manifestPathFor(current),
      };
    }
    if (current === root) {
      return undefined;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

export function realPathIfExists(target: string): string {
  try {
    return fs.realpathSync(target);
  } catch {
    return path.resolve(target);
  }
}

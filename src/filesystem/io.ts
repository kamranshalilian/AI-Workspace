import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { BINARY_SNIFF_BYTES } from "../config/constants.js";
import { isInsideOrEqual, relativePosix, toPosixPath } from "./paths.js";

export interface WalkedFile {
  absolutePath: string;
  relativePosix: string;
}

export function sha256(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function isBinaryBuffer(bytes: Buffer): boolean {
  const limit = Math.min(bytes.length, BINARY_SNIFF_BYTES);
  for (let i = 0; i < limit; i += 1) {
    if (bytes[i] === 0) {
      return true;
    }
  }
  return false;
}

/**
 * Recursively list files under `dir`. Directory symlinks that resolve outside
 * `dir` are not followed. File paths are POSIX-relative to `dir`.
 */
export function walkFiles(dir: string): WalkedFile[] {
  const root = path.resolve(dir);
  if (!fs.existsSync(root)) {
    return [];
  }
  const results: WalkedFile[] = [];
  walk(root, root, results);
  results.sort((a, b) => {
    if (a.relativePosix < b.relativePosix) {
      return -1;
    }
    if (a.relativePosix > b.relativePosix) {
      return 1;
    }
    return 0;
  });
  return results;
}

function walk(root: string, current: string, results: WalkedFile[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(current, { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    if (entry.isSymbolicLink()) {
      let real: string;
      try {
        real = fs.realpathSync(absolutePath);
      } catch {
        continue;
      }
      let stat: fs.Stats;
      try {
        stat = fs.statSync(real);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (!isInsideOrEqual(root, real)) {
          continue;
        }
        walk(root, real, results);
        continue;
      }
      if (stat.isFile()) {
        results.push({
          absolutePath: real,
          relativePosix: toPosixPath(relativePosix(root, absolutePath)),
        });
      }
      continue;
    }
    if (entry.isDirectory()) {
      walk(root, absolutePath, results);
      continue;
    }
    if (entry.isFile()) {
      results.push({
        absolutePath,
        relativePosix: toPosixPath(relativePosix(root, absolutePath)),
      });
    }
  }
}

export function fileSize(absolutePath: string): number {
  return fs.statSync(absolutePath).size;
}

export function readFilePrefix(absolutePath: string, bytes: number): Buffer {
  const fd = fs.openSync(absolutePath, "r");
  try {
    const buffer = Buffer.alloc(bytes);
    const read = fs.readSync(fd, buffer, 0, bytes, 0);
    return buffer.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

export function readFileBytes(absolutePath: string): Buffer {
  return fs.readFileSync(absolutePath);
}

export function writeFileAtomic(absolutePath: string, contents: string): void {
  const dir = path.dirname(absolutePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${absolutePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contents, { encoding: "utf8" });
  fs.renameSync(tmp, absolutePath);
}

export function pathExists(target: string): boolean {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

export function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

export function isFile(target: string): boolean {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

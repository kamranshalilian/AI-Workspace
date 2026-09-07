import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function repoRoot(): string {
  let current = fileURLToPath(new URL(".", import.meta.url));
  while (true) {
    if (
      fs.existsSync(path.join(current, "package.json")) &&
      fs.existsSync(path.join(current, "src"))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("Unable to locate repository root");
    }
    current = parent;
  }
}

export function makeTempDir(prefix = "aiw-"): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function rmTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

export function writeManifest(root: string, yaml: string): string {
  const aiDir = path.join(root, ".ai");
  fs.mkdirSync(aiDir, { recursive: true });
  const manifestPath = path.join(aiDir, "manifest.yaml");
  fs.writeFileSync(manifestPath, yaml, "utf8");
  return manifestPath;
}

export function writeFile(root: string, relativePosix: string, contents: string | Buffer): string {
  const native = relativePosix.split("/").join(path.sep);
  const abs = path.join(root, native);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
  return abs;
}

export function projectManifest(name: string, extra = ""): string {
  return `specVersion: 1\nkind: project\nname: ${name}\n${extra}`;
}

export function workspaceManifest(name: string, extra = ""): string {
  return `specVersion: 1\nkind: workspace\nname: ${name}\n${extra}`;
}

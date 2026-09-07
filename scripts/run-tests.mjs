import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const testsRoot = fileURLToPath(new URL("../dist-test/tests", import.meta.url));

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collect(abs)));
    } else if (entry.isFile() && entry.name.endsWith(".test.js")) {
      files.push(abs);
    }
  }
  files.sort();
  return files;
}

const files = await collect(testsRoot);
if (files.length === 0) {
  throw new Error(`No compiled tests found under ${testsRoot}`);
}

const child = spawn(process.execPath, ["--test", ...files], { stdio: "inherit" });
child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 1);
});

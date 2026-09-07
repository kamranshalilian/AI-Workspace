import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = path.join(root, "definitions", "agents");
const dest = path.join(root, "dist", "definitions", "agents");

if (!fs.existsSync(src)) {
  throw new Error(`Missing bundled definitions directory: ${src}`);
}

fs.mkdirSync(dest, { recursive: true });
for (const name of fs.readdirSync(src).sort()) {
  if (name.endsWith(".yaml")) {
    fs.copyFileSync(path.join(src, name), path.join(dest, name));
  }
}

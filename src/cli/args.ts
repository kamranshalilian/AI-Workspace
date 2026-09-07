import { parseArgs } from "node:util";
import { AiwError } from "../core/errors.js";
import type { ScopeKind } from "../manifest/types.js";

export type CommandName = "init" | "status" | "validate" | "doctor";

export interface ParsedCli {
  command: CommandName | undefined;
  help: boolean;
  version: boolean;
  json: boolean;
  quiet: boolean;
  verbose: boolean;
  path: string;
  kind: ScopeKind;
  name: string | undefined;
  force: boolean;
}

const PHASE2_COMMANDS = new Set([
  "agent",
  "adapter",
  "source",
  "import",
  "export",
  "sync",
  "project",
  "workspace",
]);

export function parseCli(argv: string[]): ParsedCli {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        path: { type: "string" },
        json: { type: "boolean", default: false },
        quiet: { type: "boolean", default: false },
        verbose: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
        version: { type: "boolean", default: false },
        kind: { type: "string" },
        name: { type: "string" },
        force: { type: "boolean", default: false },
        all: { type: "boolean", default: false },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AiwError("USAGE", message, {
      suggestion: "Run `aiw --help` for usage.",
    });
  }

  if (parsed.values.all) {
    throw new AiwError("USAGE", "--all is not available until workspace federation (Phase 6).", {
      suggestion: "Run the command from a single project or workspace root.",
    });
  }

  const positionals = parsed.positionals;
  const commandRaw = positionals[0];

  if (commandRaw !== undefined && PHASE2_COMMANDS.has(commandRaw)) {
    throw new AiwError("UNSUPPORTED", `Command '${commandRaw}' is not implemented in Phase 1.`, {
      suggestion: "Phase 1 supports: init, status, validate, doctor.",
    });
  }

  if (positionals.length > 1) {
    throw new AiwError("USAGE", `Unexpected arguments: ${positionals.slice(1).join(" ")}.`);
  }

  let command: CommandName | undefined;
  if (commandRaw !== undefined) {
    if (!isCommand(commandRaw)) {
      throw new AiwError("USAGE", `Unknown command '${commandRaw}'.`, {
        suggestion: "Run `aiw --help` for usage.",
      });
    }
    command = commandRaw;
  }

  const kindRaw = parsed.values.kind ?? "project";
  if (kindRaw !== "project" && kindRaw !== "workspace") {
    throw new AiwError("USAGE", `--kind must be 'project' or 'workspace' (got '${kindRaw}').`);
  }

  if (command !== undefined && command !== "init") {
    if (parsed.values.kind !== undefined || parsed.values.name !== undefined || parsed.values.force) {
      throw new AiwError("USAGE", "--kind, --name, and --force are only valid for `aiw init`.");
    }
  }

  return {
    command,
    help: parsed.values.help === true,
    version: parsed.values.version === true,
    json: parsed.values.json === true,
    quiet: parsed.values.quiet === true,
    verbose: parsed.values.verbose === true,
    path: parsed.values.path ?? process.cwd(),
    kind: kindRaw,
    name: parsed.values.name,
    force: parsed.values.force === true,
  };
}

function isCommand(value: string): value is CommandName {
  return value === "init" || value === "status" || value === "validate" || value === "doctor";
}

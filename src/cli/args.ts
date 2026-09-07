import { parseArgs } from "node:util";
import { AiwError } from "../core/errors.js";
import type { ScopeKind } from "../manifest/types.js";

export type CommandName = "init" | "status" | "validate" | "doctor" | "agent" | "export";
export type AgentAction = "add" | "remove" | "list" | "status" | "create";

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
  agentAction: AgentAction | undefined;
  targetId: string | undefined;
}

const LATER_COMMANDS = new Set(["adapter", "source", "import", "sync", "project", "workspace"]);

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
        agent: { type: "string" },
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

  if (commandRaw !== undefined && LATER_COMMANDS.has(commandRaw)) {
    throw new AiwError("UNSUPPORTED", `Command '${commandRaw}' is not implemented in Phase 3.`, {
      suggestion: "Phase 3 supports: init, status, validate, doctor, agent, export.",
    });
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

  let agentAction: AgentAction | undefined;
  let targetId: string | undefined = parsed.values.agent;

  if (command === "agent") {
    const actionRaw = positionals[1];
    if (actionRaw === undefined) {
      throw new AiwError("USAGE", "Usage: aiw agent <create|add|remove|list|status> [id].");
    }
    if (!isAgentAction(actionRaw)) {
      throw new AiwError("USAGE", `Unknown agent action '${actionRaw}'.`);
    }
    agentAction = actionRaw;
    if (actionRaw === "add" || actionRaw === "remove" || actionRaw === "create") {
      const id = positionals[2];
      if (id === undefined || id.trim() === "") {
        throw new AiwError("USAGE", `Usage: aiw agent ${actionRaw} <id>.`);
      }
      if (positionals.length > 3) {
        throw new AiwError("USAGE", `Unexpected arguments: ${positionals.slice(3).join(" ")}.`);
      }
      targetId = id;
    } else if (positionals.length > 2) {
      throw new AiwError("USAGE", `Unexpected arguments: ${positionals.slice(2).join(" ")}.`);
    }
  } else if (command === "export") {
    if (positionals.length > 1) {
      throw new AiwError("USAGE", `Unexpected arguments: ${positionals.slice(1).join(" ")}.`);
    }
  } else if (positionals.length > 1) {
    throw new AiwError("USAGE", `Unexpected arguments: ${positionals.slice(1).join(" ")}.`);
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

  if (command !== "export" && parsed.values.agent !== undefined) {
    throw new AiwError("USAGE", "--agent is only valid for `aiw export`.");
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
    agentAction,
    targetId,
  };
}

function isCommand(value: string): value is CommandName {
  return (
    value === "init" ||
    value === "status" ||
    value === "validate" ||
    value === "doctor" ||
    value === "agent" ||
    value === "export"
  );
}

function isAgentAction(value: string): value is AgentAction {
  return (
    value === "add" ||
    value === "remove" ||
    value === "list" ||
    value === "status" ||
    value === "create"
  );
}

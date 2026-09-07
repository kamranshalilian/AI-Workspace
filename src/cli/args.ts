import { parseArgs } from "node:util";
import { AiwError } from "../core/errors.js";
import type { ScopeKind } from "../manifest/types.js";

export type CommandName =
  | "init"
  | "status"
  | "validate"
  | "doctor"
  | "agent"
  | "export"
  | "source"
  | "import"
  | "promote"
  | "sync"
  | "project";
export type AgentAction = "add" | "remove" | "list" | "status" | "create";
export type SourceAction = "add" | "remove" | "list";
export type ProjectAction = "add" | "remove" | "list";

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
  sourceAction: SourceAction | undefined;
  targetId: string | undefined;
  sourceType: string | undefined;
  sourcePath: string | undefined;
  sourceId: string | undefined;
  capabilities: string | undefined;
  dryRun: boolean;
  apply: boolean;
  all: boolean;
  projectAction: ProjectAction | undefined;
  projectPath: string | undefined;
}

const LATER_COMMANDS = new Set(["adapter", "workspace"]);
const ALL_COMMANDS = new Set(["status", "validate", "doctor", "export", "sync"]);

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
        type: { type: "string" },
        capabilities: { type: "string" },
        source: { type: "string" },
        "dry-run": { type: "boolean", default: false },
        apply: { type: "boolean", default: false },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AiwError("USAGE", message, {
      suggestion: "Run `aiw --help` for usage.",
    });
  }

  const positionals = parsed.positionals;
  const commandRaw = positionals[0];

  if (commandRaw !== undefined && LATER_COMMANDS.has(commandRaw)) {
    throw new AiwError("UNSUPPORTED", `Command '${commandRaw}' is not implemented in Phase 6.`, {
      suggestion: "Phase 6 supports: init, status, validate, doctor, agent, export, source, import, promote, sync, project.",
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
  let sourceAction: SourceAction | undefined;
  let projectAction: ProjectAction | undefined;
  let targetId: string | undefined = parsed.values.agent;
  let sourceType = parsed.values.type;
  let sourcePath: string | undefined;
  let sourceId = parsed.values.source;
  let capabilities = parsed.values.capabilities;
  let startDir = parsed.values.path ?? process.cwd();
  let projectPath: string | undefined;
  const dryRun = parsed.values["dry-run"] === true;
  const apply = parsed.values.apply === true;
  const all = parsed.values.all === true;

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
  } else if (command === "source") {
    const actionRaw = positionals[1];
    if (parsed.values.help === true && actionRaw === undefined) {
      sourceAction = undefined;
    } else {
      if (actionRaw === undefined) {
        throw new AiwError("USAGE", "Usage: aiw source <add|remove|list> [id].");
      }
      if (!isSourceAction(actionRaw)) {
        throw new AiwError("USAGE", `Unknown source action '${actionRaw}'.`);
      }
      sourceAction = actionRaw;
      if (actionRaw === "add") {
        const id = positionals[2];
        if (parsed.values.help === true) {
          targetId = id;
          sourcePath = parsed.values.path;
          startDir = process.cwd();
        } else {
          if (id === undefined || id.trim() === "") {
            throw new AiwError("USAGE", "Usage: aiw source add <id> --type <type> --path <path>.");
          }
          if (positionals.length > 3) {
            throw new AiwError("USAGE", `Unexpected arguments: ${positionals.slice(3).join(" ")}.`);
          }
          targetId = id;
          sourcePath = parsed.values.path;
          startDir = process.cwd();
          if (sourceType === undefined || sourceType.trim() === "") {
            throw new AiwError("USAGE", "Usage: aiw source add <id> --type <type> --path <path>.");
          }
          if (sourcePath === undefined || sourcePath.trim() === "") {
            throw new AiwError("USAGE", "Usage: aiw source add <id> --type <type> --path <path>.");
          }
        }
      } else if (actionRaw === "remove") {
        const id = positionals[2];
        if (id === undefined || id.trim() === "") {
          throw new AiwError("USAGE", "Usage: aiw source remove <id>.");
        }
        if (positionals.length > 3) {
          throw new AiwError("USAGE", `Unexpected arguments: ${positionals.slice(3).join(" ")}.`);
        }
        targetId = id;
      } else if (positionals.length > 2) {
        throw new AiwError("USAGE", `Unexpected arguments: ${positionals.slice(2).join(" ")}.`);
      }
    }
  } else if (command === "project") {
    const actionRaw = positionals[1];
    if (parsed.values.help === true && actionRaw === undefined) {
      projectAction = undefined;
    } else {
      if (actionRaw === undefined) {
        throw new AiwError("USAGE", "Usage: aiw project <add|remove|list> [id] [path].");
      }
      if (!isProjectAction(actionRaw)) {
        throw new AiwError("USAGE", `Unknown project action '${actionRaw}'.`);
      }
      projectAction = actionRaw;
      if (actionRaw === "add") {
        const id = positionals[2];
        const declared = positionals[3];
        if (parsed.values.help === true) {
          targetId = id;
          projectPath = declared;
        } else {
          if (id === undefined || id.trim() === "") {
            throw new AiwError("USAGE", "Usage: aiw project add <id> <path>.");
          }
          if (declared === undefined || declared.trim() === "") {
            throw new AiwError("USAGE", "Usage: aiw project add <id> <path>.");
          }
          if (positionals.length > 4) {
            throw new AiwError("USAGE", `Unexpected arguments: ${positionals.slice(4).join(" ")}.`);
          }
          targetId = id;
          projectPath = declared;
        }
      } else if (actionRaw === "remove") {
        const id = positionals[2];
        if (id === undefined || id.trim() === "") {
          throw new AiwError("USAGE", "Usage: aiw project remove <id>.");
        }
        if (positionals.length > 3) {
          throw new AiwError("USAGE", `Unexpected arguments: ${positionals.slice(3).join(" ")}.`);
        }
        targetId = id;
      } else if (positionals.length > 2) {
        throw new AiwError("USAGE", `Unexpected arguments: ${positionals.slice(2).join(" ")}.`);
      }
    }
  } else if (command === "export" || command === "import" || command === "promote" || command === "sync") {
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

  if (parsed.values.agent !== undefined && command !== "export" && command !== "promote" && command !== "sync") {
    throw new AiwError("USAGE", "--agent is only valid for `aiw export`, `aiw promote`, and `aiw sync`.");
  }

  if (sourceId !== undefined && command !== "import" && command !== "sync") {
    throw new AiwError("USAGE", "--source is only valid for `aiw import` and `aiw sync`.");
  }

  if (dryRun && command !== "import" && command !== "promote" && command !== "sync") {
    throw new AiwError("USAGE", "--dry-run is only valid for `aiw import`, `aiw promote`, and `aiw sync`.");
  }

  if (apply && command !== "sync") {
    throw new AiwError("USAGE", "--apply is only valid for `aiw sync`.");
  }

  if (command === "import" && (sourceId === undefined || sourceId.trim() === "") && parsed.values.help !== true) {
    throw new AiwError("USAGE", "Usage: aiw import --source <id> [--dry-run] [--json].");
  }

  if (command === "promote" && (targetId === undefined || targetId.trim() === "") && parsed.values.help !== true) {
    throw new AiwError("USAGE", "Usage: aiw promote --agent <id> [--dry-run] [--json].");
  }

  if (all && (command === undefined || !ALL_COMMANDS.has(command))) {
    throw new AiwError("USAGE", "--all is only valid for `aiw status`, `aiw validate`, `aiw doctor`, `aiw export`, and `aiw sync`.", {
      suggestion: "Import and promote remain explicitly scoped. Use `aiw project list` to inspect the registry.",
    });
  }

  if (command !== "source") {
    if (sourceType !== undefined) {
      throw new AiwError("USAGE", "--type is only valid for `aiw source add`.");
    }
    if (capabilities !== undefined) {
      throw new AiwError("USAGE", "--capabilities is only valid for `aiw source add`.");
    }
  } else if (sourceAction !== "add") {
    if (sourceType !== undefined) {
      throw new AiwError("USAGE", "--type is only valid for `aiw source add`.");
    }
    if (capabilities !== undefined) {
      throw new AiwError("USAGE", "--capabilities is only valid for `aiw source add`.");
    }
  }

  return {
    command,
    help: parsed.values.help === true,
    version: parsed.values.version === true,
    json: parsed.values.json === true,
    quiet: parsed.values.quiet === true,
    verbose: parsed.values.verbose === true,
    path: startDir,
    kind: kindRaw,
    name: parsed.values.name,
    force: parsed.values.force === true,
    agentAction,
    sourceAction,
    targetId,
    sourceType,
    sourcePath,
    sourceId,
    capabilities,
    dryRun,
    apply,
    all,
    projectAction,
    projectPath,
  };
}

function isCommand(value: string): value is CommandName {
  return (
    value === "init" ||
    value === "status" ||
    value === "validate" ||
    value === "doctor" ||
    value === "agent" ||
    value === "export" ||
    value === "source" ||
    value === "import" ||
    value === "promote" ||
    value === "sync" ||
    value === "project"
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

function isSourceAction(value: string): value is SourceAction {
  return value === "add" || value === "remove" || value === "list";
}

function isProjectAction(value: string): value is ProjectAction {
  return value === "add" || value === "remove" || value === "list";
}

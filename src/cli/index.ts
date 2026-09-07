#!/usr/bin/env node
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseCli } from "./args.js";
import { addAgent, agentStatus, createAgent, listAgents, removeAgent } from "../core/agent.js";
import { doctorFrom } from "../core/doctor.js";
import { AiwError, isAiwError } from "../core/errors.js";
import { exportAgents } from "../core/export.js";
import { initScope } from "../core/init.js";
import { statusFrom } from "../core/status.js";
import { validateFrom } from "../core/validate.js";
import { formatAgentAdd, formatAgentCreate, formatAgentList, formatAgentRemove, formatAgentStatus, formatDoctor, formatExport, formatInit, formatStatus, formatValidate, printJson } from "./format.js";
import { HELP_TEXT } from "./help.js";

export function run(argv: string[]): number {
  try {
    const cli = parseCli(argv);
    if (cli.help || (cli.command === undefined && !cli.version)) {
      process.stdout.write(HELP_TEXT);
      return 0;
    }
    if (cli.version) {
      process.stdout.write(`${readVersion()}\n`);
      return 0;
    }
    if (cli.command === undefined) {
      throw new AiwError("USAGE", "A command is required.", {
        suggestion: "Run `aiw --help` for usage.",
      });
    }

    switch (cli.command) {
      case "init": {
        const result = initScope({
          directory: cli.path,
          kind: cli.kind,
          name: cli.name,
          force: cli.force,
        });
        if (cli.json) {
          printJson({ specVersion: 1, command: "init", ok: true, ...result });
        } else if (!cli.quiet) {
          process.stdout.write(formatInit(result));
        }
        return 0;
      }
      case "status": {
        const { summary } = statusFrom(cli.path);
        if (cli.json) {
          printJson(summary);
        } else if (!cli.quiet) {
          process.stdout.write(formatStatus(summary));
        }
        return 0;
      }
      case "validate": {
        const report = validateFrom(cli.path);
        if (cli.json) {
          printJson({ command: "validate", ...report });
        } else if (!cli.quiet) {
          process.stdout.write(formatValidate(report));
        }
        return report.ok ? 0 : 2;
      }
      case "doctor": {
        const report = doctorFrom(cli.path);
        if (cli.json) {
          printJson(report);
        } else if (!cli.quiet) {
          process.stdout.write(formatDoctor(report));
        }
        return report.ok ? 0 : 2;
      }
      case "agent": {
        return runAgent(cli);
      }
      case "export": {
        const result = exportAgents(cli.path, cli.targetId);
        if (cli.json) {
          printJson(result);
        } else if (!cli.quiet) {
          process.stdout.write(formatExport(result));
        }
        return result.ok ? 0 : 3;
      }
      default: {
        throw new AiwError("USAGE", "Unknown command.");
      }
    }
  } catch (error) {
    return handleError(error, argv.includes("--json"));
  }
}

function runAgent(cli: ReturnType<typeof parseCli>): number {
  if (cli.agentAction === undefined) {
    throw new AiwError("USAGE", "Usage: aiw agent <create|add|remove|list|status> [id].");
  }
  switch (cli.agentAction) {
    case "create": {
      if (cli.targetId === undefined) {
        throw new AiwError("USAGE", "Usage: aiw agent create <id>.");
      }
      const result = createAgent(cli.path, cli.targetId);
      if (cli.json) {
        printJson(result);
      } else if (!cli.quiet) {
        process.stdout.write(formatAgentCreate(result));
      }
      return 0;
    }
    case "add": {
      if (cli.targetId === undefined) {
        throw new AiwError("USAGE", "Usage: aiw agent add <id>.");
      }
      const result = addAgent(cli.path, cli.targetId);
      if (cli.json) {
        printJson(result);
      } else if (!cli.quiet) {
        process.stdout.write(formatAgentAdd(result));
      }
      return 0;
    }
    case "remove": {
      if (cli.targetId === undefined) {
        throw new AiwError("USAGE", "Usage: aiw agent remove <id>.");
      }
      const result = removeAgent(cli.path, cli.targetId);
      if (cli.json) {
        printJson(result);
      } else if (!cli.quiet) {
        process.stdout.write(formatAgentRemove(result));
      }
      return 0;
    }
    case "list": {
      const result = listAgents(cli.path);
      if (cli.json) {
        printJson(result);
      } else if (!cli.quiet) {
        process.stdout.write(formatAgentList(result));
      }
      return 0;
    }
    case "status": {
      const result = agentStatus(cli.path);
      if (cli.json) {
        printJson(result);
      } else if (!cli.quiet) {
        process.stdout.write(formatAgentStatus(result));
      }
      return 0;
    }
  }
}

function handleError(error: unknown, json: boolean): number {
  if (isAiwError(error)) {
    const payload = {
      specVersion: 1,
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        suggestion: error.suggestion,
      },
    };
    process.stderr.write(`${error.message}\n`);
    if (error.suggestion) {
      process.stderr.write(`${error.suggestion}\n`);
    }
    if (json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    }
    return error.exitCode;
  }
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  return 5;
}

function readVersion(): string {
  const pkgPath = fileURLToPath(new URL("../../package.json", import.meta.url));
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version?: string };
  return pkg.version ?? "0.0.0";
}

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(fs.realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  process.exitCode = run(process.argv.slice(2));
}

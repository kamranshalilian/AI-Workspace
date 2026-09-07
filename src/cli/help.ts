export const HELP_TEXT = `AI Workspace — local-first AI context layer

Usage:
  aiw <command> [options]

Commands:
  init             Create .ai/manifest.yaml
  status           Show the effective context
  validate         Validate the manifest and inheritance graph
  doctor           Diagnose problems and suggest remediations
  agent add <id>   Register a declarative agent definition
  agent remove <id>
  agent list       List bundled and registered agents
  agent status     Show output state for registered agents
  export           Write native files for enabled agents

Global options:
  --path <dir>   Start discovery from this directory
  --json         Machine-readable output
  --quiet        Errors only
  --verbose      Extra diagnostics on stderr
  --help         Show help
  --version      Show version

init options:
  --kind <kind>  project (default) or workspace
  --name <name>  Scope name (default: normalized directory basename)
  --force        Overwrite manifest.yaml if .ai/ already exists

export options:
  --agent <id>   Export a single registered agent

agent add registers a definition in the manifest only. Run aiw export to write native files.
`;

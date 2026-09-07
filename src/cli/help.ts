export const HELP_TEXT = `AI Workspace — local-first AI context layer

Usage:
  aiw <command> [options]

Commands:
  init             Create .ai/manifest.yaml
  status           Show the effective context
  validate         Validate the manifest and inheritance graph
  doctor           Diagnose problems and suggest remediations
  agent create <id>
                   Write a local Agent Definition stub
  agent add <id>   Register a definition in the manifest
  agent remove <id>
  agent list       List bundled and local definitions
  agent status     Show output state for registered agents
  export           Write native files for enabled agents

Global options:
  --path <dir>   Start discovery from this directory
  --json         Machine-readable output
  --quiet        Errors only
  --verbose      Extra diagnostics on stderr
  --help         Show help
  --version      Show package version

init options:
  --kind <kind>  project (default) or workspace
  --name <name>  Scope name (default: normalized directory basename)
  --force        Overwrite manifest.yaml if .ai/ already exists

export options:
  --agent <id>   Export a single registered agent

Install globally with npm install -g ai-workspace. Workspace state stays in .ai/.

create = create definition
add    = enable/register
export = materialize native output
`;

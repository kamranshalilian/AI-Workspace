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
  source add <id> --type <type> --path <path>
                   Register a federated source (manifest only)
  source list      List registered sources
  source remove <id>
                   Unregister a source (manifest only)

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

source add options:
  --type <type>          directory | file | repository | generated
  --path <path>          POSIX source path relative to the scope root
  --capabilities <list>  comma-separated, default: read

Install globally with npm install -g ai-workspace. Workspace state stays in .ai/.

create = create definition
add    = enable/register
export = materialize native output

source add = register a federated reference (does not copy, import, or execute)
`;

export const SOURCE_HELP_TEXT = `AI Workspace — sources

Usage:
  aiw source add <id> --type <type> --path <path> [--capabilities read,index]
  aiw source list [--json]
  aiw source remove <id>

Types:
  directory    local directory
  file         local file
  repository   local tree (no clone/fetch)
  generated    path produced by another tool (not executed)

Source registration is not import, copy, or execution.
The live source remains at path. .ai/sources/ is not created.
`;

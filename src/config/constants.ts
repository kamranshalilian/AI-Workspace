export const SPEC_VERSION = 1 as const;

export const AI_DIR_NAME = ".ai";
export const MANIFEST_FILE_NAME = "manifest.yaml";

export const NAME_PATTERN = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/;

export const DEFAULT_CONTEXT_INCLUDE = [
  "context/**",
  "rules/**",
  "skills/**",
  "roles/**",
  "architecture/**",
  "decisions/**",
  "workflows/**",
] as const;

export const WELL_KNOWN_KINDS = [
  "context",
  "rules",
  "skills",
  "roles",
  "architecture",
  "decisions",
  "workflows",
] as const;

export const RESERVED_AI_NAMES = [
  "manifest.yaml",
  "agents",
  "sources",
  "state",
  "cache",
] as const;

export const DEFAULT_MAX_FILE_BYTES = 1_048_576;
export const BINARY_SNIFF_BYTES = 8192;

export const BUILTIN_EXCLUSIONS = [
  ".env",
  ".env.*",
  "*.pem",
  "*.key",
  "*.p12",
  "*.pfx",
  "id_rsa",
  "id_ed25519",
  "*credential*",
  "*credentials*",
  "*secret*",
  "*secrets*",
  "*token*",
  "*tokens*",
] as const;

export const SCOPE_KINDS = ["project", "workspace"] as const;
export const INHERITANCE_MODES = ["extend", "replace", "disable"] as const;
export const ADAPTER_STRATEGIES = [
  "generated",
  "copy",
  "reference",
  "symlink",
  "junction",
] as const;
export const SOURCE_TYPES = ["directory", "file", "repository", "generated"] as const;
export const SOURCE_CAPABILITIES = [
  "read",
  "index",
  "write",
  "link",
  "import",
  "export",
  "sync",
] as const;

export const AGENT_CAPABILITIES = ["context", "rules", "skills"] as const;
export const FORMAT_ENGINE_IDS = [
  "identity",
  "markdown-frontmatter",
  "concatenated-markdown",
  "reference-index",
] as const;
export const ADAPTER_ENGINE_IDS = ["declarative"] as const;
export const PROVENANCE_MODES = ["header", "none"] as const;
export const CONCAT_ORDERS = ["identity", "kind-then-name"] as const;

export const MANIFEST_TOP_LEVEL_KEYS = [
  "specVersion",
  "kind",
  "name",
  "description",
  "extends",
  "context",
  "sources",
  "agents",
  "projects",
  "policies",
] as const;

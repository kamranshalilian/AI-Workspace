import { posixStem, toPosixPath } from "../filesystem/paths.js";
import type { ResolvedResource } from "../resolution/types.js";

export interface TemplateVars {
  identity: string;
  kind: string;
  relativePath: string;
  stem: string;
  name: string;
}

export function resourceVars(resource: ResolvedResource): TemplateVars {
  const stem = posixStem(resource.relativePath);
  return {
    identity: resource.identity,
    kind: resource.kind,
    relativePath: resource.relativePath,
    stem,
    name: stem,
  };
}

export function applyTemplate(template: string, vars: TemplateVars): string {
  return toPosixPath(
    template.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_match, key: string) => {
      const value = vars[key as keyof TemplateVars];
      return value ?? "";
    }),
  );
}

export function globFromTemplate(template: string): string {
  return toPosixPath(template.replace(/\{\{\s*[a-zA-Z]+\s*\}\}/g, "*"));
}

export function invertTemplate(template: string, posixPath: string): Partial<TemplateVars> | undefined {
  const posixTemplate = toPosixPath(template);
  const value = toPosixPath(posixPath);
  const tokens = posixTemplate.split(/\{\{\s*([a-zA-Z]+)\s*\}\}/);
  const vars: Partial<TemplateVars> = {};
  let remaining = value;
  const prefix = tokens[0] ?? "";
  if (!remaining.startsWith(prefix)) {
    return undefined;
  }
  remaining = remaining.slice(prefix.length);
  for (let index = 1; index < tokens.length; index += 2) {
    const key = tokens[index];
    const nextStatic = tokens[index + 1] ?? "";
    if (key === undefined) {
      return undefined;
    }
    let extracted: string;
    if (nextStatic === "") {
      extracted = remaining;
      remaining = "";
    } else {
      const at = remaining.indexOf(nextStatic);
      if (at === -1) {
        return undefined;
      }
      extracted = remaining.slice(0, at);
      remaining = remaining.slice(at + nextStatic.length);
    }
    if (extracted === "" || extracted.includes("\0")) {
      return undefined;
    }
    assignVar(vars, key, extracted);
  }
  if (remaining !== "") {
    return undefined;
  }
  if (vars.stem === undefined && vars.name !== undefined) {
    vars.stem = vars.name;
  }
  if (vars.name === undefined && vars.stem !== undefined) {
    vars.name = vars.stem;
  }
  return vars;
}

function assignVar(vars: Partial<TemplateVars>, key: string, value: string): void {
  if (key === "identity" || key === "kind" || key === "relativePath" || key === "stem" || key === "name") {
    vars[key] = value;
  }
}

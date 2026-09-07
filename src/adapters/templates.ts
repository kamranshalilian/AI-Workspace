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

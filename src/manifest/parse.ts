import { parseDocument } from "yaml";
import { AiwError } from "../core/errors.js";

export function parseYamlDocument(text: string): unknown {
  const stripped = stripBom(text);
  const document = parseDocument(stripped, {
    prettyErrors: true,
    uniqueKeys: true,
    schema: "core",
    strict: true,
    merge: false,
  });

  if (document.errors.length > 0) {
    const first = document.errors[0];
    throw new AiwError("VALIDATION", `Invalid YAML: ${first?.message ?? "parse error"}`, {
      details: { yamlErrors: document.errors.map((error) => error.message) },
    });
  }

  return document.toJS({ mapAsMap: false }) as unknown;
}

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

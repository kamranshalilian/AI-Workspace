import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyRelation } from "../../src/state/compare.js";

const last = {
  lastCanonical: "sha256:canonical-v1",
  lastExternal: "sha256:external-v1",
};

test("unchanged / unchanged is clean", () => {
  assert.equal(
    classifyRelation({
      ...last,
      currentCanonical: last.lastCanonical,
      currentExternal: last.lastExternal,
    }),
    "clean",
  );
});

test("changed / unchanged is canonical-changed", () => {
  assert.equal(
    classifyRelation({
      ...last,
      currentCanonical: "sha256:canonical-v2",
      currentExternal: last.lastExternal,
    }),
    "canonical-changed",
  );
});

test("unchanged / changed is external-changed", () => {
  assert.equal(
    classifyRelation({
      ...last,
      currentCanonical: last.lastCanonical,
      currentExternal: "sha256:external-v2",
    }),
    "external-changed",
  );
});

test("changed / changed is conflict", () => {
  assert.equal(
    classifyRelation({
      ...last,
      currentCanonical: "sha256:canonical-v2",
      currentExternal: "sha256:external-v2",
    }),
    "conflict",
  );
});

test("missing last known state is a clean baseline, not a conflict", () => {
  assert.equal(
    classifyRelation({
      currentCanonical: "sha256:a",
      currentExternal: "sha256:b",
    }),
    "clean",
  );
});

test("deletion of one side after a known pair is a one-sided change", () => {
  assert.equal(
    classifyRelation({
      ...last,
      currentCanonical: last.lastCanonical,
      currentExternal: undefined,
    }),
    "external-changed",
  );
  assert.equal(
    classifyRelation({
      ...last,
      currentCanonical: undefined,
      currentExternal: last.lastExternal,
    }),
    "canonical-changed",
  );
});

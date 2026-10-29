// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  diffPrefixes,
  isEmptyPrefixDiff,
  prefixMapOf,
  rowsToPrefixMap,
  splitContextDoc,
} from "./contextEdit";

describe("prefixMapOf", () => {
  it("picks non-@ string keys only", () => {
    expect(
      prefixMapOf({
        "@type": "@context",
        "@base": "terminusdb:///data/",
        ex: "http://example.org/",
        odd: 42,
      })
    ).toEqual({ ex: "http://example.org/" });
  });
});

describe("splitContextDoc", () => {
  it("separates prefix pairs from @-fields", () => {
    const { prefixes, fields } = splitContextDoc({
      "@type": "@context",
      "@base": "b",
      "@metadata": { a: 1 },
      ex: "http://e/",
      sys2: "http://s/",
    });
    expect(prefixes).toEqual({ ex: "http://e/", sys2: "http://s/" });
    expect(fields).toEqual({ "@type": "@context", "@base": "b", "@metadata": { a: 1 } });
  });
});

describe("rowsToPrefixMap", () => {
  it("skips empty rows and flags invalid names/iris/dupes", () => {
    const { map, errors } = rowsToPrefixMap([
      { prefix: "", uri: "" },
      { prefix: "ex", uri: "http://e/" },
      { prefix: "bad name", uri: "http://x/" },
      { prefix: "noscheme", uri: "no-scheme" },
      { prefix: "ex", uri: "http://other/" },
    ]);
    expect(map).toEqual({ ex: "http://e/" });
    expect(errors).toHaveLength(3);
  });
});

describe("diffPrefixes", () => {
  it("produces adds, updates, deletes", () => {
    const d = diffPrefixes(
      { a: "http://a/", b: "http://b/", c: "http://c/" },
      { b: "http://b/", c: "http://c2/", d: "http://d/" }
    );
    expect(d.adds).toEqual([{ prefix: "d", uri: "http://d/" }]);
    expect(d.updates).toEqual([{ prefix: "c", uri: "http://c2/" }]);
    expect(d.deletes).toEqual(["a"]);
    expect(isEmptyPrefixDiff(d)).toBe(false);
  });
  it("empty diff when identical", () => {
    expect(isEmptyPrefixDiff(diffPrefixes({ a: "x" }, { a: "x" }))).toBe(true);
  });
});

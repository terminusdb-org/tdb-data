// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildTree } from "./DoctypeTree";
import type { SchemaClass } from "@/types/terminusdb";

const cls = (id: string, extra: Record<string, unknown> = {}): SchemaClass => ({ "@id": id, "@type": "Class", ...extra });

const schema: SchemaClass[] = [
  cls("Entity"),
  cls("Animal", { "@inherits": ["T0", "T1"] }),
  cls("T0"),
  cls("T1"),
  cls("Address", { "@subdocument": [] }),
  cls("GeoAddr", { "@inherits": "Address", "@subdocument": [] }),
  cls("CityAddr", { "@inherits": "Address" }), // non-subdoc child of a subdoc
];

describe("buildTree", () => {
  const tree = buildTree(schema);

  it("nests under @inherits parents (multi-parent under each)", () => {
    const t0 = tree.find((n) => n.id === "T0")!;
    const t1 = tree.find((n) => n.id === "T1")!;
    expect(t0.children.map((c) => c.id)).toContain("Animal");
    expect(t1.children.map((c) => c.id)).toContain("Animal");
  });

  it("keeps a subdocument when its subtree has non-subdocument children", () => {
    const addr = tree.find((n) => n.id === "Address")!;
    expect(addr.isSubdocument).toBe(true);
    expect(addr.children.map((c) => c.id).sort()).toEqual(["CityAddr"]);
  });

  it("excludes non-Class objects (enum/foreign/context)", () => {
    const mixed = [...schema, { "@id": "Color", "@type": "Enum" } as SchemaClass];
    expect(buildTree(mixed).find((n) => n.id === "Color")).toBeUndefined();
  });

  it("hides subdocument leaves", () => {
    const lonely = [...schema, cls("LonelySub", { "@subdocument": [] })];
    expect(buildTree(lonely).find((n) => n.id === "LonelySub")).toBeUndefined();
  });
});

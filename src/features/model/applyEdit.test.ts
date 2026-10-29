// @vitest-environment node
import { describe, it, expect } from "vitest";
import { autoMigrationMessage, migrationPathFor } from "./applyEdit";
import { ops } from "@/lib/schemaModel/migrationOps";

describe("migrationPathFor", () => {
  it("rewrites schema paths to the migration endpoint", () => {
    expect(migrationPathFor("/api/schema/admin/uitest/local/branch/main")).toBe(
      "/api/migration/admin/uitest/local/branch/main"
    );
    expect(migrationPathFor("/api/document/admin/db/local/commit/abc123")).toBe(
      "/api/migration/admin/db/local/commit/abc123"
    );
  });
  it("leaves migration paths untouched", () => {
    const p = "/api/migration/a/b/local/branch/main";
    expect(migrationPathFor(p)).toBe(p);
  });
});

describe("autoMigrationMessage", () => {
  it("summarises ops as model: <OpType> <class>[.<prop>]", () => {
    expect(
      autoMigrationMessage([
        ops.createClassProperty("Thing", "opt", { "@type": "Optional", "@class": "xsd:string" }),
        ops.moveClassProperty("Thing", "opt", "opt2"),
      ])
    ).toBe("model: CreateClassProperty Thing.opt, MoveClassProperty Thing.opt");
  });
  it("names classes for class ops", () => {
    expect(autoMigrationMessage([ops.createClass({ "@id": "Foo", "@type": "Class" } as never)])).toBe(
      "model: CreateClass Foo"
    );
    expect(autoMigrationMessage([ops.deleteClass("Bar")])).toBe("model: DeleteClass Bar");
    expect(autoMigrationMessage([ops.expandEnum("Color", ["red"])])).toBe("model: ExpandEnum Color");
  });
});

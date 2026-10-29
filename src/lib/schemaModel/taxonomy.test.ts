// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildTaxonomy } from "./taxonomy";
import { reduceZebraSchemaFromTerminusSchema } from "./schemaReducer";
import { TerminusSchemaObject } from "./terminusReducers";

const schema: TerminusSchemaObject = {
  Entity: { "@type": "Class", "@id": "Entity", "@key": { "@type": "Random" } },
  Person: { "@type": "Class", "@id": "Person", "@key": { "@type": "Random" }, "@inherits": "Entity" },
  Agent: { "@type": "Class", "@id": "Agent", "@key": { "@type": "Random" } },
  Employee: { "@type": "Class", "@id": "Employee", "@key": { "@type": "Random" }, "@inherits": ["Person", "Agent"] },
  Address: { "@type": "Class", "@id": "Address", "@key": { "@type": "Random" }, "@subdocument": [] },
  Color: { "@type": "Enum", "@id": "Color", "@value": ["r"] },
  ExtId: { "@type": "Foreign", "@id": "ExtId" },
  Shape: { "@type": "TaggedUnion", "@id": "Shape" },
  Orphan: { "@type": "Class", "@id": "Orphan", "@key": { "@type": "Random" }, "@inherits": "DeletedParent" },
};

const model = reduceZebraSchemaFromTerminusSchema(schema);
const { classes, otherIds } = buildTaxonomy(model);

describe("buildTaxonomy", () => {
  it("roots = no-inherits classes + orphans (dangling parent refs)", () => {
    expect(classes.map((n) => n.id).sort()).toEqual(["Address", "Agent", "Entity", "Orphan"]);
  });

  it("nests children under each parent", () => {
    const entity = classes.find((n) => n.id === "Entity")!;
    expect(entity.children.map((c) => c.id)).toEqual(["Person"]);
    const person = entity.children[0];
    expect(person.children.map((c) => c.id)).toEqual(["Employee"]);
  });

  it("multi-parent classes appear under every parent with sibling links", () => {
    const agent = classes.find((n) => n.id === "Agent")!;
    const employee = agent.children.find((c) => c.id === "Employee")!;
    expect(employee.parentIds).toEqual(["Person", "Agent"]);
    expect(employee.siblingParentIds).toEqual(["Person"]);
    const underEntity = classes.find((n) => n.id === "Entity")!.children[0].children[0];
    expect(underEntity.siblingParentIds).toEqual(["Agent"]);
  });

  it("gives multi-parent occurrences distinct expansion paths", () => {
    const agent = classes.find((n) => n.id === "Agent")!;
    const underAgent = agent.children.find((c) => c.id === "Employee")!;
    const underPerson = classes.find((n) => n.id === "Entity")!.children[0].children[0];
    expect(underAgent.path).not.toEqual(underPerson.path);
    expect(underAgent.path).toBe("Agent/Employee");
    expect(underPerson.path).toBe("Entity/Person/Employee");
  });

  it("splits non-class objects into the flat list", () => {
    expect(otherIds.sort()).toEqual(["Color", "ExtId", "Shape"]);
  });
});

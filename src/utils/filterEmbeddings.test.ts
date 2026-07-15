// @vitest-environment node
import { describe, it, expect } from "vitest";
import { filterEmbeddings } from "./filterEmbeddings";

describe("filterEmbeddings", () => {
  const allEmbeddings: Record<string, number[]> = {
    "terminusdb:///data/Abt/1": [0.1, 0.2, 0.3],
    "terminusdb:///data/Abt/2": [0.4, 0.5, 0.6],
    "terminusdb:///data/Buy/1": [0.7, 0.8, 0.9],
    "terminusdb:///data/Buy/2": [1.0, 1.1, 1.2],
    "terminusdb:///data/Buy/3": [1.3, 1.4, 1.5],
  };

  it("returns all embeddings when no filter is active", () => {
    const result = filterEmbeddings(allEmbeddings, {
      projectSelectionOnly: false,
      projectionSelectionIds: new Set(),
      projectWorkingSet: false,
      workingSetIds: new Set(),
    });
    expect(result).toEqual(allEmbeddings);
  });

  it("filters to only projection selection IDs when projectSelectionOnly is true", () => {
    const selectionIds = new Set(["terminusdb:///data/Abt/1", "terminusdb:///data/Buy/3"]);
    const result = filterEmbeddings(allEmbeddings, {
      projectSelectionOnly: true,
      projectionSelectionIds: selectionIds,
      projectWorkingSet: false,
      workingSetIds: new Set(),
    });
    expect(Object.keys(result)).toHaveLength(2);
    expect(result["terminusdb:///data/Abt/1"]).toEqual([0.1, 0.2, 0.3]);
    expect(result["terminusdb:///data/Buy/3"]).toEqual([1.3, 1.4, 1.5]);
  });

  it("filters to only working set IDs when projectWorkingSet is true", () => {
    const workingSetIds = new Set([
      "terminusdb:///data/Abt/2",
      "terminusdb:///data/Buy/1",
      "terminusdb:///data/Buy/2",
    ]);
    const result = filterEmbeddings(allEmbeddings, {
      projectSelectionOnly: false,
      projectionSelectionIds: new Set(),
      projectWorkingSet: true,
      workingSetIds,
    });
    expect(Object.keys(result)).toHaveLength(3);
    expect(result["terminusdb:///data/Abt/2"]).toEqual([0.4, 0.5, 0.6]);
    expect(result["terminusdb:///data/Buy/1"]).toEqual([0.7, 0.8, 0.9]);
    expect(result["terminusdb:///data/Buy/2"]).toEqual([1.0, 1.1, 1.2]);
  });

  it("returns only 5 embeddings when working set has 5 IDs out of 2173", () => {
    const largeEmbeddings: Record<string, number[]> = {};
    for (let i = 0; i < 2173; i++) {
      largeEmbeddings[`terminusdb:///data/Abt/${i}`] = [i * 0.1, i * 0.2, i * 0.3];
    }
    const workingSetIds = new Set([
      "terminusdb:///data/Abt/0",
      "terminusdb:///data/Abt/1",
      "terminusdb:///data/Abt/2",
      "terminusdb:///data/Abt/3",
      "terminusdb:///data/Abt/4",
    ]);
    const result = filterEmbeddings(largeEmbeddings, {
      projectSelectionOnly: false,
      projectionSelectionIds: new Set(),
      projectWorkingSet: true,
      workingSetIds,
    });
    expect(Object.keys(result)).toHaveLength(5);
  });

  it("projectSelectionOnly takes precedence over projectWorkingSet", () => {
    const selectionIds = new Set(["terminusdb:///data/Abt/1"]);
    const workingSetIds = new Set([
      "terminusdb:///data/Abt/2",
      "terminusdb:///data/Buy/1",
    ]);
    const result = filterEmbeddings(allEmbeddings, {
      projectSelectionOnly: true,
      projectionSelectionIds: selectionIds,
      projectWorkingSet: true,
      workingSetIds,
    });
    expect(Object.keys(result)).toHaveLength(1);
    expect(result["terminusdb:///data/Abt/1"]).toEqual([0.1, 0.2, 0.3]);
  });

  it("returns empty object when working set IDs do not match any loaded embeddings", () => {
    const workingSetIds = new Set(["terminusdb:///data/Unknown/1"]);
    const result = filterEmbeddings(allEmbeddings, {
      projectSelectionOnly: false,
      projectionSelectionIds: new Set(),
      projectWorkingSet: true,
      workingSetIds,
    });
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("returns all embeddings when projectWorkingSet is true but working set is empty", () => {
    const result = filterEmbeddings(allEmbeddings, {
      projectSelectionOnly: false,
      projectionSelectionIds: new Set(),
      projectWorkingSet: true,
      workingSetIds: new Set(),
    });
    expect(result).toEqual(allEmbeddings);
  });

  it("returns new array references for each embedding value", () => {
    const workingSetIds = new Set(["terminusdb:///data/Abt/1"]);
    const result = filterEmbeddings(allEmbeddings, {
      projectSelectionOnly: false,
      projectionSelectionIds: new Set(),
      projectWorkingSet: true,
      workingSetIds,
    });
    expect(result["terminusdb:///data/Abt/1"]).not.toBe(allEmbeddings["terminusdb:///data/Abt/1"]);
    expect(result["terminusdb:///data/Abt/1"]).toEqual(allEmbeddings["terminusdb:///data/Abt/1"]);
  });
});

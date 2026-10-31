import { SchemaModel } from "./types";

const CLASS_KINDS = new Set(["type", "trait"]);

export interface TaxonomyNode {
  id: string;
  /** Unique expansion key — a multi-parent class renders one node per parent,
   *  so expansion state keys off the full path, not the bare id. */
  path: string;
  children: TaxonomyNode[];
  /** Parents that resolve inside the model — >1 means this class shows up in multiple places. */
  parentIds: string[];
  /** Other resolved parents beyond the one this node is rendered under (for the ⇄ chip). */
  siblingParentIds: string[];
}

export interface SchemaTaxonomySplit {
  /** Classes + subdocuments, as a multi-parent hierarchy. */
  classes: TaxonomyNode[];
  /** Enums, tagged unions, foreigns — flat "other objects" list. */
  otherIds: string[];
}

const resolvedParents = (model: SchemaModel, id: string): string[] => {
  const inherits = model[id]?.typeDefinition.inherits ?? [];
  return inherits.filter((p) => model[p] !== undefined);
};

// Classes (type+trait) form a hierarchy via inherits/subsumed; everything else is a flat group.
export function buildTaxonomy(model: SchemaModel): SchemaTaxonomySplit {
  const classIds = Object.keys(model).filter((id) => CLASS_KINDS.has(model[id].type));
  const classIdSet = new Set(classIds);

  const roots = classIds.filter((id) => resolvedParents(model, id).length === 0).sort((a, b) => a.localeCompare(b));
  const childrenOf = (parentId: string) =>
    classIds
      .filter((id) => resolvedParents(model, id).includes(parentId))
      .sort((a, b) => a.localeCompare(b));

  const buildNode = (id: string, path: string[], parentId?: string): TaxonomyNode | null => {
    if (path.includes(id)) return null; // inheritance cycle — broken schema, don't recurse
    const parents = resolvedParents(model, id);
    return {
      id,
      path: [...path, id].join("/"),
      parentIds: parents,
      siblingParentIds: parents.filter((p) => p !== parentId),
      children: childrenOf(id)
        .map((c) => buildNode(c, [...path, id], id))
        .filter((n): n is TaxonomyNode => n !== null),
    };
  };

  return {
    classes: roots
      .map((r) => buildNode(r, []))
      .filter((n): n is TaxonomyNode => n !== null),
    otherIds: Object.keys(model).filter((id) => !classIdSet.has(id)).sort((a, b) => a.localeCompare(b)),
  };
}

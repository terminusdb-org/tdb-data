import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SchemaModel } from "@/lib/schemaModel/types";
import { buildTaxonomy, type TaxonomyNode } from "@/lib/schemaModel/taxonomy";

interface Props {
  model: SchemaModel;
  selectedId?: string;
  onSelect: (id: string) => void;
  onSelectObject: (id: string) => void;
  onNewElement: (kind: "Class" | "Enum" | "TaggedUnion" | "Foreign") => void;
  expandedPaths: Set<string>;
  onExpand: (id: string, open: boolean) => void;
  /** Per-class document counts (top-level classes only). */
  docCounts?: Record<string, number>;
}

function KindBadges({ model, id }: { model: SchemaModel; id: string }) {
  const td = model[id]?.typeDefinition;
  if (!td) return null;
  return (
    <span className="ml-1 inline-flex gap-1">
      {td.type === "trait" && (
        <span className="rounded bg-violet-100 px-1 text-[10px] font-medium text-violet-700 dark:bg-violet-900 dark:text-violet-300">subdoc</span>
      )}
      {td.type === "foreign" && (
        <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">foreign</span>
      )}
      {td.isShared && (
        <span className="rounded bg-teal-100 px-1 text-[10px] font-medium text-teal-700 dark:bg-teal-900 dark:text-teal-300">shared</span>
      )}
      {td.isAbstract && <span className="rounded bg-gray-200 px-1 text-[10px] font-medium text-gray-500 dark:bg-gray-700">abs</span>}
    </span>
  );
}

function MultiParentChip({ node, onJump }: { node: TaxonomyNode; onJump: (parentId: string) => void }) {
  const { t } = useTranslation();
  if (node.siblingParentIds.length === 0) return null;
  return (
    <span className="group/mp relative ml-1 inline-block" title={t("model.taxonomy.multiParent", { parents: node.siblingParentIds.join(", ") })}>
      <span className="cursor-help rounded bg-sky-100 px-1 text-[10px] font-medium text-sky-700 dark:bg-sky-900 dark:text-sky-300">
        ⇄ {node.siblingParentIds.length + 1}
      </span>
      <span className="invisible absolute left-0 z-20 mt-1 w-max rounded-md border border-gray-200 bg-white p-1 text-[10px] shadow-lg group-hover/mp:visible dark:border-gray-700 dark:bg-gray-900">
        {node.siblingParentIds.map((p) => (
          <button key={p} type="button" className="block w-full rounded px-2 py-0.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800" onClick={(e) => { e.stopPropagation(); onJump(p); }}>
            {p}
          </button>
        ))}
      </span>
    </span>
  );
}

function TreeNode({
  node,
  model,
  depth,
  selectedId,
  expandedPaths,
  onExpand,
  onSelect,
  onJump,
  docCounts,
  forceOpen,
}: {
  node: TaxonomyNode;
  model: SchemaModel;
  depth: number;
  selectedId?: string;
  expandedPaths: Set<string>;
  onExpand: (id: string, open: boolean) => void;
  onSelect: (id: string) => void;
  onJump: (parentId: string) => void;
  docCounts?: Record<string, number>;
  forceOpen?: boolean;
}) {
  const { t } = useTranslation();
  const open = forceOpen || expandedPaths.has(node.path);
  const td = model[node.id]?.typeDefinition;
  const selected = node.id === selectedId;
  const count = docCounts?.[node.id];
  return (
    <li role="treeitem" aria-expanded={node.children.length > 0 ? open : undefined} aria-selected={selected}>
      <div
        className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${
          selected ? "bg-sky-100 font-medium dark:bg-sky-900/50" : ""
        }`}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 text-left"
          onClick={() => {
            onSelect(node.id);
            if (node.children.length > 0) onExpand(node.path, !open);
          }}
        >
          <span className="w-3 shrink-0 text-[10px] text-gray-400">{node.children.length > 0 ? (open ? "▾" : "▸") : ""}</span>
          <span className={td?.isAbstract ? "italic" : ""}>{node.id}</span>
          <KindBadges model={model} id={node.id} />
          {count !== undefined && (
            <span className="ml-auto rounded bg-gray-100 px-1 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400" title={t("model.taxonomy.documentCount", { count })}>
              {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
            </span>
          )}
        </button>
        <MultiParentChip node={node} onJump={onJump} />
      </div>
      {open && node.children.length > 0 && (
        <ul role="group">
          {node.children.map((c) => (
            <TreeNode
              key={c.path}
              node={c}
              model={model}
              depth={depth + 1}
              selectedId={selectedId}
              expandedPaths={expandedPaths}
              onExpand={onExpand}
              onSelect={onSelect}
              onJump={onJump}
              docCounts={docCounts}
              forceOpen={forceOpen}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function SchemaTaxonomy({ model, selectedId, onSelect, onSelectObject, onNewElement, expandedPaths, onExpand, docCounts }: Props) {
  const { t } = useTranslation();
  const [objectFilter, setObjectFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const { classes, otherIds } = buildTaxonomy(model);

  // Filter keeps matching nodes plus their ancestors so the path stays visible.
  const filterTree = (nodes: TaxonomyNode[], q: string): TaxonomyNode[] => {
    if (!q) return nodes;
    const lq = q.toLowerCase();
    const walk = (n: TaxonomyNode): TaxonomyNode | null => {
      const kids = n.children.map(walk).filter((c): c is TaxonomyNode => c !== null);
      return n.id.toLowerCase().includes(lq) || kids.length > 0 ? { ...n, children: kids } : null;
    };
    return nodes.map(walk).filter((n): n is TaxonomyNode => n !== null);
  };
  const filteredClasses = filterTree(classes, classFilter);

  const jumpToParent = (parentId: string) => {
    // Navigate to the other parent branch — expand it and open its detail.
    onExpand(parentId, true);
    onSelect(parentId);
  };

  const kindLabel = (id: string) => {
    const k = model[id]?.type;
    return k === "enumtrait" ? "Enum" : k === "taggedunion" ? "TaggedUnion" : k === "foreign" ? "Foreign" : k;
  };

  const filteredOthers = otherIds.filter(
    (id) => !objectFilter || id.toLowerCase().includes(objectFilter.toLowerCase())
  );

  return (
    <div className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-gray-200 p-2 dark:border-gray-700">
      <div className="mb-2 flex gap-1">
        {(["Class", "Enum", "TaggedUnion", "Foreign"] as const).map((k) => (
          <button
            key={k}
            type="button"
            className="rounded border border-gray-300 px-1.5 py-0.5 text-[11px] hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
            onClick={() => onNewElement(k)}
            title={t(`model.taxonomy.new${k}`)}
          >
            +{k}
          </button>
        ))}
      </div>
      <div className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">{t("model.taxonomy.classes")}</div>
      <input
        type="text"
        value={classFilter}
        onChange={(e) => setClassFilter(e.target.value)}
        placeholder={t("model.taxonomy.filter")}
        className="mb-1 w-full rounded border border-gray-300 px-1.5 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-900"
        aria-label={t("model.taxonomy.filterClasses")}
      />
      <ul role="tree" className="mb-3">
        {filteredClasses.map((n) => (
          <TreeNode
            key={n.id}
            node={n}
            model={model}
            depth={0}
            selectedId={selectedId}
            expandedPaths={expandedPaths}
            onExpand={onExpand}
            onSelect={onSelect}
            onJump={jumpToParent}
            docCounts={docCounts}
            forceOpen={classFilter.length > 0}
          />
        ))}
        {classes.length === 0 && <li className="px-1 py-1 text-xs text-gray-400">{t("model.taxonomy.noClasses")}</li>}
      </ul>
      <div className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">{t("model.taxonomy.otherObjects")}</div>
      <input
        type="text"
        value={objectFilter}
        onChange={(e) => setObjectFilter(e.target.value)}
        placeholder={t("model.taxonomy.filter")}
        className="mb-1 w-full rounded border border-gray-300 px-1.5 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-900"
      />
      <ul>
        {filteredOthers.map((id) => (
          <li key={id}>
            <button
              type="button"
              className={`flex w-full cursor-pointer items-center justify-between rounded px-1 py-0.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${
                id === selectedId ? "bg-sky-100 font-medium dark:bg-sky-900/50" : ""
              }`}
              onClick={() => onSelectObject(id)}
            >
              <span>{id}</span>
              <span className="text-[10px] text-gray-400">
                {kindLabel(id)}
                {model[id]?.typeDefinition.enumValues ? ` (${model[id].typeDefinition.enumValues!.length})` : ""}
              </span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className="w-full cursor-pointer rounded px-1 py-0.5 text-left text-sm text-gray-500 italic hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => onSelectObject("@context")}
          >
            @context
          </button>
        </li>
      </ul>
    </div>
  );
}

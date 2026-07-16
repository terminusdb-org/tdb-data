import React, { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { SchemaClass } from "@/types/terminusdb";
import { isSubdocument as isSubdoc } from "@/types/terminusdb";

interface DoctypeTreeNode {
  readonly id: string;
  readonly label: string;
  children: DoctypeTreeNode[];
  readonly isAbstract: boolean;
  readonly isSubdocument: boolean;
}

function buildTree(classes: SchemaClass[]): DoctypeTreeNode[] {
  const classMap = new Map<string, SchemaClass>();
  classes.forEach((cls) => classMap.set(cls["@id"], cls));

  const isSubdocument = (cls: SchemaClass): boolean => isSubdoc(cls);

  const isAbstract = (cls: SchemaClass): boolean => {
    const abs = cls["abstract"];
    return abs === true || abs === "true";
  };

  const getParents = (cls: SchemaClass): string[] => {
    const parents = cls["inherits"];
    if (!parents) return [];
    if (Array.isArray(parents)) return parents as string[];
    return [parents as string];
  };

  const childrenMap = new Map<string, DoctypeTreeNode[]>();
  const roots: DoctypeTreeNode[] = [];

  for (const cls of classes) {
    const parents = getParents(cls);
    const node: DoctypeTreeNode = {
      id: cls["@id"],
      label: cls["@id"],
      children: [],
      isAbstract: isAbstract(cls),
      isSubdocument: isSubdocument(cls),
    };

    if (parents.length === 0) {
      roots.push(node);
    } else {
      for (const parent of parents) {
        if (!childrenMap.has(parent)) childrenMap.set(parent, []);
        childrenMap.get(parent)!.push(node);
      }
    }
  }

  const populateChildren = (nodes: DoctypeTreeNode[]) => {
    for (const node of nodes) {
      node.children = childrenMap.get(node.id) ?? [];
      populateChildren(node.children);
    }
  };
  populateChildren(roots);

  const filterNonSubdoc = (nodes: DoctypeTreeNode[]): DoctypeTreeNode[] => {
    return nodes
      .filter((n) => !n.isSubdocument)
      .map((n) => ({ ...n, children: filterNonSubdoc(n.children) }));
  };

  return filterNonSubdoc(roots);
}

interface TreeItemProps {
  readonly node: DoctypeTreeNode;
  readonly level: number;
  readonly onSelect: (typeId: string) => void;
  readonly selectedType: string | null;
}

const TreeItem: React.FC<TreeItemProps> = ({ node, level, onSelect, selectedType }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedType === node.id;

  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-sm ${
          isSelected ? "bg-dfrntBlue-50 text-dfrntBlue-700" : "hover:bg-gray-100 text-gray-700"
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(node.id);
          }
        }}
        role="treeitem"
        tabIndex={0}
        aria-expanded={hasChildren ? expanded : undefined}
        aria-selected={isSelected}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="flex h-4 w-4 items-center justify-center text-gray-400 hover:text-gray-600"
            aria-label={expanded ? t("doctypeTree.collapse") : t("doctypeTree.expand")}
          >
            <svg className="h-3 w-3 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} style={{ transform: expanded ? "rotate(90deg)" : "none" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className={`truncate ${node.isAbstract ? "italic" : ""}`}>
          {node.label}
        </span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              selectedType={selectedType}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface DoctypeTreeProps {
  readonly classes: SchemaClass[];
}

export const DoctypeTree: React.FC<DoctypeTreeProps> = ({ classes }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const [selectedType, setSelectedType] = React.useState<string | null>(null);

  const tree = useMemo(() => buildTree(classes), [classes]);

  const handleSelect = (typeId: string) => {
    setSelectedType(typeId);
    const { org, team, branch, commitId } = params;
    if (org && team && branch) {
      navigate(`/${org}/${team}/local/branch/${branch}/documents?type=${encodeURIComponent(typeId)}`);
    } else if (org && team && commitId) {
      navigate(`/${org}/${team}/local/commit/${commitId}/documents?type=${encodeURIComponent(typeId)}`);
    }
  };

  if (tree.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        {t("doctypeTree.noDocTypes")}
      </div>
    );
  }

  return (
    <div role="tree" className="py-2">
      {tree.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          level={0}
          onSelect={handleSelect}
          selectedType={selectedType}
        />
      ))}
    </div>
  );
};

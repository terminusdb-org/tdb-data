import React, { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGetSchemaQuery, useRunWoqlMutation } from "@/store";
import { PageShell, PageHeader, PagePlaceholder, useRouteParams } from "@/components";
import { buildApiPath, buildRoutePath } from "@/utils/routes";
import { reduceZebraSchemaFromTerminusSchema } from "@/lib/schemaModel/schemaReducer";
import type { TerminusSchemaObject } from "@/lib/schemaModel/terminusReducers";
import { ops as migOps } from "@/lib/schemaModel/migrationOps";
import { ModelDialog } from "@/components/ModelDialog";
import { SchemaTaxonomy } from "@/features/model/SchemaTaxonomy";
import { ModelOverview } from "@/features/model/ModelOverview";
import { ClassDetail } from "@/features/model/ClassDetail";
import { ObjectDetail } from "@/features/model/ObjectDetail";
import { ContextDetail } from "@/features/model/ContextDetail";
import { useApplyMigration } from "@/features/model/applyEdit";

// Foreign schema docs are missing from GET /api/schema (TerminusDB #1832) —
// fetch them via WOQL on the schema graph, same workaround as Zebra.
const FOREIGN_TYPES_WOQL = {
  "@type": "Triple",
  subject: { "@type": "NodeValue", variable: "type_id" },
  predicate: { "@type": "NodeValue", node: "rdf:type" },
  object: { "@type": "NodeValue", node: "sys:Foreign" },
  graph: "schema",
} as const;

export const SchemaPage: React.FC = () => {
  const { t } = useTranslation();
  const routeParams = useRouteParams();
  const { classId, objectId, tab } = useParams<{ classId?: string; objectId?: string; tab?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const applyMigration = useApplyMigration();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [newElement, setNewElement] = useState<{ kind: "Class" | "Enum" | "TaggedUnion" | "Foreign"; id: string } | null>(null);
  const [foreignNames, setForeignNames] = useState<string[]>([]);
  const [runWoql] = useRunWoqlMutation();

  const schemaPath = routeParams ? buildApiPath(routeParams, "schema") : "";
  const docPath = routeParams ? buildApiPath(routeParams, "document") : "";
  const woqlPath = routeParams ? buildApiPath(routeParams, "woql") : "";
  const routeBase = routeParams ? buildRoutePath(routeParams) : "";

  const { data: classes, isLoading } = useGetSchemaQuery({ path: schemaPath, asList: true }, { skip: !routeParams });

  useEffect(() => {
    if (!woqlPath) return;
    let cancelled = false;
    runWoql({ path: woqlPath, query: FOREIGN_TYPES_WOQL })
      .unwrap()
      .then((res) => {
        if (cancelled) return;
        const names = (res.bindings ?? [])
          .map((b) => String((b as Record<string, unknown>)["type_id"] ?? ""))
          .filter(Boolean)
          .map((n) => (n.startsWith("@schema:") ? n.slice("@schema:".length) : n));
        setForeignNames(names);
      })
      .catch(() => setForeignNames([]));
    return () => {
      cancelled = true;
    };
  }, [woqlPath, classes, runWoql]);

  const model = useMemo(() => {
    if (!classes) return {};
    const docs: TerminusSchemaObject = {};
    for (const cls of classes) {
      if (cls["@id"] === "@context") continue;
      const { "@id": id, ...rest } = cls;
      docs[id] = { "@id": id, ...rest } as TerminusSchemaObject[string];
    }
    for (const name of foreignNames) {
      if (!docs[name]) docs[name] = { "@type": "Foreign", "@id": name } as TerminusSchemaObject[string];
    }
    return reduceZebraSchemaFromTerminusSchema(docs);
  }, [classes, foreignNames]);

  // ?class=X compat (DocumentEditor "edit schema" link)
  useEffect(() => {
    const cls = searchParams.get("class");
    if (cls && routeBase) {
      navigate(`${routeBase}/schema/class/${encodeURIComponent(cls)}`, { replace: true });
    }
  }, [searchParams, routeBase, navigate]);

  if (!routeParams) return <PagePlaceholder>{t("common.selectDataProduct")}</PagePlaceholder>;
  if (isLoading) return <PagePlaceholder>{t("schema.loadingSchema")}</PagePlaceholder>;

  const goClass = (id: string) => navigate(`${routeBase}/schema/class/${encodeURIComponent(id)}`);
  const goObject = (id: string) => navigate(`${routeBase}/schema/object/${encodeURIComponent(id)}`);
  const goHome = () => navigate(`${routeBase}/schema`);
  const goClassTab = (id: string, nextTab: string) => navigate(`${routeBase}/schema/class/${encodeURIComponent(id)}/${nextTab}`);
  const goObjectTab = (id: string, nextTab: string) => navigate(`${routeBase}/schema/object/${encodeURIComponent(id)}/${nextTab}`);

  const onExpand = (id: string, open: boolean) =>
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  const createElement = async () => {
    if (!newElement || !newElement.id.trim() || model[newElement.id]) return;
    const id = newElement.id.trim();
    const ops = [
      migOps.createClass(
        newElement.kind === "Enum"
          ? { "@type": "Enum", "@id": id, "@value": [] }
          : newElement.kind === "Foreign"
            ? { "@type": "Foreign", "@id": id }
            : newElement.kind === "TaggedUnion"
              ? { "@type": "TaggedUnion", "@id": id }
              : { "@type": "Class", "@id": id, "@key": { "@type": "Random" } }
      ),
    ];
    await applyMigration({ path: schemaPath, elementId: id, ops });
    const isClassKind = newElement.kind === "Class";
    setNewElement(null);
    if (isClassKind) goClass(id);
    else goObject(id);
  };

  return (
    <PageShell
      header={
        <PageHeader>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("model.title")}</h2>
            {classId && (
              <Link
                to={`${routeBase}/documents?type=${encodeURIComponent(classId)}`}
                className="ml-auto rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {t("model.documentsLink")}
              </Link>
            )}
            {/* Embeddings only make sense for classes that produce instances. */}
            {(!classId || (model[classId]?.type === "type" && !model[classId]?.typeDefinition.isAbstract)) && (
              <Link
                to={`${routeBase}/embeddings${classId ? `?type=${encodeURIComponent(classId)}` : ""}`}
                className={`rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 ${classId ? "" : "ml-auto"}`}
              >
                {t("model.embeddingsLink")}
              </Link>
            )}
          </div>
        </PageHeader>
      }
    >
      <div className="flex h-full">
        <SchemaTaxonomy
          model={model}
          selectedId={classId ?? objectId}
          onSelect={goClass}
          onSelectObject={goObject}
          onNewElement={(kind) => setNewElement({ kind, id: "" })}
          expandedPaths={expandedPaths}
          onExpand={onExpand}
        />
        {classId && model[classId] && (model[classId].type === "type" || model[classId].type === "trait") ? (
          <ClassDetail
            model={model}
            classes={classes ?? []}
            elementId={classId}
            schemaPath={schemaPath}
            docPath={docPath}
            tab={tab}
            onTabChange={(next) => goClassTab(classId, next)}
            onNavigate={goClass}
            onNavigateObject={goObject}
            onDeleted={goHome}
          />
        ) : objectId === "@context" ? (
          <ContextDetail classes={classes ?? []} schemaPath={schemaPath} tab={tab} onTabChange={(next) => goObjectTab("@context", next)} />
        ) : objectId ? (
          <ObjectDetail
            model={model}
            classes={classes ?? []}
            elementId={objectId}
            schemaPath={schemaPath}
            docPath={docPath}
            routeParams={routeParams}
            tab={tab}
            onTabChange={(next) => goObjectTab(objectId, next)}
            onNavigate={(id) => (model[id]?.type === "type" || model[id]?.type === "trait" ? goClass(id) : goObject(id))}
            onDeleted={goHome}
          />
        ) : (
          <ModelOverview model={model} onSelect={goClass} onSelectObject={goObject} />
        )}
      </div>
      {newElement && (
        <ModelDialog open onClose={() => setNewElement(null)} widthClass="w-80" title={t("model.new.title", { kind: newElement.kind })}>
            <input
              className="mb-2 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-950"
              placeholder={t("model.new.idPlaceholder")}
              value={newElement.id}
              onChange={(e) => setNewElement({ ...newElement, id: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && void createElement()}
            />
            {newElement.id && model[newElement.id] && <div className="mb-1 text-xs text-red-600">{t("model.new.idTaken")}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" onClick={() => setNewElement(null)}>
                {t("common.cancel")}
              </button>
              <button type="button" className="rounded bg-sky-600 px-3 py-1 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50" disabled={!newElement.id.trim() || !!model[newElement.id]} onClick={() => void createElement()}>
                {t("common.create")}
              </button>
            </div>
        </ModelDialog>
      )}
    </PageShell>
  );
};

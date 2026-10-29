import { useTranslation } from "react-i18next";
import type { SchemaModel } from "@/lib/schemaModel/types";
import { buildTaxonomy } from "@/lib/schemaModel/taxonomy";

// Landing panel when nothing is selected.
export function ModelOverview({ model, onSelect, onSelectObject }: { model: SchemaModel; onSelect: (id: string) => void; onSelectObject: (id: string) => void }) {
  const { t } = useTranslation();
  const { classes, otherIds } = buildTaxonomy(model);
  const count = (nodes: { children: unknown[] }[] & { id?: string }[]): number =>
    nodes.reduce((acc, n) => acc + 1 + count((n as { children?: { children: unknown[] }[] }).children ?? []), 0);
  return (
    <div className="flex-1 p-6">
      <h2 className="mb-2 text-base font-semibold">{t("model.overview.title")}</h2>
      <p className="mb-4 text-sm text-gray-500">{t("model.overview.blurb")}</p>
      <div className="grid max-w-xl grid-cols-2 gap-3">
        <button type="button" className="rounded-lg border border-gray-200 p-3 text-left hover:border-sky-400 dark:border-gray-700" onClick={() => classes[0] && onSelect(classes[0].id)}>
          <div className="text-2xl font-semibold">{count(classes)}</div>
          <div className="text-xs text-gray-500">{t("model.overview.classes")}</div>
        </button>
        <button type="button" className="rounded-lg border border-gray-200 p-3 text-left hover:border-sky-400 dark:border-gray-700" onClick={() => otherIds[0] && onSelectObject(otherIds[0])}>
          <div className="text-2xl font-semibold">{otherIds.length}</div>
          <div className="text-xs text-gray-500">{t("model.overview.otherObjects")}</div>
        </button>
      </div>
    </div>
  );
}

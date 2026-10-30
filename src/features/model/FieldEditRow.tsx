import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SchemaModel, TypePropertyDefinition } from "@/lib/schemaModel/types";
import type { SupportedZebraTypes, TerminusMultiplicityDefinitions } from "@/lib/schemaModel/terminusReducers";
import { buildPredicateIndex, specsEqual } from "@/lib/schemaModel/predicates";
import { FilterCombobox } from "@/components/FilterCombobox";
import { zebraToOthersMapping } from "@/lib/schemaModel/mappings";

import type { NewClassKind } from "@/lib/schemaModel/migrationOps";

export interface FieldDraft {
  name: string;
  prop: TypePropertyDefinition;
  default?: { value: string } | "error";
  /** Inline-created link target (decision 12). */
  newClass?: { id: string; kind: NewClassKind };
  /** @oneOf group index — equal to oneOfCount appends a new group; absent = regular field. */
  oneOfGroup?: number;
}

// Full TerminusDB datatype palette — every xsd/sys type the engine accepts.
const PRIMITIVES: SupportedZebraTypes[] = [
  "string", "boolean", "integer", "decimal", "double", "float",
  "dateTime", "date", "time", "dateTimeStamp",
  "gYear", "gMonth", "gDay", "gYearMonth", "gMonthDay",
  "duration", "yearMonthDuration", "dayTimeDuration",
  "long", "int", "short", "byte",
  "unsignedLong", "unsignedInt", "unsignedShort", "unsignedByte",
  "positiveInteger", "nonNegativeInteger", "negativeInteger", "nonPositiveInteger",
  "hexBinary", "base64Binary",
  "anyURI", "language", "normalizedString", "token", "NMTOKEN", "Name", "NCName",
  "JSON",
  "url", "email", "html",
  "coordinate", "coordinatePolygon", "coordinatePolyline",
  "dateRange", "dateTimeInterval", "gYearRange", "integerRange", "decimalRange",
];
const MULTIPLICITIES: TerminusMultiplicityDefinitions[] = ["Mandatory", "Optional", "Set", "List", "Cardinality", "Array"];
// Cardinality is presented as "Set (Cardinality)": a bounded Set. Bare Set when no bounds are set.
const MULT_LABEL: Record<string, string> = { Cardinality: "Set (Cardinality)" };

type LinkedKind = "linkedType" | "linkedTrait" | "linkedEnum" | "linkedForeign" | "linkedTaggedUnion";
// Inline-created targets: targetKind → link slot on the property + doc kind to create.
const NEW_TARGET = {
  newClass: { link: "linkedType", kind: "class" },
  newSubdoc: { link: "linkedTrait", kind: "subdoc" },
  newEnum: { link: "linkedEnum", kind: "enum" },
  newTaggedUnion: { link: "linkedTaggedUnion", kind: "taggedunion" },
  newForeign: { link: "linkedForeign", kind: "foreign" },
} as const;
type TargetKind = "primitive" | LinkedKind | keyof typeof NEW_TARGET;

// Model element type → property link slot.
const LINK_KIND_OF: Record<string, LinkedKind> = {
  type: "linkedType",
  trait: "linkedTrait",
  enumtrait: "linkedEnum",
  foreign: "linkedForeign",
  taggedunion: "linkedTaggedUnion",
};
const linkKindOf = (modelType: string | undefined): LinkedKind | "primitive" =>
  (modelType && LINK_KIND_OF[modelType]) || "primitive";

const LINK_KEYS: readonly LinkedKind[] = ["linkedTrait", "linkedType", "linkedEnum", "linkedForeign", "linkedTaggedUnion"];
const initialTargetKind = (initial?: TypePropertyDefinition): TargetKind => {
  for (const k of LINK_KEYS) if (initial?.[k]) return k;
  return "primitive";
};

interface Props {
  model: SchemaModel;
  targetId: string;
  existingNames: string[];
  initial?: TypePropertyDefinition & { originalName?: string };
  /** Number of existing @oneOf groups on the class; undefined hides the control. */
  oneOfCount?: number;
  /** Group index the edited field currently belongs to (undefined = regular field). */
  oneOfGroup?: number;
  onSave: (draft: FieldDraft) => void;
  onCancel: () => void;
}

export function FieldEditRow({ model, targetId, existingNames, initial, oneOfCount, oneOfGroup, onSave, onCancel }: Props) {
  const { t } = useTranslation();
  const predicates = useMemo(() => buildPredicateIndex(model), [model]);
  const [name, setName] = useState(initial?.originalName ?? initial?.name ?? "");
  const [multiplicity, setMultiplicity] = useState<TerminusMultiplicityDefinitions>(initial?.multiplicity ?? "Optional");
  const [linkedTarget, setLinkedTarget] = useState(
    initial?.linkedType ?? initial?.linkedTrait ?? initial?.linkedEnum ?? initial?.linkedForeign ?? initial?.linkedTaggedUnion ?? ""
  );
  const [primitive, setPrimitive] = useState<SupportedZebraTypes>(initial?.type && PRIMITIVES.includes(initial.type) ? initial.type : "string");
  const [targetKind, setTargetKind] = useState<TargetKind>(initialTargetKind(initial));
  const [newClassId, setNewClassId] = useState("");
  const [unfold, setUnfold] = useState(initial?.unfold ?? false);
  const [minCard, setMinCard] = useState(initial?.minCardinality?.toString() ?? "");
  const [maxCard, setMaxCard] = useState(initial?.maxCardinality?.toString() ?? initial?.cardinality?.toString() ?? "");
  const [dimensions, setDimensions] = useState(initial?.dimensions?.toString() ?? "1");
  const [defaultValue, setDefaultValue] = useState("");
  const [oneOfSel, setOneOfSel] = useState<string>(oneOfGroup !== undefined ? String(oneOfGroup) : "none");
  const [error, setError] = useState<string | null>(null);

  // Mandatory fields need a default for existing instances; Foreign specs
  // always need one — the engine rejects a Foreign property created without.
  const targetNeedsDefault = !initial && (multiplicity === "Mandatory" || targetKind === "linkedForeign" || targetKind === "newForeign");
  const knownPredicate = predicates[name];
  const predicateSpecs = knownPredicate ? [...new Set(knownPredicate.defs.map((d) => JSON.stringify(d.spec)))] : [];

  const classOptions = (kind: string) =>
    Object.keys(model).filter((id) => linkKindOf(model[id].type) === kind);

  // Picking a known predicate name offers its existing definitions for reuse.
  const adoptPredicateDef = (specJson: string) => {
    const def = knownPredicate?.defs.find((d) => JSON.stringify(d.spec) === specJson);
    if (!def) return;
    const spec = def.spec;
    if (typeof spec === "string") {
      setMultiplicity("Mandatory");
      setTargetKind("primitive");
      const linked = spec as SupportedZebraTypes;
      if (PRIMITIVES.includes(linked)) setPrimitive(linked);
    } else if (spec && typeof spec === "object") {
      const s = spec as Record<string, unknown>;
      setMultiplicity((s["@type"] as TerminusMultiplicityDefinitions) ?? "Optional");
      const cls = typeof s["@class"] === "string" ? s["@class"] : "";
      const kind = linkKindOf(model[cls]?.type);
      if (kind !== "primitive") {
        setTargetKind(kind);
        setLinkedTarget(cls);
      } else if (PRIMITIVES.includes(cls as SupportedZebraTypes)) {
        setTargetKind("primitive");
        setPrimitive(cls as SupportedZebraTypes);
      }
    }
  };

  const validate = (): string | null => {
    if (!name.trim()) return t("model.field.errorNameRequired");
    if (name.startsWith("@")) return t("model.field.errorNoAtPrefix");
    const isOwn = existingNames.includes(name);
    if (isOwn && name !== initial?.originalName) return t("model.field.errorCollision");
    if (targetKind in NEW_TARGET && (!newClassId.trim() || model[newClassId])) {
      return t("model.field.errorNewClassId");
    }
    if (targetNeedsDefault && !defaultValue) return t("model.field.errorDefaultRequired");
    if (oneOfSel !== "none" && multiplicity === "Optional") return t("model.field.errorOneOfOptional");
    if (["linkedType", "linkedTrait", "linkedEnum", "linkedForeign", "linkedTaggedUnion"].includes(targetKind) && !linkedTarget)
      return t("model.field.errorTargetRequired");
    return null;
  };

  const handleSave = () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    const isForeign = targetKind === "linkedForeign" || targetKind === "newForeign";
    const newTarget = targetKind in NEW_TARGET ? NEW_TARGET[targetKind as keyof typeof NEW_TARGET] : undefined;
    // "Set (Cardinality)" with no bounds collapses to a plain Set.
    const effMultiplicity: TerminusMultiplicityDefinitions =
      multiplicity === "Cardinality" && !minCard && !maxCard ? "Set" : multiplicity;
    const prop: TypePropertyDefinition = {
      name,
      type: targetKind === "primitive" ? primitive : newTarget ? newTarget.link : (targetKind as LinkedKind),
      multiplicity: isForeign ? "Foreign" : effMultiplicity,
      ...(targetKind === "linkedType" && { linkedType: linkedTarget }),
      ...(targetKind === "linkedTrait" && { linkedTrait: linkedTarget }),
      ...(targetKind === "linkedEnum" && { linkedEnum: linkedTarget }),
      ...(targetKind === "linkedForeign" && { linkedForeign: linkedTarget }),
      ...(targetKind === "linkedTaggedUnion" && { linkedTaggedUnion: linkedTarget }),
      ...(newTarget && { [newTarget.link]: newClassId }),
      ...(effMultiplicity === "Cardinality" && {
        ...(minCard && { minCardinality: Number(minCard) }),
        ...(maxCard && { maxCardinality: Number(maxCard) }),
        ...(minCard && minCard === maxCard ? { cardinality: Number(minCard) } : {}),
      }),
      ...(multiplicity === "Array" && { dimensions: Number(dimensions) || 1 }),
      ...(unfold && targetKind !== "primitive" && { unfold: true }),
    };
    onSave({
      name,
      prop,
      ...(targetNeedsDefault && defaultValue ? { default: { value: defaultValue } } : {}),
      ...(newTarget && {
        newClass: { id: newClassId, kind: newTarget.kind },
      }),
      ...(oneOfSel !== "none" && {
        oneOfGroup: oneOfSel === "new" ? oneOfCount! : Number(oneOfSel),
      }),
    });
  };

  const selectCls =
    "min-h-9 rounded border border-gray-300 px-1.5 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

  return (
    <div className="rounded-md border border-sky-300 bg-sky-50/50 p-2 dark:border-sky-800 dark:bg-sky-950/20">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          list={`predicates-${targetId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("model.field.namePlaceholder")}
          className={`${selectCls} w-full sm:w-40`}
          aria-label={t("model.field.name")}
        />
        <datalist id={`predicates-${targetId}`}>
          {Object.keys(predicates).sort().map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <select value={multiplicity} onChange={(e) => setMultiplicity(e.target.value as TerminusMultiplicityDefinitions)} className={`${selectCls} w-full sm:w-auto`} aria-label={t("model.field.multiplicity")} disabled={targetKind === "linkedForeign" || targetKind === "newForeign"}>
          {MULTIPLICITIES.map((m) => (
            <option key={m} value={m}>{MULT_LABEL[m] ?? m}</option>
          ))}
        </select>
        <select
          value={targetKind}
          onChange={(e) => { setTargetKind(e.target.value as typeof targetKind); setLinkedTarget(""); }}
          className={`${selectCls} w-full sm:w-auto`}
          aria-label={t("model.field.type")}
        >
          <option value="primitive">{t("model.field.primitive")}</option>
          <optgroup label={t("model.field.linkTargets")}>
            <option value="linkedType">{t("model.field.classes")}</option>
            <option value="linkedTrait">{t("model.field.subdocuments")}</option>
            <option value="linkedEnum">{t("model.field.enums")}</option>
            <option value="linkedForeign">{t("model.field.foreigns")}</option>
            <option value="linkedTaggedUnion">{t("model.field.taggedUnions")}</option>
          </optgroup>
          <optgroup label={t("model.field.createNew")}>
            <option value="newClass">{t("model.field.newClassOption")}</option>
            <option value="newSubdoc">{t("model.field.newSubdocOption")}</option>
            <option value="newEnum">{t("model.field.newEnumOption")}</option>
            <option value="newTaggedUnion">{t("model.field.newTaggedUnionOption")}</option>
            <option value="newForeign">{t("model.field.newForeignOption")}</option>
          </optgroup>
        </select>
        {oneOfCount !== undefined && (
          <select
            value={oneOfSel}
            onChange={(e) => setOneOfSel(e.target.value)}
            className={`${selectCls} w-full sm:w-auto`}
            aria-label={t("model.field.oneOf")}
            title={t("model.field.oneOfTitle")}
          >
            <option value="none">{t("model.field.oneOfNone")}</option>
            {Array.from({ length: oneOfCount }, (_, i) => (
              <option key={i} value={i}>
                {t("model.field.oneOfGroup", { index: i + 1 })}
              </option>
            ))}
            <option value="new">{t("model.field.oneOfNew")}</option>
          </select>
        )}
        {targetKind === "primitive" && (
          <FilterCombobox
            options={PRIMITIVES}
            value={primitive}
            formatOption={(p) => (zebraToOthersMapping[p]?.tdb ? `${zebraToOthersMapping[p].tdb} (${p})` : p)}
            onChange={(v) => setPrimitive(v as SupportedZebraTypes)}
            placeholder={t("model.field.primitiveType")}
            aria-label={t("model.field.primitiveType")}
            className="w-full max-w-full sm:w-60"
          />
        )}
        {["linkedType", "linkedTrait", "linkedEnum", "linkedForeign", "linkedTaggedUnion"].includes(targetKind) && (
          <FilterCombobox
            options={classOptions(targetKind)}
            value={linkedTarget}
            onChange={setLinkedTarget}
            placeholder={t("model.field.chooseTarget")}
            emptyLabel={t("model.field.noTargets")}
            aria-label={t("model.field.target")}
            className="w-full sm:w-44"
          />
        )}
        {targetKind !== "primitive" && !(targetKind in NEW_TARGET) && multiplicity !== "Mandatory" && (
          <label className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-300" title={t("model.field.unfoldTitle")}>
            <input type="checkbox" className="h-4 w-4" checked={unfold} onChange={(e) => setUnfold(e.target.checked)} />
            {t("model.field.unfold")}
          </label>
        )}
        {targetKind in NEW_TARGET && (
          <input type="text" value={newClassId} onChange={(e) => setNewClassId(e.target.value)} placeholder={t("model.field.newClassIdPlaceholder")} className={`${selectCls} w-full sm:w-36`} />
        )}
        {multiplicity === "Cardinality" && (
          <>
            <input type="number" value={minCard} onChange={(e) => setMinCard(e.target.value)} placeholder={t("model.field.min")} className={`${selectCls} w-20`} />
            <input type="number" value={maxCard} onChange={(e) => setMaxCard(e.target.value)} placeholder={t("model.field.max")} className={`${selectCls} w-20`} />
          </>
        )}
        {multiplicity === "Array" && (
          <input type="number" value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder={t("model.field.dimensions")} className={`${selectCls} w-20`} />
        )}
        {targetNeedsDefault && (
          <input
            type="text"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
            placeholder={t("model.field.defaultPlaceholder")}
            className={`${selectCls} w-full sm:w-32`}
            aria-label={t("model.field.default")}
          />
        )}
        <button type="button" onClick={handleSave} className="min-h-9 w-full rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 sm:w-auto">
          {t("common.save")}
        </button>
        <button type="button" onClick={onCancel} className="min-h-9 w-full rounded px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 sm:w-auto dark:text-gray-300 dark:hover:bg-gray-800">
          {t("common.cancel")}
        </button>
      </div>
      {knownPredicate && name !== initial?.originalName && (
        <div className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">
          {t("model.field.predicateUsedBy", { count: knownPredicate.defs.length })}
          {predicateSpecs.length > 1 && (
            <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              {t("model.field.overloadCount", { count: predicateSpecs.length })}
            </span>
          )}
          {knownPredicate.defs.some((d) => d.doc) && (
            <span className="ml-1 cursor-help" title={knownPredicate.defs.map((d) => ("description" in (d.doc ?? {}) ? (d.doc as { description?: string }).description : undefined) ?? ("comment" in (d.doc ?? {}) ? (d.doc as { comment?: string }).comment : undefined)).filter(Boolean).join(" · ")}>
              ⓘ
            </span>
          )}
          {predicateSpecs.length > 1 && (
            <select className={`${selectCls} ml-2`} defaultValue="" onChange={(e) => e.target.value && adoptPredicateDef(e.target.value)} aria-label={t("model.field.adoptSpec")}>
              <option value="">{t("model.field.adoptSpec")}</option>
              {predicateSpecs.map((s) => (
                <option key={s} value={s}>
                  {s} — {t("model.field.usedBy", { ids: knownPredicate.defs.filter((d) => specsEqual(d.spec, JSON.parse(s))).map((d) => d.elementId).join(", ") })}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {error && <div className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</div>}
    </div>
  );
}

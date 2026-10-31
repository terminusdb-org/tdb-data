import { t } from "i18next";
import { ITypeDefinition, SchemaModel, SchemaElementKind, TypePropertyDefinition, TypePropertyDefinitions } from "./types";
import { SupportedZebraTypes, TerminusMultiplicityDefinitions } from "./terminusReducers";
import { replaceNumeralsWithSubscriptNumerals } from "./fn";

const MERMAID_DELIMITERS = { inheritance: "..|>", association: "-->", aggregation: "*--" } as const;
const MAX_ENUM_MERMAID = 10;

export interface ClassField {
  fieldId: string;
  inherited: boolean;
  linkedClass?: string;
  type: SupportedZebraTypes;
  dimensions?: number;
  fieldSetIndex?: number;
  minMultiplicity?: number;
  maxMultiplicity?: number;
  multiplicity: TerminusMultiplicityDefinitions;
}

export interface ClassDefinitionWithFlattenedSubTraits extends ClassDefinition {
  associatedSubClasses: Array<ClassFieldInfo>; // for flattened sub-documents (in postprocessing)
}
export interface ClassDefinition {
  id: string;
  name: string;
  classType: SchemaElementKind;
  aggregatedClasses: Array<ClassFieldInfo>; // for sub-documents
  inheritedClasses: Array<string>; // for composed types
  associatedClasses: Array<ClassFieldInfo>; // for linked types
  disjointClassFields: Array<ClassField>;
  ownClassFields: Array<ClassField>;
  inheritedClassFields: Array<ClassField>;
  enumValues?: Array<ClassField>;
}

export interface ClassFieldInfo {
  className: string;
  fieldId: string;
}
// Also only go as far as there are properties left to show! Keep track of the inherited traits.

export interface MapPropertyToMermaidOptions {
  fieldSetIndex?: number;
}


export const reduceClassDataFromTrait = (
  typeDefinition: ITypeDefinition,
  id: string,
  isTopLevel: boolean,
  inherited: boolean
): ClassDefinition => {
  const name = typeDefinition.id;
  const properties = typeDefinition.propertyDefinitions ?? {};
  const disjointProperties = typeDefinition.propertyDefinitionsOneOf ?? [];
  const inheritedProperties = typeDefinition.inheritedPropertyDefinitions ?? {};

  const associatedClassMap: Record<string, ClassFieldInfo> = {};
  const aggregatedClassMap: Record<string, ClassFieldInfo> = {};

  const mapPropertyToMermaidClassField = (
    properties: TypePropertyDefinitions,
    inherited: boolean,
    options?: MapPropertyToMermaidOptions
  ): Array<ClassField> => {
    return Object.keys(properties).map((propKey) => {
      const property: TypePropertyDefinition = properties[propKey];
      if (isTopLevel && property.linkedType) {
        associatedClassMap[property.linkedType] = { className: property.linkedType, fieldId: property.name };
      }
      if (isTopLevel && property.linkedEnum) {
        aggregatedClassMap[property.linkedEnum] = { className: property.linkedEnum, fieldId: property.name };
      }
      if (isTopLevel && property.linkedTrait) {
        aggregatedClassMap[property.linkedTrait] = { className: property.linkedTrait, fieldId: property.name };
      }
      if (isTopLevel && property.linkedForeign) {
        aggregatedClassMap[property.linkedForeign] = { className: property.linkedForeign, fieldId: property.name };
      }
      if (isTopLevel && property.linkedTaggedUnion) {
        aggregatedClassMap[property.linkedTaggedUnion] = { className: property.linkedTaggedUnion, fieldId: property.name };
      }

      const mapCardinality = (specific: number | undefined, generic: number | undefined, otherwise: number): number => {
        if (specific !== undefined) {
          return specific;
        } else if (generic !== undefined) {
          return generic;
        } else {
          return otherwise;
        }
      };

      return {
        fieldId: propKey,
        ...(property.linkedType && { linkedClass: property.linkedType }),
        ...(property.linkedTrait && { linkedClass: property.linkedTrait }),
        ...(property.linkedForeign && { linkedClass: property.linkedForeign }),
        ...(property.linkedTaggedUnion && { linkedClass: property.linkedTaggedUnion }),
        ...(property.linkedEnum && { linkedClass: property.linkedEnum }),
        ...(options?.fieldSetIndex !== undefined && { fieldSetIndex: options.fieldSetIndex }),
        ...(["Mandatory","Foreign"].includes(property.multiplicity) && {
          minMultiplicity: mapCardinality(property.minCardinality, property.cardinality, 1),
        }),
        ...(["Mandatory","Foreign"].includes(property.multiplicity) && {
          maxMultiplicity: mapCardinality(property.maxCardinality, property.cardinality, 1),
        }),
        ...(property.multiplicity === "Optional" && {
          minMultiplicity: mapCardinality(property.minCardinality, property.cardinality, 0),
        }),
        ...(property.multiplicity === "Optional" && {
          maxMultiplicity: mapCardinality(property.maxCardinality, property.cardinality, 1),
        }),
        ...(property.multiplicity === "Set" && {
          minMultiplicity: mapCardinality(property.minCardinality, property.cardinality, 0),
        }),
        ...(property.multiplicity === "Set" && {
          maxMultiplicity: mapCardinality(property.maxCardinality, property.cardinality, Infinity),
        }),
        ...(property.multiplicity === "Cardinality" && {
          minMultiplicity: mapCardinality(property.minCardinality, property.cardinality, 0),
        }),
        ...(property.multiplicity === "Cardinality" && {
          maxMultiplicity: mapCardinality(property.maxCardinality, property.cardinality, Infinity),
        }),
        ...(property.multiplicity === "List" && {
          minMultiplicity: mapCardinality(property.minCardinality, property.cardinality, 0),
        }),
        ...(property.multiplicity === "List" && {
          maxMultiplicity: mapCardinality(property.maxCardinality, property.cardinality, Infinity),
        }),
        ...(property.multiplicity === "Array" && { dimensions: property.dimensions }),
        type: property.type,
        multiplicity: property.multiplicity,
        inherited,
      };
    });
  };

  const ownClassFields = mapPropertyToMermaidClassField(properties, false);
  const inheritedClassFields = mapPropertyToMermaidClassField(inheritedProperties, true);
  const disjointClassFields = disjointProperties
    .map((fieldSet, index) => mapPropertyToMermaidClassField(fieldSet, false, { fieldSetIndex: index }))
    .flat();
  const associatedClasses = Object.values(associatedClassMap);
  const aggregatedClasses = Object.values(aggregatedClassMap);
  const inheritedClasses = (inherited && typeDefinition.inherits) || [];
  const enumValues = typeDefinition.enumValues?.map((enumValue): ClassField => {
    return {
      fieldId: enumValue,
      type: "string",
      multiplicity: "Mandatory",
      inherited: false,
    };
  });

  return {
    id,
    name,
    classType: typeDefinition.type,
    aggregatedClasses,
    associatedClasses,
    disjointClassFields,
    inheritedClasses,
    enumValues: enumValues ?? [],
    inheritedClassFields,
    ownClassFields,
  };
};

export const reduceMermaidClassDiagramParts = (schemaElements: SchemaModel, id: string): Array<ClassDefinition> => {
  const lookupTable: Record<string, string> = Object.keys(schemaElements).reduce(
    (obj, item) => ({ ...obj, [item]: `\`${item}\`` }),
    {}
  );

  const classReducer = (classDefinitions: Array<ClassDefinition>, classId: string): Array<ClassDefinition> => {
    const classDefinition = reduceClassDataFromTrait(
      schemaElements[classId]?.typeDefinition,
      lookupTable[classId],
      classId === id,
      true
    );
    const composedClasses =
      (classDefinition.inheritedClassFields.length > 0 &&
        classDefinition.inheritedClasses.reduce<Array<ClassDefinition>>((defs, classId) => classReducer(defs, classId), [])) || [];
    const composedClassDefinitions = composedClasses.filter(
      (inherited) => inherited.inheritedClassFields.length > 0 || inherited.ownClassFields.length > 0
    );
    const aggregatedClassDefinitions = classDefinition.aggregatedClasses
      .filter((c) => lookupTable[c.className])
      .map((c) =>
        reduceClassDataFromTrait(schemaElements[c.className]?.typeDefinition, lookupTable[c.className], c.className === id, false)
      );
    const associatedClassDefinitions = classDefinition.associatedClasses
      .filter((c) => lookupTable[c.className])
      .map((c) =>
        reduceClassDataFromTrait(schemaElements[c.className]?.typeDefinition, lookupTable[c.className], c.className === id, false)
      );
    [classDefinition, ...composedClassDefinitions, ...aggregatedClassDefinitions, ...associatedClassDefinitions].forEach(
      (classDef) => delete lookupTable[classDef.name]
    );

    return [
      ...classDefinitions,
      classDefinition,
      ...composedClassDefinitions,
      ...aggregatedClassDefinitions,
      ...associatedClassDefinitions,
    ];
  };

  const classList = [id].reduce(classReducer, []);
  // Filter out duplicates
  const classMap = classList.reduce(
    (classMap: Record<string, ClassDefinition>, item) => (classMap[item.name] && classMap) || { ...classMap, [item.name]: item },
    {}
  );
  return Object.values(classMap);
};


export const reduceMermaidClassArrayToMap = (classDefinitionArray: Array<ClassDefinition>): Record<string, ClassDefinition> =>
  classDefinitionArray.reduce((classes, classdefinition) => ({ ...classes, [classdefinition.name]: classdefinition }), {}) || {};

export const renderInheritedLinks = (id: string, delimiter: string, destinations: Array<string>, annotation?: string): string =>
  (destinations.length > 0 &&
    "  " +
      destinations
        .filter((dest) => dest && dest !== id)
        .map((dest) => `${id} ${delimiter} ${dest}${(annotation && " : " + annotation) || ""}`)
        .join("\n  ") +
      "\n") ||
  "";

export type EntityConnectionTypes = "LINK" | "COMPOSED" | "NONDECORATED_LINK";

export const renderConnection = (fieldName: string, type: EntityConnectionTypes) => {
  switch (type) {
    case "LINK":
      return t("schema-element-browser.links-to", { fieldId: fieldName });
    case "COMPOSED":
      return t("schema-element-browser.composes", { fieldId: fieldName });
    case "NONDECORATED_LINK":
      return t("schema-element-browser.nondecorated-link-to", { fieldId: fieldName });
    default:
      throw new Error(`Unknown connection type: ${type}`);
  }
};

export const renderLinkedFields = (
  id: string,
  delimiter: string,
  destinations: Array<FieldClass>,
  type: EntityConnectionTypes
): string => {
  return (
    (destinations.length > 0 &&
      "  " +
        destinations
          .filter((dest) => dest && dest.class !== id)
          .map((dest) => {
            const annotation = renderConnection(dest.field, type);
            return `${id} ${delimiter} ${dest.class}${(annotation && ` : ${annotation.replace(":", "∶")}`) || ""}`;
          })
          .join("\n  ") +
        "\n") ||
    ""
  );
};

export const renderMermaidChart = (mermaidMappedParts: Record<string, ClassDefinition>, traitName: string): string => {
  const classes = Object.keys(mermaidMappedParts);
  const index = classes.indexOf(traitName);
  if (index !== -1) {
    classes.splice(index, 1);
  }

  return renderMermaidClassDiagram([traitName, ...classes], mermaidMappedParts);
};

export const renderMermaidClassDiagram = (traitList: Array<string>, mappedClasses: Record<string, ClassDefinition>): string => {
  if (traitList.length === 0) return "";
  const m: Array<string> = [];
  m.push("classDiagram\n  direction BT\n");
  traitList.forEach((trait) => m.push(renderMermaidClass(mappedClasses[trait], mappedClasses)));
  const mermaidChart = m.join("");
  return mermaidChart;
};

export const renderMermaidChartFromTraits = (traits: SchemaModel, id: string): string => {
  const diagramParts = reduceMermaidClassDiagramParts(traits, id);
  const mermaidMappedParts: Record<string, ClassDefinition> = reduceMermaidClassArrayToMap(diagramParts);
  const mermaidChart = renderMermaidChart(mermaidMappedParts, id);
  return mermaidChart;
};

export const renderMermaidChartFromTraitSelection = (traits: SchemaModel, ids: Array<string>): string => {
  const diagramParts = ids.map((id) => {
    const inherited = (traits[id]?.typeDefinition?.inherits?.length ?? 0) > 0;
    return reduceClassDataFromTrait(traits[id]?.typeDefinition, `\`${id}\``, true, inherited);
  });
  const mermaidMappedParts: Record<string, ClassDefinition> = reduceMermaidClassArrayToMap(diagramParts);
  const mermaidChart = renderMermaidClassDiagram(ids, mermaidMappedParts);
  return mermaidChart;
};

export interface FieldClass {
  field: string;
  class: string;
}

export const renderMermaidClass = (
  classDefinition: ClassDefinition,
  classOrigNameLookup: Record<string, ClassDefinition>
): string => {
  const cd: Array<string> = [];
  const traitName = classDefinition.id;
  const nameToField = (c: ClassFieldInfo): FieldClass => {
    return { class: classOrigNameLookup[c.className]?.id ?? c.className, field: c.fieldId };
  };
  cd.push(
    renderInheritedLinks(
      traitName,
      MERMAID_DELIMITERS.inheritance,
      classDefinition.inheritedClasses.filter((c) => classOrigNameLookup[c]).map((name) => classOrigNameLookup[name]?.id),
      t("schema-element-browser.inherits")
    )
  );
  cd.push(
    renderLinkedFields(
      traitName,
      MERMAID_DELIMITERS.association,
      classDefinition.associatedClasses.filter((c) => classOrigNameLookup[c.className]).map(nameToField),
      "LINK"
    )
  );
  cd.push(
    renderLinkedFields(
      traitName,
      MERMAID_DELIMITERS.aggregation,
      classDefinition.aggregatedClasses.filter((c) => classOrigNameLookup[c.className]).map(nameToField),
      "COMPOSED"
    )
  );
  cd.push(renderClassDefinition(classDefinition));

  const mermaidClass = cd.join("");
  return mermaidClass;
};

const renderCardinality = (multiplicity: TerminusMultiplicityDefinitions, min?: number, max?: number) => {
  const supportedMultiplicity = multiplicity === "List" || multiplicity === "Set" || multiplicity === "Cardinality";
  if (!supportedMultiplicity) return "";
  if (min === 0 && max === Infinity) return "";
  if (min === max) return `｛${min}｝`;
  return `｛${min},${max === Infinity ? "∞" : max}｝`;
};

export const renderClassDefinition = (classDefinition: ClassDefinition) => {
  const d: Array<string> = [];

  const renderMultiplicity = (multiplicity: TerminusMultiplicityDefinitions, min?: number, max?: number, dimensions?: number) => {
    if (multiplicity === "List") {
      return `［≡］`;
    } else if (multiplicity === "Mandatory" || multiplicity === "Foreign") {
      return " ＊ ";
    } else if (multiplicity === "Set") {
      return `｛｝`;
    } else if (multiplicity === "Cardinality") {
      return `｛｝${renderCardinality(multiplicity, min, max)}`;
    } else if (multiplicity === "Optional") {
      return " ？ ";
    } else if (multiplicity === "Array") {
      return `［${dimensions ?? ""}］`;
    } else {
      return "";
    }
  };

  d.push(`  class ${classDefinition.id} {\n`);
  // FIXME: Fix getPropertyList to include inherited fields in complete list
  // and order the fields here too by the same order (includeRest = true)
  classDefinition.ownClassFields.forEach((field) => {
    if (field.type === "linkedType" || field.type === "linkedTrait" || field.type === "linkedEnum") {
      d.push(
        `    ＋ ${field.fieldId}${renderMultiplicity(
          field.multiplicity,
          field.minMultiplicity,
          field.maxMultiplicity,
          field.dimensions
        )} ${field.type === "linkedType" ? "🔗" : "¶"} ＜${field.linkedClass}＞\n`
      );
    } else if (field.type === "linkedForeign") {
      d.push(
        `    ＋ ${field.fieldId}${renderMultiplicity(
          field.multiplicity,
          field.minMultiplicity,
          field.maxMultiplicity,
          field.dimensions
        )} ${field.type === "linkedForeign" ? "⮑" : "¶"} ＜${field.linkedClass}＞\n`
      );
    } else {
      d.push(
        `    ＋ ${field.fieldId}${renderMultiplicity(
          field.multiplicity,
          field.minMultiplicity,
          field.maxMultiplicity,
          field.dimensions
        )} ＜${field.type === "JSON" ? "sys" : "xsd"}∶${field.type}＞\n`
      );
    }
  });
  classDefinition.disjointClassFields.forEach((field) => {
    if (field.type === "linkedType" || field.type === "linkedTrait" || field.type === "linkedEnum") {
      d.push(
        `    ⨁${field.fieldSetIndex !== undefined && replaceNumeralsWithSubscriptNumerals(String(field.fieldSetIndex))} ${
          field.fieldId
        }${renderMultiplicity(field.multiplicity, field.minMultiplicity, field.maxMultiplicity, field.dimensions)} ${
          field.type === "linkedType" ? "🔗" : "¶"
        } ＜${field.linkedClass}＞\n`
      );
    } else if (field.type === "linkedForeign") {
      d.push(
        `    ⨁${field.fieldSetIndex !== undefined && replaceNumeralsWithSubscriptNumerals(String(field.fieldSetIndex))} ${field.fieldId}${renderMultiplicity(
          field.multiplicity,
          field.minMultiplicity,
          field.maxMultiplicity,
          field.dimensions
        )} ${
          field.type === "linkedForeign" ? "⮑" : "¶"
        } ＜${field.linkedClass}＞\n`
      );
    } else {
      d.push(
        `    ⨁${field.fieldSetIndex !== undefined && replaceNumeralsWithSubscriptNumerals(String(field.fieldSetIndex))} ${
          field.fieldId
        }${renderMultiplicity(field.multiplicity, field.minMultiplicity, field.maxMultiplicity, field.dimensions)}＜${
          field.type === "JSON" ? "sys" : "xsd"
        }∶${field.type}＞\n`
      );
    }
  });
  classDefinition.inheritedClassFields.forEach((field) => {
    if (field.type === "linkedType" || field.type === "linkedTrait" || field.type === "linkedEnum") {
      d.push(
        `    ♢ ${field.fieldId}${renderMultiplicity(
          field.multiplicity,
          field.minMultiplicity,
          field.maxMultiplicity,
          field.dimensions
        )} ${field.type === "linkedType" ? "🔗" : "¶"} ＜${field.linkedClass}＞\n`
      );
    } else if (field.type === "linkedForeign") {
      d.push(
        `    ♢ ${field.fieldId}${renderMultiplicity(
          field.multiplicity,
          field.minMultiplicity,
          field.maxMultiplicity,
          field.dimensions
        )} ${field.type === "linkedForeign" ? "⮑" : "¶"} ＜${field.linkedClass}＞\n`
      );
    } else {
      // FIXME: Show as foreign here
      d.push(
        `    ♢ ${field.fieldId}${renderMultiplicity(
          field.multiplicity,
          field.minMultiplicity,
          field.maxMultiplicity,
          field.dimensions
        )} ＜${field.type === "JSON" ? "sys" : "xsd"}∶${field.type}＞\n`
      );
    }
  });
  classDefinition.enumValues?.forEach((field, index) => {
    const maxCount = MAX_ENUM_MERMAID;
    if (index < maxCount) {
      d.push(`    ▷ ${field.fieldId?.length > 25 ? `${field.fieldId?.slice(0, 25)}…` : field.fieldId}\n`);
    } else if (index === maxCount) {
      d.push(`    …(${t("schema-element-browser.first-ten-shown", { count: maxCount })})\n`);
    }
  });
  d.push(`  }\n`);

  const mermaidClassDefinition = d.join("");
  return mermaidClassDefinition;
};

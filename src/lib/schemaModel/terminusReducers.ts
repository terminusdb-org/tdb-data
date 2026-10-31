import {
  ITypeDefinition,
  ITypePropertyTranslatedDescriptions,
  TypeMetadataDescriptionObject,
  TypePropertyDefinition,
  TypePropertyDefinitions,
  TypePropertyDescription,
  SchemaElementKind,
} from "./types";
import { TerminusResponseObject } from "./types";

import { TypeMetadataAsObject, TypeMetadataLoaded, TypeMetadataParsed } from "./types";
import { DfrntTypeMetadata } from "./types";
import { isStringsArray } from "./fn";
import { tdbToJOthersMapping, zebraToOthersMapping } from "./mappings";

export type FirstObjectLevelTypeValues<T, V> = T extends object ? { [K in keyof T]: SecObjLev1<T[K], V> }[keyof T] : never;

export type SecondObjectLevelTypeValues<T, V> = T extends object ? { [K in keyof T]: SecObjLev0<T[K], V> }[keyof T] : never;
type SecObjLev0<T, V> = T extends object ? { [K in keyof T]: SecObjLev1<T[K], V> }[keyof T] : never;
type SecObjLev1<T, V> = Extract<T, V>;

export interface TdbToJOthersMapping {
  [tdb: string]: {
    jsonSchema: string;
    zebra: SupportedZebraTypes;
  };
}

export interface ZebraToOthersMapping {
  [jsonSchema: string]: {
    tdb: SupportedTerminusTypes;
    jsonSchema?: {
      type: string;
      minimum?: number;
      exclusiveMinimum?: number;
      maximum?: number;
      exclusiveMaximum?: number;
      format?: string;
      pattern?: string;
    };
  };
}

export type SupportedZebraLinkedTypes = "linkedTrait" | "linkedEnum" | "linkedType" | "linkedForeign" | "linkedTaggedUnion";


// FIXME: Check if adding TaggedUnion Here

/**
 * To edit types, in order (should consider generating the base data):
 * 1. Add to SupportedTerminusTypes
 * 1. Add to SupportedZebraTypes
 * 1. Add to zebraToOthersMapping
 * 1. Add to propertyDefinitions.json (should be generated)
 * 1. Add to DefinedProperties.json (should be generated)
 * 1. Copy propertyDefinitions from propertyDefinitions.json to:
 *    1. COPYFROMDEFINITIONschemaJsonSchemaType.json
 *    1. COPYFROMDEFINITIONschemaJsonSchemaTrait.json
 * 1. Copy definedProperties from DefinedProperties.json to:
 *    1. COPYFROMDEFINITIONschemaJsonSchemaType.json
 *    1. COPYFROMDEFINITIONschemaJsonSchemaTrait.json
 *    1. COPYFROMDEFINITIONschemaTypeJsonSchema.json
 * 1. Update parseTabularCell
 *    1. parseTabularCell.ts
 *
 * These are defined in https://www.w3.org/TR/xmlschema11-2/ 
 * Where there is also regular expressions!
 */
export type SupportedTerminusTypes =
  // TerminusDB Base Types: https://github.com/terminusdb/terminusdb/blob/main/src/core/triple/base_type.pl
  // Supported types list: https://terminusdb.com/docs/guides/reference-guides/terminusdb-data-types
  // TDB Core
  | "xsd:string" //   corresponds to JSON Schema - string
  | "xsd:boolean" //  corresponds to JSON Schema - boolean
  | "xsd:decimal" //  corresponds to JSON Schema - string (this was a change in TDB 11)
  | "xsd:integer" //  corresponds to JSON Schema - string (this was a change in TDB 11)
  // IEEE floating-point
  | "xsd:double" //   corresponds to JSON Schema - number
  | "xsd:float" //    corresponds to JSON Schema - number
  // Time and date
  | "xsd:date" //     corresponds to JSON Schema - string/date
  | "xsd:time" //     corresponds to JSON Schema - string/time
  | "xsd:dateTime" // corresponds to JSON Schema - string/date-time
  | "xsd:dateTimeStamp" // corresponds to JSON Schema - string/dateTimeStamp
  // Recurring and partial dates
  | "xsd:gYear" //                  --> string/signed int
  | "xsd:gMonth" //                 --> string/Implement as integer 1-12
  | "xsd:gDay" //          	        --> string/Implement as integer 1-31 --> (Month of Duodecember in BCE 46 had 34 days)
  | "xsd:gYearMonth" //             --> string/exists in TerminusDB ?? format?
  | "xsd:gMonthDay" //              --> string/exists in TerminusDB ?? format?
  | "xsd:duration" //               --> string/exists in TerminusDB ?? format?
  | "xsd:yearMonthDuration" //      --> string/exists in TerminusDB ?? format?
  | "xsd:dayTimeDuration" //        --> string/exists in TerminusDB ?? format?
  // Limited-range integer numbers
  | "xsd:byte" // corresponds to JSON Schema - number
  | "xsd:short" // corresponds to JSON Schema - number
  | "xsd:int" // corresponds to JSON Schema - number
  | "xsd:long" // corresponds to JSON Schema - string (WARNING: JSON support is shaky for longs)
  | "xsd:unsignedByte" // corresponds to JSON Schema - number
  | "xsd:unsignedShort" // corresponds to JSON Schema - number
  | "xsd:unsignedInt" // corresponds to JSON Schema - number
  | "xsd:unsignedLong" // corresponds to JSON Schema - number
  | "xsd:positiveInteger" // corresponds to JSON Schema - number
  | "xsd:nonNegativeInteger" // corresponds to JSON Schema - number
  | "xsd:negativeInteger" // corresponds to JSON Schema - number
  | "xsd:nonPositiveInteger" // corresponds to JSON Schema - number
  // Encoded binary data
  | "xsd:hexBinary"          //                               --> edit as strings
  | "xsd:base64Binary"       //                               --> edit as strings
  // Miscellaneous XSD types
  | "xsd:anyURI"             //                               --> edit as strings (validate as per IRI)
  | "xsd:language"           //                               --> edit as strings (validate as per BCP47)
  | "xsd:normalizedString"   //                               --> edit as strings
  | "xsd:token"              //                               --> edit as strings
  | "xsd:NMTOKEN"            //                               --> edit as strings
  | "xsd:Name"               //                               --> edit as strings
  | "xsd:NCName"             //                               --> edit as strings
  // Miscellaneous XDD types (TerminusDB extended datatypes)
  | "xdd:url" //              --> edit as string (IRI)
  | "xdd:email" //            --> edit as string
  | "xdd:html" //             --> edit as string
  | "xdd:json"               //- available in TerminusDB      --> edit as string
  | "xdd:coordinate" //         [lat,long]
  | "xdd:coordinatePolygon" //  [[lat,long],...]
  | "xdd:coordinatePolyline" // [[lat,long],...]
  | "xdd:dateRange" //          [start,end] dates
  | "xdd:dateTimeInterval" //   ISO interval string
  | "xdd:gYearRange" //         [start,end] years
  | "xdd:integerRange" //       [lo,hi] integers
  | "xdd:decimalRange" //       [lo,hi] decimals
  | "sys:JSON"          // Internal TerminusDB type allowing for any JSON
  | "xsd:anySimpleType" // Internal TerminusDB type allowing for any simple type
  | "linkedForeign" // For foreign references
  | "linkedType"
  | "linkedTrait"
  | "linkedEnum"
  | "linkedTaggedUnion";

  // FIXME: Check if adding TaggedUnion Here


export type SupportedZebraTypes =
  | SupportedZebraLinkedTypes
  | "string"
  | "boolean"
  | "decimal" // handled as strings
  | "integer" // handled as strings
  | "double"
  | "float"
  | "dateTime"
  | "date"
  | "time"
  | "dateTimeStamp"
  | "gYear"
  | "gMonth"
  | "gDay"
  | "gYearMonth"
  | "gMonthDay"
  | "duration"
  | "yearMonthDuration"
  | "dayTimeDuration"
  | "long"
  | "byte"
  | "short"
  | "int"
  | "unsignedByte"
  | "unsignedShort"
  | "unsignedInt"
  | "unsignedLong"
  | "positiveInteger"
  | "negativeInteger"
  | "nonPositiveInteger"
  | "nonNegativeInteger"
  | "hexBinary"       
  | "base64Binary"    
  | "anyURI"          
  | "language"        
  | "normalizedString"
  | "token"           
  | "NMTOKEN"         
  | "Name"            
  | "NCName"          
  | "JSON"
  // XDD extended datatypes (zebra names mirror the tdb suffix)
  | "url"
  | "email"
  | "html"
  | "coordinate"
  | "coordinatePolygon"
  | "coordinatePolyline"
  | "dateRange"
  | "dateTimeInterval"
  | "gYearRange"
  | "integerRange"
  | "decimalRange"
  ;

export interface TerminusSchemaObject {
  [propName: string]: TerminusSchema;
}

export interface TerminusSchemaDocumentation extends TerminusDocumentation {
  "@language"?: string;
  "@properties"?: Record<string, string | TerminusDocumentation>;
  "@values"?: Record<string, string | TerminusDocumentation>;
}

export interface TerminusDocumentation {
  "@label"?: string;
  "@authors"?: Array<string>;
  "@comment"?: string;
}

export type TerminusDbType = "Class" | "Enum" | "Foreign" | "TaggedUnion";
export interface TerminusSchema {
  "@id": string;
  "@key"?: {
    "@type": "Random" | "Lexical" | "Hash" | "ValueHash" | "UuidV7";
    "@fields"?: Array<string>; // Applicable only for "Lexical" and "Hash"
  };
  "@base"?: string;
  "@unfoldable"?: [];
  "@shared"?: [];
  "@metadata"?: TypeMetadataAsObject | unknown;
  "@value"?: Array<string>;
  "@values"?: Array<string>;
  "@documentation"?: TerminusSchemaDocumentation | Array<TerminusSchemaDocumentation>;
  "@type": TerminusDbType;
  "@abstract"?: [];
  "@subdocument"?: [];
  "@inherits"?: string | Array<string>;
  [proptype: string]: unknown | TerminusPropertyDefinition;
}

export interface ZebraParsedTerminusTypeDocumentation {
  properties: Record<string, TypePropertyDescription | string>;
  typeDoc: TypePropertyDescription;
}

export interface ZebraTypeDocumentation {
  default: ZebraParsedTerminusTypeDocumentation;
  translated: Record<string, ITypePropertyTranslatedDescriptions>;
  valuesMetaData?: Record<string, TypePropertyDescription>;
}

export type TerminusMultiplicityDefinitions =
  | "Optional"
  | "Mandatory"
  | "List"
  | "Set"
  | "Cardinality"
  | "Array"
  | "Foreign" /* TerminusDB returns a Foreign Multiplicity but must get Mandatory back (See bug TerminusDB bug #1832) */;

export interface TerminusPropertyDefinition {
  "@type": TerminusMultiplicityDefinitions;
  "@class": string | SupportedZebraLinkedTypes;
  "@cardinality"?: number;
  "@dimensions"?: number;
  "@min_cardinality"?: number;
  "@max_cardinality"?: number;
  "@min"?: number; // FIXME: min should probably not be there. Converted into min_cardinality, see terminusdb issue #1932
  "@max"?: number; // FIXME: max should probably not be there. Converted into max_cardinality, see terminusdb issue #1932
  "@unfold"?: boolean; // Field-level unfold on linked property specs
  zebraLinkedClass?: string;
}

export const getTerminusPropertyDefinition = (prop: unknown): TerminusPropertyDefinition => {
  if (prop && typeof prop === "object" && "@class" in prop) {
    const definedProp = prop as TerminusPropertyDefinition;
    if(definedProp["@type"] === "Foreign") {
      return {
        "@class": definedProp["@class"],
        "@type": "Foreign",
      };
    }
    const terminusdbPropertyDefinition = {
      "@class": definedProp["@class"],
      "@type": definedProp["@type"],
      ...(definedProp["@cardinality"] !== undefined && { "@cardinality": definedProp["@cardinality"] }),
      ...(definedProp["@min_cardinality"] !== undefined && { "@min_cardinality": definedProp["@min_cardinality"] }),
      ...(definedProp["@max_cardinality"] !== undefined && { "@max_cardinality": definedProp["@max_cardinality"] }),
      ...(definedProp["@min"] !== undefined && definedProp["@min"] !== 0 && { "@min_cardinality": definedProp["@min"] }),
      ...(definedProp["@max"] !== undefined && { "@max_cardinality": definedProp["@max"] }),
      ...(definedProp["@dimensions"] !== undefined && { "@dimensions": definedProp["@dimensions"] }),
    };
    // FIXME: This is due to Terminusdb issue #1932 too
    if (
      terminusdbPropertyDefinition["@min_cardinality"] &&
      terminusdbPropertyDefinition["@max_cardinality"] &&
      terminusdbPropertyDefinition["@min_cardinality"] === terminusdbPropertyDefinition["@max_cardinality"]
    ) {
      terminusdbPropertyDefinition["@cardinality"] = terminusdbPropertyDefinition["@min_cardinality"];
      delete terminusdbPropertyDefinition["@min_cardinality"];
      delete terminusdbPropertyDefinition["@max_cardinality"];
    }
    return terminusdbPropertyDefinition;
  } else if (typeof prop === "string") {
    return {
      "@class": prop,
      "@type": "Mandatory",
    };
  } else {
    throw new Error("Unknown response from TerminusDB");
  }
};

export const getCleanProperties = (
  terminusSchema: TerminusSchemaObject,
  c: TerminusSchema
): { [proptype: string]: TerminusPropertyDefinition } =>
  Object.keys(c).reduce((acc, key) => {
    if (!key.startsWith("@")) {
      const propDefinition = getTerminusPropertyDefinition(c[key]);
      const propertyClass = propDefinition["@class"];
      if (propertyClass in terminusSchema) {
        const propertySchemaClass = terminusSchema[propertyClass];
        if (propertySchemaClass["@subdocument"]) {
          propDefinition["zebraLinkedClass"] = propDefinition["@class"];
          propDefinition["@class"] = "linkedTrait";
        } else if (propertySchemaClass["@type"] === "Enum") {
          propDefinition["zebraLinkedClass"] = propDefinition["@class"];
          propDefinition["@class"] = "linkedEnum";
        } else if (propertySchemaClass["@type"] === "Foreign") {
          propDefinition["zebraLinkedClass"] = propDefinition["@class"];
          propDefinition["@class"] = "linkedForeign";
        } else if (propertySchemaClass["@type"] === "TaggedUnion") {
          propDefinition["zebraLinkedClass"] = propDefinition["@class"];
          propDefinition["@class"] = "linkedTaggedUnion";
        } else {
          propDefinition["zebraLinkedClass"] = propDefinition["@class"];
          propDefinition["@class"] = "linkedType";
        }
      } else if (typeof propertyClass === "string" && !(propertyClass in tdbToJOthersMapping) && !propertyClass.includes(":")) {
        // Dangling class reference — e.g. a Foreign hidden by TerminusDB
        // #1832, a deleted type still referenced (#860), or a link target
        // that has not been synthesised into the schema map yet. Keep it as
        // a linkedType pointing at the raw name instead of crashing.
        propDefinition["zebraLinkedClass"] = propertyClass;
        propDefinition["@class"] = "linkedType";
      }
      return Object.assign(acc, { [key]: propDefinition });
    } else {
      return acc;
    }
  }, {});

export const getZebraPropertyDefinition = (
  keyName: string,
  terminusProperty: TerminusPropertyDefinition,
  description: TypePropertyDescription
): TypePropertyDefinition => {
  const propertyType = getZebraPropertyValueType(terminusProperty["@class"] as SupportedTerminusTypes);

  const otherDefinitions = {
    ...(terminusProperty["@cardinality"] !== undefined && { cardinality: terminusProperty["@cardinality"] }),
    ...(terminusProperty["@max_cardinality"] !== undefined && { maxCardinality: terminusProperty["@max_cardinality"] }),
    ...(terminusProperty["@min_cardinality"] !== undefined && { minCardinality: terminusProperty["@min_cardinality"] }),
    multiplicity: terminusProperty["@type"],
    ...(description && Object.keys(description).length > 0 && { metaData: description }),
    ...(terminusProperty["@dimensions"] !== undefined && { dimensions: terminusProperty["@dimensions"] }),
    ...(terminusProperty["@unfold"] === true && { unfold: true }),
  };

  if (
    propertyType === "linkedType" ||
    propertyType === "linkedTrait" ||
    propertyType === "linkedEnum" ||
    propertyType === "linkedForeign" ||
    propertyType === "linkedTaggedUnion"
  ) {
    return {
      name: keyName,
      type: propertyType,
      ...(propertyType === "linkedType" && { linkedType: terminusProperty.zebraLinkedClass }),
      ...(propertyType === "linkedTrait" && { linkedTrait: terminusProperty.zebraLinkedClass }),
      ...(propertyType === "linkedForeign" && { linkedForeign: terminusProperty.zebraLinkedClass }),
      ...(propertyType === "linkedEnum" && { linkedEnum: terminusProperty.zebraLinkedClass }),
      ...(propertyType === "linkedTaggedUnion" && { linkedTaggedUnion: terminusProperty.zebraLinkedClass }),
      ...otherDefinitions,
    };
  } else {
    return {
      name: keyName,
      type: propertyType,
      ...otherDefinitions,
    };
  }
};

const getZebraPropertyValueType = (tdbPropertyType: SupportedTerminusTypes): SupportedZebraTypes => {
  if (tdbToJOthersMapping[tdbPropertyType] !== undefined) {
    return tdbToJOthersMapping[tdbPropertyType].zebra;
  } else if (
    tdbPropertyType === "linkedType" ||
    tdbPropertyType === "linkedTrait" ||
    tdbPropertyType === "linkedEnum" ||
    tdbPropertyType === "linkedForeign" ||
    tdbPropertyType === "linkedTaggedUnion"
  ) {
    return tdbPropertyType;
  } else {
    // Example: trait deleted but still referenced from type, see terminusdb issue #860
    // FIXME: These kinds of errors should show up in the user interface (through logger?)
    // FIXME: Also make it possible to workaround and accept the errors, we are likely too strict atm
    throw new Error(`TerminusDB schema error, type not supported: ` + tdbPropertyType);
  }
};

const getTerminusPropertyValue = (zebraPropertyType: SupportedZebraTypes | undefined): SupportedTerminusTypes | undefined => {
  if (zebraPropertyType === undefined) {
    return undefined;
  }
  if (zebraToOthersMapping[zebraPropertyType]) {
    return zebraToOthersMapping[zebraPropertyType].tdb;
  } else if (
    zebraPropertyType === "linkedType" ||
    zebraPropertyType === "linkedTrait" ||
    zebraPropertyType === "linkedEnum" ||
    zebraPropertyType === "linkedForeign"
  ) {
    return zebraPropertyType;
  } else {
    throw new Error("Internal error, some type not supported: " + zebraPropertyType);
  }
};

const getTerminusLinkedType = (e: TypePropertyDefinition): string => {
  if (e.linkedType) {
    return e.linkedType;
  } else if (e.linkedTrait) {
    return e.linkedTrait;
  } else if (e.linkedEnum) {
    return e.linkedEnum;
  } else if (typeof e.linkedForeign === "string") {
    return e.linkedForeign;
  } else if (e.linkedTaggedUnion) {
    return e.linkedTaggedUnion;
  } else {
    throw new Error("Unsupported type for " + JSON.stringify(e));
  }
};

export const castTerminusValue = (pd: TypePropertyDefinition) => {
  const otherDefinitions = {
    ...(pd.cardinality !== undefined && { "@cardinality": pd.cardinality }),
    ...(pd.minCardinality !== undefined && { "@min_cardinality": pd.minCardinality }),
    ...(pd.maxCardinality !== undefined && { "@max_cardinality": pd.maxCardinality }),
    ...(pd.dimensions !== undefined && { "@dimensions": pd.dimensions }),
  };
  // FIXME: Check if adding TaggedUnion Here
  const zebraCustomizedTerminusType =
    pd.type === "linkedType" || pd.type === "linkedTrait" || pd.type === "linkedEnum" || pd.type === "linkedForeign" || pd.type === "linkedTaggedUnion";
  const zebraTerminusValue = zebraCustomizedTerminusType ? getTerminusLinkedType(pd) : getTerminusPropertyValue(pd.type);

  if (pd.multiplicity === "Mandatory") {
    return {
      [pd.name]: zebraTerminusValue,
    };
  } else if (pd.multiplicity === "Foreign") {
    // Workaround to enable adding Foreign with Foreign multiplicity due to terminusdb bug #1832
    return {
      [pd.name]: {
        "@class": zebraTerminusValue,
        "@type": "Foreign",
        "@id": zebraTerminusValue,
        ...otherDefinitions,
      },
    };
  } else {
    return {
      [pd.name]: {
        "@class": zebraTerminusValue,
        "@type": pd.multiplicity,
        ...otherDefinitions,
        ...(pd.unfold && { "@unfold": true }),
      },
    };
  }
};

export const mapProperties = (typeDefinitionProperties: TypePropertyDefinitions): { [proptype: string]: string } => {
  return Object.keys(typeDefinitionProperties).reduce((acc, key) => {
    const e = typeDefinitionProperties[key];
    return Object.assign(
      {
        ...castTerminusValue(e),
      },
      acc
    );
  }, {});
};

const reduceZebraPropertyDescriptionToTerminus = (
  typeDoc: TypePropertyDescription | undefined
): TerminusDocumentation | string | undefined => {
  if (typeof typeDoc === "object" && ("comment" in typeDoc || "label" in typeDoc)) {
    return {
      ...(typeDoc?.label !== undefined && { "@label": typeDoc?.label }),
      ...(typeDoc?.comment !== undefined && { "@comment": typeDoc?.comment }),
    };
  } else if (typeof typeDoc === "object" && "description" in typeDoc && typeDoc.description !== undefined) {
    return typeDoc.description;
  } else {
    return undefined;
  }
};

const reduceZebraDescriptionToTerminus = (
  propertyMetaData: TypeMetadataDescriptionObject | undefined
): undefined | TerminusDocumentation => {
  if (
    typeof propertyMetaData === "object" &&
    ("comment" in propertyMetaData || "authors" in propertyMetaData || "label" in propertyMetaData)
  ) {
    return {
      ...(propertyMetaData?.label !== undefined && { "@label": propertyMetaData?.label }),
      ...(propertyMetaData?.authors !== undefined && { "@authors": propertyMetaData?.authors }),
      ...(propertyMetaData?.comment !== undefined && { "@comment": propertyMetaData?.comment }),
    };
  } else {
    return undefined;
  }
};

const assemblePropertyDescriptions = (
  properties: TypePropertyDefinitions
): Record<string, TerminusDocumentation | string> | undefined => {
  return Object.keys(properties).reduce((acc: Record<string, TerminusDocumentation | string>, name) => {
    const terminusDocumentationField = reduceZebraPropertyDescriptionToTerminus(properties[name].metaData);
    if (!terminusDocumentationField) return acc;
    acc[properties[name].name] = terminusDocumentationField;
    return acc;
  }, {});
};

export const parseZebraTypeMetadata = (metadata: TypeMetadataLoaded | undefined): TypeMetadataAsObject | unknown | undefined => {
  if (typeof metadata === "undefined") {
    return undefined;
  } else if (metadata.parsed) {
    return {
      ...metadata.parsed,
      ...(("DFRNT" in metadata.parsed &&
        metadata.parsed.DFRNT &&
        typeof metadata.parsed.DFRNT === "object" &&
        !Array.isArray(metadata.parsed.DFRNT) && { DFRNT: parseDfrntMetadata(metadata.parsed.DFRNT) }) ||
        {}),
    };
  } else {
    return metadata.unparsed;
  }
};

export const reduceZebraSchemaTypeToTerminusType = (zebraType: SchemaElementKind): TerminusDbType => {
  switch (zebraType) {
    case "type":
      return "Class";
    case "trait":
      return "Class";
    case "enumtrait":
      return "Enum";
    case "foreign":
      return "Foreign";
    case "taggedunion":
      return "TaggedUnion";
  }
};

export const reduceZebraTypeDocTranslationsToTerminus = (
  translations: Record<string, ITypePropertyTranslatedDescriptions>,
  isEnumType: boolean
): Array<TerminusSchemaDocumentation> => {
  const translationArray = Object.keys(translations).reduce((translationAcc: Array<TerminusSchemaDocumentation>, lang) => {
    const translation = translations[lang];

    const terminusTypeMetadata = reduceZebraDescriptionToTerminus(translation.metaData);
    const terminusPropertyDescriptions = Object.keys(translation.propertyDocumentation).reduce(
      (properties: Record<string, string | TerminusDocumentation>, propName) => {
        const terminusProperty = reduceZebraPropertyDescriptionToTerminus(translation.propertyDocumentation[propName]);
        if (terminusProperty) {
          properties[propName] = terminusProperty;
        }
        return properties;
      },
      {}
    );

    translationAcc.push({
      ...(terminusTypeMetadata && { ...(typeof terminusTypeMetadata !== "string" ? { ...terminusTypeMetadata } : undefined) }),
      ...(Object.keys(terminusPropertyDescriptions).length > 0 && {
        [isEnumType ? "@values" : "@properties"]: terminusPropertyDescriptions,
      }),
      "@language": lang,
    });
    return translationAcc;
  }, []);

  return translationArray;
};

export const reduceZebraTypeDocDocumentationToTerminus = (t: ITypeDefinition, isEnumType: boolean): TerminusSchemaDocumentation => {
  const assembledDefaultPropertyDescriptions = isEnumType
    ? t.valuesMetadata &&
      t.enumValues?.reduce((acc: Record<string, TerminusDocumentation | string>, enumValue) => {
        const terminusValueDescription = t.valuesMetadata && reduceZebraPropertyDescriptionToTerminus(t.valuesMetadata[enumValue]);
        if (terminusValueDescription) {
          acc[enumValue] = terminusValueDescription;
        }
        return acc;
      }, {})
    : assemblePropertyDescriptions(t.propertyDefinitions ?? {});
  const assembledDefaultPropertyOneOfDescriptions = (
    t.propertyDefinitionsOneOf && t.propertyDefinitionsOneOf.length > 0 ? t.propertyDefinitionsOneOf : undefined
  )
    ?.map((definition) => assemblePropertyDescriptions(definition ?? {}))
    .reduce((a, b) => ({ ...a, ...b }), {});

  const assembledPropertyDescriptions = {
    ...assembledDefaultPropertyDescriptions,
    ...assembledDefaultPropertyOneOfDescriptions,
  };

  const typeDescriptions = reduceZebraDescriptionToTerminus(t.metaData);

  return {
    ...(Object.keys(assembledPropertyDescriptions).length > 0 && {
      [isEnumType ? "@values" : "@properties"]: assembledPropertyDescriptions,
    }),
    ...typeDescriptions,
  };
};

export const reduceZebraTypeDocsToTerminusDocumentation = (t: ITypeDefinition): Array<TerminusSchemaDocumentation> | undefined => {
  // First assembly the default property descriptions

  // Then tackle the translations
  const isEnumType = (t.enumValues?.length ?? 0) > 0;
  const defaultPropertyDescription: TerminusSchemaDocumentation = reduceZebraTypeDocDocumentationToTerminus(t, isEnumType);

  const terminusDocumentationTranslations: Array<TerminusSchemaDocumentation> = reduceZebraTypeDocTranslationsToTerminus(
    t.translations ?? {},
    isEnumType
  );

  const documentation: Array<TerminusSchemaDocumentation> = [
    ...((Object.keys(defaultPropertyDescription).length > 0 && [defaultPropertyDescription]) || []),
    ...terminusDocumentationTranslations,
  ];

  return documentation.length > 0 ? documentation : undefined;
};

export const reduceZebraSchemaToTerminus = (t: ITypeDefinition): TerminusSchema => {
  const typeType = reduceZebraSchemaTypeToTerminusType(t.type);
  const terminusDocumentation = reduceZebraTypeDocsToTerminusDocumentation(t);
  const metadata = parseZebraTypeMetadata(t.typeMetadata);

  return {
    ...{ "@type": typeType },
    ...(!t.enumValues &&
      typeType === "Class" && {
        "@key": {
          "@type": t.keyDefinition?.type ?? "Random",
          ...((t.keyDefinition?.includedFields && { "@fields": t.keyDefinition?.includedFields }) || {}),
        },
      }),
    "@id": t.id,
    ...(metadata !== undefined && { "@metadata": metadata }),
    ...(typeof t.base === "string" && { "@base": t.base }),
    ...(t.unfoldable && { "@unfoldable": [] }),
    ...(t.isShared && { "@shared": [] }),
    ...(t.inherits && { "@inherits": t.inherits }),
    ...(t.isAbstract && { "@abstract": [] }),
    ...(t.type === "trait" && { "@subdocument": [] }),

    ...(terminusDocumentation && { "@documentation": terminusDocumentation }),

    ...(t.propertyDefinitions && mapProperties(t.propertyDefinitions)),
    ...(t.propertyDefinitionsOneOf &&
      t.propertyDefinitionsOneOf.length > 0 && {
        "@oneOf": t.propertyDefinitionsOneOf.map((propertyDefinitions) => mapProperties(propertyDefinitions)),
      }),
    ...(t.enumValues && { "@value": t.enumValues }),
  };
};

const getValueAsArray = <T>(value: T | Array<T> | undefined): Array<T> => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};
const reduceTerminusToTypePropertyDescriptionFields = (
  doc: string | { "@label"?: string; "@comment"?: string }
): TypePropertyDescription => {
  return (
    (typeof doc === "string" && { description: doc }) || {
      ...(typeof doc !== "string" && doc["@label"] !== undefined && { label: doc["@label"] }),
      ...(typeof doc !== "string" && doc["@comment"] !== undefined && { comment: doc["@comment"] }),
    }
  );
};

const reduceTerminusToTypeDescriptionFields = (
  doc: string | { "@label"?: string; "@authors"?: Array<string>; "@comment"?: string }
): TypePropertyDescription | TypeMetadataDescriptionObject => {
  return (
    (typeof doc === "string" && { description: doc }) || {
      ...(typeof doc !== "string" && doc["@label"] !== undefined && { label: doc["@label"] }),
      ...(typeof doc !== "string" && doc["@authors"] !== undefined && { authors: doc["@authors"] }),
      ...(typeof doc !== "string" && doc["@comment"] !== undefined && { comment: doc["@comment"] }),
    }
  );
};

const getPropertyDescriptions = (
  propDescriptions: TerminusSchemaDocumentation | Array<TerminusSchemaDocumentation> | undefined
): ZebraTypeDocumentation => {
  const terminusPropertyDocumentation = getValueAsArray<TerminusSchemaDocumentation>(propDescriptions);

  const reduceTerminusPropertyDocs = (
    properties:
      | undefined
      | Record<
          string,
          | string
          | {
              "@label"?: string | undefined;
              "@comment"?: string | undefined;
            }
        >
  ) =>
    !properties
      ? {}
      : Object.keys(properties).reduce((acc: Record<string, TypePropertyDescription>, key) => {
          if (properties) {
            acc[key] = reduceTerminusToTypePropertyDescriptionFields(properties[key]);
          }
          return acc;
        }, {});

  const zebraTypeDoc: ZebraTypeDocumentation = {
    default: {
      properties: {},
      typeDoc: {},
    },
    translated: {},
  };

  terminusPropertyDocumentation.forEach((langProp) => {
    const lang = langProp["@language"];
    const properties = langProp["@values"]
      ? reduceTerminusPropertyDocs(langProp["@values"])
      : reduceTerminusPropertyDocs(langProp["@properties"]) ?? undefined;
    const typeDoc = reduceTerminusToTypeDescriptionFields(langProp);
    if (lang) {
      zebraTypeDoc.translated[lang] = {
        propertyDocumentation: properties,
        metaData: "comment" in typeDoc || "label" in typeDoc || "authors" in typeDoc ? typeDoc : {},
      };
    } else {
      zebraTypeDoc.default = { properties, typeDoc };
    }
  });

  return zebraTypeDoc;
};

const inheritedTypeNames = (inherited: Array<string> | string | undefined): Array<string> | undefined => {
  if (typeof inherited === "string") {
    return [inherited];
  } else if (Array.isArray(inherited)) {
    return inherited;
  } else {
    return undefined;
  }
};

const parseDfrntMetadata = (obj: object): DfrntTypeMetadata => {
  const dfrntTypeMetadata: DfrntTypeMetadata = {};
  if ("version" in obj && typeof obj.version === "string") {
    dfrntTypeMetadata.version = obj.version;
  }
  if ("hexRgbBackground" in obj && typeof obj.hexRgbBackground === "string") {
    dfrntTypeMetadata.hexRgbBackground = obj.hexRgbBackground;
  }
  if ("labelPropertyOverride" in obj && typeof obj.labelPropertyOverride === "string") {
    dfrntTypeMetadata.labelPropertyOverride = obj.labelPropertyOverride;
  }
  if ("labelOverride" in obj && typeof obj.labelOverride === "string") {
    dfrntTypeMetadata.labelOverride = obj.labelOverride;
  }
  if ("propertyDisplayOrder" in obj && Array.isArray(obj.propertyDisplayOrder) && isStringsArray(obj.propertyDisplayOrder)) {
    dfrntTypeMetadata.propertyDisplayOrder = obj.propertyDisplayOrder;
  }
  if ("reversedEdgeDirection" in obj && Array.isArray(obj.reversedEdgeDirection) && isStringsArray(obj.reversedEdgeDirection)) {
    dfrntTypeMetadata.reversedEdgeDirection = obj.reversedEdgeDirection;
  }
  return dfrntTypeMetadata;
};

export const parseTypeMetadata = (metadata: TypeMetadataAsObject | unknown | undefined): TypeMetadataLoaded | undefined => {
  if (typeof metadata === "undefined") {
    return undefined;
  } else if (
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    Object.keys(metadata).filter((key) => typeof key === "string").length > 0
  ) {
    const parsedTypeMetadata: TypeMetadataParsed = {
      parsed: {
        ...metadata,
        ...(("DFRNT" in metadata &&
          metadata.DFRNT &&
          typeof metadata.DFRNT === "object" &&
          !Array.isArray(metadata.DFRNT) && { DFRNT: parseDfrntMetadata(metadata.DFRNT) }) ||
          {}),
      },
    } as TypeMetadataParsed;
    return parsedTypeMetadata;
  } else {
    return {
      unparsed: metadata,
    };
  }
};

export const reduceTerminusTypeToZebraType = (
  terminusType: TerminusDbType,
  subDocumentKey: [] | undefined
): SchemaElementKind => {
  if (terminusType === "Class" && Array.isArray(subDocumentKey)) {
    return "trait";
  } else if (terminusType === "Enum") {
    return "enumtrait";
  } else if (terminusType === "Foreign") {
    return "foreign";
  } else if (terminusType === "Class") {
    return "type";
  } else if (terminusType === "TaggedUnion") {
    return "taggedunion";
  } else {
    throw new Error(`Unknown terminus type: ${terminusType}`);
  }
};

export const reduceTerminusSchemaToZebra = (terminusSchema: TerminusSchemaObject, key: string): ITypeDefinition => {
  const c = terminusSchema[key];
  const properties = getCleanProperties(terminusSchema, c);

  const typeDocumentation: ZebraTypeDocumentation = getPropertyDescriptions(c["@documentation"]);
  //   (c["@documentation"] && c["@documentation"]["@properties"]) ?? {}
  // );
  const schemaFinalType = reduceTerminusTypeToZebraType(c["@type"], c["@subdocument"]);
  const metadata = parseTypeMetadata(c["@metadata"]);
  return {
    id: c["@id"],
    ...((Object.keys(typeDocumentation.default.typeDoc).length > 0 && {
      metaData: {
        ...((("comment" in typeDocumentation.default.typeDoc || "label" in typeDocumentation.default.typeDoc) &&
          typeDocumentation.default.typeDoc) ||
          {}),
      },
    }) ||
      {}),
    ...((Object.keys(typeDocumentation.translated).length > 0 && { translations: typeDocumentation.translated }) || undefined),
    ...((metadata && { typeMetadata: metadata }) || undefined),
    ...((typeof c["@base"] === "string" && { base: c["@base"] }) || undefined),
    ...((c["@unfoldable"] && { unfoldable: true }) || undefined),
    ...((c["@shared"] && { isShared: true }) || undefined),
    type: schemaFinalType,
    ...((c["@key"] && {
      keyDefinition: {
        type: c["@key"]?.["@type"] ?? "Random",
        ...(c["@key"]["@fields"] && { includedFields: c["@key"]["@fields"] }),
      },
    }) ||
      {}),
    ...(schemaFinalType === "enumtrait" && Array.isArray(c["@value"] ?? c["@values"]) && { enumValues: c["@value"] ?? c["@values"] }),
    ...(c["@type"] === "Enum" && {
      valuesMetadata: (c["@value"] ?? c["@values"] ?? []).reduce((acc, pd) => {
        const propertyDocumentation = typeDocumentation.default.properties[pd];
        return Object.assign(acc, {
          [pd]: typeof propertyDocumentation === "string" ? { description: propertyDocumentation } : { ...propertyDocumentation },
        });
      }, {}),
    }),
    ...(Array.isArray(c["@abstract"]) && { isAbstract: true }),
    ...(c["@inherits"] && { inherits: inheritedTypeNames(c["@inherits"]) }),
    ...(Object.keys(properties).length > 0 &&
      c["@type"] !== "Enum" && {
        propertyDefinitions: Object.keys(properties).reduce((acc, pd) => {
          const propertyDocumentation = typeDocumentation.default.properties[pd];
          // EDITED HERE. ASSUMING IT COMES IN EARLIER!
          return Object.assign(acc, {
            [pd]: getZebraPropertyDefinition(pd, properties[pd], {
              ...(typeof propertyDocumentation === "string"
                ? { description: propertyDocumentation }
                : { ...propertyDocumentation }),
            }),
          });
        }, {}),
      }),
    ...(typeof c["@oneOf"] === "object" &&
      c["@type"] !== "Enum" && {
        propertyDefinitionsOneOf: (Array.isArray(c["@oneOf"]) ? c["@oneOf"] : [c["@oneOf"]]).map((oneOfSegment: TerminusSchema) => {
          const properties = getCleanProperties(terminusSchema, oneOfSegment);
          return Object.keys(properties).reduce((acc, pd) => {
            const propertyDocumentation = typeDocumentation.default.properties[pd];
            return Object.assign(acc, {
              [pd]: getZebraPropertyDefinition(pd, properties[pd], {
                ...(typeof propertyDocumentation === "string"
                  ? { description: propertyDocumentation }
                  : { ...propertyDocumentation }),
              }),
            });
          }, {});
        }),
      }),
  };
};

export const zebraTypeJsonReducer = (zebraTypeJson: string): ITypeDefinition => {
  const p = JSON.parse(zebraTypeJson);
  return {
    ...(p.id && { id: p.id }),
    ...(p.type && { type: p.type }),
    ...(p.inherits && { inherits: p.inherits }),
    ...(p.isAbstract && { isAbstract: p.isAbstract }),
    ...(p.base && { base: p.base }),
    ...(p.unfoldable && { unfoldable: p.unfoldable }),
    ...(p.metaData && { metaData: p.metaData }),
    ...(p.subsumed && { subsumed: p.subsumed }),
    ...(p.enumValues && { enumValues: p.enumValues }),
    ...(p.keyDefinition && { keyDefinition: p.keyDefinition }),
    ...(p.typeMetadata && { typeMetadata: p.typeMetadata }),
    ...(p.valuesMetadata && { valuesMetadata: p.valuesMetadata }),
    ...(p.translations && { translations: p.translations }),
    ...(p.propertyDefinitionsOneOf &&
      p.propertyDefinitionsOneOf.length > 0 && { propertyDefinitionsOneOf: p.propertyDefinitionsOneOf }),
    ...(p.propertyDefinitions && { propertyDefinitions: p.propertyDefinitions }),
    ...(p.inheritedPropertyDefinitions && { inheritedPropertyDefinitions: p.inheritedPropertyDefinitions }),
    ...(p.inheritedPropertyDefinitionsOneOf && { inheritedPropertyDefinitionsOneOf: p.inheritedPropertyDefinitionsOneOf }),
  };
};

export const terminusTypeJsonReducer = (zebraTypeJson: string): TerminusResponseObject => {
  const p = JSON.parse(zebraTypeJson);
  return {
    ...(p["@id"] && { "@id": p["@id"] }),
    ...(p["@type"] && { "@type": p["@type"] }),
    ...p,
  };
};

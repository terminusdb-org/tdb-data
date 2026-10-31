import type { SupportedZebraTypes, TerminusMultiplicityDefinitions } from "./terminusReducers";

export interface TypePropertyDefinition {
  name: string;
  type: SupportedZebraTypes;
  multiplicity: TerminusMultiplicityDefinitions;
  linkedForeign?: string;
  linkedTaggedUnion?: string;
  linkedTrait?: string;
  linkedType?: string;
  linkedEnum?: string;
  cardinality?: number;
  minCardinality?: number;
  maxCardinality?: number;
  dimensions?: number;
  /** Field-level @unfold on a linked property spec. */
  unfold?: boolean;
  metaData?: TypePropertyDescription;
}

export type TypePropertyDescription = TypePropertyDescriptionObject | TypePropertyDescriptionString;

export interface TypePropertyDescriptionObject {
  label?: string;
  comment?: string;
}

export interface TypeMetadataDescriptionObject extends TypePropertyDescriptionObject {
  authors?: Array<string>;
}

export interface TypePropertyDescriptionString {
  description?: string;
}

export interface TypePropertyDefinitions {
  [propName: string]: TypePropertyDefinition;
}
export interface TypePropertyDescriptions {
  [propName: string]: TypePropertyDescription;
}
export type SchemaElementKind = "type" | "trait" | "enumtrait" | "foreign" | "taggedunion";

export interface KeyTypeDefinition {
  type: "Random" | "Lexical" | "Hash" | "ValueHash" | "UuidV7";
  includedFields?: Array<string>;
}

export interface ITypeDefinitionBare {
  id: string;
  keyDefinition?: KeyTypeDefinition;
  inherits?: Array<string>;
  subsumed?: Array<string>;
  isAbstract?: boolean;
  /** Reference-counted shared document (@shared marker). */
  isShared?: boolean;
  base?: string;
  valuesMetadata?: TypePropertyDescriptions;
  unfoldable?: true;
  type: SchemaElementKind;
  enumValues?: Array<string>;
  metaData?: TypeMetadataDescriptionObject;
  translations?: Record<string, ITypePropertyTranslatedDescriptions>;
  typeMetadata?: TypeMetadataLoaded;
}

export interface ITypePropertyTranslatedDescriptions {
  metaData: TypeMetadataDescriptionObject;
  propertyDocumentation: Record<string, TypePropertyDescription>;
}

export interface ITypeDefinition extends ITypeDefinitionBare {
  propertyDefinitions?: TypePropertyDefinitions;
  propertyDefinitionsOneOf?: Array<TypePropertyDefinitions>;
  inheritedPropertyDefinitions?: TypePropertyDefinitions;
  inheritedPropertyDefinitionsOneOf?: Array<TypePropertyDefinitions>;
}

export interface IZebraSchema {
  [propName: string]: ITypeDefinition;
}

export interface ModelElement {
  id: string;
  label: string;
  description: string;
  type: SchemaElementKind;
  path?: string;
  typeDefinition: ITypeDefinition;
}

export interface SchemaModel {
  [propName: string]: ModelElement;
}

export interface TypeConfigurationOptions {
  hexRgbBackground?: string;
  propertyDisplayOrder?: Array<string>;
  reversedEdgeDirection?: Array<string>;
}

export interface DfrntSchemaExtensions extends TypeConfigurationOptions {
  labelOverride?: string;
  labelPropertyOverride?: string | Array<string>;
}

export type DfrntTypeMetadata = DfrntSchemaExtensions & {
  [property: string]: never | unknown;
  version?: string;
};

export type TypeMetadataLoaded = TypeMetadataParsed | TypeMetadataUnparsed;

export interface TypeMetadataParsed {
  parsed: TypeMetadataAsObject;
  unparsed?: never;
}

export interface TypeMetadataUnparsed {
  parsed?: never;
  unparsed: unknown;
}

export type TypeMetadataAsObject = {
  [property: string]: never | unknown | undefined;
  DFRNT?: DfrntTypeMetadata;
  tags?: Record<string, unknown>;
};

export type TerminusResponseObject = Record<string, unknown>;

import { reduceTerminusSchemaToZebra, reduceZebraSchemaToTerminus, TerminusSchemaObject } from "./terminusReducers";
import { ITypeDefinition, SchemaModel } from "./types";

export const indexTerminusClasses = (input: TerminusSchemaObject): TerminusSchemaObject => {
  return Object.keys(input)
    .filter((key) => !!input[key]["@id"])
    .map((key) => input[key])
    .reduce(
      (acc, item) => ({
        ...acc,
        [item["@id"] as string]: item,
      }),
      {}
    );
};

// Compute inherited propertyDefinitions for the schema. Fail loud on malformed input.
export const reduceZebraSchemaFromTerminusSchema = (schema: TerminusSchemaObject): SchemaModel => {
  const terminusClasses = indexTerminusClasses(schema);
  const model = Object.keys(terminusClasses).reduce((typesAcc: SchemaModel, typeKey) => {
    const classItem = reduceTerminusSchemaToZebra(terminusClasses, typeKey);
    typesAcc[typeKey] = {
      id: typeKey,
      label: typeKey,
      description: `SchemaElement ${typeKey}`,
      type: classItem.type,
      typeDefinition: classItem,
    };
    // Calculate inherited properties for all types
    const getTypeDefinitionsForInheritedTypes = (td: ITypeDefinition): Array<ITypeDefinition> => {
      const inheritedTypeDefinitions: Array<ITypeDefinition> =
        td.inherits?.reduce((acc: Array<ITypeDefinition>, parentType) => {
          const parentTypeDefinition = terminusClasses[parentType] && reduceTerminusSchemaToZebra(terminusClasses, parentType);
          if (parentTypeDefinition) {
            acc.push(parentTypeDefinition);
            if (parentTypeDefinition.inherits) {
              acc.push(...getTypeDefinitionsForInheritedTypes(parentTypeDefinition));
            }
            return acc;
          }
          return acc;
        }, []) ?? [];
      return inheritedTypeDefinitions;
    };

    const inheritedTypeDefinitions = getTypeDefinitionsForInheritedTypes(classItem);
    const inheritedTypeDefinitionProperties = inheritedTypeDefinitions.reduce((acc, inheritedTypeDefinition) => {
      return { ...acc, ...inheritedTypeDefinition.propertyDefinitions };
    }, {});
    const inheritedTypeDefinitionOneOfProperties = inheritedTypeDefinitions.reduce(
      (acc, inheritedTypeDefinition) => ({ ...acc, ...inheritedTypeDefinition.propertyDefinitionsOneOf }),
      {}
    );
    typesAcc[typeKey].typeDefinition.inheritedPropertyDefinitions = inheritedTypeDefinitionProperties;
    if (Array.isArray(inheritedTypeDefinitionOneOfProperties) && inheritedTypeDefinitionOneOfProperties.length > 0) {
      typesAcc[typeKey].typeDefinition.inheritedPropertyDefinitionsOneOf = inheritedTypeDefinitionOneOfProperties;
    }
    return typesAcc;
  }, {});
  // Second pass: build the "subsumed" reverse index — order-independent since all elements exist.
  Object.keys(model).forEach((typeKey) => {
    model[typeKey].typeDefinition.inherits?.forEach((parentType) => {
      if (model[parentType]) {
        model[parentType].typeDefinition.subsumed = Array.from(
          new Set([...(model[parentType].typeDefinition.subsumed ?? []), typeKey])
        );
      }
    });
  });
  return model;
};

export const reduceTerminusSchemaFromZebraSchema = (schemaElements: SchemaModel): TerminusSchemaObject => {
  return Object.keys(schemaElements).reduce((acc: TerminusSchemaObject, elementName) => {
    const zebraSchema = reduceZebraSchemaToTerminus(schemaElements[elementName].typeDefinition);
    acc[elementName] = zebraSchema;
    return acc;
  }, {});
};

export const reduceTerminusSchemaFromTypeDefinitions = (typeDefinitions: Array<ITypeDefinition>): TerminusSchemaObject => {
  return typeDefinitions.reduce((acc: TerminusSchemaObject, element) => {
    const zebraSchema = reduceZebraSchemaToTerminus(element);
    acc[element.id] = zebraSchema;
    return acc;
  }, {});
};

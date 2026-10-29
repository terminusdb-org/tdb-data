import { TdbToJOthersMapping, ZebraToOthersMapping } from "./terminusReducers";

export const zebraToOthersMapping: ZebraToOthersMapping = {
  // TDB Core
  string: {
    jsonSchema: {
      type: "string",
    },
    tdb: "xsd:string",
  },
  boolean: {
    jsonSchema: {
      type: "boolean",
    },
    tdb: "xsd:boolean",
  },
  decimal: {
    jsonSchema: {
      type: "string",
      pattern: "^-?[0-9]+(\\.[0-9]+)?$",
    },
    tdb: "xsd:decimal",
  },
  integer: {
    jsonSchema: {
      type: "string",
      pattern: "^-?[0-9]+$",
    },
    tdb: "xsd:integer",
  },
  // IEEE floating-point
  double: {
    jsonSchema: {
      type: "number",
    },
    tdb: "xsd:double",
  },
  float: {
    jsonSchema: {
      type: "number",
    },
    tdb: "xsd:float",
  },
  // Time and date
  date: {
    jsonSchema: {
      type: "string",
      format: "date",
    },
    tdb: "xsd:date",
  },
  time: {
    jsonSchema: {
      type: "string",
      format: "time",
    },
    tdb: "xsd:time",
  },
  dateTime: {
    jsonSchema: {
      type: "string",
      format: "date-time",
    },
    tdb: "xsd:dateTime",
  },
  dateTimeStamp: {
    jsonSchema: {
      type: "string",
      format: "date-time",
    },
    tdb: "xsd:dateTimeStamp",
  },
  // Recurring and partial dates
  gYear: {
    jsonSchema: {
      type: "string",
      pattern: "^-?[0-9]+$"
    },
    tdb: "xsd:gYear",
  },
  gMonth: {
    jsonSchema: {
      type: "string",
      pattern: "^(0?[1-9]|1[0-2])$"
    },
    tdb: "xsd:gMonth",
  },
  gDay: {
    jsonSchema: {
      type: "string",
      pattern: "^(0?[1-9]|[12][0-9]|3[01])$"
    },
    tdb: "xsd:gDay",
  },
  gYearMonth: {
    jsonSchema: {
      type: "string",
    },
    tdb: "xsd:gYearMonth",
  },
  gMonthDay: {
    jsonSchema: {
      type: "string",
    },
    tdb: "xsd:gMonthDay",
  },
  duration: {
    jsonSchema: {
      type: "string",
      format: "duration"
    },
    tdb: "xsd:duration",
  },
  yearMonthDuration: {
    jsonSchema: {
      type: "string",
    },
    tdb: "xsd:yearMonthDuration",
  },
  dayTimeDuration: {
    jsonSchema: {
      type: "string",
    },
    tdb: "xsd:dayTimeDuration",
  },
  // Limited-range integer numbers
  byte: {
    jsonSchema: {
      type: "integer",
      minimum: -128,
      maximum: 127,
    },
    tdb: "xsd:byte",
  },
  short: {
    jsonSchema: {
      type: "integer",
      minimum: -32768,
      maximum: 32767,
    },
    tdb: "xsd:short",
  },
  int: {
    jsonSchema: {
      type: "integer",
      minimum: -2147483648,
      maximum: 2147483647,
    },
    tdb: "xsd:int",
  },
  long: {
    jsonSchema: {
      type: "string",
      pattern: "^-?+?[0-9]+$"
    },
    tdb: "xsd:long",
  },
  unsignedByte: {
    jsonSchema: {
      type: "integer",
      minimum: 0,
      maximum: 255,
    },
    tdb: "xsd:unsignedByte",
  },
  unsignedShort: {
    jsonSchema: {
      type: "integer",
      minimum: 0,
      maximum: 65535,
    },
    tdb: "xsd:unsignedShort",
  },
  unsignedInt: {
    jsonSchema: {
      type: "integer",
      minimum: 0,
      maximum: 4294967295,
    },
    tdb: "xsd:unsignedInt",
  },
  unsignedLong: {
    jsonSchema: {
      type: "string",
      pattern: "^+?[0-9]+$"
    },
    tdb: "xsd:unsignedLong",
  },
  positiveInteger: {
    jsonSchema: {
      type: "integer",
      exclusiveMinimum: 0,
    },
    tdb: "xsd:positiveInteger",
  },
  nonNegativeInteger: {
    jsonSchema: {
      type: "integer",
      minimum: 0,
    },
    tdb: "xsd:nonNegativeInteger",
  },
  negativeInteger: {
    jsonSchema: {
      type: "integer",
      exclusiveMaximum: 0,
    },
    tdb: "xsd:negativeInteger",
  },
  nonPositiveInteger: {
    jsonSchema: {
      type: "integer",
      maximum: 0,
    },
    tdb: "xsd:nonPositiveInteger",
  },
  // Encoded binary data
  hexBinary: {
    jsonSchema: {
      type: "string",
    },
    tdb: "xsd:hexBinary",
  },
  base64Binary: {
    jsonSchema: {
      type: "string",
    },
    tdb: "xsd:base64Binary",
  },
  anyURI: {
    jsonSchema: {
      type: "string",
    },
    tdb: "xsd:anyURI",
  },
  anySimpleType: {
    jsonSchema: {
      type: "string",
    },
    tdb: "xsd:anySimpleType",
  },
  language: {
    jsonSchema: {
      type: "string",
    },
    tdb: "xsd:language",
  },
  normalizedString: {
    jsonSchema: {
      type: "string",
    },
    tdb: "xsd:normalizedString",
  },
  token: {
    jsonSchema: {
      type: "string",
    },
    tdb: "xsd:token",
  },
  NMTOKEN: {
    jsonSchema: {
      type: "string",
    },
    tdb: "xsd:NMTOKEN",
  },
  Name: {
    jsonSchema: {
      type: "string",
    },
    tdb: "xsd:Name",
  },
  NCName: {
    jsonSchema: {
      type: "string",
    },
    tdb: "xsd:NCName",
  },
  xddJson: {
    tdb: "xdd:json",
  },
  JSON: {
    tdb: "sys:JSON",
  },
  linkedForeign: {
    jsonSchema: {
      type: "string",
    },
    tdb: "linkedForeign",
  },
  // Miscellaneous XDD types (THESE ARE DEPRECATED IN TERMINUSDB)
  // tdb: "xdd:url",
  // tdb: "xdd:email",
  // xdd:json - available in TerminusDB as sys:JSON --> edit as string
  // xdd:html - available in TerminusDB           --> edit as string
  // xdd:dateRange
  // xdd:gYearRange
  // xdd:integerRange
  // xdd:decimalRange
  // tdb: "xdd:coordinate",
  // tdb: "xdd:coordinatePolygon",
  // tdb: "xdd:coordinatePolyline",
};

export const tdbToJOthersMapping: TdbToJOthersMapping = Object.keys(zebraToOthersMapping).reduce((acc, key) => {
  const tdbKey = zebraToOthersMapping[key].tdb;
  const validatesAsAnyJson = {};
  return Object.assign(acc, {
    [tdbKey]: {
      zebra: key,
      jsonSchema: zebraToOthersMapping[key].jsonSchema || validatesAsAnyJson,
    },
  });
}, {});

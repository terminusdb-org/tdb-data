// @vitest-environment node
import { describe, expect, it } from "vitest";
import { apiErrorType, describeApiError } from "./apiErrors";

describe("describeApiError", () => {
  it("extracts type, verbatim message and details from an object payload", () => {
    const error = {
      status: 400,
      data: {
        "@type": "api:ErrorResponse",
        "api:status": "api:failure",
        "api:message": "weakening check failed",
        "api:error": { "@type": "api:WeakeningFailure", detail: { x: 1 } },
      },
    };
    const detail = describeApiError(error);
    expect(detail.type).toBe("api:WeakeningFailure");
    expect(detail.message).toBe("weakening check failed");
    expect(detail.detailsJson).toContain("api:WeakeningFailure");
  });

  it("parses a JSON-string payload (text responseHandler)", () => {
    const error = {
      status: 400,
      data: JSON.stringify({
        "api:message": "schema check failure",
        "api:error": { "@type": "api:SchemaCheckFailure" },
      }),
    };
    const detail = describeApiError(error);
    expect(apiErrorType(error)).toBe("api:SchemaCheckFailure");
    expect(detail.type).toBe("api:SchemaCheckFailure");
    expect(detail.message).toBe("schema check failure");
  });

  it("falls back to envelope @type when api:error is absent", () => {
    const detail = describeApiError({ status: 500, data: { "@type": "api:ErrorResponse", "api:message": "boom" } });
    expect(detail.type).toBe("api:ErrorResponse");
    expect(detail.message).toBe("boom");
  });

  it("degrades gracefully for non-API errors", () => {
    const detail = describeApiError(new Error("nope"));
    expect(detail.type).toBeNull();
    expect(detail.message).toBe("nope");
  });
});

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildEmbeddingsByTypeQuery } from "./projectionApi";

describe("buildEmbeddingsByTypeQuery", () => {
  it("builds URL with no query params when docTypes is omitted", () => {
    const result = buildEmbeddingsByTypeQuery({
      path: "/api/plugin/search-embeddings/admin/db/local/branch/main",
    });
    expect(result).toBe(
      "/api/plugin/search-embeddings/admin/db/local/branch/main"
    );
  });

  it("builds URL with no query params when docTypes is empty", () => {
    const result = buildEmbeddingsByTypeQuery({
      path: "/api/plugin/search-embeddings/admin/db/local/branch/main",
      docTypes: [],
    });
    expect(result).toBe(
      "/api/plugin/search-embeddings/admin/db/local/branch/main"
    );
  });

  it("builds URL with doc_types param for a single type", () => {
    const result = buildEmbeddingsByTypeQuery({
      path: "/api/plugin/search-embeddings/admin/db/local/branch/main",
      docTypes: ["Product"],
    });
    expect(result).toBe(
      "/api/plugin/search-embeddings/admin/db/local/branch/main?doc_type=Product"
    );
  });

  it("builds URL with repeated doc_type params for multiple types", () => {
    const result = buildEmbeddingsByTypeQuery({
      path: "/api/plugin/search-embeddings/admin/db/local/branch/main",
      docTypes: ["Product", "Customer"],
    });
    expect(result).toBe(
      "/api/plugin/search-embeddings/admin/db/local/branch/main?doc_type=Product&doc_type=Customer"
    );
  });

  it("encodes special characters in doc type names", () => {
    const result = buildEmbeddingsByTypeQuery({
      path: "/api/plugin/search-embeddings/admin/db/local/branch/main",
      docTypes: ["My Type"],
    });
    expect(result).toBe(
      "/api/plugin/search-embeddings/admin/db/local/branch/main?doc_type=My%20Type"
    );
  });
});

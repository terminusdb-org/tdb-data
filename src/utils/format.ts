import * as prettier from "prettier/standalone";
import graphqlPlugin from "prettier/plugins/graphql";
import handlebarsPlugin from "prettier/plugins/glimmer";
import Handlebars from "handlebars";

export async function formatGraphql(code: string): Promise<string> {
  try {
    return await prettier.format(code, {
      parser: "graphql",
      plugins: [graphqlPlugin],
      tabWidth: 2,
    });
  } catch (err) {
    throw new Error(`GraphQL format error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function formatHandlebars(code: string): Promise<string> {
  try {
    return await prettier.format(code, {
      parser: "glimmer",
      plugins: [handlebarsPlugin],
      tabWidth: 2,
    });
  } catch (err) {
    throw new Error(`Handlebars format error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function renderHandlebars(template: string, data: unknown): string {
  try {
    const compiled = Handlebars.compile(template);
    return compiled(data);
  } catch (err) {
    throw new Error(`Handlebars render error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

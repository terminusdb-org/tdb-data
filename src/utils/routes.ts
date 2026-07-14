import type { RefType } from "@/store/dataProductSlice";

export interface RouteParams {
  readonly org: string;
  readonly team: string;
  readonly refType: RefType;
  readonly refName: string;
}

export function buildApiPath(params: RouteParams, suffix: string): string {
  const { org, team, refType, refName } = params;
  return `/api/${suffix}/${org}/${team}/local/${refType}/${refName}`;
}

export function buildRouteBase(params: RouteParams): string {
  const { org, team, refType, refName } = params;
  const base = configBasePath();
  return `${base}/${org}/${team}/local/${refType}/${refName}`;
}

export function buildRoutePath(params: RouteParams): string {
  const { org, team, refType, refName } = params;
  return `/${org}/${team}/local/${refType}/${refName}`;
}

export function configBasePath(): string {
  return (import.meta.env.BASE_URL ?? "/app/data").replace(/\/$/, "");
}


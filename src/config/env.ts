interface AppConfig {
  readonly apiUrl: string;
  readonly tdbUser: string;
  readonly basePath: string;
}

interface RuntimeEnv {
  readonly VITE_TDB_URL?: string;
  readonly VITE_TDB_USER?: string;
  readonly VITE_BASE_PATH?: string;
}

declare global {
  interface Window {
    __ENV__?: RuntimeEnv;
  }
}

function getEnvVar(name: keyof RuntimeEnv): string | undefined {
  if (typeof window !== "undefined" && window.__ENV__) {
    const runtimeValue = window.__ENV__[name];
    if (typeof runtimeValue === "string" && !runtimeValue.includes("PLACEHOLDER")) {
      return runtimeValue;
    }
  }
  const buildValue = import.meta.env[name];
  if (typeof buildValue === "string" && !buildValue.includes("PLACEHOLDER")) {
    return buildValue;
  }
  return undefined;
}

function loadConfig(): AppConfig {
  const tdbUrl = getEnvVar("VITE_TDB_URL") ?? "";
  const tdbUser = getEnvVar("VITE_TDB_USER") ?? "admin";
  const basePath = (getEnvVar("VITE_BASE_PATH") ?? import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

  return {
    apiUrl: tdbUrl.length > 0 ? tdbUrl.replace(/\/$/, "") : "",
    tdbUser,
    basePath,
  };
}

export const config: AppConfig = loadConfig();
export type { AppConfig };

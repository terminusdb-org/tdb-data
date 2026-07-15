import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRunWoqlMutation, useGetIndexStatusQuery } from "@/store";
import { buildApiPath, type RouteParams } from "@/utils/routes";

export const StatusBar: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [runWoql] = useRunWoqlMutation();

  const org = params.org;
  const team = params.team;
  const branch = params.branch;
  const commitId = params.commitId;

  const refType = branch ? "branch" : commitId ? "commit" : null;
  const refName = branch ?? commitId ?? null;

  const routeParams: RouteParams | null = useMemo(() => {
    if (!org || !team || !refType || !refName) return null;
    return { org, team, refType, refName };
  }, [org, team, refType, refName]);

  const indexPath = routeParams ? buildApiPath(routeParams, "index") : "";
  const { data: indexStatus } = useGetIndexStatusQuery(
    { path: indexPath },
    { skip: !routeParams }
  );

  const [stats, setStats] = React.useState<{
    tripleCount: number | null;
    storageSize: number | null;
    typeCount: number | null;
  }>({ tripleCount: null, storageSize: null, typeCount: null });

  React.useEffect(() => {
    if (!routeParams) {
      setStats({ tripleCount: null, storageSize: null, typeCount: null });
      return;
    }

    const fetchStats = async () => {
      try {
        const woqlPath = buildApiPath(routeParams, "woql");

        const tripleQuery = {
          "@type": "Count",
          query: {
            "@type": "And",
            and: [
              {
                "@type": "Triple",
                subject: { "@type": "NodeValue", variable: "Subject" },
                predicate: { "@type": "NodeValue", node: "rdf:type" },
                object: { "@type": "Value", variable: "Type" },
              },
            ],
          },
          count: { "@type": "Value", variable: "Count" },
        };

        const tripleResult = await runWoql({ path: woqlPath, query: tripleQuery }).unwrap();
        const countVal = tripleResult?.bindings?.[0]?.Count;
        let tripleCount: number | null = null;
        if (typeof countVal === "number") {
          tripleCount = countVal;
        } else if (countVal && typeof countVal === "object" && "@value" in countVal) {
          const v = (countVal as Record<string, unknown>)["@value"];
          if (typeof v === "number") {
            tripleCount = v;
          } else if (typeof v === "string") {
            const parsed = Number.parseInt(v, 10);
            tripleCount = Number.isNaN(parsed) ? null : parsed;
          }
        }

        const typeQuery = {
          "@type": "And",
          and: [
            {
              "@type": "IsA",
              element: { "@type": "NodeValue", variable: "Subject" },
              type: { "@type": "NodeValue", variable: "Type" },
            },
          ],
        };

        const typeResult = await runWoql({ path: woqlPath, query: typeQuery }).unwrap();
        const typeSet = new Set<string>();
        for (const b of typeResult?.bindings ?? []) {
          const t = String(b["Type"] ?? "");
          if (t) typeSet.add(t);
        }

        setStats({
          tripleCount,
          storageSize: null,
          typeCount: typeSet.size,
        });
      } catch {
        setStats({ tripleCount: null, storageSize: null, typeCount: null });
      }
    };

    fetchStats();
  }, [routeParams, runWoql]);

  if (!routeParams) {
    return (
      <footer className="flex h-8 items-center border-t border-gray-200 bg-white px-4 text-xs text-gray-400">
        Select a data product to view statistics
      </footer>
    );
  }

  const buildLink = (segment: string): string => {
    const base = `/${org}/${team}/local/${refType}/${refName}`;
    return segment ? `${base}/${segment}` : base;
  };

  const handleClick = (segment: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(buildLink(segment));
  };

  return (
    <footer className="flex h-8 items-center gap-4 border-t border-gray-200 bg-white px-4 text-xs text-gray-500">
      <span className="font-medium text-gray-700">
        {org}/{team}
      </span>
      <span className="text-gray-300">|</span>
      <button type="button" onClick={handleClick("index-stats")} className="hover:text-dfrntBlue-600 hover:underline">
        Triples:{" "}
        <span className="font-data font-medium text-gray-700">
          {stats.tripleCount !== null ? stats.tripleCount.toLocaleString() : "—"}
        </span>
      </button>
      <button type="button" onClick={handleClick("index-stats")} className="hover:text-dfrntBlue-600 hover:underline">
        Indexed:{" "}
        <span className="font-data font-medium text-gray-700">
          {indexStatus?.engine?.searchable_documents != null ? indexStatus.engine.searchable_documents.toLocaleString() : "—"}
        </span>
      </button>
      <span className="text-gray-300">|</span>
      <button type="button" onClick={handleClick("doctypes")} className="hover:text-dfrntBlue-600 hover:underline">
        Types: <span className="font-data font-medium">{stats.typeCount !== null ? stats.typeCount : "—"}</span>
      </button>
      <button type="button" onClick={handleClick("documents")} className="hover:text-dfrntBlue-600 hover:underline">
        Documents
      </button>
      <button type="button" onClick={handleClick("raw")} className="hover:text-dfrntBlue-600 hover:underline">
        Raw JSON
      </button>
    </footer>
  );
};

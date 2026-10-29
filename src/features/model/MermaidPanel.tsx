import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SchemaModel } from "@/lib/schemaModel/types";
import { renderMermaidChartFromTraits } from "@/lib/schemaModel/mermaid";
import { notify } from "@/store/notificationSlice";
import { useAppDispatch } from "@/store";

interface Props {
  model: SchemaModel;
  elementId: string;
  onNavigate: (id: string) => void;
}

// Lazy mermaid import keeps ~500kB out of the main bundle. Zoom state lives in
// a CSS transform; "fit" recomputes scale from the rendered SVG's real size.
export function MermaidPanel({ model, elementId, onNavigate }: Props) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const outerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [hasSvg, setHasSvg] = useState(false);

  const fit = () => {
    const svg = containerRef.current?.querySelector("svg");
    const outer = outerRef.current;
    if (!svg || !outer) return;
    const bbox = svg.getBBox();
    const w = bbox.width || svg.clientWidth || 1;
    const next = Math.min(1, outer.clientWidth / (w + 40));
    setZoom(Number(next.toFixed(2)));
  };

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setHasSvg(false);
    const render = async () => {
      try {
        const definition = renderMermaidChartFromTraits(model, elementId);
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: "default",
          class: { useMaxWidth: false },
          themeVariables: { fontSize: "11px" },
        });
        const { svg } = await mermaid.render(`model-mermaid-${elementId}-${Date.now()}`, definition);
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        // Click a class box to navigate — mermaid 12 emits one g.node per class.
        containerRef.current.querySelectorAll("g.node").forEach((group) => {
          const label = group.querySelector(".label text, .label foreignObject, text")?.textContent?.trim() ?? "";
          const target = model[label] ? label : Object.keys(model).find((id) => label.startsWith(id) || id === label.replace(/\s.*$/, ""));
          if (target) {
            (group as SVGGElement).style.cursor = "pointer";
            group.addEventListener("click", () => onNavigate(target));
          }
        });
        setHasSvg(true);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        dispatch(notify({ severity: "error", title: t("model.diagram.renderFailed"), message: msg }));
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [model, elementId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fit once the SVG lands.
  useEffect(() => {
    if (hasSvg) fit();
  }, [hasSvg]); // eslint-disable-line react-hooks/exhaustive-deps

  const clamp = (z: number) => Math.min(3, Math.max(0.1, Number(z.toFixed(2))));
  const btnCls = "rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800";

  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <button type="button" className={btnCls} onClick={() => setZoom((z) => clamp(z - 0.15))} aria-label={t("model.diagram.zoomOut")}>
          −
        </button>
        <span className="w-12 text-center font-mono text-[11px] text-gray-500">{Math.round(zoom * 100)}%</span>
        <button type="button" className={btnCls} onClick={() => setZoom((z) => clamp(z + 0.15))} aria-label={t("model.diagram.zoomIn")}>
          +
        </button>
        <button type="button" className={btnCls} onClick={fit} aria-label={t("model.diagram.fit")}>
          {t("model.diagram.fit")}
        </button>
        <button type="button" className={btnCls} onClick={() => setZoom(1)} aria-label={t("model.diagram.actual")}>
          100%
        </button>
      </div>
      {error && <div className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
      <div ref={outerRef} className="overflow-auto" style={{ maxHeight: "70vh" }}>
        <div
          ref={containerRef}
          aria-label={t("model.diagram.ariaLabel")}
          style={{ transform: `scale(${zoom})`, transformOrigin: "0 0", width: `${100 / zoom}%` }}
        />
      </div>
    </div>
  );
}

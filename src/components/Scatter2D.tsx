import React, { useMemo, useState } from "react";
import { DeckGL } from "@deck.gl/react";
import { OrthographicView } from "@deck.gl/core";
import { ScatterplotLayer, TextLayer } from "@deck.gl/layers";

export interface ScatterPoint {
  readonly id: string;
  readonly position: [number, number];
  readonly color: [number, number, number];
  readonly radius: number;
  readonly docType: string;
}

export interface Scatter2DProps {
  readonly points: ReadonlyArray<ScatterPoint>;
  readonly selectedId: string | null;
  readonly highlightedIds: ReadonlySet<string>;
  readonly selectionIds?: ReadonlySet<string>;
  readonly workingSetIds?: ReadonlySet<string>;
  readonly workingSetVisible?: boolean;
  readonly dimmedTypes: ReadonlySet<string>;
  readonly onSelect: (id: string | null) => void;
  readonly onHover?: (id: string | null) => void;
  readonly width: number;
  readonly height: number;
}

export const Scatter2D: React.FC<Scatter2DProps> = ({
  points,
  selectedId,
  highlightedIds,
  selectionIds,
  workingSetIds,
  workingSetVisible = true,
  dimmedTypes,
  onSelect,
  onHover,
  width,
  height,
}) => {
  const selectionSet = useMemo(() => selectionIds ?? new Set<string>(), [selectionIds]);
  const wsSet = useMemo(() => workingSetIds ?? new Set<string>(), [workingSetIds]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const layers = useMemo(() => {
    const selectedPoints = (points as ScatterPoint[]).filter((d) => selectionSet.has(d.id));
    const labeledPoints = (points as ScatterPoint[]).filter(
      (d) => selectionSet.has(d.id) || highlightedIds.has(d.id) || selectedId === d.id || hoveredId === d.id
    );
    const wsPoints = workingSetVisible ? (points as ScatterPoint[]).filter((d) => wsSet.has(d.id) && !selectionSet.has(d.id)) : [];
    const hoveredPoints = (points as ScatterPoint[]).filter((d) => hoveredId === d.id);
    return [
      // Working set marker layer — blue ring for working set members (not selected)
      new ScatterplotLayer({
        id: "scatter-2d-working-set",
        data: wsPoints,
        getPosition: (d: ScatterPoint) => d.position,
        getFillColor: [0, 0, 0, 0],
        getRadius: (d: ScatterPoint) => d.radius * 2.5,
        stroked: true,
        getLineColor: [59, 130, 246, 160],
        getLineWidth: 1.5,
        pickable: false,
        radiusUnits: "pixels",
        lineWidthUnits: "pixels",
      }),
      // Halo/ring layer for locally selected points — rendered behind main layer
      new ScatterplotLayer({
        id: "scatter-2d-selection-halo",
        data: selectedPoints,
        getPosition: (d: ScatterPoint) => d.position,
        getFillColor: [255, 215, 0, 60],
        getRadius: (d: ScatterPoint) => d.radius * 3.5,
        stroked: true,
        getLineColor: [255, 165, 0, 220],
        getLineWidth: 2,
        pickable: false,
        radiusUnits: "pixels",
        lineWidthUnits: "pixels",
      }),
      new ScatterplotLayer({
        id: "scatter-2d",
        data: points as ScatterPoint[],
        getPosition: (d: ScatterPoint) => d.position,
        getFillColor: (d: ScatterPoint) => {
          if (selectionSet.has(d.id)) {
            return [d.color[0], d.color[1], d.color[2], 255];
          }
          if (dimmedTypes.has(d.docType)) {
            return [d.color[0], d.color[1], d.color[2], 38];
          }
          return [d.color[0], d.color[1], d.color[2], 200];
        },
        getRadius: (d: ScatterPoint) => {
          if (highlightedIds.has(d.id)) return d.radius * 2;
          if (selectionSet.has(d.id)) return d.radius * 1.8;
          if (selectedId === d.id) return d.radius * 1.5;
          return d.radius;
        },
        stroked: true,
        getLineColor: (d: ScatterPoint) => {
          if (highlightedIds.has(d.id)) return [255, 99, 71, 255];
          if (selectionSet.has(d.id)) return [255, 165, 0, 255];
          if (selectedId === d.id) return [30, 58, 138, 255];
          return [0, 0, 0, 0];
        },
        getLineWidth: (d: ScatterPoint) => {
          if (highlightedIds.has(d.id)) return 2;
          if (selectionSet.has(d.id)) return 2;
          if (selectedId === d.id) return 1.5;
          return 0;
        },
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 80],
        onHover: (info: { object?: ScatterPoint; x: number; y: number }) => {
          if (info.object) {
            setHoveredId(info.object.id);
            onHover?.(info.object.id);
          } else {
            setHoveredId(null);
            onHover?.(null);
          }
        },
        onClick: (info: { object?: ScatterPoint }) => {
          if (info.object) {
            onSelect(info.object.id);
          } else {
            onSelect(null);
          }
        },
        radiusUnits: "pixels",
        lineWidthUnits: "pixels",
      }),
      // Golden hover halo — rendered on top of main layer
      new ScatterplotLayer({
        id: "scatter-2d-hover-halo",
        data: hoveredPoints,
        getPosition: (d: ScatterPoint) => d.position,
        getFillColor: [255, 215, 0, 100],
        getRadius: (d: ScatterPoint) => d.radius * 3,
        stroked: true,
        getLineColor: [255, 193, 7, 255],
        getLineWidth: 2,
        pickable: false,
        radiusUnits: "pixels",
        lineWidthUnits: "pixels",
      }),
      // Text labels for selected/highlighted/hovered points only
      // Uses pixelOffset to position above the point in screen space,
      // not world coordinates which would be tiny in UMAP space.
      new TextLayer({
        id: "scatter-2d-labels",
        data: labeledPoints,
        getPosition: (d: ScatterPoint) => d.position,
        getText: (d: ScatterPoint) => d.id,
        getColor: (d: ScatterPoint) => {
          if (selectionSet.has(d.id)) return [180, 83, 9, 255];
          if (highlightedIds.has(d.id)) return [255, 99, 71, 255];
          if (selectedId === d.id) return [30, 58, 138, 255];
          return [60, 60, 60, 200];
        },
        getSize: 12,
        getAnchor: "middle",
        getAlignmentBaseline: "bottom",
        getTextAnchor: "middle",
        pixelOffset: [0, -12],
        pickable: false,
        sizeUnits: "pixels",
        outlineWidth: 2,
        outlineColor: [255, 255, 255, 200],
      }),
    ];
  }, [points, selectedId, highlightedIds, selectionSet, wsSet, workingSetVisible, dimmedTypes, onSelect, onHover, hoveredId]);

  const views = useMemo(() => [new OrthographicView({ id: "main", controller: true })], []);

  const initialViewState = useMemo(() => ({
    main: {
      target: [0, 0, 0] as [number, number, number],
      zoom: 1,
      minZoom: -10,
      maxZoom: 20,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any, []);

  return (
    <div className={hoveredId ? "scatter-cursor-pointer" : "scatter-cursor-grab"} style={{ width, height, background: "#fafafa" }}>
      <style>{`
        .scatter-cursor-pointer canvas { cursor: pointer !important; }
        .scatter-cursor-grab canvas { cursor: grab !important; }
      `}</style>
      <DeckGL
        layers={layers}
        views={views}
        initialViewState={initialViewState}
        width={width}
        height={height}
      />
    </div>
  );
};

import React, { useMemo, useState } from "react";
import { DeckGL } from "@deck.gl/react";
import { OrbitView } from "@deck.gl/core";
import { PointCloudLayer, LineLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";

export interface Point3D {
  readonly id: string;
  readonly position: [number, number, number];
  readonly color: [number, number, number];
  readonly radius: number;
  readonly docType: string;
}

export interface Scatter3DProps {
  readonly points: ReadonlyArray<Point3D>;
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

export const Scatter3D: React.FC<Scatter3DProps> = ({
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
  const selectionSet = selectionIds ?? new Set<string>();
  const wsSet = workingSetIds ?? new Set<string>();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const layers = useMemo(() => {
    const selectedPoints = (points as Point3D[]).filter((d) => selectionSet.has(d.id));
    const labeledPoints = (points as Point3D[]).filter(
      (d) => selectionSet.has(d.id) || highlightedIds.has(d.id) || selectedId === d.id || hoveredId === d.id
    );
    const wsPoints = workingSetVisible ? (points as Point3D[]).filter((d) => wsSet.has(d.id) && !selectionSet.has(d.id)) : [];
    const hoveredPoints = (points as Point3D[]).filter((d) => hoveredId === d.id);
    return [
      // Working set marker layer — blue ring for working set members (not selected)
      new PointCloudLayer({
        id: "scatter-3d-working-set",
        data: wsPoints,
        getPosition: (d: Point3D) => d.position,
        getColor: [59, 130, 246, 100],
        getRadius: (d: Point3D) => d.radius * 2.5,
        pointSize: 6,
        pickable: false,
        radiusUnits: "pixels",
      }),
      // Halo layer for locally selected points — rendered behind main layer
      new PointCloudLayer({
        id: "scatter-3d-selection-halo",
        data: selectedPoints,
        getPosition: (d: Point3D) => d.position,
        getColor: [255, 215, 0, 80],
        getRadius: (d: Point3D) => d.radius * 3.5,
        pointSize: 8,
        pickable: false,
        radiusUnits: "pixels",
      }),
      new PointCloudLayer({
        id: "scatter-3d",
        data: points as Point3D[],
        getPosition: (d: Point3D) => d.position,
        getColor: (d: Point3D) => {
          if (selectionSet.has(d.id)) {
            return [d.color[0], d.color[1], d.color[2], 255];
          }
          if (dimmedTypes.has(d.docType)) {
            return [d.color[0], d.color[1], d.color[2], 38];
          }
          return [d.color[0], d.color[1], d.color[2], 200];
        },
        getRadius: (d: Point3D) => {
          if (highlightedIds.has(d.id)) return d.radius * 2;
          if (selectionSet.has(d.id)) return d.radius * 1.8;
          if (selectedId === d.id) return d.radius * 1.5;
          return d.radius;
        },
        pointSize: 4,
        pickable: true,
        onHover: (info: { object?: Point3D }) => {
          if (info.object) {
            setHoveredId(info.object.id);
            onHover?.(info.object.id);
          } else {
            setHoveredId(null);
            onHover?.(null);
          }
        },
        onClick: (info: { object?: Point3D }) => {
          if (info.object) {
            onSelect(info.object.id);
          } else {
            onSelect(null);
          }
        },
        radiusUnits: "pixels",
      }),
      // Golden hover halo — rendered on top of main layer
      new PointCloudLayer({
        id: "scatter-3d-hover-halo",
        data: hoveredPoints,
        getPosition: (d: Point3D) => d.position,
        getColor: [255, 215, 0, 120],
        getRadius: (d: Point3D) => d.radius * 3,
        pointSize: 7,
        pickable: false,
        radiusUnits: "pixels",
      }),
      // Text labels for selected/highlighted points only
      // Uses pixelOffset to position above the point in screen space
      new TextLayer({
        id: "scatter-3d-labels",
        data: labeledPoints,
        getPosition: (d: Point3D) => d.position,
        getText: (d: Point3D) => d.id,
        getColor: (d: Point3D) => {
          if (selectionSet.has(d.id)) return [180, 83, 9, 255];
          if (highlightedIds.has(d.id)) return [255, 99, 71, 255];
          if (selectedId === d.id) return [30, 58, 138, 255];
          return [60, 60, 60, 220];
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

  const views = useMemo(
    () => [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new OrbitView({
        id: "main",
        controller: {
          keyboardZoom: true,
          keyboardRotate: true,
          dragPan: true,
          inertia: true,
        } as any,
      } as any),
    ],
    [],
  );

  const initialViewState = useMemo(() => ({
    main: {
      target: [0, 0, 0] as [number, number, number],
      zoom: 1,
      minZoom: -10,
      maxZoom: 20,
      rotationX: 45,
      rotationOrbit: 30,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any, []);

  // 3D cross-hair at world origin [0,0,0] — stays visible as user navigates
  const crossHairLayers = useMemo(() => {
    const axisLen = 0.3;
    const axisAlpha = 180;
    const lineDataX = [{ from: [-axisLen, 0, 0] as [number, number, number], to: [axisLen, 0, 0] as [number, number, number] }];
    const lineDataY = [{ from: [0, -axisLen, 0] as [number, number, number], to: [0, axisLen, 0] as [number, number, number] }];
    const lineDataZ = [{ from: [0, 0, -axisLen] as [number, number, number], to: [0, 0, axisLen] as [number, number, number] }];
    const centerData = [{ position: [0, 0, 0] as [number, number, number] }];
    return [
      new LineLayer({
        id: 'crosshair-x',
        data: lineDataX,
        getSourcePosition: (d: { from: [number, number, number]; to: [number, number, number] }) => d.from,
        getTargetPosition: (d: { from: [number, number, number]; to: [number, number, number] }) => d.to,
        getColor: [200, 80, 80, axisAlpha],
        getWidth: 1,
        widthUnits: 'pixels',
      }),
      new LineLayer({
        id: 'crosshair-y',
        data: lineDataY,
        getSourcePosition: (d: { from: [number, number, number]; to: [number, number, number] }) => d.from,
        getTargetPosition: (d: { from: [number, number, number]; to: [number, number, number] }) => d.to,
        getColor: [80, 200, 80, axisAlpha],
        getWidth: 1,
        widthUnits: 'pixels',
      }),
      new LineLayer({
        id: 'crosshair-z',
        data: lineDataZ,
        getSourcePosition: (d: { from: [number, number, number]; to: [number, number, number] }) => d.from,
        getTargetPosition: (d: { from: [number, number, number]; to: [number, number, number] }) => d.to,
        getColor: [80, 80, 200, axisAlpha],
        getWidth: 1,
        widthUnits: 'pixels',
      }),
      new ScatterplotLayer({
        id: 'crosshair-center',
        data: centerData,
        getPosition: (d: { position: [number, number, number] }) => d.position,
        getFillColor: [100, 100, 100, 220],
        getRadius: 3,
        radiusUnits: 'pixels',
        stroked: false,
        pickable: false,
      }),
    ];
  }, []);

  return (
    <div className={hoveredId ? "scatter-cursor-pointer" : "scatter-cursor-grab"} style={{ width, height, background: "#fafafa" }}>
      <style>{`
        .scatter-cursor-pointer canvas { cursor: pointer !important; }
        .scatter-cursor-grab canvas { cursor: grab !important; }
      `}</style>
      <DeckGL
        layers={[...layers, ...crossHairLayers]}
        views={views}
        initialViewState={initialViewState}
        width={width}
        height={height}
      />
    </div>
  );
};

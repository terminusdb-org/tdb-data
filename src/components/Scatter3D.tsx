import React, { useMemo } from "react";
import { DeckGL } from "@deck.gl/react";
import { OrbitView } from "@deck.gl/core";
import { PointCloudLayer, LineLayer, ScatterplotLayer } from "@deck.gl/layers";

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
  readonly dimmedTypes: ReadonlySet<string>;
  readonly onSelect: (id: string | null) => void;
  readonly width: number;
  readonly height: number;
}

export const Scatter3D: React.FC<Scatter3DProps> = ({
  points,
  selectedId,
  highlightedIds,
  dimmedTypes,
  onSelect,
  width,
  height,
}) => {
  const layers = useMemo(() => {
    return [
      new PointCloudLayer({
        id: "scatter-3d",
        data: points as Point3D[],
        getPosition: (d: Point3D) => d.position,
        getColor: (d: Point3D) => {
          if (dimmedTypes.has(d.docType)) {
            return [d.color[0], d.color[1], d.color[2], 38];
          }
          return [d.color[0], d.color[1], d.color[2], 200];
        },
        getRadius: (d: Point3D) => {
          if (highlightedIds.has(d.id)) return d.radius * 2;
          if (selectedId === d.id) return d.radius * 1.5;
          return d.radius;
        },
        pointSize: 4,
        pickable: true,
        onClick: (info: { object?: Point3D }) => {
          if (info.object) {
            onSelect(info.object.id);
          } else {
            onSelect(null);
          }
        },
        radiusUnits: "pixels",
      }),
    ];
  }, [points, selectedId, highlightedIds, dimmedTypes, onSelect]);

  const views = useMemo(
    () => [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new OrbitView({ id: "main", controller: true } as any),
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
    <div style={{ width, height, background: "#fafafa", cursor: "pointer" }}>
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

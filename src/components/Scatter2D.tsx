import React, { useMemo } from "react";
import { DeckGL } from "@deck.gl/react";
import { OrthographicView } from "@deck.gl/core";
import { ScatterplotLayer } from "@deck.gl/layers";

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
  readonly dimmedTypes: ReadonlySet<string>;
  readonly onSelect: (id: string | null) => void;
  readonly width: number;
  readonly height: number;
}

export const Scatter2D: React.FC<Scatter2DProps> = ({
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
      new ScatterplotLayer({
        id: "scatter-2d",
        data: points as ScatterPoint[],
        getPosition: (d: ScatterPoint) => d.position,
        getFillColor: (d: ScatterPoint) => {
          if (dimmedTypes.has(d.docType)) {
            return [d.color[0], d.color[1], d.color[2], 38];
          }
          return [d.color[0], d.color[1], d.color[2], 200];
        },
        getRadius: (d: ScatterPoint) => {
          if (highlightedIds.has(d.id)) return d.radius * 2;
          if (selectedId === d.id) return d.radius * 1.5;
          return d.radius;
        },
        stroked: true,
        getLineColor: (d: ScatterPoint) => {
          if (highlightedIds.has(d.id)) return [255, 99, 71, 255];
          if (selectedId === d.id) return [30, 58, 138, 255];
          return [0, 0, 0, 0];
        },
        getLineWidth: (d: ScatterPoint) => {
          if (highlightedIds.has(d.id)) return 2;
          if (selectedId === d.id) return 1.5;
          return 0;
        },
        pickable: true,
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
    ];
  }, [points, selectedId, highlightedIds, dimmedTypes, onSelect]);

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
    <div style={{ width, height, background: "#fafafa", cursor: "pointer" }}>
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

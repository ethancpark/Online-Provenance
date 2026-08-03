"use client";

import { useMemo, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import statesTopo from "us-atlas/states-10m.json";
import { TRIBE_LOCATIONS } from "@/lib/tribeLocations";
import styles from "./HotspotMap.module.css";

export type TribeCount = { name: string; count: number };

type Props = { tribes: TribeCount[] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STATES = feature(statesTopo as any, (statesTopo as any).objects.states) as unknown as FeatureCollection<
  Geometry,
  { name: string }
>;

const WIDTH = 975;
const HEIGHT = 610;
const projection = geoAlbersUsa().scale(1300).translate([WIDTH / 2, HEIGHT / 2]);
const pathGen = geoPath(projection);

// Server and browser floating point differ in the last digits, which React
// reports as a hydration mismatch.
const round2 = (n: number) => Math.round(n * 100) / 100;

type Placed = TribeCount & { x: number; y: number };

export default function HotspotMap({ tribes }: Props) {
  const [hover, setHover] = useState<Placed | null>(null);

  const placed = useMemo<Placed[]>(() => {
    return tribes
      .map((t) => {
        const loc = TRIBE_LOCATIONS[t.name];
        if (!loc) return null;
        const xy = projection([loc.lon, loc.lat]);
        if (!xy) return null; // outside the AlbersUsa clip
        return { ...t, x: round2(xy[0]), y: round2(xy[1]) };
      })
      .filter((p): p is Placed => p !== null)
      .sort((a, b) => b.count - a.count); // large dots first, small drawn on top
  }, [tribes]);

  const maxCount = Math.max(1, ...placed.map((p) => p.count));

  // Area-proportional so a dot twice the area means twice the volume.
  function radius(count: number) {
    return round2(4 + Math.sqrt(count / maxCount) * 14);
  }

  return (
    <div className={styles.wrap}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={styles.svg}
        role="img"
        aria-label="Map of the United States showing where each nation's marks are being copied"
      >
        {/* Land is neutral: it locates the dots, it does not encode a value. */}
        <g>
          {STATES.features.map((f, i) => (
            <path
              key={i}
              d={pathGen(f) ?? undefined}
              fill="var(--paper-tint)"
              stroke="var(--rule)"
              strokeWidth={0.75}
            />
          ))}
        </g>
        {/* One clay tone for every dot; only size carries the volume. */}
        <g>
          {placed.map((p) => (
            <circle
              key={p.name}
              cx={p.x}
              cy={p.y}
              r={radius(p.count)}
              className={styles.dot}
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </g>
      </svg>

      {hover && (
        <div
          className={styles.tip}
          style={{ left: `${(hover.x / WIDTH) * 100}%`, top: `${(hover.y / HEIGHT) * 100}%` }}
        >
          <span className={styles.tipName}>{hover.name}</span>
          <span className={styles.tipCount}>
            {hover.count} {hover.count === 1 ? "listing" : "listings"}
          </span>
        </div>
      )}
    </div>
  );
}

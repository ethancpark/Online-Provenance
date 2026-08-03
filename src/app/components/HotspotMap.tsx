"use client";

import { useMemo, useState } from "react";
import { geoAlbersUsa, geoPath, geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import statesTopo from "us-atlas/states-10m.json";
import { TRIBE_LOCATIONS } from "@/lib/tribeLocations";
import styles from "./HotspotMap.module.css";

export type TribeCount = { name: string; count: number };

type Props = { tribes: TribeCount[] };

// us-atlas ships TopoJSON; convert once to GeoJSON features for rendering.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STATES = feature(statesTopo as any, (statesTopo as any).objects.states) as unknown as FeatureCollection<
  Geometry,
  { name: string }
>;

const WIDTH = 975;
const HEIGHT = 610;
const projection = geoAlbersUsa().scale(1300).translate([WIDTH / 2, HEIGHT / 2]);
const pathGen = geoPath(projection);

type Placed = TribeCount & { x: number; y: number; state: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function HotspotMap({ tribes }: Props) {
  const [hover, setHover] = useState<Placed | null>(null);

  const placed = useMemo<Placed[]>(() => {
    return tribes
      .map((t) => {
        const loc = TRIBE_LOCATIONS[t.name];
        if (!loc) return null;
        const xy = projection([loc.lon, loc.lat]);
        if (!xy) return null; // outside the AlbersUsa clip (rare)
        // Derive the containing state from geometry rather than trusting a
        // name field — most locations come from Census centroids with no
        // state attached, and point-in-polygon is exact.
        const hit = STATES.features.find((f) => geoContains(f, [loc.lon, loc.lat]));
        const abbr = STATE_NAME_TO_ABBR[hit?.properties?.name ?? ""] ?? loc.state ?? "";
        // Round: server and browser floating-point differ in the last digits,
        // which React reports as a hydration mismatch.
        return { ...t, x: round2(xy[0]), y: round2(xy[1]), state: abbr };
      })
      .filter((p): p is Placed => p !== null)
      .sort((a, b) => a.count - b.count); // biggest drawn last, on top
  }, [tribes]);

  // Aggregate per state so the choropleth reflects real totals.
  const byState = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of placed) {
      if (p.state) m.set(p.state, (m.get(p.state) ?? 0) + p.count);
    }
    return m;
  }, [placed]);

  const maxState = Math.max(1, ...byState.values());
  const maxTribe = Math.max(1, ...placed.map((p) => p.count));

  function stateFill(abbr: string) {
    const v = byState.get(abbr) ?? 0;
    if (!v) return "var(--map-empty)";
    const t = Math.sqrt(v / maxState); // sqrt so mid values stay visible
    return `color-mix(in srgb, var(--accent) ${Math.round(12 + t * 78)}%, var(--map-empty))`;
  }

  function radius(count: number) {
    return round2(3.5 + Math.sqrt(count / maxTribe) * 13);
  }

  return (
    <div className={styles.wrap}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={styles.svg}
        role="img"
        aria-label="Map of the United States showing where tribal marks are being copied"
      >
        <g>
          {STATES.features.map((f, i) => {
            const abbr = STATE_NAME_TO_ABBR[f.properties?.name ?? ""] ?? "";
            return (
              <path
                key={i}
                d={pathGen(f) ?? undefined}
                fill={stateFill(abbr)}
                stroke="var(--map-stroke)"
                strokeWidth={0.6}
              />
            );
          })}
        </g>
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
          <div className={styles.tipName}>{hover.name}</div>
          <div className={styles.tipCount}>
            {hover.count} {hover.count === 1 ? "listing" : "listings"} flagged
          </div>
        </div>
      )}

      <div className={styles.legend}>
        <span>Fewer</span>
        <span className={styles.ramp} />
        <span>More listings found</span>
      </div>
    </div>
  );
}

const STATE_NAME_TO_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI",
  Wyoming: "WY", "District of Columbia": "DC",
};

"use client";

import { useState } from "react";
import { CABLE, MOTION } from "../timings";

/**
 * Development only (add ?tune to the URL with `npm run dev`): a live slider for
 * every motion and cable constant. The 3D scene reads these objects every
 * frame, so changes apply at once. "Copy values" puts the current numbers on
 * the clipboard to paste back into timings.ts. Never part of a production build.
 */
const groups = { MOTION, CABLE } as Record<string, Record<string, number>>;

function range(v: number): [number, number, number] {
  if (v === 0) return [-10, 10, 0.1];
  const a = Math.abs(v);
  const step = a < 0.1 ? 0.001 : a < 1 ? 0.01 : a < 10 ? 0.05 : a < 100 ? 0.5 : 10;
  return v < 0 ? [v * 3, -v * 3, step] : [0, v * 3, step];
}

export default function Tune() {
  const [, bump] = useState(0);
  const [open, setOpen] = useState(true);
  const [init] = useState(() => JSON.parse(JSON.stringify(groups)) as typeof groups);
  return (
    <div
      data-ui
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        right: 12,
        top: 110,
        bottom: 12,
        width: 300,
        overflow: "auto",
        zIndex: 50,
        background: "rgba(10,10,12,0.88)",
        color: "#eee",
        font: "11px/1.3 ui-monospace, monospace",
        borderRadius: 10,
        padding: 10,
        display: open ? "block" : "none",
      }}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(JSON.stringify(groups, null, 2))}
        >
          Copy values
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Hide
        </button>
      </div>
      {Object.entries(groups).map(([name, obj]) => (
        <fieldset key={name} style={{ border: "1px solid #333", margin: "0 0 8px", padding: 6 }}>
          <legend>{name}</legend>
          {Object.entries(obj)
            .filter(([, v]) => typeof v === "number")
            .map(([k, v]) => {
              const [min, max, step] = range(init[name][k]);
              return (
                <label key={k} style={{ display: "grid", gridTemplateColumns: "120px 1fr 48px", gap: 6, alignItems: "center" }}>
                  <span>{k}</span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={v}
                    onChange={(e) => {
                      obj[k] = Number(e.target.value);
                      bump((n) => n + 1);
                    }}
                  />
                  <span style={{ textAlign: "right" }}>{+v.toFixed(3)}</span>
                </label>
              );
            })}
        </fieldset>
      ))}
    </div>
  );
}

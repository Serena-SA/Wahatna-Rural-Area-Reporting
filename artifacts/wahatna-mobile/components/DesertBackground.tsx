import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Circle,
  Rect,
  Stop,
} from "react-native-svg";

// Stylized desert backdrop that switches by device time of day:
//   day  → sunny dunes + ghaf-tree silhouettes
//   night → starry sky + moon over dark dunes
// A dark scrim keeps the app's light text/cards readable in both modes.
//
// `mode` lets the Home screen override the automatic time-of-day switch so the
// day and night looks can be featured on demand (e.g. in a demo).

export type DesertMode = "auto" | "day" | "night";

function isDaytime(now: Date): boolean {
  const h = now.getHours();
  return h >= 6 && h < 18;
}

/** A single ghaf-tree silhouette (broad umbrella canopy on a short trunk). */
function Ghaf({ x, baseY, s, color }: { x: number; baseY: number; s: number; color: string }) {
  return (
    <G opacity={0.95}>
      <Rect x={x - 1.6 * s} y={baseY - 20 * s} width={3.2 * s} height={20 * s} rx={1} fill={color} />
      <Ellipse cx={x} cy={baseY - 24 * s} rx={26 * s} ry={8.5 * s} fill={color} />
      <Ellipse cx={x - 15 * s} cy={baseY - 20 * s} rx={14 * s} ry={6.5 * s} fill={color} />
      <Ellipse cx={x + 15 * s} cy={baseY - 20 * s} rx={14 * s} ry={6.5 * s} fill={color} />
      <Ellipse cx={x} cy={baseY - 30 * s} rx={16 * s} ry={6 * s} fill={color} />
    </G>
  );
}

const STARS: { x: number; y: number; r: number; o: number }[] = [
  { x: 40, y: 60, r: 1.4, o: 0.9 }, { x: 110, y: 110, r: 1, o: 0.7 },
  { x: 170, y: 50, r: 1.6, o: 1 }, { x: 230, y: 130, r: 1, o: 0.6 },
  { x: 70, y: 180, r: 1.2, o: 0.8 }, { x: 320, y: 90, r: 1.3, o: 0.9 },
  { x: 360, y: 200, r: 1, o: 0.6 }, { x: 150, y: 200, r: 1.1, o: 0.7 },
  { x: 270, y: 60, r: 1.5, o: 1 }, { x: 200, y: 160, r: 1, o: 0.6 },
  { x: 30, y: 120, r: 1, o: 0.7 }, { x: 380, y: 130, r: 1.2, o: 0.8 },
];

export function DesertBackground({ mode = "auto" }: { mode?: DesertMode }) {
  const [autoDay, setAutoDay] = useState(() => isDaytime(new Date()));

  useEffect(() => {
    if (mode !== "auto") return;
    const id = setInterval(() => setAutoDay(isDaytime(new Date())), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [mode]);

  const day = mode === "auto" ? autoDay : mode === "day";

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            {day
              ? [
                  <Stop key="0" offset="0" stopColor="#5B8FB0" />,
                  <Stop key="1" offset="0.5" stopColor="#C9A86A" />,
                  <Stop key="2" offset="1" stopColor="#E6C684" />,
                ]
              : [
                  <Stop key="0" offset="0" stopColor="#070B1E" />,
                  <Stop key="1" offset="0.7" stopColor="#101A33" />,
                  <Stop key="2" offset="1" stopColor="#1B2742" />,
                ]}
          </LinearGradient>
          <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
            {day
              ? [
                  <Stop key="0" offset="0" stopColor="#10130C" stopOpacity="0.58" />,
                  <Stop key="1" offset="0.45" stopColor="#10130C" stopOpacity="0.18" />,
                  <Stop key="2" offset="1" stopColor="#10130C" stopOpacity="0.42" />,
                ]
              : [
                  <Stop key="0" offset="0" stopColor="#070B1E" stopOpacity="0.5" />,
                  <Stop key="1" offset="1" stopColor="#070B1E" stopOpacity="0.55" />,
                ]}
          </LinearGradient>
        </Defs>

        {/* Sky */}
        <Rect x="0" y="0" width="400" height="800" fill="url(#sky)" />

        {day ? (
          <>
            {/* Sun + glow */}
            <Circle cx="300" cy="150" r="74" fill="#FFE39A" opacity={0.22} />
            <Circle cx="300" cy="150" r="44" fill="#FFE3A6" opacity={0.95} />
          </>
        ) : (
          <>
            {/* Stars + moon */}
            {STARS.map((s, i) => (
              <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.o} />
            ))}
            <Circle cx="305" cy="140" r="36" fill="#E8ECF5" opacity={0.95} />
            <Circle cx="292" cy="132" r="34" fill={day ? "transparent" : "#16213D"} opacity={0.5} />
          </>
        )}

        {/* Dune layers */}
        <Path
          d="M0 470 Q120 410 230 460 T400 450 L400 800 L0 800 Z"
          fill={day ? "#C2924A" : "#0E1510"}
        />
        <Path
          d="M0 560 Q140 500 260 555 T400 540 L400 800 L0 800 Z"
          fill={day ? "#A6792F" : "#0A0F09"}
        />

        {/* Ghaf trees on the dunes */}
        <Ghaf x={88} baseY={548} s={1.1} color={day ? "#2E3A22" : "#05080B"} />
        <Ghaf x={300} baseY={566} s={0.85} color={day ? "#27331D" : "#04060A"} />
        <Ghaf x={190} baseY={585} s={1.35} color={day ? "#222D18" : "#03050A"} />

        {/* Readability scrim */}
        <Rect x="0" y="0" width="400" height="800" fill="url(#scrim)" />
      </Svg>
    </View>
  );
}

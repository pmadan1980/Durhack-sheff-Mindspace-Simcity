import { useId } from "react";
import {
  config,
  districtInfo,
  districts,
  fmt,
  type District,
  type Round,
  type State,
} from "./simulation";

interface Props {
  state: State;
  active?: District | null;
  onSelect?: (d: District) => void;
  compact?: boolean;
  running?: boolean;
  round?: Round;
}
const positions: Record<District, [number, number]> = {
  A: [282, 194],
  C: [516, 204],
  D: [249, 370],
  R: [493, 389],
};

export default function WorldArt({
  state,
  active,
  onSelect,
  compact,
  running = true,
  round,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const activity = round?.activity;
  const intensities = activity
    ? {
        A:
          activity.taskGain /
          (config.achievementRate * config.dailyBudget * config.methodCap),
        C:
          activity.connectionGain /
          (config.connectionRate * config.dailyBudget),
        D:
          activity.methodGain /
          (config.discoveryMethodGain * config.dailyBudget),
        R: activity.restored / (config.recoveryRate * config.dailyBudget),
      }
    : { A: 0.2, C: 0.2, D: 0.2, R: 0.2 };
  return (
    <svg
      className={`world-art ${running ? "art-running" : ""} ${compact ? "compact-art" : ""}`}
      viewBox="0 0 780 570"
      role="img"
      aria-label={`Four connected districts. ${fmt(state.energy)} energy tokens, ${fmt(state.taskProgress)} presentation points, method ${fmt(state.method, 2)} times.`}
    >
      <defs>
        <radialGradient id={`${uid}-halo`}>
          <stop stopColor="#54857a" stopOpacity=".22" />
          <stop offset="1" stopColor="#182d37" stopOpacity="0" />
        </radialGradient>
        <pattern
          id={`${uid}-grid`}
          width="34"
          height="20"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-27)"
        >
          <path
            d="M 34 0 L 0 0 0 20"
            fill="none"
            stroke="#aec5c5"
            strokeOpacity=".07"
            strokeWidth=".7"
          />
        </pattern>
        <filter id={`${uid}-glow`}>
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <ellipse cx="390" cy="310" rx="360" ry="250" fill={`url(#${uid}-halo)`} />
      <path d="M60 320 386 123 730 319 397 520Z" fill={`url(#${uid}-grid)`} />
      <g
        className="contours"
        fill="none"
        stroke="#86b1a7"
        strokeWidth=".7"
        opacity=".2"
      >
        {[0, 1, 2, 3].map((i) => (
          <ellipse
            key={i}
            cx="390"
            cy="326"
            rx={250 + i * 27}
            ry={132 + i * 16}
            transform="rotate(-4 390 326)"
          />
        ))}
      </g>
      <g fill="none" strokeLinecap="round">
        {(["A", "C", "D", "R"] as District[]).map((d, i) => {
          const [x, y] = positions[d];
          return (
            <g key={d}>
              <path
                d={`M${x} ${y + 35} Q390 ${240 + i * 27} 390 310`}
                stroke={districtInfo[d].color}
                strokeWidth="9"
                opacity=".05"
              />
              <path
                className="connection-trail"
                d={`M${x} ${y + 35} Q390 ${240 + i * 27} 390 310`}
                stroke={districtInfo[d].color}
                strokeWidth={1 + Math.min(1, intensities[d]) * 3}
                opacity={0.1 + Math.min(1, intensities[d]) * 0.8}
                style={{
                  animationDuration: `${28 - Math.min(1, intensities[d]) * 20}s`,
                }}
                strokeDasharray="3 8"
              />
            </g>
          );
        })}
      </g>
      <g transform="translate(390 309)">
        <ellipse cy="15" rx="40" ry="21" fill="#aecabd" opacity=".07" />
        <path
          d="M0-21 25-7 25 13 0 28-25 13-25-7Z"
          fill="#24443f"
          stroke="#9ac8b7"
          strokeOpacity=".55"
        />
        <path d="M0-21 25-7 0 8-25-7Z" fill="#bad4bb" />
        <path d="M0 8V28" stroke="#80ad99" />
        <circle cy="-28" r="4" fill="#d5e7bf" className="beacon" />
      </g>
      {districts.map((d) => {
        const [x, y] = positions[d];
        const color = districtInfo[d].color;
        return (
          <g
            key={d}
            className={`district-art ${active === d ? "district-selected" : ""}`}
            transform={`translate(${x} ${y})`}
            style={{ "--district": color } as React.CSSProperties}
            onClick={() => onSelect?.(d)}
          >
            <ellipse
              cy="45"
              rx="112"
              ry="58"
              fill={color}
              opacity={active === d ? ".12" : ".035"}
            />
            <path
              d="M-94 14 0-39 94 14 94 30 0 84-94 30Z"
              fill="#172b32"
              stroke={color}
              strokeOpacity=".25"
            />
            <path
              d="M-94 14 0-39 94 14 0 68Z"
              fill={
                d === "A"
                  ? "#3c3833"
                  : d === "C"
                    ? "#39333f"
                    : d === "D"
                      ? "#303248"
                      : "#263f3c"
              }
              stroke={color}
              strokeOpacity=".5"
            />
            <path
              d="M-78 14 0-30 78 14 0 59Z"
              fill="none"
              stroke={color}
              strokeOpacity=".14"
            />
            {d === "A" && (
              <g>
                {[-1, 0, 1].map((n, i) => (
                  <g
                    key={n}
                    transform={`translate(${n * 33} ${Math.abs(n) * 15 - 9})`}
                  >
                    <path
                      d={`M-15 0 0-9 15 0 15 ${-46 - i * 15} 0 ${-55 - i * 15} -15 ${-46 - i * 15}Z`}
                      fill="#a17352"
                    />
                    <path
                      d={`M0-9 15 0 15 ${-46 - i * 15} 0 ${-55 - i * 15}Z`}
                      fill="#c79368"
                    />
                    <path
                      d={`M-15 ${-46 - i * 15} 0 ${-55 - i * 15} 15 ${-46 - i * 15} 0 ${-37 - i * 15}Z`}
                      fill="#f3bd85"
                    />
                    {[0, 1, 2].map((w) => (
                      <path
                        key={w}
                        d={`M4 ${-15 - w * 13} 11 ${-19 - w * 13}`}
                        stroke="#ffe4b2"
                        strokeWidth="3"
                      />
                    ))}
                  </g>
                ))}
                <path d="M0-89V-124" stroke="#e1bc8a" />
                <path d="M0-124 23-116 0-108Z" fill={color} />
              </g>
            )}
            {d === "C" && (
              <g>
                <path
                  d="M-58 8V-38Q-58-64-30-64T-2-38V8L-16 16V-34Q-16-50-30-50T-44-34V16Z"
                  fill="#c18fa8"
                />
                <path
                  d="M-6 16V-26Q-6-52 22-52T50-26V16L36 24V-22Q36-38 22-38T8-22V24Z"
                  fill="#e5b2c8"
                />
                <path
                  d="M-52 22 4 54 63 20"
                  fill="none"
                  stroke="#f6d7e4"
                  strokeWidth="2"
                  opacity=".5"
                />
                <circle
                  cx="-24"
                  cy="-76"
                  r="7"
                  fill={color}
                  opacity=".7"
                  className="float-one"
                />
                <circle
                  cx="31"
                  cy="-64"
                  r="4"
                  fill={color}
                  className="float-two"
                />
              </g>
            )}
            {d === "D" && (
              <g>
                <path d="M-32 15 0 33 34 14 34-28 0-48-32-29Z" fill="#726b9e" />
                <path d="M0 33 34 14 34-28 0-10Z" fill="#8a81bb" />
                <path d="M-32-29 0-48 34-28 0-10Z" fill="#c3bce6" />
                <path d="M-30-29Q-32-81 0-81T33-29Z" fill="#aaa1db" />
                <path d="M0-81Q26-80 33-29L0-10Z" fill="#c2bae9" />
                <ellipse
                  cy="-66"
                  rx="48"
                  ry="12"
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  transform="rotate(-30 0 -66)"
                />
                <path
                  d="M0-112V-96M-8-104H8"
                  stroke="#e2dcff"
                  strokeWidth="2"
                  className="float-one"
                />
                <circle cx="45" cy="-82" r="3" fill={color} />
              </g>
            )}
            {d === "R" && (
              <g>
                <ellipse cy="20" rx="50" ry="26" fill="#52786a" />
                <ellipse cy="12" rx="50" ry="26" fill="#8db59e" />
                <ellipse cy="5" rx="34" ry="18" fill="#3d685a" />
                <ellipse cy="0" rx="34" ry="18" fill="#b1ceb0" />
                <path
                  d="M-43-2V-49M39-2V-37M-8-13V-73"
                  stroke="#749d80"
                  strokeWidth="5"
                />
                <path
                  d="M-43-76-66-35H-20ZM39-65 16-24H62ZM-8-112-37-56H21Z"
                  fill="#89b799"
                />
                <path d="M-8-112V-56H21Z" fill="#b4d3ab" />
                <path d="M-43-76V-35H-20Z" fill="#a8caa4" />
                <path
                  d="M-24 33Q0 20 27 33M-14 40Q0 32 15 40"
                  fill="none"
                  stroke="#cee8c7"
                  strokeWidth="1.5"
                />
              </g>
            )}
            {Array.from({ length: 6 }, (_, i) => {
              const px = -62 + i * 23,
                py = 20 + (i % 2) * 17;
              return (
                <g
                  key={i}
                  className="resident-particle"
                  style={{ animationDelay: `${i * -0.7}s` }}
                >
                  <ellipse
                    cx={px}
                    cy={py + 5}
                    rx="4"
                    ry="2"
                    fill="#000"
                    opacity=".2"
                  />
                  <path
                    d={`M${px} ${py}v4`}
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle cx={px} cy={py - 3} r="2.5" fill="#e7e4d5" />
                </g>
              );
            })}
            <g
              transform={`translate(${d === "D" ? -115 : d === "R" ? 35 : d === "A" ? -123 : 84} ${d === "A" || d === "C" ? -64 : 102})`}
              className="map-label"
            >
              <text fill={color} fontSize="10" letterSpacing="1.5">
                {districtInfo[d].name.toUpperCase()}
              </text>
              <text y="17" fill="#a7b7b6" fontSize="10">
                {d === "A"
                  ? `${fmt(state.taskProgress)} points`
                  : d === "C"
                    ? `${fmt(state.connectionProgress)} points`
                    : d === "D"
                      ? `${fmt(state.method, 2)}× method`
                      : `${fmt(state.energy)} energy`}
              </text>
            </g>
          </g>
        );
      })}
      {Array.from({ length: 22 }, (_, i) => (
        <circle
          key={i}
          cx={110 + ((i * 79) % 575)}
          cy={80 + ((i * 61) % 380)}
          r={i % 3 === 0 ? 1.8 : 1}
          fill={districtInfo[districts[i % 4]].color}
          opacity=".35"
          className={i % 2 ? "float-one" : "float-two"}
        />
      ))}
      <g transform="translate(69 488)" opacity=".6">
        <path d="M0 14 8-6 16 14 8 9Z" fill="none" stroke="#c0d0c9" />
        <text x="5" y="-15" fill="#c0d0c9" fontSize="9">
          N
        </text>
      </g>
      <text
        x="390"
        y="529"
        textAnchor="middle"
        fill="#839b9c"
        fontSize="9"
        letterSpacing="3"
      >
        FOUR DISTRICTS. ONE SHARED WORLD.
      </text>
    </svg>
  );
}

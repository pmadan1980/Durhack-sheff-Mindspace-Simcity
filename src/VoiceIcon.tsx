import { useId } from "react";
import type { District } from "./simulation";
import { voicePalette } from "./voicePalette";

const silhouettes: Record<District, string> = {
  A: "M50 11 C56 11 59 33 65 37 C71 41 89 37 91 44 C94 51 75 59 73 66 C71 73 81 87 74 90 C66 94 57 80 50 80 C43 80 33 94 26 90 C19 87 29 73 27 66 C25 59 6 51 9 44 C11 37 29 41 35 37 C41 33 44 11 50 11Z",
  C: "M50 88 C32 79 12 61 12 43 C12 20 36 16 50 32 C64 16 88 20 88 43 C88 61 68 79 50 88Z",
  D: "M56 11 C51 15 54 27 62 35 C72 44 81 52 81 66 C81 83 67 91 50 91 C32 91 20 82 20 65 C20 49 34 38 41 26 C47 16 51 11 56 11Z",
  R: "M25 83 C13 83 7 75 7 66 C7 56 14 50 23 50 C26 39 34 34 43 36 C48 25 64 24 72 36 C78 38 82 44 83 49 C91 50 95 56 95 64 C95 74 89 82 77 83Z",
};

export default function VoiceIcon({ d, size = 40, speaking = false, title }: {
  d: District;
  size?: number;
  speaking?: boolean;
  title?: string;
}) {
  const id = useId().replace(/:/g, "");
  const { light, clay, shade, cheek } = voicePalette[d];
  const faceY = d === "A" ? 54 : d === "C" ? 50 : 61;
  const ink = "#382631";

  return (
    <svg
      className={`voice-icon voice-${d}${speaking ? " is-speaking" : ""}`}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <radialGradient id={`${id}-clay`} cx="35%" cy="24%" r="83%">
          <stop stopColor={light} />
          <stop offset=".56" stopColor={clay} />
          <stop offset="1" stopColor={shade} />
        </radialGradient>
        <radialGradient id={`${id}-shadow`}>
          <stop stopColor="#080510" stopOpacity=".66" />
          <stop offset="1" stopColor="#080510" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="90" rx="43" ry="8" fill={`url(#${id}-shadow)`} />
      <path d={silhouettes[d]} transform="translate(0 3)" fill={shade} />
      <path d={silhouettes[d]} fill={`url(#${id}-clay)`} />
      <g transform={`translate(0 ${faceY})`}>
        <path d="M32 8a5 3 0 1 0 0 .01M68 8a5 3 0 1 1 0 .01" fill={cheek} opacity=".55" />
        {d === "R" ? (
          <path d="M35 0q5 5 10 0m10 0q5 5 10 0" stroke={ink} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        ) : (
          <g className="vi-eyes" fill={ink}>
            <ellipse cx="40" cy="0" rx="3.5" ry="5.2" />
            <ellipse cx="60" cy="0" rx="3.5" ry="5.2" />
            <circle cx="39" cy="-1.6" r="1" fill={light} />
            <circle cx="59" cy="-1.6" r="1" fill={light} />
          </g>
        )}
        {d === "A" && <path d="M35 -10l9 3m12 0l9 -3" stroke={ink} strokeWidth="2.2" fill="none" strokeLinecap="round" />}
        {d === "D" && <path d="M34 -9q5-4 11-1m10 2q5-3 10 1" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round" />}
        <path className="vi-mouth" d="M45 10q5 5 10 0" stroke={ink} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
      {d === "D" && <path d="M77 13l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill={light} />}
      {d === "R" && <path d="M79 27a9 9 0 1 0 9 11 8 8 0 0 1-9-11Z" fill="#f8dfad" />}
    </svg>
  );
}

import { useId } from "react";
import { districtInfo, type District } from "./simulation";

/** Original, cute character marks for the four voices (2D twins of the 3D personas). */
export default function VoiceIcon({
  d,
  size = 40,
  speaking = false,
  title,
}: {
  d: District;
  size?: number;
  speaking?: boolean;
  title?: string;
}) {
  const id = useId().replace(/:/g, "");
  const c = districtInfo[d].color;
  const body = {
    // Achievement: a determined little spark-star.
    A: "M50 8 C55 8 57 30 62 34 C67 38 90 36 92 41 C94 46 74 58 72 64 C70 70 80 90 76 93 C72 96 56 82 50 82 C44 82 28 96 24 93 C20 90 30 70 28 64 C26 58 6 46 8 41 C10 36 33 38 38 34 C43 30 45 8 50 8 Z",
    // Connection: a warm, round heart-ish blob.
    C: "M50 90 C34 80 12 66 12 44 C12 28 24 18 36 18 C43 18 47 22 50 27 C53 22 57 18 64 18 C76 18 88 28 88 44 C88 66 66 80 50 90 Z",
    // Discovery: a curious teardrop wisp with a curl.
    D: "M58 8 C52 10 50 18 54 24 C62 34 80 48 80 64 C80 81 66 92 50 92 C34 92 20 81 20 64 C20 46 38 32 46 20 C50 14 52 9 58 8 Z",
    // Recovery: a sleepy, cosy cloud.
    R: "M24 82 C12 82 6 74 6 65 C6 56 13 50 21 50 C20 38 30 28 42 30 C47 20 60 16 70 24 C78 30 80 38 79 44 C89 44 95 52 95 62 C95 73 87 82 76 82 Z",
  }[d];
  const eyes = { A: [40, 60, 52], C: [38, 62, 50], D: [40, 60, 62], R: [38, 62, 62] }[d];
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
        <radialGradient id={`g${id}`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="0.35" stopColor={c} />
          <stop offset="1" stopColor={c} stopOpacity="0.85" />
        </radialGradient>
        <filter id={`f${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <path d={body} fill={c} opacity="0.55" filter={`url(#f${id})`} />
      <path d={body} fill={`url(#g${id})`} stroke="#ffffff66" strokeWidth="1.5" />
      {d === "R" ? (
        <>
          <path d={`M${eyes[0] - 7} ${eyes[2]} q7 6 14 0`} stroke="#1d1b3a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d={`M${eyes[1] - 7} ${eyes[2]} q7 6 14 0`} stroke="#1d1b3a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path className="vi-mouth" d="M44 72 q6 4 12 0" stroke="#1d1b3a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <text x="80" y="26" fontSize="16" fontWeight="700" fill="#e8fff4">z</text>
        </>
      ) : (
        <>
          <g className="vi-eyes">
          {[eyes[0], eyes[1]].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy={eyes[2]} rx="8.5" ry={d === "D" ? 11 : 10} fill="#fff" />
              <circle cx={x + (d === "D" ? 1 : 0)} cy={eyes[2] + (d === "D" ? -2 : 1)} r="5.5" fill="#1d1b3a" />
              <circle cx={x + 2.5} cy={eyes[2] - 2.5} r="2" fill="#fff" />
            </g>
          ))}
          </g>
          {d === "A" && (
            <>
              <path d="M31 40 l14 5" stroke="#1d1b3a" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M69 40 l-14 5" stroke="#1d1b3a" strokeWidth="3.5" strokeLinecap="round" />
              <path className="vi-mouth" d="M43 68 q7 5 14 0" stroke="#1d1b3a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            </>
          )}
          {d === "C" && (
            <>
              <ellipse cx="27" cy="62" rx="6" ry="3.5" fill="#ff3d6e" opacity="0.5" />
              <ellipse cx="73" cy="62" rx="6" ry="3.5" fill="#ff3d6e" opacity="0.5" />
              <path className="vi-mouth" d="M40 64 q10 10 20 0" stroke="#1d1b3a" strokeWidth="3.5" fill="#7a1f3a" strokeLinecap="round" />
            </>
          )}
          {d === "D" && (
            <>
              <path d="M33 47 q7 -6 13 -2" stroke="#1d1b3a" strokeWidth="3" fill="none" strokeLinecap="round" />
              <circle className="vi-mouth" cx="50" cy="79" r="3.5" fill="#1d1b3a" />
              <path d="M76 6 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z" fill="#fff" />
            </>
          )}
        </>
      )}
    </svg>
  );
}

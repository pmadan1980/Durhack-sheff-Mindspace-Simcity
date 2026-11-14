import { useEffect, useId, useState } from "react";
import {
  config,
  districtInfo,
  districts,
  fmt,
  type Config,
  type District,
  type Election,
  type Policy,
  type Round,
  type State,
} from "./simulation";
import { memoriesFor } from "./memories";

interface Props {
  state: State;
  active?: District | null;
  onSelect?: (d: District) => void;
  onMemory?: (day: number) => void;
  compact?: boolean;
  running?: boolean;
  round?: Round;
  history?: Round[];
  rules?: Config;
  phase?: "Campaign" | "Voting" | "Resolution";
  voteProgress?: number;
  election?: Election;
  proposals?: Policy[];
}

const positions: Record<District, number> = { A: 230, C: 410, D: 590, R: 770 };
const crystalPaths: Record<District, string> = {
  A: "M0-19 15 10 0 19-15 10Z",
  C: "M0-13Q-18-28-19-7Q-18 5 0 20Q18 5 19-7Q18-28 0-13Z",
  D: "M0-22 17 0 0 22-17 0Z",
  R: "M-11-17 11-17 18 0 11 17-11 17-18 0Z",
};

function leadFor(policy: Policy, peers: Policy[]): District {
  // Emphasis is extra blocks versus the actual ballot's average allocation.
  // It is a visual role, not a claim about which residents voted for a policy.
  const emphasis = (d: District) =>
    policy.allocation[d] -
    peers.reduce((sum, p) => sum + p.allocation[d], 0) / peers.length;
  return districts.reduce((lead, d) =>
    emphasis(d) > emphasis(lead) ? d : lead,
  );
}

function beginFlight(node: SVGAnimationElement | null) {
  node?.beginElement();
}

function thoughts(state: State, c: Config): Record<District, [string, string]> {
  return {
    A:
      state.taskResult !== null
        ? [
            state.taskResult ? "We made the deadline!" : "We missed day three.",
            "Every choice left a trace.",
          ]
        : state.taskProgress >= c.taskGoal
          ? ["The presentation is ready!", "What matters next?"]
          : [
              "The presentation is due.",
              `Day ${c.taskDeadlineDay} · ${fmt(state.taskProgress)}/${c.taskGoal} ready`,
            ],
    C:
      state.day <= c.connectionLastOpenDay
        ? ["She’s only here today.", "Can we make room for her?"]
        : state.connectionResult
          ? ["We made time for her.", "That one stays with us."]
          : ["The visit window closed.", "I wish we’d had more time."],
    D:
      state.method > 1
        ? [
            "Our new approach is ready.",
            `${fmt(state.method, 2)}× method, ready to use.`,
          ]
        : ["Could there be a new way?", "A little curiosity, please."],
    R:
      state.energy < c.energyCap * 0.4
        ? [
            "Our energy is running low.",
            `${fmt(state.energy)}/${c.energyCap} left. A little rest?`,
          ]
        : state.energy >= c.energyCap
          ? ["Our lantern is full.", "Let’s use that energy gently."]
          : [
              "We need energy, too.",
              `${fmt(state.energy)}/${c.energyCap} energy to share.`,
            ],
  };
}

function Crystal({ district, glow }: { district: District; glow?: string }) {
  return (
    <g>
      {glow && (
        <circle
          r="26"
          fill={districtInfo[district].color}
          opacity=".5"
          filter={glow}
        />
      )}
      <path
        d={crystalPaths[district]}
        fill={districtInfo[district].color}
        stroke="#fff5ff"
        strokeWidth="1.5"
      />
      <path d="M0-16 0 16-9 0Z" fill="#fff" opacity=".36" />
      <path d="M0-13 10 2 0 16Z" fill="#441f79" opacity=".22" />
      <text
        textAnchor="middle"
        y="5"
        fill="#392041"
        fontSize="12"
        fontWeight="bold"
      >
        {district === "A"
          ? "△"
          : district === "C"
            ? "∞"
            : district === "D"
              ? "+"
              : "≈"}
      </text>
    </g>
  );
}

export default function WorldArt({
  state,
  active,
  onSelect,
  onMemory,
  compact,
  running = true,
  round,
  history,
  rules = config,
  phase = "Campaign",
  voteProgress = 0,
  election,
  proposals,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const [inspected, setInspected] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(Boolean(round));
  useEffect(() => {
    setCelebrating(Boolean(round));
    if (!round) return;
    const timer = window.setTimeout(() => setCelebrating(false), 4700);
    return () => window.clearTimeout(timer);
  }, [round?.id]);
  const memories = memoriesFor(history ?? (round ? [round] : []), rules);
  const memory = memories.find((m) => m.id === inspected);
  const currentThoughts = thoughts(state, rules);
  const hasNewMemories = memories.some((m) => m.day === round?.before.day);
  const lead =
    (celebrating || compact) && round
      ? leadFor(round.policy, round.policies)
      : phase === "Resolution" && election && proposals
        ? leadFor(proposals[election.winner], proposals)
        : null;
  const ballotCount = election?.ballots.length ?? 0;
  const votesShown =
    phase === "Voting"
      ? Math.floor(voteProgress * ballotCount)
      : phase === "Resolution"
        ? ballotCount
        : 0;
  const glow = `url(#${uid}-glow)`;
  const selectPersona = (d: District) => {
    setInspected(null);
    onSelect?.(d);
  };
  return (
    <div
      className={`headquarters ${compact ? "compact-hq" : ""} ${running ? "hq-running" : ""}`}
    >
      <svg
        className="world-art"
        viewBox={compact ? "0 35 1000 535" : "0 0 1000 620"}
        role="group"
        aria-label={`MINDSPACE headquarters. ${fmt(state.energy)} energy, ${fmt(state.taskProgress)} presentation points, ${fmt(state.method, 2)}× method.`}
      >
        <defs>
          <radialGradient id={`${uid}-room`} cx="50%" cy="33%" r="70%">
            <stop stopColor="#7353b3" />
            <stop offset=".55" stopColor="#382456" />
            <stop offset="1" stopColor="#24112f" />
          </radialGradient>
          <radialGradient id={`${uid}-window`}>
            <stop stopColor="#ffdfb8" />
            <stop offset=".4" stopColor="#d5a4e9" />
            <stop offset="1" stopColor="#6645a0" />
          </radialGradient>
          <linearGradient id={`${uid}-arch`} x2=".3" y2="1">
            <stop stopColor="#d7b4ef" />
            <stop offset=".5" stopColor="#8661b6" />
            <stop offset="1" stopColor="#462762" />
          </linearGradient>
          <linearGradient id={`${uid}-floor`} x2="0" y2="1">
            <stop stopColor="#a175a6" />
            <stop offset="1" stopColor="#301a43" />
          </linearGradient>
          <linearGradient id={`${uid}-desk`} x2="0" y2="1">
            <stop stopColor="#ffafdc" />
            <stop offset=".22" stopColor="#f65ca9" />
            <stop offset=".56" stopColor="#d72f87" />
            <stop offset="1" stopColor="#8c225e" />
          </linearGradient>
          <linearGradient id={`${uid}-desktop`} x2="0" y2="1">
            <stop stopColor="#ffb0dc" />
            <stop offset=".5" stopColor="#fa75bc" />
            <stop offset="1" stopColor="#dd3897" />
          </linearGradient>
          {districts.map((d) => (
            <linearGradient id={`${uid}-${d}`} key={d} x2="1" y2=".7">
              <stop stopColor="#fff7e2" />
              <stop offset=".3" stopColor={districtInfo[d].color} />
              <stop
                offset="1"
                stopColor={
                  d === "A"
                    ? "#d78522"
                    : d === "C"
                      ? "#d94c7c"
                      : d === "D"
                        ? "#2084b7"
                        : "#329d88"
                }
              />
            </linearGradient>
          ))}
          <filter
            id={`${uid}-glow`}
            x="-80%"
            y="-80%"
            width="260%"
            height="260%"
          >
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        <rect width="1000" height="620" fill={`url(#${uid}-room)`} />
        <ellipse
          cx="500"
          cy="160"
          rx="198"
          ry="148"
          fill={`url(#${uid}-window)`}
        />
        <g fill="none" strokeLinecap="round">
          <path
            d="M274 280V176C274-33 726-33 726 176V280"
            stroke="#301b50"
            strokeWidth="49"
          />
          <path
            d="M274 280V176C274-33 726-33 726 176V280"
            stroke={`url(#${uid}-arch)`}
            strokeWidth="32"
          />
          <path
            d="M291 278V177C291-11 709-11 709 177V278"
            stroke="#edcfff"
            strokeWidth="3"
            opacity=".75"
          />
          <path
            d="M500 10V298M324 80 675 267M676 80 325 267"
            stroke="#efcfff"
            strokeWidth="3"
            opacity=".22"
          />
          <path
            d="M0 30Q500-115 1000 30M0 56Q500-88 1000 56"
            stroke="#b087d9"
            strokeWidth="9"
            opacity=".6"
          />
        </g>
        <g
          className="mind-orbit"
          transform="translate(500 125)"
          fill="none"
          stroke="#fff0d9"
        >
          <ellipse
            rx="63"
            ry="28"
            strokeWidth="1.5"
            opacity=".6"
            transform="rotate(-28)"
          />
          <ellipse
            rx="63"
            ry="28"
            strokeWidth="1"
            opacity=".5"
            transform="rotate(28)"
          />
          <path d="M0-32 23 0 0 32-23 0Z" fill="#fff2c9" strokeWidth="2" />
          <path d="M0-32V32L-23 0Z" fill="#ffbde8" />
          <circle cx="57" cy="-18" r="5" fill="#d9ffae" />
        </g>

        {/* Empty sockets are architecture, not invented memories. */}
        {[0, 1].map((side) => (
          <g key={side} transform={`translate(${side ? 748 : 32} 61)`}>
            <rect
              width="220"
              height="233"
              rx="26"
              fill="#281637"
              stroke="#b48bd1"
              strokeWidth="7"
            />
            <path
              d="M10 24Q110 0 210 24"
              stroke="#f8bfff"
              strokeWidth="2"
              fill="none"
              opacity=".65"
            />
            {Array.from({ length: 6 }, (_, row) => (
              <g key={row} transform={`translate(0 ${40 + row * 32})`}>
                <path
                  d="M10 20H210"
                  stroke="#80529e"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <path
                  d="M12 17H208"
                  stroke="#d4a0df"
                  strokeWidth="2"
                  opacity=".7"
                />
                {[52, 110, 168].map((x) => (
                  <ellipse
                    key={x}
                    cx={x}
                    cy="7"
                    rx="17"
                    ry="5"
                    fill="#b188db"
                    opacity=".13"
                  />
                ))}
              </g>
            ))}
          </g>
        ))}
        <path d="M0 327Q500 264 1000 327V620H0Z" fill={`url(#${uid}-floor)`} />
        <g fill="none" stroke="#e7bcf5" opacity=".23">
          <ellipse cx="500" cy="475" rx="440" ry="132" strokeWidth="3" />
          <ellipse cx="500" cy="475" rx="377" ry="108" />
          <path d="M0 488 1000 488M132 620 388 319M868 620 612 319M500 315V620" />
        </g>
        <ellipse
          cx="500"
          cy="495"
          rx="324"
          ry="86"
          fill="#ff66bd"
          opacity=".19"
          filter={glow}
        />

        {/* Transport tracks lead from the console to real event crystals. */}
        <g fill="none" strokeLinecap="round">
          <path
            d="M447 402C250 460 3 367 84 108M553 402C750 460 997 367 916 108"
            stroke="#22132e"
            strokeWidth="16"
          />
          <path
            d="M447 402C250 460 3 367 84 108M553 402C750 460 997 367 916 108"
            stroke="#bd8cd3"
            strokeWidth="7"
          />
          <path
            className="memory-track"
            d="M447 402C250 460 3 367 84 108M553 402C750 460 997 367 916 108"
            stroke="#ffd4fa"
            strokeWidth="2"
            strokeDasharray="2 20"
          />
        </g>

        {districts.map((d, i) => {
          const x = positions[d];
          const forward = lead === d;
          const color = districtInfo[d].color;
          const gain = round
            ? {
                A: round.activity.taskGain,
                C: round.activity.connectionGain,
                D: round.activity.methodGain,
                R: round.activity.restored,
              }[d]
            : 0;
          return (
            <g
              key={d}
              transform={`translate(${x} ${forward ? 352 : 330})`}
              className={`persona-position ${forward ? "persona-leading" : ""} ${active === d ? "persona-selected" : ""} ${active && active !== d ? "persona-unfocused" : ""}`}
              style={
                {
                  "--persona": color,
                  "--idle-delay": `${i * -0.9}s`,
                } as React.CSSProperties
              }
              role="button"
              tabIndex={0}
              aria-label={`${compact ? "Solo" : "Focus"} ${districtInfo[d].name}`}
              aria-pressed={active === d}
              onClick={() => selectPersona(d)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectPersona(d);
                }
              }}
            >
              <ellipse cy="73" rx="57" ry="13" fill="#241032" opacity=".4" />
              {active === d && (
                <ellipse
                  cy="73"
                  rx="66"
                  ry="18"
                  stroke={color}
                  strokeWidth="2"
                  fill={color}
                  fillOpacity=".13"
                />
              )}
              <g className={`persona-idle persona-${d}`}>
                <g stroke="#3c254e" strokeWidth="5" strokeLinecap="round">
                  <path d="M-17 46-23 68-36 69M17 46 23 68 36 69" />
                </g>
                {d === "A" && (
                  <>
                    <path
                      d="M-40 36-29-44Q0-69 29-44L40 36Q0 61-40 36Z"
                      fill={`url(#${uid}-A)`}
                      stroke="#ffd98b"
                      strokeWidth="2"
                    />
                    <path
                      d="M-23-48-12-77 0-57 14-80 24-44"
                      fill="#ffd36f"
                      stroke="#fff1b2"
                      strokeWidth="2"
                    />
                    <path
                      d="M-32 0-50 24M28 4 48 14"
                      stroke="#f9c65d"
                      strokeWidth="12"
                      strokeLinecap="round"
                    />
                    <g className="clipboard">
                      <rect
                        x="31"
                        y="-5"
                        width="35"
                        height="45"
                        rx="5"
                        fill="#fff1c8"
                        stroke="#a96739"
                        strokeWidth="3"
                        transform="rotate(10 46 16)"
                      />
                      <path
                        d="M43-7H56V1H43ZM42 12H56M42 21H56M42 30H51"
                        fill="none"
                        stroke="#c38443"
                        strokeWidth="3"
                      />
                    </g>
                    <path
                      d="M-21-17-8-21M9-23 22-18"
                      stroke="#6c432e"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </>
                )}
                {d === "C" && (
                  <>
                    <path
                      d="M-42 22Q-55-5-33-26Q-46-66-12-67Q5-80 21-60Q55-57 40-24Q62 13 36 38Q1 62-42 22Z"
                      fill={`url(#${uid}-C)`}
                      stroke="#ffb3d0"
                      strokeWidth="2"
                    />
                    <path
                      d="M-14-66Q0-94 18-73"
                      stroke="#ffb5d7"
                      fill="none"
                      strokeWidth="7"
                      strokeLinecap="round"
                    />
                    <path
                      d="M-32 8-50 17M32 8 49 17"
                      stroke="#ff8fa8"
                      strokeWidth="11"
                      strokeLinecap="round"
                    />
                    <g className="linked-crystals" transform="translate(0 28)">
                      <path d="M-22 0H22" stroke="#ffe1ed" strokeWidth="3" />
                      <g transform="translate(-23 0) scale(.58)">
                        <Crystal district="C" />
                      </g>
                      <g transform="translate(23 0) scale(.58)">
                        <Crystal district="C" />
                      </g>
                    </g>
                  </>
                )}
                {d === "D" && (
                  <>
                    <path
                      d="M0-70 40-35 35 29 0 52-35 29-40-35Z"
                      fill={`url(#${uid}-D)`}
                      stroke="#a8f5ff"
                      strokeWidth="2"
                    />
                    <path
                      d="M0-70-12-29 0 52-35 29-40-35Z"
                      fill="#fff"
                      opacity=".16"
                    />
                    <path
                      d="M-31 7-52-1M31 7 54-15"
                      stroke="#6ce6ef"
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                    <g
                      className="floating-prism"
                      transform="translate(63 -45) scale(.8)"
                    >
                      <Crystal district="D" glow={glow} />
                      <ellipse
                        rx="29"
                        ry="9"
                        fill="none"
                        stroke="#e4fcff"
                        strokeWidth="1.5"
                        transform="rotate(-25)"
                      />
                    </g>
                    <path
                      d="M-24-30-8-34M8-34 24-30"
                      stroke="#1b6f91"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </>
                )}
                {d === "R" && (
                  <>
                    <path
                      d="M-49 25Q-60-21-28-48Q0-73 29-48Q61-20 49 25Q28 55 0 51Q-32 55-49 25Z"
                      fill={`url(#${uid}-R)`}
                      stroke="#b1f6d3"
                      strokeWidth="2"
                    />
                    <path
                      d="M-32-43Q-41-76-18-67Q-1-64 0-56"
                      fill="#c8f1c1"
                      stroke="#91d5a8"
                      strokeWidth="2"
                    />
                    <path
                      d="M-39 10-56 24M39 10 52 19"
                      stroke="#9ce8be"
                      strokeWidth="12"
                      strokeLinecap="round"
                    />
                    <g className="lantern" transform="translate(57 37)">
                      <circle
                        r="29"
                        fill="#e2ff8d"
                        opacity=".55"
                        filter={glow}
                      />
                      <path
                        d="M-7-10V-19Q0-31 7-19V-10"
                        fill="none"
                        stroke="#e0f8a6"
                        strokeWidth="3"
                      />
                      <rect
                        x="-13"
                        y="-12"
                        width="26"
                        height="31"
                        rx="8"
                        fill="#d9ff9e"
                        stroke="#eefec4"
                        strokeWidth="2"
                      />
                      <path
                        d="M0-5V12M-8 3H8"
                        stroke="#fffdeb"
                        strokeWidth="3"
                      />
                    </g>
                  </>
                )}
                <g className="persona-eyes" fill="#39223d">
                  {d === "R" && state.energy < rules.energyCap * 0.4 ? (
                    <path
                      d="M-22-10H-11M11-10H22"
                      stroke="#39223d"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  ) : (
                    <>
                      <ellipse cx="-16" cy="-11" rx="4" ry="6" />
                      <ellipse cx="16" cy="-11" rx="4" ry="6" />
                      <circle cx="-15" cy="-13" r="1.2" fill="#fff" />
                      <circle cx="17" cy="-13" r="1.2" fill="#fff" />
                    </>
                  )}
                </g>
                <ellipse
                  cx="-27"
                  cy="0"
                  rx="7"
                  ry="4"
                  fill="#ff7599"
                  opacity=".4"
                />
                <ellipse
                  cx="27"
                  cy="0"
                  rx="7"
                  ry="4"
                  fill="#ff7599"
                  opacity=".4"
                />
                <path
                  d={
                    d === "C" && state.connectionResult === false
                      ? "M-9 14Q0 4 9 14"
                      : "M-9 7Q0 19 9 7"
                  }
                  fill="none"
                  stroke="#69334f"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </g>
              <g
                className={`thought-bubble ${phase === "Campaign" || active === d ? "thought-visible" : ""}`}
                transform={`translate(0 ${forward ? -181 : -159})`}
              >
                <path
                  d="M-78-35H78Q86-35 86-25V15Q86 25 76 25H14L0 40-6 25H-76Q-86 25-86 15V-25Q-86-35-78-35Z"
                  fill="#fff6fc"
                  stroke={color}
                  strokeWidth="2"
                />
                <text
                  textAnchor="middle"
                  y="-10"
                  fill="#492446"
                  fontSize="11.5"
                  fontWeight="bold"
                >
                  {currentThoughts[d][0]}
                </text>
                <text textAnchor="middle" y="10" fill="#795579" fontSize="10.5">
                  {currentThoughts[d][1]}
                </text>
              </g>
              {celebrating && gain > 0 && (
                <text
                  key={round?.id}
                  className="outcome-pop"
                  y="-99"
                  textAnchor="middle"
                  fill={color}
                  fontSize="16"
                  fontWeight="bold"
                >
                  +{fmt(gain, d === "D" ? 2 : 1)}{" "}
                  {d === "A"
                    ? "progress"
                    : d === "C"
                      ? "visit"
                      : d === "D"
                        ? "method"
                        : "replenished"}
                </text>
              )}
            </g>
          );
        })}

        {/* The hot-pink desk remains a common visual reference in both worlds. */}
        <path
          d="M163 426Q165 370 278 362Q500 404 722 362Q835 370 837 426L801 492Q500 587 199 492Z"
          fill={`url(#${uid}-desk)`}
          stroke="#ffacd9"
          strokeWidth="2"
        />
        <path
          d="M166 416Q168 361 278 356Q500 397 722 356Q832 361 834 416Q500 516 166 416Z"
          fill={`url(#${uid}-desktop)`}
          stroke="#ffd2ed"
          strokeWidth="3"
        />
        <path
          d="M183 438Q500 541 817 438"
          fill="none"
          stroke="#ff95ce"
          strokeWidth="3"
        />
        <path
          className="desk-reflection"
          d="M270 451Q430 491 587 465L550 512Q392 516 270 479Z"
          fill="#fff0ff"
          opacity=".12"
        />
        <ellipse
          cx="500"
          cy="403"
          rx="70"
          ry="22"
          fill="#421d61"
          stroke="#ffb4e4"
          strokeWidth="3"
        />
        <ellipse cx="500" cy="400" rx="53" ry="14" fill="#8e4f9f" />
        <text
          x="500"
          y="404"
          textAnchor="middle"
          fill="#ffe2ef"
          fontSize="10"
          letterSpacing="1"
        >
          {celebrating
            ? hasNewMemories
              ? "MEMORY FORMED"
              : "CHOICE RESOLVED"
            : phase === "Campaign"
              ? "6 BLOCKS · 1 CHOICE"
              : `${votesShown} / ${ballotCount} VOTES`}
        </text>
        {districts.map((d, i) => (
          <g
            key={d}
            transform={`translate(${270 + i * 153} ${i === 0 || i === 3 ? 408 : 442})`}
          >
            <rect
              x="-37"
              y="-18"
              width="74"
              height="24"
              rx="8"
              fill="#68305e"
              stroke="#ffd0e9"
              strokeWidth="1.5"
            />
            {Array.from({ length: 5 }, (_, n) => (
              <rect
                key={n}
                x={-27 + n * 12}
                y="-11"
                width="7"
                height="10"
                rx="3"
                fill={districtInfo[d].color}
                opacity={0.35 + n * 0.13}
              />
            ))}
            <circle
              cy="22"
              r="10"
              fill={districtInfo[d].color}
              stroke="#fff0e5"
              strokeWidth="2"
            />
            <text
              y="26"
              textAnchor="middle"
              fill="#4b2549"
              fontSize="11"
              fontWeight="bold"
            >
              {districtInfo[d].symbol}
            </text>
          </g>
        ))}
        {Array.from({ length: rules.residentCount }, (_, i) => {
          const ballot = election?.ballots[i];
          const d =
            ballot && proposals
              ? leadFor(proposals[ballot.choice], proposals)
              : "D";
          return (
            <circle
              key={i}
              className="vote-light"
              cx={293 + i * 18}
              cy={488 + Math.sin((i / 23) * Math.PI) * 27}
              r="4"
              fill={i < votesShown ? districtInfo[d].color : "#813563"}
              stroke={i < votesShown ? "#fff3db" : "#ab4b83"}
              strokeWidth="1"
            />
          );
        })}
        <text
          x="500"
          y="552"
          textAnchor="middle"
          fill="#f8b9e2"
          letterSpacing="8"
          fontSize="11"
        >
          YOUR INNER WORLD, IN COMPOSITION
        </text>

        {memories.map((m, i) => {
          const side = i % 2;
          const socket = Math.floor(i / 2);
          const x = (side ? 748 : 32) + 52 + (socket % 3) * 58;
          const y = 101 + Math.floor(socket / 3) * 32;
          const fresh = celebrating && m.day === round?.before.day;
          return (
            <g key={m.id}>
              <g
                transform={`translate(${x} ${y})`}
                role="button"
                tabIndex={0}
                aria-label={`Day ${m.day}: ${m.title}. ${m.choice}`}
                aria-pressed={memory?.id === m.id}
                className={`memory-crystal ${fresh ? "memory-arriving" : ""}`}
                onClick={() => setInspected(m.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setInspected(m.id);
                  }
                }}
              >
                <title>{`Day ${m.day} · ${m.choice} · ${m.outcome}`}</title>
                <circle r="23" fill="transparent" />
                <g transform="scale(.63)">
                  <Crystal district={m.district} glow={glow} />
                </g>
                {memory?.id === m.id && (
                  <circle r="20" fill="none" stroke="#fff3df" strokeWidth="2" />
                )}
              </g>
              {fresh && (
                <g className="travelling-memory">
                  <animateMotion
                    ref={beginFlight}
                    dur="2.6s"
                    begin="indefinite"
                    fill="freeze"
                    path={`M500 416C${side ? 990 : 10} 490 ${side ? 990 : 10} 295 ${x} ${y}`}
                  />
                  <g transform="scale(.9)">
                    <Crystal district={m.district} glow={glow} />
                  </g>
                </g>
              )}
            </g>
          );
        })}
        {Array.from({ length: 17 }, (_, i) => (
          <circle
            key={i}
            className="hq-sparkle"
            cx={30 + ((i * 137) % 940)}
            cy={30 + ((i * 71) % 480)}
            r={i % 3 === 0 ? 2 : 1}
            fill={districtInfo[districts[i % 4]].color}
            style={{ animationDelay: `${i * -0.4}s` }}
          />
        ))}
      </svg>
      <div className="persona-selector" aria-label="Meet the four perspectives">
        {districts.map((d) => (
          <button
            key={d}
            className={active === d ? "selected" : ""}
            style={
              { "--persona": districtInfo[d].color } as React.CSSProperties
            }
            onClick={() => selectPersona(d)}
            aria-pressed={active === d}
          >
            <span aria-hidden="true">{districtInfo[d].symbol}</span>
            <span>
              {districtInfo[d].name}
              <small>
                {d === "A"
                  ? `${fmt(state.taskProgress)} presentation`
                  : d === "C"
                    ? `${fmt(state.connectionProgress)} visit`
                    : d === "D"
                      ? `${fmt(state.method, 2)}× method`
                      : `${fmt(state.energy)} energy`}
              </small>
            </span>
          </button>
        ))}
      </div>
      {memories.length > 0 && (
        <label className="memory-picker">
          REVISIT A MEMORY
          <select
            aria-label="Revisit a memory"
            value={memory?.id ?? ""}
            onChange={(e) => setInspected(e.target.value || null)}
          >
            <option value="">Choose a crystal…</option>
            {memories.map((m) => (
              <option key={m.id} value={m.id}>
                Day {m.day} · {m.title} · {m.choice}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className={`hq-caption ${memory ? "memory-open" : ""}`}>
        {memory ? (
          <>
            <span
              className="memory-icon"
              style={{ color: districtInfo[memory.district].color }}
            >
              {districtInfo[memory.district].symbol}
            </span>
            <div>
              <small>
                DAY {memory.day} · {memory.choice}
                {memory.manual ? " · INTERVENTION" : ""}
              </small>
              <b>{memory.title}</b>
              <p>{memory.outcome}</p>
              {onMemory && (
                <button onClick={() => onMemory(memory.day)}>
                  Inspect this day’s votes & maths →
                </button>
              )}
            </div>
            <button
              className="memory-close"
              aria-label="Close memory"
              onClick={() => setInspected(null)}
            >
              ×
            </button>
          </>
        ) : (
          <>
            <span className="memory-icon">✦</span>
            <div>
              <b>
                {celebrating && round
                  ? `${round.policy.name} ${round.manual ? "was chosen" : "won"}.${hasNewMemories ? " A moment became a memory." : " Every allocation leaves a trace."}`
                  : active
                    ? `${districtInfo[active].name}: “${currentThoughts[active].join(" ")}”`
                    : "Four perspectives. One shared mind."}
              </b>
              <p>
                {memories.length
                  ? `${memories.length} real ${memories.length === 1 ? "memory" : "memories"} on the shelves. Select a glowing crystal to revisit its choice and outcome.`
                  : round
                    ? "No new milestone yet. Keep exploring to fill these shelves."
                    : "The shelves are waiting. Resolve a day to make your first real memories."}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  Compass,
  Headphones,
  HelpCircle,
  Home,
  Pause,
  Play,
  Settings2,
  SkipForward,
  Sparkles,
  X,
} from "lucide-react";
import {
  districtInfo,
  districts,
  fmt,
  judgeSetup,
  scenarios,
  setupForThought,
  validateSetup,
  type Config,
  type District,
  type Election,
  type Round,
  type Setup,
  type State,
} from "./simulation";
import { memoriesFor } from "./memories";
import WorldArt from "./WorldArt";
import "./universe.css";

export const locations = {
  hub: {
    title: "The inner universe",
    subtitle: "Four voices. Infinite possibilities.",
    symbol: "✳",
    color: "#cbb3ff",
  },
  headquarters: {
    title: "Thought Headquarters",
    subtitle: "Every universe begins with a thought.",
    symbol: "⌘",
    color: "#d6b4ff",
  },
  memory: {
    title: "Memory Chamber",
    subtitle: "Some moments become part of you.",
    symbol: "◌",
    color: "#ffb2cf",
  },
  decision: {
    title: "Decision Chamber",
    subtitle: "Different voices. One shared future.",
    symbol: "△",
    color: "#ffd36c",
  },
  parallel: {
    title: "Parallel Worlds",
    subtitle: "A different choice. A different constellation.",
    symbol: "⑂",
    color: "#c9a9ff",
  },
  observatory: {
    title: "The Observatory",
    subtitle: "A little wonder. Nothing hidden.",
    symbol: "⌁",
    color: "#70bfff",
  },
  symphony: {
    title: "Symphony Chamber",
    subtitle: "This is what your world sounds like.",
    symbol: "♫",
    color: "#a5ecc0",
  },
  A: {
    title: "Ambition",
    subtitle: "A little higher. A little closer.",
    symbol: "△",
    color: "#ffd36c",
  },
  C: {
    title: "Emotion",
    subtitle: "The things that make it matter.",
    symbol: "♡",
    color: "#ff8fab",
  },
  D: {
    title: "Logic",
    subtitle: "There is always another way.",
    symbol: "◇",
    color: "#70bfff",
  },
  R: {
    title: "Wellbeing",
    subtitle: "Even a universe needs to breathe.",
    symbol: "❋",
    color: "#a5ecc0",
  },
} as const;
export type Location = keyof typeof locations;
const Scene = lazy(() => import("./MindScene"));

class SceneBoundary extends Component<
  { children: ReactNode; onUnavailable: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onUnavailable();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface Props {
  entered: boolean;
  room: Location;
  onEnter: () => void;
  onVisit: (room: Location) => void;
  state: State;
  rules: Config;
  history: Round[];
  election: Election;
  phase: string;
  voteProgress: number;
  pair: { a: Round; b: Round } | null;
  setup: Setup;
  onSetup: (setup: Setup) => void;
  onApply: (setup: Setup) => void;
  onInspect: (day: number) => void;
  onHelp: () => void;
  onPlay: () => void;
  onStep: () => void;
  playing: boolean;
  frozen: boolean;
  sounding: boolean;
  soundOn: boolean;
  onSound: () => void;
  solo: District | null;
  onSolo: (d: District | null) => void;
  children: ReactNode;
}

export default function MindUniverse(props: Props) {
  const {
    entered,
    room,
    state,
    rules,
    history,
    pair,
    onVisit,
    setup,
    onSetup,
    onApply,
  } = props;
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [lite, setLite] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [settings, setSettings] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [thought, setThought] = useState("");
  const [thoughtResult, setThoughtResult] = useState("");
  const [memoryId, setMemoryId] = useState<string | null>(null);
  const memories = memoriesFor(history, rules);
  const memory = memories.find((m) => m.id === memoryId);
  const district = districts.includes(room as District)
    ? (room as District)
    : null;
  const info = locations[room];
  const flat = lite || unavailable;
  useEffect(() => {
    setArrived(flat || reduced);
    setMapOpen(false);
  }, [room, entered, flat, reduced]);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  function visit(next: Location) {
    if (next === "parallel" && !history.length) return;
    if (next !== room) setArrived(flat || reduced);
    onVisit(next);
    setMapOpen(false);
  }
  function openMemory(id: string) {
    setMemoryId(id);
    visit("memory");
  }
  function submitThought(e: React.FormEvent) {
    e.preventDefault();
    const text = thought.trim();
    if (!text || validateSetup(setup)) return;
    const next = setupForThought(text, setup);
    onSetup(next);
    onApply(next);
    setThoughtResult(
      `Thought received. ${next.taskProgress ? "A head start: 10 presentation points." : "A fresh presentation: 0 points."} Energy: ${next.energy} tokens. Your four voices are ready.`,
    );
  }
  const motionProps = reduced
    ? { initial: false as const }
    : { initial: { opacity: 0, y: 14 } };
  return (
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>
      <div
        className={`mind-universe ${entered ? "inside-mind" : "outside-mind"} ${flat ? "lightweight" : "full-3d"} ${reduced ? "still-mind" : ""} room-${room}`}
        style={{ "--location": info.color } as CSSProperties}
      >
        <div
          className="universe-canvas"
          aria-label={
            flat
              ? "Lightweight illustrated mind world"
              : "Interactive 3D mind world"
          }
        >
          {flat ? (
            <div className="illustrated-world">
              {entered ? (
                <WorldArt
                  state={state}
                  rules={rules}
                  history={history}
                  round={history.at(-1)}
                  running={props.playing && !reduced}
                  active={district}
                  onSelect={(d) => visit(d)}
                  onMemory={(day) => {
                    const m = memories.find((m) => m.day === day);
                    if (m) openMemory(m.id);
                  }}
                />
              ) : (
                <svg
                  viewBox="0 0 600 400"
                  role="img"
                  aria-label="An illuminated two-hemisphere brain"
                >
                  <defs>
                    <radialGradient id="brain-light">
                      <stop stopColor="#d9b5ff" />
                      <stop offset="1" stopColor="#58436e" />
                    </radialGradient>
                  </defs>
                  {[-1, 1].map((side) => (
                    <g
                      key={side}
                      transform={`translate(${300 + side * 85},180)`}
                    >
                      <ellipse
                        rx="100"
                        ry="130"
                        fill="url(#brain-light)"
                        stroke="#d6b4ff"
                        strokeWidth="2"
                      />
                      {Array.from({ length: 8 }, (_, i) => (
                        <path
                          key={i}
                          d={`M -60 ${-85 + i * 24} Q -20 ${-125 + i * 24} 0 ${-85 + i * 24} T 70 ${-75 + i * 24}`}
                          fill="none"
                          stroke={i % 2 ? "#ffd3e5" : "#a3c9ff"}
                          strokeWidth="4"
                        />
                      ))}
                    </g>
                  ))}
                </svg>
              )}
            </div>
          ) : (
            <SceneBoundary onUnavailable={() => setUnavailable(true)}>
              <Suspense
                fallback={
                  <div className="world-loading" role="status">
                    <span />
                    Gathering your thoughts…
                  </div>
                }
              >
                <Scene
                  entered={entered}
                  room={room}
                  state={state}
                  rules={rules}
                  history={history}
                  election={props.election}
                  phase={props.phase}
                  voteProgress={props.voteProgress}
                  reduced={reduced}
                  sounding={props.sounding}
                  solo={props.solo}
                  pair={pair}
                  onVisit={visit}
                  onMemory={openMemory}
                  onArrive={() => setArrived(true)}
                  onUnavailable={() => setUnavailable(true)}
                />
              </Suspense>
            </SceneBoundary>
          )}
        </div>
        <div className="universe-vignette" />
        <header className="universe-header">
          <button
            className="universe-brand"
            onClick={() => (entered ? visit("hub") : props.onHelp())}
            aria-label={entered ? "Return to central hub" : "About MINDSPACE"}
          >
            <span>✳</span> MINDSPACE<sup>®</sup>
          </button>
          <span className="universe-edition">AN EXPLORATION OF YOU</span>
          <div className="universe-tools">
            <button
              className={props.soundOn ? "tool-on" : ""}
              onClick={props.onSound}
              aria-label={props.soundOn ? "Mute sound" : "Enable sound"}
              title={props.soundOn ? "Mute sound" : "Enable sound"}
            >
              <Headphones size={17} />
            </button>
            <button
              aria-label="Experience settings"
              aria-expanded={settings}
              onClick={() => setSettings(!settings)}
            >
              <Settings2 size={17} />
            </button>
            <button aria-label="How to explore" onClick={props.onHelp}>
              <HelpCircle size={17} />
            </button>
          </div>
        </header>
        {settings && (
          <section
            className="experience-settings glass"
            aria-label="Experience settings"
          >
            <b>Make yourself comfortable.</b>
            <label>
              <input
                type="checkbox"
                checked={reduced}
                onChange={(e) => setReduced(e.target.checked)}
              />{" "}
              Reduced motion
            </label>
            <label>
              <input
                type="checkbox"
                checked={flat}
                disabled={unavailable}
                onChange={(e) => setLite(e.target.checked)}
              />{" "}
              Lightweight illustrated mode
            </label>
            <small>
              {unavailable
                ? "3D is unavailable. All decisions, music and history still work."
                : "Switch modes at any time. Your world stays intact."}
            </small>
            <button onClick={() => setSettings(false)}>
              Close settings <X size={14} />
            </button>
          </section>
        )}
        {!entered && props.children}
        <AnimatePresence mode="wait">
          {!entered ? (
            <motion.main
              key="entrance"
              className="brain-entrance"
              {...motionProps}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.5 } }}
            >
              <div className="entrance-heading">
                <span className="cosmic-eyebrow">
                  A LITTLE WONDER. A WHOLE WORLD WITHIN.
                </span>
                <h1>MINDSPACE</h1>
              </div>
              <div className="entrance-action">
                <p>
                  An entire universe lives
                  <br className="narrow-only" /> inside your mind.
                </p>
                <button className="enter-mind" onClick={props.onEnter}>
                  ENTER YOUR MIND <ArrowRight size={18} />
                </button>
                <span className="entrance-hint">
                  <i /> MOVE YOUR CURSOR. FOLLOW YOUR CURIOSITY.
                </span>
              </div>
              <div className="entrance-foot">
                <span>ORIGINAL WORLDS · HUMAN POSSIBILITIES</span>
                <span>A FICTIONAL MODEL. NOT A DIAGNOSIS.</span>
              </div>
              <div className="orbital-word word-ambition">
                △ &nbsp; AMBITION
              </div>
              <div className="orbital-word word-emotion">♡ &nbsp; EMOTION</div>
              <div className="orbital-word word-logic">◇ &nbsp; LOGIC</div>
              <div className="orbital-word word-wellbeing">
                ❋ &nbsp; WELLBEING
              </div>
            </motion.main>
          ) : (
            <motion.div
              key="interior"
              className="inner-interface"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduced || flat ? 0 : 1.3, duration: 0.6 }}
            >
              <div className="location-heading">
                <span className="cosmic-eyebrow">
                  {room === "hub"
                    ? "WELCOME TO YOUR INNER WORLD"
                    : "WITHIN THE MIND / " +
                      (district
                        ? "DISTRICT " +
                          (districts.indexOf(district) + 1)
                            .toString()
                            .padStart(2, "0")
                        : "A NEW PERSPECTIVE")}
                </span>
                <h1 key={room} tabIndex={-1}>
                  {info.title}
                  <span>.</span>
                </h1>
                <p>{info.subtitle}</p>
                <span className="travel-status" role="status">
                  {arrived
                    ? room === "hub"
                      ? "Choose an island or follow a pathway."
                      : "You’ve arrived. Stay curious."
                    : "Following the neural pathways…"}
                </span>
              </div>
              {room === "hub" && (
                <div className="hub-invitation">
                  <button onClick={() => visit("headquarters")}>
                    <Sparkles size={17} />
                    <span>
                      What’s on your mind?
                      <small>Begin at Thought Headquarters</small>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              )}
              {room === "headquarters" && (
                <motion.section
                  key="thought"
                  className="thought-console cosmic-panel glass"
                  {...motionProps}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span className="cosmic-eyebrow">THE THOUGHT CONSOLE</span>
                  <h2>Let it take shape.</h2>
                  <form onSubmit={submitThought}>
                    <label htmlFor="thought">
                      What’s taking up space in your mind?
                    </label>
                    <textarea
                      id="thought"
                      maxLength={400}
                      value={thought}
                      onChange={(e) => setThought(e.target.value)}
                      placeholder="My presentation is in three days, but my friend is only here today…"
                      required
                    />
                    <div className="thought-prompts">
                      <button
                        type="button"
                        onClick={() => {
                          setThought(
                            "My presentation is due, but my friend is visiting.",
                          );
                          onSetup({ ...judgeSetup });
                        }}
                      >
                        A deadline & a friend
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setThought(
                            "I’m exhausted, but my presentation is almost done.",
                          )
                        }
                      >
                        Almost done, feeling tired
                      </button>
                    </div>
                    <details className="thought-assumptions">
                      <summary>
                        Starting assumptions <Settings2 size={13} />
                      </summary>
                      <label>
                        Dilemma variant
                        <select
                          value={setup.scenarioId}
                          onChange={(e) => {
                            const s = scenarios.find(
                              (s) => s.id === e.target.value,
                            )!;
                            onSetup({
                              ...setup,
                              scenarioId: s.id,
                              taskProgress: s.taskProgress,
                            });
                          }}
                        >
                          {scenarios.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div>
                        <label>
                          Energy
                          <input
                            aria-label="Starting energy"
                            type="number"
                            min="0"
                            max={setup.energyCap}
                            value={setup.energy}
                            onChange={(e) =>
                              onSetup({
                                ...setup,
                                energy: e.target.valueAsNumber,
                              })
                            }
                          />
                        </label>
                        <label>
                          Capacity
                          <input
                            aria-label="Energy capacity"
                            type="number"
                            min="1"
                            max="30"
                            value={setup.energyCap}
                            onChange={(e) =>
                              onSetup({
                                ...setup,
                                energyCap: e.target.valueAsNumber,
                              })
                            }
                          />
                        </label>
                        <label>
                          Progress
                          <input
                            aria-label="Starting task progress"
                            type="number"
                            min="0"
                            max="30"
                            value={setup.taskProgress}
                            onChange={(e) =>
                              onSetup({
                                ...setup,
                                taskProgress: e.target.valueAsNumber,
                              })
                            }
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className="subtle-button"
                        disabled={!!validateSetup(setup)}
                        onClick={() => {
                          onApply(setup);
                          setThoughtResult(
                            "Your starting assumptions are live. Visit the Decision Chamber when you’re ready.",
                          );
                        }}
                      >
                        Apply assumptions & reset world
                      </button>
                    </details>
                    {validateSetup(setup) && (
                      <p role="alert">{validateSetup(setup)}</p>
                    )}
                    {history.length > 0 && (
                      <p className="thought-disclosure">
                        A new thought resets this session’s choices and
                        memories.
                      </p>
                    )}
                    <button
                      className="cosmic-primary"
                      type="submit"
                      disabled={!thought.trim() || !!validateSetup(setup)}
                    >
                      RELEASE THOUGHT <ArrowRight size={15} />
                    </button>
                  </form>
                  <p className="thought-disclosure">
                    Local, not AI. “Almost done” sets 10 progress; “tired” sets
                    up to 4 energy. Other thoughts start the authored
                    deadline-and-visit dilemma. Nothing is sent or saved.
                  </p>
                  {thoughtResult && (
                    <div className="thought-response" role="status">
                      <span>✧</span>
                      <p>{thoughtResult}</p>
                    </div>
                  )}
                  <button
                    className="journey-link"
                    onClick={() => visit("decision")}
                  >
                    Hear your voices decide <ArrowRight size={15} />
                  </button>
                </motion.section>
              )}
              {district && (
                <motion.section
                  key={`district-${district}`}
                  className="district-story cosmic-panel glass"
                  {...motionProps}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span className="persona-symbol">{info.symbol}</span>
                  <span className="cosmic-eyebrow">
                    MEET YOUR {districtInfo[district].name.toUpperCase()} VOICE
                  </span>
                  <h2>
                    {
                      [
                        "“Let’s make it happen.”",
                        "“Make room for someone.”",
                        "“What if there’s a better way?”",
                        "“You can’t pour from empty.”",
                      ][districts.indexOf(district)]
                    }
                  </h2>
                  <div className="district-resource">
                    <strong>
                      {fmt(
                        district === "A"
                          ? state.taskProgress
                          : district === "C"
                            ? state.connectionProgress
                            : district === "D"
                              ? state.method
                              : state.energy,
                        2,
                      )}
                      {district === "D" ? "×" : ""}
                    </strong>
                    <span>
                      {district === "A"
                        ? `of ${rules.taskGoal} presentation points`
                        : district === "C"
                          ? `of ${rules.connectionGoal} visit points`
                          : district === "D"
                            ? "method multiplier · applies tomorrow"
                            : `of ${rules.energyCap} shared energy tokens`}
                    </span>
                  </div>
                  <p>
                    {districtInfo[district].purpose}{" "}
                    {district === "C" && state.connectionResult !== null
                      ? state.connectionResult
                        ? "The visit became a memory."
                        : "The visit window has closed."
                      : district === "A" && state.taskResult !== null
                        ? state.taskResult
                          ? "Your day-three deadline was met."
                          : "The day-three deadline was missed."
                        : "This island grows with your world’s real outcomes."}
                  </p>
                  <button
                    className="cosmic-primary"
                    onClick={() => {
                      props.onSolo(props.solo === district ? null : district);
                      if (!props.soundOn) props.onSound();
                    }}
                  >
                    <Headphones size={15} />
                    {props.solo === district
                      ? "RELEASE SOLO"
                      : "ISOLATE THIS VOICE"}
                  </button>
                  <button
                    className="journey-link"
                    onClick={() => visit("decision")}
                  >
                    Give it a voice in today’s decision <ArrowRight size={14} />
                  </button>
                </motion.section>
              )}
              {room === "memory" && (
                <section className="memory-shelf cosmic-panel glass">
                  <span className="cosmic-eyebrow">
                    ONLY MOMENTS THAT REALLY HAPPENED
                  </span>
                  <h2>
                    {memories.length
                      ? "A constellation of moments."
                      : "Your story is still unwritten."}
                  </h2>
                  {memories.length ? (
                    <>
                      <label htmlFor="memory-select">Choose a memory</label>
                      <select
                        id="memory-select"
                        value={memoryId ?? ""}
                        onChange={(e) => setMemoryId(e.target.value)}
                      >
                        <option value="" disabled>
                          Follow a glowing orb…
                        </option>
                        {memories.map((m) => (
                          <option key={m.id} value={m.id}>
                            Day {m.day} / {m.title}
                          </option>
                        ))}
                      </select>
                      {memory && (
                        <motion.div
                          className="selected-memory"
                          key={memory.id}
                          {...motionProps}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <span
                            className="memory-gem"
                            style={{
                              color: districtInfo[memory.district].color,
                            }}
                          >
                            ◈
                          </span>
                          <span className="cosmic-eyebrow">
                            DAY {memory.day} ·{" "}
                            {memory.manual ? "INTERVENTION" : "ELECTED CHOICE"}
                          </span>
                          <h3>{memory.title}</h3>
                          <p>{memory.outcome}</p>
                          <small>{memory.choice}</small>
                          <button
                            className="journey-link"
                            onClick={() => props.onInspect(memory.day)}
                          >
                            Trace this moment in the Observatory{" "}
                            <ArrowRight size={14} />
                          </button>
                        </motion.div>
                      )}
                    </>
                  ) : (
                    <>
                      <p>
                        Resolve your first day and its real outcomes become
                        glowing memories.
                      </p>
                      <button
                        className="journey-link"
                        onClick={() => visit("decision")}
                      >
                        Make a first memory <ArrowRight size={14} />
                      </button>
                    </>
                  )}
                </section>
              )}
              <div
                className={`room-content ${arrived ? "has-arrived" : "is-travelling"}`}
                key={room}
              >
                {props.children}
              </div>
              <div className="universe-transport glass">
                <span>
                  <i className={props.playing ? "transport-pulse" : ""} />
                  {props.frozen ? "FROZEN" : "DAY"}{" "}
                  {String(
                    props.frozen && pair
                      ? pair.a.before.day
                      : Math.min(state.day, rules.maxDays),
                  ).padStart(2, "0")}{" "}
                  <small>/ {rules.maxDays}</small>
                </span>
                <button
                  aria-label={
                    props.frozen
                      ? props.playing
                        ? "Pause comparison loops"
                        : "Play comparison loops"
                      : props.playing
                        ? "Pause world"
                        : "Play world"
                  }
                  disabled={!props.frozen && state.day > rules.maxDays}
                  onClick={props.onPlay}
                >
                  {props.playing ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <button
                  aria-label="Step one day"
                  title={
                    props.frozen
                      ? "Frozen comparison. Return to Decisions to step the live world."
                      : "Step one day"
                  }
                  disabled={props.frozen || state.day > rules.maxDays}
                  onClick={props.onStep}
                >
                  <SkipForward size={15} />
                </button>
                <span className="transport-energy">
                  ❋ {fmt(state.energy)}
                  <small> ENERGY</small>
                </span>
              </div>
              <nav
                className="journey-dock glass"
                aria-label="Travel through the mind"
              >
                <button
                  className={room === "hub" ? "current-location" : ""}
                  onClick={() => visit("hub")}
                  title="Central hub"
                >
                  <Home size={17} />
                  <span>Hub</span>
                </button>
                <span className="dock-divider" />
                {(
                  [
                    "headquarters",
                    "memory",
                    "decision",
                    "parallel",
                    "observatory",
                    "symphony",
                  ] as const
                ).map((place) => (
                  <button
                    key={place}
                    className={room === place ? "current-location" : ""}
                    aria-current={room === place ? "location" : undefined}
                    onClick={() => visit(place)}
                    disabled={place === "parallel" && !history.length}
                    title={
                      place === "parallel" && !history.length
                        ? "Resolve a day to open Parallel Worlds"
                        : locations[place].title
                    }
                  >
                    <b style={{ color: locations[place].color }}>
                      {locations[place].symbol}
                    </b>
                    <span>
                      {
                        {
                          headquarters: "Thoughts",
                          memory: "Memories",
                          decision: "Decisions",
                          parallel: "Worlds",
                          observatory: "Observe",
                          symphony: "Symphony",
                        }[place]
                      }
                    </span>
                  </button>
                ))}
                <span className="dock-divider" />
                <button
                  onClick={() => setMapOpen(!mapOpen)}
                  aria-expanded={mapOpen}
                  aria-label="Open mind atlas"
                >
                  <Compass size={17} />
                  <span>Atlas</span>
                </button>
              </nav>
              {mapOpen && (
                <section className="mind-atlas glass" aria-label="Mind atlas">
                  <span className="cosmic-eyebrow">CHOOSE A DESTINATION</span>
                  <div>
                    {(Object.keys(locations) as Location[]).map((place) => (
                      <button
                        disabled={place === "parallel" && !history.length}
                        key={place}
                        onClick={() => visit(place)}
                      >
                        <span style={{ color: locations[place].color }}>
                          {locations[place].symbol}
                        </span>
                        {locations[place].title}
                        <ArrowRight size={13} />
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {room === "hub" && (
                <div
                  className="hub-districts"
                  aria-label="District destinations"
                >
                  {districts.map((d) => (
                    <button
                      key={d}
                      onClick={() => visit(d)}
                      style={
                        { "--island": locations[d].color } as CSSProperties
                      }
                    >
                      <i />
                      {locations[d].title}
                      <ArrowRight size={12} />
                    </button>
                  ))}
                </div>
              )}
              {room !== "hub" && (
                <button className="back-to-hub" onClick={() => visit("hub")}>
                  <Home size={13} /> RETURN TO HUB
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <span className="world-coordinate">
          {entered
            ? "INNER SPACE / " + room.toUpperCase()
            : "01 / THE WORLD WITHIN"}{" "}
          <ArrowDown size={11} />
        </span>
      </div>
    </MotionConfig>
  );
}

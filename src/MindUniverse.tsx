import { BrainMotionContext } from "./brainMotion";
import { introLine } from "./dialogue";
import { taskText } from "./simulation";
import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useRef,
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
  isWorldComplete,
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
import MemoryShelf from "./MemoryShelf";
import { spiralDistrict } from "./hubSpiral";
import { voices } from "./dialogue";
import VoiceIcon from "./VoiceIcon";
import type { Cue } from "./journey";
import {
  cerebellumPx,
  cerebrumPx,
  stemPx,
  svgPath,
  zonePx,
} from "./brainShape";
import WorldArt from "./WorldArt";
import "./universe.css";
import "./journey.css";

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
    symbol: "⚖",
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
  A: {
    title: "Achievement",
    subtitle: "A little higher. A little closer.",
    symbol: "△",
    color: "#ffc531",
  },
  C: {
    title: "Connection",
    subtitle: "The things that make it matter.",
    symbol: "◎",
    color: "#ff7f8f",
  },
  D: {
    title: "Discovery",
    subtitle: "There is always another way.",
    symbol: "✧",
    color: "#4a90ff",
  },
  R: {
    title: "Recovery",
    subtitle: "Even a universe needs to breathe.",
    symbol: "≈",
    color: "#5fe3b4",
  },
} as const;
export type Location = keyof typeof locations;
const chamberRoute = ["headquarters", "memory", "decision", "parallel", "observatory"] as const;

function isTravelControl(target: EventTarget) {
  return target instanceof Element && !!target.closest("button, a, input, select, textarea, summary, [contenteditable]");
}
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
  guided: boolean;
  staged: boolean;
  cue: Cue | null;
  inProgress: boolean;
  onRelease: (setup: Setup, text: string) => void;
  onFree: () => void;
  onResume: () => void;
  stage: ReactNode;
  free: boolean;
  onApply: (setup: Setup) => void;
  onInspect: (day: number) => void;
  onReplayMemory: (day: number) => void;
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
  const [spiralProgress, setSpiralProgress] = useState(0);
  const swipeLast = useRef<{ x: number; y: number } | null>(null);
  const [thought, setThought] = useState("");
  const [thoughtResult, setThoughtResult] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [memoryId, setMemoryId] = useState<string | null>(null);
  const [voice, setVoice] = useState<District | null>(null);
  const [lit, setLit] = useState<District[]>([]);
  const toggleVoice = (d: District) => {
    setVoice(d);
    setLit((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d]));
  };
  const memories = memoriesFor(history, rules);
  const memory = memories.find((m) => m.id === memoryId);
  const district = districts.includes(room as District)
    ? (room as District)
    : null;
  const info = locations[room];
  const flat = lite || unavailable;
  const canExploreSpiral = entered && room === "hub" && !props.staged && !settings && !mapOpen;
  const spiralFocus = room === "hub" ? spiralDistrict(spiralProgress) : null;
  const moveSpiral = (delta: number) =>
    setSpiralProgress(progress => Math.max(0, Math.min(1, progress + delta)));
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
    if (!text) {
      setThoughtResult("Write a sentence first, or pick one of the prompts.");
      document.getElementById("thought")?.focus();
      return;
    }
    if (validateSetup(setup)) return;
    if (props.inProgress && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setThoughtResult("");
    const next = setupForThought(text, setup);
    onSetup(next);
    props.onRelease(next, text);
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
          data-room-travel={canExploreSpiral ? "true" : undefined}
          onWheel={event => {
            if (!canExploreSpiral || event.ctrlKey || event.metaKey || isTravelControl(event.target)) return;
            const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
            const pixels = delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 280 : 1);
            moveSpiral(Math.max(-240, Math.min(240, pixels)) / 1600);
          }}
          onTouchStart={event => {
            const touch = event.touches[0];
            swipeLast.current = canExploreSpiral && event.touches.length === 1 && !isTravelControl(event.target)
              ? { x: touch.clientX, y: touch.clientY }
              : null;
          }}
          onTouchMove={event => {
            const last = swipeLast.current;
            if (!canExploreSpiral || !last || event.touches.length !== 1) return;
            const touch = event.touches[0];
            const x = last.x - touch.clientX;
            const y = last.y - touch.clientY;
            swipeLast.current = { x: touch.clientX, y: touch.clientY };
            moveSpiral((Math.abs(y) >= Math.abs(x) ? y : x) / 680);
          }}
          onTouchCancel={() => { swipeLast.current = null; }}
          onTouchEnd={() => { swipeLast.current = null; }}
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
                  active={district ?? spiralFocus}
                  onSelect={(d) => visit(d)}
                  onMemory={(day) => {
                    const m = memories.find((m) => m.day === day);
                    if (m) openMemory(m.id);
                  }}
                />
              ) : (
                <FlatBrain voice={voice} onVoice={setVoice} onToggle={toggleVoice} />
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
                  spiralProgress={spiralProgress}
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
                  cue={props.cue}
                  voice={entered ? null : voice}
                  lit={lit}
                  onVoice={setVoice}
                  onToggle={toggleVoice}
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
              <div className="entrance-copy">
                <span className="cosmic-eyebrow">
                  EXPLORE THE WORLD WITHIN
                </span>
                <h1>MINDSPACE</h1>
                <p className="entrance-lede">
                  Four voices share one mind, six blocks of time a day and one
                  energy reserve. Twenty-four residents vote on how to spend
                  them.
                </p>
                <div className="entrance-dilemma">
                  <span>AN EXAMPLE DILEMMA</span>{taskText(rules, " Your presentation is due in ")}{rules.taskDeadlineDay} days.
                  Your friend is only here today.
                </div>
                <button className="enter-mind" onClick={props.onEnter}>
                  ENTER YOUR MIND <ArrowRight size={18} />
                </button>
                <span className="entrance-hint">
                  <i /> DRAG TO ROTATE · SCROLL TO ZOOM · CHOOSE A VOICE
                </span>
              </div>
              <aside
                className={`voice-card ${voice ? "has-voice" : ""}`}
                style={
                  voice
                    ? ({ "--voice": districtInfo[voice].color } as CSSProperties)
                    : undefined
                }
                aria-live="polite"
              >
                {voice ? (
                  <>
                    <span className="voice-card-symbol">
                      <VoiceIcon d={voice} size={56} speaking />
                    </span>
                    <span className="cosmic-eyebrow">
                      {districtInfo[voice].name.toUpperCase()} ·{" "}
                      {voices[voice].guards.toUpperCase()}
                    </span>
                    <b>“{introLine(voice,rules,state.day)}”</b>
                    <small>{voices[voice].wants}</small>
                  </>
                ) : (
                  <>
                    <span className="cosmic-eyebrow">FOUR VOICES</span>
                    <b>Hover a region of the brain, or pick a voice below.</b>
                    <small>Each lobe is a voice. Tap one to light its memory orb.</small>
                  </>
                )}
              </aside>
              <div className="voice-legend" role="group" aria-label="The four voices">
                {districts.map((d) => (
                  <button
                    key={d}
                    aria-pressed={lit.includes(d)}
                    className={voice === d ? "legend-active" : ""}
                    onMouseEnter={() => setVoice(d)}
                    onFocus={() => setVoice(d)}
                    onClick={() => toggleVoice(d)}
                    style={{ "--voice": districtInfo[d].color } as CSSProperties}
                  >
                    <VoiceIcon d={d} size={26} />
                    {districtInfo[d].name}
                  </button>
                ))}
              </div>
              <div className="entrance-foot">
                <span>A COMPOSITION OF PRIORITIES · DURHACK 2026</span>
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
              {!props.staged && (
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
                {!arrived && <span className="travel-status" role="status">Travelling to {info.title}…</span>}
                {room === "hub" && <div className="hub-spiral-control">
                  <label htmlFor="hub-spiral-position">Explore the hub spiral</label>
                  <input id="hub-spiral-position" type="range" min={0} max={1000}
                    value={Math.round(spiralProgress * 1000)}
                    aria-valuetext={spiralFocus ? districtInfo[spiralFocus].name : "Hub overview"}
                    onChange={event => setSpiralProgress(Number(event.target.value) / 1000)} />
                  <small>
                    <span className="room-wheel-hint">Scroll the scene</span>
                    <span className="room-swipe-hint">Swipe the scene</span>
                    {" · "}{spiralFocus ? districtInfo[spiralFocus].name : "Hub overview"}
                  </small>
                </div>}
              </div>
              )}
              {room === "hub" && !props.guided && (
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
              {room === "headquarters" && !props.staged && (
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
                      placeholder={taskText(rules, "My presentation is in three days, but my friend is only here today…")}
                      required
                    />
                    <div className="thought-prompts">
                      <button
                        type="button"
                        onClick={() => {
                          setThought(
                            taskText(rules, "My presentation is due, but my friend is visiting."),
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
                            taskText(rules, "I’m exhausted, but my presentation is almost done."),
                          )
                        }
                      >
                        Almost done, feeling tired
                      </button>
                    </div>
                    {props.free && (
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
                            max={rules.taskGoal}
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
                    )}
                    {validateSetup(setup) && (
                      <p role="alert">{validateSetup(setup)}</p>
                    )}
                    {history.length > 0 && (
                      <p className="thought-disclosure">
                        A new thought resets this session’s choices and
                        memories.
                      </p>
                    )}
                    {confirming && (
                      <p className="thought-confirm" role="alert">
                        This replaces your current local world, including its
                        days and memories. Release it anyway?{" "}
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setConfirming(false)}
                        >
                          Keep current world
                        </button>
                      </p>
                    )}
                    <button
                      className="cosmic-primary"
                      type="submit"
                      disabled={!!validateSetup(setup)}
                    >
                      {confirming ? "REPLACE WORLD & RELEASE" : "RELEASE THOUGHT"}{" "}
                      <ArrowRight size={15} />
                    </button>
                  </form>
                  {thoughtResult && (
                    <div className="thought-response" role="status">
                      <span>✧</span>
                      <p>{thoughtResult}</p>
                    </div>
                  )}
                  <button className="journey-link" onClick={props.onFree}>
                    Or skip the story and explore freely{" "}
                    <ArrowRight size={15} />
                  </button>
                </motion.section>
              )}
              {district && !props.staged && (
                <motion.section
                  key={`district-${district}`}
                  className="district-story cosmic-panel glass"
                  {...motionProps}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span className="persona-symbol">
                    <VoiceIcon d={district} size={64} />
                  </span>
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
                        ? taskText(rules, `of ${rules.taskGoal} presentation points`)
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
              {room === "memory" && !props.staged && (
                <MemoryShelf
                  history={history}
                  rules={rules}
                  memories={memories}
                  memory={memory}
                  onSelect={setMemoryId}
                  onInspect={props.onInspect}
                  onReplay={props.onReplayMemory}
                  onFirstDay={() => visit("decision")}
                />
              )}
              <div
                className={`room-content ${arrived ? "has-arrived" : "is-travelling"}`}
                key={room}
              >
                {props.children}
              </div>
              <BrainMotionContext.Provider value={reduced}>{props.stage}</BrainMotionContext.Provider>
              {props.guided && !props.staged && (
                <div className="resume-bar glass" role="status">
                  Journey paused.
                  <button className="cosmic-primary" onClick={props.onResume}>
                    Resume journey <ArrowRight size={14} />
                  </button>
                </div>
              )}
              {!props.guided && (
              <div className="universe-transport glass">
                <span>
                  <i className={props.playing ? "transport-pulse" : ""} />
                  {props.frozen ? "FROZEN" : "DAY"}{" "}
                  {String(
                    props.frozen && pair
                      ? pair.a.before.day
                      : Math.min(isWorldComplete(state, rules) ? (history.at(-1)?.before.day ?? state.day) : state.day, rules.taskDeadlineDay),
                  ).padStart(2, "0")}{" "}
                  <small>/ {rules.taskDeadlineDay}</small>
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
                  disabled={!props.frozen && isWorldComplete(state, rules)}
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
                  disabled={props.frozen || isWorldComplete(state, rules)}
                  onClick={props.onStep}
                >
                  <SkipForward size={15} />
                </button>
                <span className="transport-energy">
                  ❋ {fmt(state.energy)}
                  <small> ENERGY</small>
                </span>
              </div>
              )}
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
                {chamberRoute.map((place) => (
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
              {room === "hub" && !props.guided && (
                <div
                  className="hub-districts"
                  aria-label="District destinations"
                >
                  {districts.map((d) => (
                    <button
                      key={d}
                      onClick={() => visit(d)}
                      data-spiral-focus={spiralFocus === d}
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
              {room !== "hub" && !props.staged && (
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

function FlatBrain({
  voice,
  onVoice,
  onToggle,
}: {
  voice: District | null;
  onVoice: (d: District | null) => void;
  onToggle: (d: District) => void;
}) {
  return (
    <svg
      className="flat-brain"
      viewBox="120 90 700 540"
      role="img"
      aria-label="A side-view brain with four coloured voice regions"
    >
      <defs>
        <clipPath id="flat-cerebrum">
          <path d={svgPath(cerebrumPx)} />
        </clipPath>
        <filter id="flat-blur">
          <feGaussianBlur stdDeviation="38" />
        </filter>
      </defs>
      <path d={svgPath(stemPx)} fill="#1c2350" stroke="#8f9cff" strokeWidth="2" />
      <path d={svgPath(cerebellumPx)} fill="#1c2350" stroke="#8f9cff" strokeWidth="2" />
      <path d={svgPath(cerebrumPx)} fill="#141a3a" />
      <g clipPath="url(#flat-cerebrum)" filter="url(#flat-blur)">
        {districts.map((d) => (
          <circle
            key={d}
            cx={zonePx[d][0]}
            cy={zonePx[d][1]}
            r={voice === d ? 150 : 130}
            fill={districtInfo[d].color}
            opacity={voice && voice !== d ? 0.25 : 0.55}
          />
        ))}
      </g>
      <path d={svgPath(cerebrumPx)} fill="none" stroke="#b9c4ff" strokeWidth="2" />
      {districts.map((d) => (
        <circle
          key={d}
          cx={zonePx[d][0]}
          cy={zonePx[d][1]}
          r="12"
          fill={districtInfo[d].color}
          stroke="#fff"
          strokeWidth="3"
          style={{ cursor: "pointer" }}
          onMouseEnter={() => onVoice(d)}
          onClick={() => onToggle(d)}
        />
      ))}
    </svg>
  );
}

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronDown,
  CircleHelp,
  GitBranch,
  Globe2,
  Headphones,
  Orbit,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Settings2,
  SkipForward,
  Sparkles,
  Telescope,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  actionState,
  branch,
  createWorld,
  districtInfo,
  districts,
  elect,
  externalEvent,
  fmt,
  judgeSetup,
  proposalsForDay,
  resolve,
  scenarios,
  validatePolicy,
  validateSetup,
  type Config,
  type District,
  type Policy,
  type Round,
  type Setup,
  type State,
} from "./simulation";
import { audio, audioConfig, projectScore } from "./audio";
import WorldArt from "./WorldArt";
import Observatory from "./Observatory";

interface Session {
  state: State;
  rules: Config;
  history: Round[];
  proposals: Policy[];
  elapsed: number;
  playing: boolean;
  speed: number;
}
type Action =
  | { type: "reset"; setup: Setup }
  | { type: "play" }
  | { type: "pause" }
  | { type: "speed"; speed: number }
  | { type: "tick" }
  | { type: "step"; day: number }
  | { type: "edit"; policy: Policy };
function initialSession(setup: Setup): Session {
  return {
    ...createWorld(setup),
    history: [],
    proposals: proposalsForDay(1),
    elapsed: 0,
    playing: false,
    speed: 1,
  };
}
function finish(s: Session): Session {
  if (s.state.day > s.rules.maxDays) return { ...s, playing: false };
  const round = resolve(s.state, s.proposals, s.rules);
  return {
    ...s,
    state: round.after,
    history: [...s.history, round].slice(-s.rules.historyLimit),
    proposals: proposalsForDay(round.after.day),
    elapsed: 0,
    playing: s.playing && round.after.day <= s.rules.maxDays,
  };
}
function reducer(s: Session, action: Action): Session {
  switch (action.type) {
    case "reset":
      return initialSession(action.setup);
    case "play":
      return { ...s, playing: s.state.day <= s.rules.maxDays };
    case "pause":
      return { ...s, playing: false };
    case "speed":
      return { ...s, speed: action.speed };
    case "step":
      return action.day === s.state.day ? finish({ ...s, playing: false }) : s;
    case "tick": {
      if (!s.playing) return s;
      const next = { ...s, elapsed: s.elapsed + 0.25 * s.speed };
      return next.elapsed >= s.rules.daySeconds ? finish(next) : next;
    }
    case "edit":
      return !s.playing &&
        s.elapsed < s.rules.campaignSeconds &&
        !validatePolicy(action.policy, s.rules)
        ? {
            ...s,
            proposals: s.proposals.map((p) =>
              p.id === action.policy.id ? structuredClone(action.policy) : p,
            ),
          }
        : s;
  }
}
const note =
  "An interactive fictional model. Change its assumptions and explore what follows.";
export default function App() {
  const [setup, setSetup] = useState<Setup>({ ...judgeSetup });
  const [session, dispatch] = useReducer(reducer, judgeSetup, initialSession);
  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState<"World" | "Compare" | "Observatory">("World");
  const [soundOn, setSoundOn] = useState(false);
  const [soundStatus, setSoundStatus] = useState(
    "Sound is off. Your world is still listening.",
  );
  const [soundAtEntry, setSoundAtEntry] = useState(true);
  const [volume, setVolume] = useState(audioConfig.masterVolumeDefault);
  const [muted, setMuted] = useState(false);
  const [solo, setSolo] = useState<District | null>(null);
  const [focused, setFocused] = useState<District>("A");
  const [pair, setPair] = useState<{ a: Round; b: Round } | null>(null);
  const [mix, setMix] = useState(0.5);
  const [comparePlaying, setComparePlaying] = useState(true);
  const [hiddenPause, setHiddenPause] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [help, setHelp] = useState(false);
  const lastStepTime = useRef(0);
  const { state, rules: c, history, proposals, elapsed, playing } = session;
  const last = history.at(-1);
  const selected = history.find((r) => r.before.day === selectedDay) ?? last;
  const prior = history.find(
    (r) => r.before.day === (selected?.before.day ?? 1) - 1,
  );
  const election = useMemo(
    () => elect(actionState(state, c), proposals, c),
    [state, proposals, c],
  );
  const phase =
    elapsed < c.campaignSeconds
      ? "Campaign"
      : elapsed < c.campaignSeconds + c.voteSeconds
        ? "Voting"
        : "Resolution";
  const ended = state.day > c.maxDays;
  const preview = createWorld(validateSetup(setup) ? judgeSetup : setup);

  useEffect(() => {
    const timer = setInterval(() => dispatch({ type: "tick" }), 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) {
        dispatch({ type: "pause" });
        setComparePlaying(false);
        setHiddenPause(true);
        audio.stop();
        void audio.context?.suspend();
        setSoundOn(false);
        setSoundStatus("Paused while away. Resume sound when you’re ready.");
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      audio.dispose();
    };
  }, []);
  useEffect(() => {
    const priorA = history.find(
      (r) => r.before.day === (pair?.a.before.day ?? 1) - 1,
    );
    audio.setFrame(
      tab === "Compare" && pair
        ? {
            a: projectScore(pair.a.after, pair.a, priorA, c),
            b: projectScore(pair.b.after, pair.b, priorA, c),
          }
        : { a: projectScore(state, last, history.at(-2), c) },
    );
  }, [state, last, history, c, tab, pair]);
  useEffect(() => {
    audio.setMix(tab === "Compare" && pair ? mix : 0, solo, volume, muted);
  }, [tab, pair, mix, solo, volume, muted]);
  useEffect(() => {
    audio.play(
      entered &&
        soundOn &&
        !hiddenPause &&
        (tab === "Compare" && pair ? comparePlaying : playing),
    );
  }, [entered, soundOn, hiddenPause, playing, tab, pair, comparePlaying]);
  async function enableSound() {
    try {
      const enabled = await audio.enable();
      setSoundOn(enabled);
      setHiddenPause(false);
      setSoundStatus(
        enabled
          ? "Synthesised live · patterns change on the next bar"
          : "Audio suspended. Click Resume sound to try again.",
      );
    } catch {
      setSoundOn(false);
      setSoundStatus(
        "Audio unavailable in this browser. Silent visual mode is ready.",
      );
    }
  }
  function reset(toSetup = false) {
    audio.reset();
    dispatch({ type: "reset", setup });
    setPair(null);
    setSelectedDay(null);
    setTab("World");
    setSolo(null);
    setHiddenPause(false);
    if (toSetup) setEntered(false);
  }
  function compare(round = selected) {
    if (!round) return;
    dispatch({ type: "pause" });
    audio.reset();
    const alternative = round.policies.find((p) => p.id !== round.policy.id)!;
    setPair({ a: structuredClone(round), b: branch(round, alternative.id, c) });
    setMix(0.5);
    setComparePlaying(true);
    setTab("Compare");
  }
  function navigate(next: typeof tab) {
    if (next === "Compare") {
      if (!pair) {
        compare();
        return;
      }
      dispatch({ type: "pause" });
    }
    setTab(next);
  }
  function stepDay() {
    const now = performance.now();
    if (now - lastStepTime.current < 400) return;
    lastStepTime.current = now;
    dispatch({ type: "step", day: state.day });
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => setHelp(true)}
          aria-label="About MINDSPACE"
        >
          <span className="brand-mark">
            <Orbit size={27} strokeWidth={1.3} />
          </span>
          <span>
            MINDSPACE<span className="brand-dot">®</span>
            <small>A DECISION, COMPOSED.</small>
          </span>
        </button>
        {entered ? (
          <nav aria-label="Main navigation">
            {(["World", "Compare", "Observatory"] as const).map((name) => (
              <button
                key={name}
                onClick={() => navigate(name)}
                className={tab === name ? "nav-active" : ""}
                disabled={name === "Compare" && !last}
                title={
                  name === "Compare" && !last
                    ? "Resolve a day to unlock comparison"
                    : undefined
                }
              >
                {name === "World" ? (
                  <Globe2 size={15} />
                ) : name === "Compare" ? (
                  <GitBranch size={15} />
                ) : (
                  <Telescope size={15} />
                )}
                {name}
                {name === "Compare" && <span className="tiny-dot" />}
              </button>
            ))}
          </nav>
        ) : (
          <span className="header-edition">
            AN EXPERIMENT IN POSSIBLE WORLDS
          </span>
        )}
        <div className="header-right">
          <span className="edition">
            <i /> DURHACK 2026
          </span>
          <button
            className="icon-button"
            aria-label="How to explore"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={19} />
          </button>
        </div>
      </header>

      {!entered ? (
        <main className="landing">
          <section className="landing-copy">
            <span className="eyebrow">
              <span className="live-dot" /> A SMALL WORLD FOR A BIG WHAT IF.
            </span>
            <h1>
              One decision.
              <br />
              Many ways
              <br />
              to <em>become.</em>
            </h1>
            <p className="landing-intro">
              Give your dilemma a world of its own.
              <br />
              Let it vote. Hear it evolve. Explore another choice.
            </p>
            <div className="scenario-card">
              <div className="scenario-card-top">
                <span className="eyebrow">01 / YOUR STARTING POINT</span>
                <button
                  className="text-button"
                  onClick={() => setSetup({ ...judgeSetup })}
                >
                  <Sparkles size={13} /> Try a demo dilemma
                </button>
              </div>
              <h2>{scenarios.find((s) => s.id === setup.scenarioId)?.label}</h2>
              <p>{scenarios.find((s) => s.id === setup.scenarioId)?.summary}</p>
              <label className="scenario-select">
                Dilemma variant
                <select
                  value={setup.scenarioId}
                  onChange={(e) => {
                    const scenario = scenarios.find(
                      (s) => s.id === e.target.value,
                    )!;
                    setSetup({
                      ...setup,
                      scenarioId: scenario.id,
                      taskProgress: scenario.taskProgress,
                    });
                  }}
                >
                  {scenarios.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <details className="setup-details">
                <summary>
                  <Settings2 size={14} /> Edit starting assumptions{" "}
                  <ChevronDown size={14} />
                </summary>
                <div className="setup-fields">
                  <label>
                    Energy tokens
                    <input
                      aria-label="Starting energy"
                      type="number"
                      min="0"
                      max={setup.energyCap}
                      value={setup.energy}
                      onChange={(e) =>
                        setSetup({ ...setup, energy: e.target.valueAsNumber })
                      }
                    />
                  </label>
                  <label>
                    Energy capacity
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={setup.energyCap}
                      onChange={(e) =>
                        setSetup({
                          ...setup,
                          energyCap: e.target.valueAsNumber,
                        })
                      }
                    />
                  </label>
                  <label>
                    Task progress
                    <input
                      aria-label="Starting task progress"
                      type="number"
                      min="0"
                      max="30"
                      value={setup.taskProgress}
                      onChange={(e) =>
                        setSetup({
                          ...setup,
                          taskProgress: e.target.valueAsNumber,
                        })
                      }
                    />
                  </label>
                </div>
                <p>
                  6 time blocks per day · presentation goal 12 · visit goal 3
                </p>
              </details>
              {validateSetup(setup) && (
                <p role="alert" className="error-text">
                  {validateSetup(setup)}
                </p>
              )}
              <div className="enter-row">
                <button
                  className="primary"
                  disabled={!!validateSetup(setup)}
                  onClick={() => {
                    dispatch({ type: "reset", setup });
                    setEntered(true);
                    dispatch({ type: "play" });
                    if (soundAtEntry) void enableSound();
                  }}
                >
                  Enter world <ArrowRight size={17} />
                </button>
                <label className="sound-checkbox">
                  <input
                    type="checkbox"
                    checked={soundAtEntry}
                    onChange={(e) => setSoundAtEntry(e.target.checked)}
                  />
                  <Headphones size={15} /> Enable sound
                </label>
              </div>
            </div>
            <p className="fiction-note">{note}</p>
          </section>
          <section className="landing-visual">
            <div className="visual-corner">
              <span className="eyebrow">A LIVING COMPOSITION</span>
              <span className="coordinate">54°46′ N · 01°34′ W</span>
            </div>
            <div className="landing-art-title">
              A world made
              <br />
              of <em>what matters.</em>
            </div>
            <WorldArt
              state={preview.state}
              active={focused}
              onSelect={setFocused}
            />
            <div className="landing-districts">
              {districts.map((d) => (
                <button
                  key={d}
                  style={
                    {
                      "--district": districtInfo[d].color,
                    } as React.CSSProperties
                  }
                  onClick={() => setFocused(d)}
                  className={focused === d ? "selected" : ""}
                >
                  <span>{districtInfo[d].symbol}</span>
                  {districtInfo[d].name}
                </button>
              ))}
            </div>
            <p className="landing-visual-note">
              24 residents. 4 districts. No single right answer.
            </p>
            <span className="visual-serial">
              FIG. 001 — THE POSSIBILITY OF BALANCE
            </span>
          </section>
        </main>
      ) : (
        <main className="workspace">
          {hiddenPause && (
            <div className="away-banner" role="status">
              Your world paused while this tab was away. No days were skipped.
              <button
                onClick={() => {
                  setHiddenPause(false);
                  void enableSound();
                  if (tab === "Compare") setComparePlaying(true);
                  else dispatch({ type: "play" });
                }}
              >
                Resume experience <Play size={13} />
              </button>
            </div>
          )}
          {tab === "World" && (
            <>
              <div className="world-heading">
                <div>
                  <span className="eyebrow">
                    WORLD A /{" "}
                    {setup.scenarioId === scenarios[0].id
                      ? "THE ORIGINAL POSSIBILITY"
                      : "A LITTLE HEAD START"}
                  </span>
                  <h1>
                    The presentation & the visit
                    <span className="heading-period">.</span>
                  </h1>
                  <p>
                    A deadline in three days. A friend here for one. A world
                    finding its way.
                  </p>
                </div>
                <button className="secondary small" onClick={() => reset(true)}>
                  <Settings2 size={14} /> Edit assumptions
                </button>
              </div>
              <div className="world-grid">
                <section className="world-stage">
                  <div className="stage-top">
                    <span className="stage-day">
                      DAY{" "}
                      <b>
                        {String(Math.min(state.day, c.maxDays)).padStart(
                          2,
                          "0",
                        )}
                      </b>
                      <span>/ {String(c.maxDays).padStart(2, "0")}</span>
                    </span>
                    <span className="stage-status">
                      <i className={playing ? "live-dot" : ""} />
                      {ended
                        ? "COMPOSITION COMPLETE"
                        : playing
                          ? "WORLD IS EVOLVING"
                          : "WORLD IS PAUSED"}
                    </span>
                    <span className="stage-view">ISOMETRIC / LIVE</span>
                  </div>
                  <WorldArt
                    state={state}
                    round={last}
                    active={focused}
                    onSelect={setFocused}
                    running={playing}
                  />
                  <div className="stage-foot">
                    <div>
                      <span className="event-orb">
                        <Sparkles size={15} />
                      </span>
                      <p>
                        <b>
                          {ended
                            ? "A world, composed."
                            : externalEvent(state.day).name}
                        </b>
                        <span>
                          {ended
                            ? "Fourteen days of choices. Reset to begin another composition."
                            : externalEvent(state.day).detail}
                        </span>
                      </p>
                    </div>
                    <span className="stage-seed">SEED {c.seed}</span>
                  </div>
                </section>
                <aside className="election-panel panel">
                  <div className="panel-heading">
                    <span className="eyebrow">THE DAILY ELECTION</span>
                    <span className="tag">
                      <Radio size={11} />
                      {ended ? "FINISHED" : phase.toUpperCase()}
                    </span>
                  </div>
                  <h2>
                    {ended
                      ? "A history of choices."
                      : "Six blocks. Three futures."}
                  </h2>
                  <p className="muted">
                    {ended
                      ? "Replay your days below, or explore an alternative."
                      : "24 residents vote for the future they value. The winning budget becomes today’s policy."}
                  </p>
                  <div className="phase-track">
                    {["Campaign", "Voting", "Resolution"].map((p, i) => (
                      <div key={p} className={phase === p ? "current" : ""}>
                        <span>0{i + 1}</span>
                        {p}
                      </div>
                    ))}
                  </div>
                  <div className="day-progress">
                    <span
                      style={{ width: `${(elapsed / c.daySeconds) * 100}%` }}
                    />
                  </div>
                  <div className="candidate-list">
                    {proposals.map((p, i) => (
                      <Candidate
                        key={`${state.day}-${p.id}`}
                        policy={p}
                        index={i}
                        votes={election.counts[i]}
                        leading={i === election.winner}
                        locked={
                          playing || elapsed >= c.campaignSeconds || ended
                        }
                        rules={c}
                        onSave={(policy) => dispatch({ type: "edit", policy })}
                      />
                    ))}
                  </div>
                  <div
                    className="vote-residents"
                    aria-label={`${c.residentCount} forecast votes`}
                  >
                    {election.ballots.map((b) => (
                      <span
                        title={`${b.resident.id}: ${proposals[b.choice].name}`}
                        key={b.resident.id}
                        style={{
                          background: [
                            districtInfo.A.color,
                            districtInfo.C.color,
                            districtInfo.D.color,
                          ][b.choice],
                        }}
                      />
                    ))}
                    <span>24 / 24</span>
                  </div>
                  <p className="election-note">
                    {phase === "Campaign" ? "Live forecast" : "Locked ballot"} ·{" "}
                    {election.tied
                      ? "Tie: first listed proposal wins."
                      : "Most votes wins. Ties go to first listed."}
                    {state.day > 1 &&
                      " Authored visit blocks now move to Achievement."}
                  </p>
                  <div className="playback">
                    <button
                      className="primary play-button"
                      disabled={ended}
                      onClick={() => {
                        setHiddenPause(false);
                        dispatch({ type: playing ? "pause" : "play" });
                        if (!soundOn && audio.context) void enableSound();
                      }}
                    >
                      {playing ? <Pause size={15} /> : <Play size={15} />}
                      {playing ? "Pause" : "Play world"}
                    </button>
                    <button
                      className="secondary"
                      disabled={ended}
                      onClick={stepDay}
                    >
                      <SkipForward size={15} /> Step day
                    </button>
                    <select
                      aria-label="Simulation speed"
                      value={session.speed}
                      onChange={(e) =>
                        dispatch({ type: "speed", speed: +e.target.value })
                      }
                    >
                      {c.speedOptions.map((n) => (
                        <option key={n} value={n}>
                          {n}×
                        </option>
                      ))}
                    </select>
                    <button
                      className="icon-button reset-button"
                      aria-label="Reset world"
                      title="Reset world"
                      onClick={() => reset()}
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>
                </aside>
              </div>
              <section
                className="resources"
                aria-label="Shared world resources"
              >
                <Resource
                  symbol="△"
                  color={districtInfo.A.color}
                  name="Presentation"
                  value={state.taskProgress}
                  max={c.taskGoal}
                  detail={milestone(
                    state.taskResult,
                    "Due end of day 3",
                    "Goal met on day 3",
                    "Missed day 3 goal",
                  )}
                />
                <Resource
                  symbol="◎"
                  color={districtInfo.C.color}
                  name="The visit"
                  value={state.connectionProgress}
                  max={c.connectionGoal}
                  detail={milestone(
                    state.connectionResult,
                    "Window closes end of day 1",
                    "Visit completed on day 1",
                    "Visit window missed",
                  )}
                />
                <Resource
                  symbol="✧"
                  color={districtInfo.D.color}
                  name="Method"
                  value={state.method}
                  max={c.methodCap}
                  suffix="×"
                  detail="Discovery carries into future days"
                />
                <Resource
                  symbol="≈"
                  color={districtInfo.R.color}
                  name="Shared energy"
                  value={state.energy}
                  max={c.energyCap}
                  detail="Tokens available before external events"
                />
              </section>
            </>
          )}

          {tab === "Compare" && pair && (
            <section className="compare-view">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    PARALLEL WORLDS / ONE ROUND, RECOMPOSED
                  </span>
                  <h1>What if you chose differently?</h1>
                  <p>
                    Same starting point. Same external event. One different
                    allocation.
                  </p>
                </div>
                <span className="stamp">
                  FROZEN AT END OF DAY {pair.a.before.day}
                </span>
              </div>
              <div className="comparison-worlds">
                {(
                  [
                    ["A", pair.a],
                    ["B", pair.b],
                  ] as const
                ).map(([label, r]) => (
                  <article
                    className={`comparison-card world-${label.toLowerCase()}`}
                    key={label}
                  >
                    <div className="comparison-title">
                      <span className="world-letter">{label}</span>
                      <div>
                        <span className="eyebrow">
                          {label === "A"
                            ? "THE ELECTED PATH"
                            : "MANUAL INTERVENTION"}
                        </span>
                        <h2>{r.policy.name}</h2>
                      </div>
                      {label === "A" ? (
                        <span className="tag">
                          {r.election.counts[r.election.winner]} VOTES
                        </span>
                      ) : (
                        <GitBranch size={19} />
                      )}
                    </div>
                    <WorldArt
                      state={r.after}
                      round={r}
                      compact
                      active={solo}
                      running={comparePlaying}
                    />
                    <div className="comparison-stats">
                      <span>
                        <small>Presentation</small>
                        <b>{fmt(r.after.taskProgress)}</b>
                      </span>
                      <span>
                        <small>Visit</small>
                        <b>{fmt(r.after.connectionProgress)}</b>
                      </span>
                      <span>
                        <small>Energy</small>
                        <b>{fmt(r.after.energy)}</b>
                      </span>
                      <span>
                        <small>Method</small>
                        <b>{fmt(r.after.method, 2)}×</b>
                      </span>
                    </div>
                    {label === "B" && (
                      <label className="branch-choice">
                        Replace this round’s policy
                        <select
                          aria-label="Alternative policy"
                          value={pair.b.policy.id}
                          onChange={(e) => {
                            audio.reset();
                            setPair({
                              ...pair,
                              b: branch(pair.a, e.target.value, c),
                            });
                          }}
                        >
                          {pair.a.policies.map((p) => (
                            <option value={p.id} key={p.id}>
                              {p.name}
                              {p.id === pair.a.policy.id
                                ? " (same policy)"
                                : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {label === "A" && (
                      <p className="comparison-explanation">
                        The original election is preserved in both records. B is
                        an intervention, not a new democratic mandate.
                      </p>
                    )}
                  </article>
                ))}
              </div>
              <div className="mixer panel">
                <div>
                  <span className="eyebrow">
                    <Headphones size={14} /> THE PARALLEL WORLDS MIXER
                  </span>
                  <h2>Listen between the possibilities.</h2>
                  <p>This blends sound, never the numerical worlds.</p>
                </div>
                <div className="mixer-slider">
                  <div>
                    <button
                      onClick={() => setMix(0)}
                      className={mix === 0 ? "endpoint active" : "endpoint"}
                    >
                      A only
                    </button>
                    <span>
                      {Math.round((1 - mix) * 100)}% A <i>/</i>{" "}
                      {Math.round(mix * 100)}% B
                    </span>
                    <button
                      onClick={() => setMix(1)}
                      className={mix === 1 ? "endpoint active" : "endpoint"}
                    >
                      B only
                    </button>
                  </div>
                  <input
                    aria-label="A B audio balance"
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={mix}
                    onChange={(e) => setMix(+e.target.value)}
                  />
                  <small>
                    Equal-power crossfade · shared {audioConfig.bpm} BPM clock
                  </small>
                </div>
                <button
                  className="secondary"
                  onClick={() => setComparePlaying(!comparePlaying)}
                >
                  {comparePlaying ? <Pause size={15} /> : <Play size={15} />}
                  {comparePlaying ? "Pause loops" : "Play loops"}
                </button>
              </div>
              <div className="delta-row">
                {(
                  [
                    "taskProgress",
                    "connectionProgress",
                    "energy",
                    "method",
                  ] as const
                ).map((key, i) => {
                  const d = districts[i === 2 ? 3 : i === 3 ? 2 : i];
                  const delta = pair.b.after[key] - pair.a.after[key];
                  return (
                    <div className="delta-card" key={key}>
                      <span style={{ color: districtInfo[d].color }}>
                        {districtInfo[d].symbol}
                      </span>
                      <div>
                        <small>
                          B − A /{" "}
                          {["PRESENTATION", "VISIT", "ENERGY", "METHOD"][i]}
                        </small>
                        <b>
                          {delta > 0 ? "+" : ""}
                          {fmt(delta, 3)}
                          {key === "method" ? "×" : ""}
                        </b>
                      </div>
                      <button
                        aria-label={`Compare ${districtInfo[d].name} district`}
                        title="Compare this district"
                        onClick={() => {
                          setSolo(solo === d ? null : d);
                          setFocused(d);
                        }}
                      >
                        <Headphones size={17} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="comparison-footnote">
                {pair.a.policy.id === pair.b.policy.id
                  ? "Identical-policy comparison: both sets of numbers match."
                  : `Only the day ${pair.a.before.day} action differs.`}{" "}
                Both receive “{pair.a.external.name}”. No later days are
                simulated.{" "}
                <button className="text-button" onClick={() => setTab("World")}>
                  Return to live World A <ArrowRight size={13} />
                </button>
              </p>
            </section>
          )}

          {tab === "Observatory" && (
            <Observatory
              round={selected}
              prior={prior}
              state={state}
              rules={c}
              history={history}
              election={election}
              policies={proposals}
            />
          )}

          <section
            className={`sound-desk ${soundOn && (playing || (tab === "Compare" && comparePlaying)) ? "is-sounding" : ""}`}
            aria-label="Sound controls"
          >
            <div className="sound-title">
              <AudioLines size={23} />
              <div>
                <span className="eyebrow">THE WORLD’S COMPOSITION</span>
                <small>
                  {soundOn
                    ? `${audioConfig.bpm} BPM · C pentatonic`
                    : "Best explored with headphones"}
                </small>
              </div>
            </div>
            <div className="part-controls">
              {districts.map((d) => (
                <button
                  key={d}
                  aria-pressed={solo === d}
                  className={solo === d ? "solo-active" : ""}
                  onClick={() => {
                    setSolo(solo === d ? null : d);
                    setFocused(d);
                  }}
                  style={
                    {
                      "--district": districtInfo[d].color,
                    } as React.CSSProperties
                  }
                >
                  <span className="part-icon">{districtInfo[d].symbol}</span>
                  <span>
                    {districtInfo[d].name}
                    <small>
                      {solo === d
                        ? "SOLO · CLICK TO RELEASE"
                        : districtInfo[d].voice}
                    </small>
                  </span>
                  <span className="mini-wave">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <i
                        key={n}
                        style={{
                          height: `${[8, 17, 24, 12, 19][n - 1]}px`,
                          animationDelay: `${n * -0.13}s`,
                        }}
                      />
                    ))}
                  </span>
                </button>
              ))}
            </div>
            <div className="master-controls">
              <button
                className="icon-button"
                aria-label={muted ? "Unmute master" : "Mute master"}
                onClick={() => setMuted(!muted)}
              >
                {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <input
                aria-label="Master volume"
                type="range"
                min="0"
                max="1"
                step=".01"
                value={volume}
                onChange={(e) => setVolume(+e.target.value)}
              />
              <button
                className="sound-enable"
                onClick={() => void enableSound()}
              >
                {soundOn ? <Check size={13} /> : <Headphones size={13} />}
                {soundOn ? "Sound on" : "Enable sound"}
              </button>
            </div>
          </section>
          <p className="sound-status" role="status">
            {soundStatus}
            {solo
              ? ` · ${districtInfo[solo].name} isolated in both worlds`
              : ""}
          </p>

          {tab !== "Compare" && (
            <section className="timeline panel">
              <div className="timeline-heading">
                <div>
                  <span className="eyebrow">YOUR WORLD’S MEMORY</span>
                  <h2>Every day leaves a trace.</h2>
                </div>
                <button
                  className="secondary small"
                  disabled={!selected}
                  title={
                    !selected
                      ? "Resolve one day to create a branch"
                      : `Branch day ${selected.before.day}`
                  }
                  onClick={() => compare()}
                >
                  <GitBranch size={14} /> Explore another choice{" "}
                  <ArrowUpRight size={14} />
                </button>
              </div>
              <div className="timeline-track">
                <div className="genesis">
                  <span>
                    <Orbit size={20} />
                  </span>
                  <b>Genesis</b>
                  <small>The starting point</small>
                </div>
                {history.length ? (
                  history.map((r) => (
                    <button
                      key={r.id}
                      className={`day-portrait ${selected?.id === r.id ? "portrait-selected" : ""}`}
                      onClick={() => setSelectedDay(r.before.day)}
                    >
                      <span className="portrait-art">
                        {districts.map((d) => (
                          <i
                            key={d}
                            style={{
                              height: `${8 + r.policy.allocation[d] * 8}px`,
                              background: districtInfo[d].color,
                            }}
                          />
                        ))}
                      </span>
                      <span>
                        <b>Day {String(r.before.day).padStart(2, "0")}</b>
                        <small>{r.policy.name}</small>
                      </span>
                      <Check size={12} />
                    </button>
                  ))
                ) : (
                  <div className="timeline-empty">
                    <span className="dotted-line" />
                    Your first election will begin a history. Play or step a
                    day.
                    <span className="dotted-line" />
                  </div>
                )}
              </div>
              {selected && (
                <div className="latest-resolution">
                  <Check size={13} />
                  <span>
                    Day {selected.before.day}: <b>{selected.policy.name}</b>{" "}
                    elected · +{fmt(selected.activity.taskGain)} presentation ·
                    +{fmt(selected.activity.connectionGain)} visit ·{" "}
                    {selected.activity.energyDelta >= 0 ? "+" : ""}
                    {fmt(selected.activity.energyDelta)} net energy.
                  </span>
                  <button
                    className="text-button"
                    onClick={() => setTab("Observatory")}
                  >
                    Inspect calculations <ArrowRight size={12} />
                  </button>
                </div>
              )}
            </section>
          )}
          <footer className="footer">
            <span>{note}</span>
            <span>
              COMPOSED AT DURHACK <span className="footer-star">✳</span> 2026
            </span>
          </footer>
        </main>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="help-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setHelp(false);
              if (e.key === "Tab") {
                const buttons =
                  e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
                const first = buttons[0],
                  last = buttons[buttons.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                }
                if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <button
              className="icon-button modal-close"
              aria-label="Close guide"
              onClick={() => setHelp(false)}
              autoFocus
            >
              <X size={20} />
            </button>
            <span className="eyebrow">WELCOME TO MINDSPACE</span>
            <h2 id="help-title">A decision isn’t a single note.</h2>
            <p>
              It’s a composition of things that matter. Explore this fictional
              one through four connected districts.
            </p>
            <ol>
              <li>
                <b>Watch a day unfold.</b> Residents choose one of three
                six-block budgets. Pause to edit a proposal, or Step day for an
                instant result.
              </li>
              <li>
                <b>Hear the consequences.</b> Enable sound, then play. Click a
                district’s musical part to isolate it. Music reflects the most
                recently resolved activity; the opening is a quiet starting
                motif.
              </li>
              <li>
                <b>Try another choice.</b> Select a completed day and branch.
                A/B blends sound only. Returning to World A leaves it paused.
              </li>
              <li>
                <b>Inspect the rules.</b> Observatory shows the selected day’s
                actual arithmetic, votes and dependencies.
              </li>
            </ol>
            <p className="fiction-note">
              A creative model, not a diagnosis, advice or prediction. No
              network service or key is needed. Refresh starts a fresh world.
            </p>
            <button className="primary" onClick={() => setHelp(false)}>
              Let’s explore <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function milestone(
  result: boolean | null,
  pending: string,
  success: string,
  missed: string,
) {
  return result === null ? pending : result ? success : missed;
}
function Resource({
  symbol,
  color,
  name,
  value,
  max,
  detail,
  suffix,
}: {
  symbol: string;
  color: string;
  name: string;
  value: number;
  max: number;
  detail: string;
  suffix?: string;
}) {
  return (
    <article className="resource">
      <span className="resource-symbol" style={{ color }}>
        {symbol}
      </span>
      <div>
        <div className="resource-title">
          <span>{name}</span>
          <b>
            {fmt(value, 2)}
            {suffix}
            <small>
              {" "}
              / {max}
              {suffix}
            </small>
          </b>
        </div>
        <div className="resource-bar">
          <i
            style={{
              background: color,
              width: `${Math.min(100, (value / max) * 100)}%`,
            }}
          />
        </div>
        <small>{detail}</small>
      </div>
    </article>
  );
}
function Budget({ policy }: { policy: Policy }) {
  return (
    <div
      className="budget-strip"
      aria-label={districts
        .map((d) => `${districtInfo[d].name} ${policy.allocation[d]}`)
        .join(", ")}
    >
      {districts.flatMap((d) =>
        Array.from({ length: policy.allocation[d] }, (_, i) => (
          <span
            key={`${d}-${i}`}
            style={{ background: districtInfo[d].color }}
            title={`${districtInfo[d].name}: ${policy.allocation[d]}`}
          />
        )),
      )}
    </div>
  );
}
function Candidate({
  policy,
  index,
  votes,
  leading,
  locked,
  rules,
  onSave,
}: {
  policy: Policy;
  index: number;
  votes: number;
  leading: boolean;
  locked: boolean;
  rules: Config;
  onSave: (p: Policy) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(policy);
  const error = validatePolicy(draft, rules);
  return (
    <article className={`candidate ${leading ? "candidate-leading" : ""}`}>
      <div className="candidate-top">
        <span className={`candidate-avatar avatar-${index}`}>
          {index === 0 ? "△" : index === 1 ? "◎" : "✧"}
        </span>
        <div>
          <h3>{policy.name}</h3>
          <span>{leading ? "LEADING FORECAST" : policy.description}</span>
        </div>
        <div className="vote-count">
          {votes}
          <small>votes</small>
        </div>
      </div>
      <Budget policy={policy} />
      <div className="budget-caption">
        <span>
          {districts.map((d) => `${d}${policy.allocation[d]}`).join(" · ")}
        </span>
        <button
          className="text-button"
          disabled={locked}
          onClick={() => {
            setDraft(structuredClone(policy));
            setEditing(!editing);
          }}
        >
          {editing ? "Cancel" : "Edit budget"}
        </button>
      </div>
      {editing && !locked && (
        <div className="budget-editor">
          <div>
            {districts.map((d) => (
              <label key={d}>
                {districtInfo[d].name}
                <input
                  type="number"
                  min="0"
                  max="6"
                  step="1"
                  aria-label={`${policy.name} ${districtInfo[d].name} blocks`}
                  value={draft.allocation[d]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      allocation: {
                        ...draft.allocation,
                        [d]: e.target.valueAsNumber,
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          {rules.connectionLastOpenDay < 2 && draft.allocation.C > 0 && (
            <p className="note">
              Connection blocks only produce gains while the visit is open.
            </p>
          )}
          <button
            className="secondary small"
            disabled={!!error}
            onClick={() => {
              onSave(draft);
              setEditing(false);
            }}
          >
            Save proposal <Check size={12} />
          </button>
        </div>
      )}
    </article>
  );
}

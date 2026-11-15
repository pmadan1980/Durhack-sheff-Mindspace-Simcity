import ScenarioFlow,{type ScenarioNavigation} from "./ScenarioFlow";
import { getScenario, routeThought } from "./engine";
import { BrainTransition } from "./BrainCinema";
import ParallelWorlds from "./ParallelWorlds";
import { taskText } from "./simulation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  GitBranch,
  Headphones,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Settings2,
  SkipForward,
  X,
} from "lucide-react";
import {
  actionState,
  isWorldComplete,
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
  validatePolicy,
  type Config,
  type District,
  replay,
  type Policy,
  type Round,
  type Setup,
  type State,
} from "./simulation";
import { audio, audioConfig, projectScore } from "./audio";
import Observatory from "./Observatory";
import JourneyStage from "./GuidedJourney";
import VoiceIcon from "./VoiceIcon";
import {
  initialJourney,
  journeyReducer,
  revealOrder,
  revealedCounts,
  roundFor,
  sceneRoom,
  type Cue,
} from "./journey";
import MindUniverse, { type Location } from "./MindUniverse";

export default function App() {
  const [setup, setSetup] = useState<Setup>({ ...judgeSetup });
  const [journey, dispatch] = useReducer(
    journeyReducer,
    judgeSetup,
    initialJourney,
  );
  const [thought, setThought] = useState("");
  const [scenarioCue,setScenarioCue]=useState<Cue|null>(null);
  const [scenarioNavigation,setScenarioNavigation]=useState<ScenarioNavigation|null>(null);
  const onScenarioVisual=useCallback((next:Cue|null,nextRoom?:Location)=>{setScenarioCue(next);if(nextRoom)setRoom(nextRoom);},[]);
  const thoughtMatch = useMemo(() => routeThought(thought.slice(0, 10000)), [thought]);
  const matchedScenario = useMemo(() => thoughtMatch.status === "candidate"
    ? getScenario(thoughtMatch.candidates[0].id) : undefined, [thoughtMatch]);
  const familyTime = thoughtMatch.candidates.some(({ id }) => id === "family-time" || id === "family-deadline");
  const parallelScenarioId = matchedScenario?.id === "presentation-and-visit" ? undefined : matchedScenario?.id;
  const [thoughtArriving,setThoughtArriving]=useState(false);
  const [speaker, setSpeaker] = useState<District | null>(null);
  const [focus, setFocus] = useState<District | null>(null);
  const [listening, setListening] = useState(false);
  const [reactions, setReactions] = useState<Cue["reactions"]>([]);
  const [entered, setEntered] = useState(false);
  const [room, setRoom] = useState<Location>("hub");
  const tab =
    room === "parallel"
      ? "Compare"
      : room === "observatory"
        ? "Observatory"
        : "World";
  const [soundOn, setSoundOn] = useState(false);
  const [soundStatus, setSoundStatus] = useState(
    "Sound is off. Your world is still listening.",
  );
  const [volume, setVolume] = useState(audioConfig.masterVolumeDefault);
  const [muted, setMuted] = useState(false);
  const [solo, setSolo] = useState<District | null>(null);
  const [pair, setPair] = useState<{ a: Round; b: Round } | null>(null);
  // A guided counterfactual covers the changed day through the last story day in both worlds.
  const [horizon, setHorizon] = useState<{ day: number; a: Round[]; b: Round[] } | null>(null);
  const [unfold, setUnfold] = useState(0);
  const [hiddenPause, setHiddenPause] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [help, setHelp] = useState(false);
  const lastStepTime = useRef(0);
  const session = journey.world;
  const { state, rules: c, history, proposals, elapsed, playing } = session;
  const scene = journey.scene;
  const free = scene === "free";
  const guided = entered && !free && scene !== "thought";
  const staged = guided && !journey.exploring;
  const activeScenario=guided&&matchedScenario&&matchedScenario.id!=="presentation-and-visit"?matchedScenario:undefined;
  const last = history.at(-1);
  const selected = history.find((r) => r.before.day === selectedDay) ?? last;
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
  const ended = isWorldComplete(state, c);
  // Free play: forecast before voting, only the counted prefix while voting, totals after.
  const counted =
    phase === "Campaign"
      ? c.residentCount
      : phase === "Voting"
        ? Math.floor(
            Math.max(0, Math.min(1, (elapsed - c.campaignSeconds) / c.voteSeconds)) *
              c.residentCount,
          )
        : c.residentCount;
  const shownCounts = proposals.map(
    (_, i) => election.ballots.slice(0, counted).filter((b) => b.choice === i).length,
  );
  const shownLead = shownCounts.indexOf(Math.max(...shownCounts));

  useEffect(() => {
    if (!free) return;
    const timer = setInterval(() => dispatch({ type: "tick" }), 250);
    return () => clearInterval(timer);
  }, [free]);
  // One managed reveal clock: it only runs while counting and is cancelled on any change.
  const lockedDay = journey.locked?.day;
  useEffect(() => {
    if (scene !== "voting" || !journey.counting || lockedDay === undefined)
      return;
    const timer = setInterval(
      () => dispatch({ type: "reveal", day: lockedDay }),
      (c.guidedCountSeconds * 1000) / c.residentCount,
    );
    return () => clearInterval(timer);
  }, [scene, journey.counting, lockedDay, c]);
  useEffect(() => {
    if (entered && !journey.exploring && scene !== "free" && scene !== "thought")
      setRoom(sceneRoom[scene]);
    setListening(false);
    if (scene !== "result") setReactions([]);
    if ((scene === "listen" || scene === "closing") && horizon)
      setPair({ a: horizon.a.at(-1)!, b: horizon.b.at(-1)! });
  }, [scene, entered, journey.exploring]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) {
        dispatch({ type: "pause" });
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
    audio.setFrame({ a: projectScore(state, last, history.at(-2), c) });
  }, [state, last, history, c]);
  useEffect(() => {
    audio.setMix(0, solo, volume, muted);
  }, [solo, volume, muted]);
  useEffect(() => {
    audio.play(entered && soundOn && !hiddenPause && tab !== "Compare" &&
      (free ? playing : listening || (scene === "debate" && staged)));
  }, [entered, soundOn, hiddenPause, playing, tab, free, listening, scene, staged]);
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
  function restart() {
    setScenarioCue(null);setScenarioNavigation(null);
    setThought("");
    setThoughtArriving(false);
    setHorizon(null);
    audio.reset();
    dispatch({ type: "reset", setup });
    setPair(null);
    setSelectedDay(null);
    setSolo(null);
    setHiddenPause(false);
    setRoom("headquarters");
  }
  function reset() {
    setThought("");
    audio.reset();
    dispatch({ type: "reset", setup });
    dispatch({ type: "free" });
    setPair(null);
    setSelectedDay(null);
    setSolo(null);
    setHiddenPause(false);
    setRoom("decision");
  }
  const locked = journey.locked;
  const cueRound = locked ? roundFor(history, locked.day) : undefined;
  const cue: Cue | null = guided
    ? {
        scene,
        speaker,
        focus,
        plans: locked?.proposals ?? proposals,
        votes: locked
          ? (() => {
              const v: (number | null)[] = locked.election.ballots.map(() => null);
              revealOrder(v.length)
                .slice(0, journey.revealed)
                .forEach((i) => (v[i] = locked.election.ballots[i].choice));
              return v;
            })()
          : [],
        counts: locked ? revealedCounts(locked, journey.revealed) : null,
        winner:
          locked && journey.revealed >= locked.election.ballots.length
            ? locked.election.winner
            : null,
        flights:
          cueRound && (scene === "consequences" || scene === "reflection")
            ? { key: cueRound.id, allocation: cueRound.policy.allocation }
            : null,
        thought: scene === "briefing",
        reactions,
      }
    : null;
  function branchHorizon(day: number, policyId: string) {
    const r = replay(history, day, policyId, c);
    audio.reset();
    setHorizon({ day, ...r });
    setUnfold(0);
    setPair({ a: r.a[0], b: r.b[0] });
    setRoom("parallel");
  }
  function compare(round = selected) {
    if (!round) return;
    setHorizon(null);
    dispatch({ type: "pause" });
    audio.reset();
    const alternative = round.policies.find((p) => p.id !== round.policy.id);
    if (!alternative) return;
    setPair({ a: structuredClone(round), b: branch(round, alternative.id, c) });
    setRoom("parallel");
  }
  function navigate(next: "World" | "Compare" | "Observatory") {
    if (next === "Compare") {
      if (!pair) {
        compare();
        return;
      }
      dispatch({ type: "pause" });
    }
    setRoom(
      next === "Compare"
        ? "parallel"
        : next === "Observatory"
          ? "observatory"
          : "decision",
    );
  }
  function stepDay() {
    const now = performance.now();
    if (now - lastStepTime.current < 400) return;
    lastStepTime.current = now;
    dispatch({ type: "step", day: state.day });
  }
  return (
    <MindUniverse
      entered={entered}
      room={room}
      state={state}
      rules={c}
      history={history}
      pair={pair}
      setup={setup}
      onSetup={setSetup}
      election={election}
      phase={phase}
      voteProgress={Math.max(
        0,
        Math.min(1, (elapsed - c.campaignSeconds) / c.voteSeconds),
      )}
      onEnter={() => {
        setEntered(true);
        setHiddenPause(false);
        dispatch({ type: "reset", setup });
        setRoom("hub");
      }}
      guided={guided}
      free={free}
      staged={staged}
      cue={activeScenario?scenarioCue??cue:cue}
      parallelReady={!!activeScenario&&scenarioCue?.winner!==null&&scenarioCue?.winner!==undefined}
      inProgress={scene !== "thought"}
      onRelease={(next, text) => {
        audio.reset();
        if (!soundOn && !muted) void enableSound();
        setScenarioCue(null);setScenarioNavigation(null);
        setThought(text);
        setThoughtArriving(true);
        setHorizon(null);
        setPair(null);
        setSelectedDay(null);
        setSolo(null);
        setHiddenPause(false);
        dispatch({ type: "begin", setup: next });
      }}
      onFree={() => {
        setThought("");
        audio.reset();
        dispatch({ type: "reset", setup });
        dispatch({ type: "free" });
        setRoom("decision");
      }}
      onResume={() => {
        dispatch({ type: "explore", on: false });
        setRoom(sceneRoom[scene]);
      }}
      stage={
        staged ? (
          thoughtArriving ? <BrainTransition key={thought} thought={thought} onDone={()=>setThoughtArriving(false)} /> : activeScenario ? <ScenarioFlow key={thought} scenarioId={activeScenario.id} thought={thought} onVisual={onScenarioVisual} navigation={scenarioNavigation} onExit={restart} soundOn={soundOn&&!muted} onSound={()=>{setMuted(false);void enableSound();}}/> : <JourneyStage
            journey={journey}
            dispatch={dispatch}
            thought={thought}
            matchedScenarioTitle={matchedScenario?.title}
            parallelScenarioId={parallelScenarioId}
            familyTime={familyTime}
            soundOn={soundOn && !muted}
            solo={solo}
            onSound={() => {
              setMuted(false);
              void enableSound().then(() => setListening(scene !== "debate"));
            }}
            listening={listening}
            onListen={setListening}
            onSolo={setSolo}
            onSpeaker={setSpeaker}
            onFocus={setFocus}
            onExplore={() => dispatch({ type: "explore", on: true })}
            onObservatory={() => {
              dispatch({ type: "explore", on: true });
              setSelectedDay(history.at(-1)?.before.day ?? null);
              setRoom("observatory");
            }}
            onRestart={restart}
            onBranch={branchHorizon}
            horizon={horizon}
            unfold={unfold}
            onUnfold={(i) => {
              if (!horizon) return;
              setUnfold(i);
              audio.reset();
              setPair({ a: horizon.a[i], b: horizon.b[i] });
            }}
            onReact={(list) =>
              setReactions(list.map((r, i) => ({ ...r, key: performance.now() + i })))
            }
          />
        ) : null
      }
      onVisit={(next) => {
        if(activeScenario){if(next==="hub"){restart();setRoom("hub");}else setScenarioNavigation(previous=>({room:next,key:(previous?.key??0)+1}));return;}
        if (guided && !journey.exploring && next !== sceneRoom[scene])
          dispatch({ type: "explore", on: true });
        if (next === "parallel") {
          navigate("Compare");
          return;
        }
        setRoom(next);
      }}
      onApply={(next) => {
        setThought("");
        audio.reset();
        dispatch({ type: "reset", setup: next });
        if (free) dispatch({ type: "free" });
        setPair(null);
        setSelectedDay(null);
        setSolo(null);
        setHiddenPause(false);
      }}
      onInspect={(day) => {
        setSelectedDay(day);
        navigate("Observatory");
      }}
      onReplayMemory={(day) => {
        const round = roundFor(history, day);
        if (round) { setSelectedDay(day); compare(round); }
      }}
      onHelp={() => setHelp(true)}
      playing={tab !== "Compare" && playing}
      frozen={tab === "Compare"}
      onPlay={() => {
        setHiddenPause(false);
        if (tab !== "Compare") dispatch({ type: playing ? "pause" : "play" });
        if (!soundOn && audio.context) void enableSound();
      }}
      onStep={stepDay}
      solo={solo}
      onSolo={setSolo}
      sounding={
        soundOn &&
        !muted &&
        volume > 0 &&
        tab !== "Compare" && playing
      }
      soundOn={soundOn && !muted}
      onSound={() => {
        if (soundOn) setMuted(!muted);
        else {
          setMuted(false);
          void enableSound();
        }
      }}
    >
      <div className="app-shell">
        {entered && (
          <main className={`workspace ${staged ? "workspace-staged" : ""}`}>
            {hiddenPause && (
              <div className="away-banner" role="status">
                Your world paused while this tab was away. No days were skipped.
                <button
                  onClick={() => {
                    setHiddenPause(false);
                    void enableSound();
                    if (tab !== "Compare") dispatch({ type: "play" });
                  }}
                >
                  Resume experience <Play size={13} />
                </button>
              </div>
            )}
            {guided && journey.exploring && room === "decision" && (
              <section className="panel explore-note">
                The Decision Chamber is part of your guided journey. Resume the
                journey to continue today’s election.
              </section>
            )}
            {free && tab === "World" && room === "decision" && (
              <>
                <div className="world-grid">
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
                    <p className="election-note">{taskText(c, " Presentation due day ")}{c.taskDeadlineDay} ·{" "}
                      {c.connectionLastOpenDay ? `visit closes day ${c.connectionLastOpenDay}.` : "no visit."}
                      <br />
                      {ended
                        ? state.taskResult ? taskText(c, "Presentation complete. This scenario has ended.") : "The deadline has passed. This scenario has ended."
                        : externalEvent(state.day, c).detail}
                    </p>
                    <button
                      className="text-button"
                      onClick={() => setRoom("headquarters")}
                    >
                      Edit starting assumptions <Settings2 size={12} />
                    </button>
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
                          votes={shownCounts[i]}
                          leading={counted > 0 && i === shownLead}
                          label={phase === "Campaign" ? "LEADING FORECAST" : phase === "Voting" ? "LEADING COUNT" : "ELECTED"}
                          locked={
                            playing || elapsed >= c.campaignSeconds || ended
                          }
                          rules={c}
                          onSave={(policy) =>
                            dispatch({ type: "worldEdit", policy })
                          }
                        />
                      ))}
                    </div>
                    <div
                      className="vote-residents"
                      aria-label={`${c.residentCount} forecast votes`}
                    >
                      {election.ballots.slice(0, counted).map((b) => (
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
                      <span>
                        {counted} / {c.residentCount}
                        {phase === "Campaign" ? " forecast" : ""}
                      </span>
                    </div>
                    <p className="election-note">
                      {phase === "Campaign" ? "Live forecast" : "Locked ballot"}{" "}
                      ·{" "}
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
                    symbol="A"
                    color={districtInfo.A.color}
                    name={taskText(c, "Presentation")}
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
                    symbol="C"
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
                    symbol="D"
                    color={districtInfo.D.color}
                    name="Method"
                    value={state.method}
                    max={c.methodCap}
                    suffix="×"
                    detail="Discovery carries into future days"
                  />
                  <Resource
                    symbol="R"
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
                <div className="section-heading"><div><span className="eyebrow">PARALLEL WORLDS</span><h1>One decision. Two living futures.</h1><p>The same starting point. A different choice.</p></div></div>
                <ParallelWorlds a={pair.a} b={pair.b} rules={c} matchedScenarioId={parallelScenarioId} familyTime={familyTime} />
                <label className="parallel-policy-picker">Try another plan
                  <select aria-label="Alternative plan" value={horizon ? horizon.b[0].policy.id : pair.b.policy.id} onChange={(e) => {
                    audio.reset();
                    if (horizon) branchHorizon(horizon.day, e.target.value);
                    else setPair({ ...pair, b: branch(pair.a, e.target.value, c) });
                  }}>
                    {(horizon ? horizon.a[0] : pair.a).policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <button className="text-button" onClick={() => navigate("World")}>Return to your world <ArrowRight size={13} /></button>
              </section>
            )}

            {tab === "Observatory" && (
              <Observatory
                round={selected}
                state={state}
                rules={c}
                history={history}
                election={election}
                policies={proposals}
                onSelectDay={setSelectedDay}
                onBranch={() => compare()}
              />
            )}
            <footer className="footer">
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
                    e.currentTarget.querySelectorAll<HTMLButtonElement>(
                      "button",
                    );
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
                Explore what matters through four connected districts.
              </p>
              <ol>
                <li>
                  <b>Release a thought.</b> Tell us what’s on your mind, then confirm the details.</li>
                <li>
                  <b>Meet the voices and hear the debate.</b> Achievement,
                  Connection, Discovery and Recovery each make their case.
                </li>
                <li>
                  <b>Shape the plans.</b> Keep or edit a six-block plan. Then
                  24 residents vote and you watch the real ballots counted.
                </li>
                <li>
                  <b>See what changed.</b> Watch the world and its music respond.
                </li>
                <li>
                  <b>Try another future.</b> Change a completed day’s plan and compare the worlds.
                </li>
              </ol>
              <button className="primary" onClick={() => setHelp(false)}>
                Let’s explore <ArrowRight size={15} />
              </button>
            </section>
          </div>
        )}
      </div>
    </MindUniverse>
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
  symbol: District;
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
        <VoiceIcon d={symbol} size={34} />
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
    <div className="allocation-breakdown">
      <small>Time blocks</small>
      <div className="allocation-parts">
        {districts.filter(d => policy.allocation[d] > 0).map(d => (
          <span key={d} style={{ "--voice": districtInfo[d].color } as React.CSSProperties}>
            <VoiceIcon d={d} size={21} />
            <span>{districtInfo[d].name}</span>
            <b>×{policy.allocation[d]}</b>
          </span>
        ))}
      </div>
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
  label,
}: {
  label: string;
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
        <span className={`candidate-avatar avatar-${index}`}>{index + 1}</span>
        <div>
          <h3>{policy.name}</h3>
          <span>{leading ? label : policy.description}</span>
        </div>
        <div className="vote-count">
          {votes}
          <small>votes</small>
        </div>
      </div>
      <Budget policy={policy} />
      <div className="budget-caption">

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

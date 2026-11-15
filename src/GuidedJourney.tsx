import { conversationLine } from "./debateCopy";
import DebatePersonas from "./DebatePersonas";
import { BrainWorld, JourneyCinema } from "./BrainCinema";
import { introLine } from "./dialogue";
import PlanPreview, { TimeBlocks, timeLabels } from "./PlanPreview";
import { worldCaption } from "./parallelStory";
import ParallelWorlds from "./ParallelWorlds";
import { taskText } from "./simulation";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  FastForward,
  Headphones,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
} from "lucide-react";
import {
  taskTypes,
  actionState,
  isWorldComplete,
  districtInfo,
  districts,
  fmt,
  maxDeadlineDay,
  thoughtSignals,
  validatePolicy,
  type Config,
  type District,
  type Policy,
  type Round,
  type State,
} from "./simulation";
import {
  commentary,
  lastGuidedDay,
  previousScene,
  leaders,
  planAccent,
  revealOrder,
  revealedCounts,
  roundFor,
  sameAllocation,
  storySteps,
  worldSteps,
  type Journey,
  type JourneyAction,
  type Scene,
} from "./journey";
import {
  answer,
  debate,
  forecasts,
  questions,
  reaction,
  reactions,
  sinceYesterday,
  speakerName,
  voices,
  type Line,
  type Speaker,
} from "./dialogue";
import { audio, projectScore } from "./audio";
import VoiceIcon from "./VoiceIcon";

const signed = (n: number, places = 1) =>
  `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n), places)}`;
const color = (s: Speaker) => (s === "N" ? "#c9c3ff" : districtInfo[s].color);
const symbol = (s: Speaker) => (s === "N" ? "✳" : districtInfo[s].symbol);
interface Props {
  journey: Journey;
  dispatch: Dispatch<JourneyAction>;
  thought: string;
  soundOn: boolean;
  solo: District | null;
  onSound: () => void;
  onListen: (on: boolean) => void;
  listening: boolean;
  onSolo: (d: District | null) => void;
  onSpeaker: (d: District | null) => void;
  onFocus: (d: District | null) => void;
  onExplore: () => void;
  onObservatory: () => void;
  onRestart: () => void;
  onBranch: (day: number, policyId: string) => void;
  onReact: (list: { d: District; kind: "cheer" | "sigh" }[]) => void;
  horizon: { day: number; a: Round[]; b: Round[] } | null;
  unfold: number;
  onUnfold: (i: number) => void;
  mix: number;
  onMix: (x: number) => void;
  loops: boolean;
  onLoops: (on: boolean) => void;
}

export default function JourneyStage(props: Props) {
  const { journey: j, dispatch } = props;
  const w = j.world;
  const c = w.rules;
  const day = j.scene === "comparison" && props.horizon
    ? props.horizon.a[Math.min(props.unfold,props.horizon.a.length-1)].before.day
    : (j.scene === "listen" || j.scene === "closing") && props.horizon
      ? props.horizon.a.at(-1)!.before.day
      : j.locked?.day ?? w.state.day;
  const advance = (from: Scene) => dispatch({ type: "advance", from });
  const stage = useRef<HTMLElement>(null);
  useEffect(() => {
    stage.current?.scrollTo({ top: 0 });
    stage.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  }, [j.scene, day]);
  const post = worldSteps.some((s) => s.scene === j.scene);
  const steps = post ? worldSteps : storySteps;
  const stepIndex = steps.findIndex((s) => s.scene === j.scene);
  const wide = j.scene === "voting";
  return (
    <>
      <JourneyCinema scene={j.scene} thought={props.thought} day={day} policy={j.locked?.proposals[j.locked.election.winner] ?? w.history.at(-1)?.policy} memories={w.history} soundOn={props.soundOn} rules={c} previews={props.horizon ? [props.horizon.a[0],props.horizon.b[0]] : undefined} />
      <nav className="journey-strip" aria-label="Journey progress">
        <span className="journey-day">
          DAY <b>{Math.min(day, lastGuidedDay(c))}</b> / {lastGuidedDay(c)}
        </span>
        <ol>
          {steps.map((s, i) => (
            <li
              key={s.scene}
              className={
                i === stepIndex ? "step-current" : i < stepIndex ? "step-done" : ""
              }
              aria-current={i === stepIndex ? "step" : undefined}
            >
              {s.label}
            </li>
          ))}
        </ol>
        <div className="journey-tools">
          {previousScene(j) && <button className="journey-back" onClick={()=>dispatch({type:"back",from:j.scene})}><ArrowLeft size={13} /> Back</button>}
          {j.scene === "voting" && j.locked && j.revealed < j.locked.election.ballots.length && (
            <button onClick={() => dispatch({ type: "count", on: !j.counting })}>
              {j.counting ? <Pause size={14} /> : <Play size={14} />}
              {j.counting ? "Pause count" : "Resume count"}
            </button>
          )}
          <button onClick={props.onExplore} title="Pause the journey and wander the rooms">
            <Compass size={14} /> Explore manually
          </button>
          <button onClick={props.onRestart} aria-label="Start a new thought" title="Start a new thought">
            <RotateCcw size={14} />
          </button>
        </div>
      </nav>
      <p className="sr-only" role="status" aria-live="polite">
        {`Day ${day}: ${steps[stepIndex]?.label ?? j.scene}`}
      </p>
      <section
        ref={stage}
        className={`journey-stage scene-${j.scene} ${wide ? "stage-wide" : ""} ${j.scene==="debate"?"debate-studio":""}`}
        aria-label="Journey stage"
      >
        {j.scene === "clarify" && <Clarify {...props} advance={advance} />}
        {j.scene === "briefing" && <Briefing {...props} day={day} advance={advance} />}
        {j.scene === "introductions" && <Introductions {...props} advance={advance} />}
        {j.scene === "debate" && <Debate {...props} advance={advance} />}
        {j.scene === "intervention" && <Intervention {...props} advance={advance} />}
        {j.scene === "voting" && <Broadcast {...props} advance={advance} />}
        {j.scene === "result" && <Result {...props} advance={advance} />}
        {j.scene === "consequences" && <Consequences {...props} advance={advance} />}
        {j.scene === "reflection" && <Reflection {...props} advance={advance} />}
        {j.scene === "summary" && <Summary {...props} advance={advance} />}
        {j.scene === "branch" && <Branch {...props} advance={advance} />}
        {j.scene === "comparison" && <SideBySide {...props} advance={advance} />}
        {j.scene === "listen" && <Listen {...props} advance={advance} />}
        {j.scene === "closing" && <Closing {...props} advance={advance} />}
      </section>
      {!post && j.scene !== "intervention" && j.scene !== "debate" && j.scene !== "introductions" && <Ribbon state={w.state} rules={c} />}
    </>
  );
}

type SceneProps = Props & { advance: (from: Scene) => void; day?: number };

function Primary({ label, onClick, disabled, note }: { label: string; onClick: () => void; disabled?: boolean; note?: string }) {
  return (
    <div className="stage-action">
      {note && <small>{note}</small>}
      <button className="cosmic-primary" onClick={onClick} disabled={disabled}>
        {label} <ArrowRight size={15} />
      </button>
    </div>
  );
}

const hasVisit = (c: Config) => c.connectionLastOpenDay > 0;
const visitPhrase = (c: Config) =>
  !hasVisit(c)
    ? ""
    : c.connectionLastOpenDay === 1
      ? "Your friend is only here today."
      : `Your friend is here until the end of day ${c.connectionLastOpenDay}.`;
const deadlinePhrase = (c: Config) =>
  c.taskDeadlineDay === 1
    ? taskText(c, "Your presentation is due at the end of today.")
    : taskText(c, `Your presentation is due in ${c.taskDeadlineDay} days.`);

/** The single place to confirm or change the authored scenario's assumptions. */
function Clarify({ journey: j, dispatch, thought, advance }: SceneProps) {
  const s = j.setup;
  const c = j.world.rules;
  const from = thoughtSignals(thought);
  const set = (patch: Partial<typeof s>) => {
    const next = { ...s, ...patch };
    if (next.visitLastDay > next.taskDeadlineDay) next.visitLastDay = next.taskDeadlineDay;
    dispatch({ type: "assume", setup: next });
  };
  const tag = (mine: boolean, words?: string) => (
    <span className={`answer-tag ${mine ? "from-words" : ""}`}>
      {mine ? `From your words: “${words}”` : "Suggested assumption"}
    </span>
  );
  return (
    <>
      <span className="cosmic-eyebrow">BEFORE WE START · A FEW QUESTIONS</span>
      <h2 tabIndex={-1}>Let’s get your situation right.</h2>
      {thought && <blockquote className="thought-quote">“{thought}”</blockquote>}

      <fieldset className="choice-set">
        <legend>What are you working on?</legend>
        <label className="inline-field">
          Task type
          <select value={s.taskType} onChange={(e) => set({ taskType: e.target.value as typeof s.taskType })}>
            {taskTypes.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
          </select>
        </label>
      </fieldset>
      <fieldset className="choice-set">
        <legend>{taskText(c, "When is the presentation due?")}</legend>
        {tag(false)}
        <div className="chip-row">
          {Array.from({ length: maxDeadlineDay }, (_, i) => i + 1).map((d) => (
            <button key={d} aria-pressed={s.taskDeadlineDay === d} onClick={() => set({ taskDeadlineDay: d })}>
              {d === 1 ? "End of today" : `End of day ${d}`}
            </button>
          ))}
        </div>
      </fieldset>
      {(from.visit || s.visitLastDay > 0) && <fieldset className="choice-set">
        <legend>Is a visit competing for your time?</legend>
        {from.visit && s.visitLastDay > 0 && tag(true, "friend / visit")}
        <div className="chip-row">
          <button aria-pressed={s.visitLastDay > 0} onClick={() => set({ visitLastDay: Math.max(1, s.visitLastDay || 1) })}>
            Yes, a friend’s visit
          </button>
          <button aria-pressed={s.visitLastDay === 0} onClick={() => set({ visitLastDay: 0 })}>{taskText(c, " No, just the presentation ")}</button>
        </div>
        {s.visitLastDay > 0 && (
          <label className="inline-field">
            The visit is possible until
            <select value={s.visitLastDay} onChange={(e) => set({ visitLastDay: +e.target.value })}>
              {Array.from({ length: s.taskDeadlineDay }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d === 1 ? "the end of today" : `the end of day ${d}`}</option>
              ))}
            </select>
          </label>
        )}
      </fieldset>}
      <fieldset className="choice-set">
        <legend>{taskText(c, "How far along is the presentation?")}</legend>
        {tag(from.prepared, "almost done")}
        <label className="inline-field">
          <input type="range" min={0} max={j.world.rules.taskGoal} step={1} value={Math.min(s.taskProgress, j.world.rules.taskGoal)}
            onChange={(e) => set({ taskProgress: +e.target.value })} />
          <b>{s.taskProgress} / {j.world.rules.taskGoal} points</b>
        </label>
      </fieldset>
      <fieldset className="choice-set">
        <legend>How much energy do you have right now?</legend>
        {tag(from.tired, "exhausted / tired")}
        <label className="inline-field">
          <input type="range" min={0} max={s.energyCap} step={1} value={s.energy}
            onChange={(e) => set({ energy: +e.target.value })} />
          <b>{s.energy} / {s.energyCap} tokens</b>
        </label>
      </fieldset>
      <Primary label="Confirm and see the briefing" onClick={() => advance("clarify")} />
    </>
  );
}

function Briefing({ journey: j, dispatch, thought, advance }: SceneProps) {
  const w = j.world, c = w.rules;
  const start = actionState(w.state, c);
  const prev = w.history.at(-1);
  const first = w.history.length === 0;
  const visitOpen = w.state.day <= c.connectionLastOpenDay;
  return (
    <>
      <span className="cosmic-eyebrow">DAY {w.state.day} OF {c.taskDeadlineDay} · BRIEFING</span>
      <h2 tabIndex={-1}>{first ? "Here is the dilemma." : "A new day. Here's what changed."}</h2>
      {first ? (
        <>
          {thought && <blockquote className="thought-quote">“{thought}”</blockquote>}
          <p className="stage-lede">
            {deadlinePhrase(c)} {visitPhrase(c)} You have {c.dailyBudget} blocks to spend today, and limited energy.
          </p>
        </>
      ) : (
        <ul className="since-list">
          {prev && sinceYesterday(prev, start, c).map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
      <div className="fact-grid">
        <article style={{ "--fact": districtInfo.A.color } as CSSProperties}>
          <small>DEADLINE</small>
          <b>{fmt(w.state.taskProgress)} / {c.taskGoal}</b>
          <span>{taskText(c, "presentation points, due end of day ")}{c.taskDeadlineDay}{w.state.taskProgress >= c.taskGoal ? " · already complete" : ""}</span>
        </article>
        <article style={{ "--fact": districtInfo.C.color } as CSSProperties}>
          {hasVisit(c) ? (
            <>
              <small>{visitOpen ? "CLOSING OPPORTUNITY" : "OPPORTUNITY CLOSED"}</small>
              <b>{fmt(w.state.connectionProgress)} / {c.connectionGoal}</b>
              <span>visit points · {visitOpen ? (c.connectionLastOpenDay === w.state.day ? "last day" : `until day ${c.connectionLastOpenDay}`) : w.state.connectionResult ? "goal met" : "goal missed"}</span>
            </>
          ) : (
            <>
              <small>NO COMPETING VISIT</small>
              <b>—</b>
              <span>You confirmed there’s no visit, so no plan spends time on one.</span>
            </>
          )}
        </article>
        <article style={{ "--fact": districtInfo.R.color } as CSSProperties}>
          <small>TODAY’S RESOURCES</small>
          <b>{c.dailyBudget} blocks</b>
          <span>of time, plus {fmt(start.energy)} / {c.energyCap} energy tokens{start.energy !== w.state.energy ? ` (after: ${prev?.external.name ?? ""})` : ""}</span>
        </article>
      </div>
      {first && (
        <div className="mapped">
          <button className="text-button" onClick={() => dispatch({ type: "back", from: "briefing" })}>
            Change my answers
          </button>
        </div>
      )}
      <Primary label={first ? "Meet your voices" : "Hear the debate"} onClick={() => advance("briefing")} />
    </>
  );
}

function Introductions({ journey: j, dispatch, advance, onSpeaker }: SceneProps) {
  const index=Math.min(j.line,3), d=districts[index];
  useEffect(() => { onSpeaker(d); return () => onSpeaker(null); }, [d, onSpeaker]);
  const s=j.world.state,c=j.world.rules;
  const detail={A:`${fmt(s.taskProgress)} of ${c.taskGoal} ${c.taskType} points`,C:c.connectionLastOpenDay>0?`Visit available until day ${c.connectionLastOpenDay}`:"No visit planned",D:`${fmt(s.method,2)}× current method`,R:`${fmt(s.energy)} of ${c.energyCap} energy`}[d];
  return <div className="voice-introduction" style={{"--intro-voice":districtInfo[d].color} as CSSProperties}>
    <header className="intro-heading"><span className="cosmic-eyebrow">MEET YOUR VOICES · {index+1} OF 4</span><h2 tabIndex={-1}>One mind. Four priorities.</h2></header>
    <div className="intro-composition">
      <div className="intro-world"><BrainWorld active={[...districts]} speaker={d} mode="debate" /></div>
      <article className="intro-voice-panel" key={d} aria-label={`${districtInfo[d].name} introduction`}>
        <div className="intro-identity"><VoiceIcon d={d} size={54} speaking/><span>YOUR INNER VOICE</span></div>
        <h3>{districtInfo[d].name}</h3>
        <blockquote>“{introLine(d,c,s.day)}”</blockquote>
        <span className="intro-world-detail">{detail}</span>
      </article>
    </div>
    <footer className="intro-footer">
      <div className="intro-voice-tabs" role="group" aria-label="Meet a voice">{districts.map((voice,i)=><button key={voice} aria-label={`Meet ${districtInfo[voice].name}`} aria-pressed={voice===d} style={{"--tab-voice":districtInfo[voice].color} as CSSProperties} onClick={()=>dispatch({type:"line",line:i})}><VoiceIcon d={voice} size={25}/><span>{districtInfo[voice].name}</span></button>)}</div>
      <div className="intro-actions"><button className="text-button" onClick={()=>advance("introductions")}>Skip introductions</button><button className="cosmic-primary" onClick={()=>index<3?dispatch({type:"line",line:index+1}):advance("introductions")}>{index<3?"Next voice":"Hear the debate"}<ArrowRight size={15}/></button></div>
    </footer>
  </div>;
}

function Debate({ journey: j, dispatch, advance, onSpeaker, soundOn, onSound }: SceneProps) {
  const w = j.world, c = w.rules;
  const start = actionState(w.state, c);
  const lines = useMemo(() => debate(start, w.proposals, c), [start, w.proposals, c]);
  const shown = Math.min(j.line, lines.length - 1);
  const current = lines[shown];
  const [asking, setAsking] = useState<District | null>(null);
  const [asked, setAsked] = useState<{ d: District; q: number; line: number } | null>(null);
  const speaker = asked?.line === shown ? asked.d : current.speaker === "N" ? null : current.speaker;
  useEffect(() => { onSpeaker(speaker); return () => onSpeaker(null); }, [speaker, onSpeaker]);
  useEffect(() => {
    audio.setDebateSpeaker(speaker);
    return () => audio.setDebateSpeaker(undefined);
  }, [speaker]);
  const f = forecasts(start, w.proposals, c);
  const done = shown >= lines.length - 1;
  // Auto-play at reading pace; it stops at the end, on Pause, or while a question is open.
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || done || asking) return;
    const words = current.text.split(/\s+/).length;
    const timer = window.setTimeout(() => {
      if (!document.hidden) dispatch({ type: "line", line: shown + 1 });
    }, 1800 + words * 260);
    return () => window.clearTimeout(timer);
  }, [auto, done, asking, shown, current.text, dispatch]);
  return (
    <>
      <span className="cosmic-eyebrow">DAY {w.state.day} · THE DEBATE · DECISION CHAMBER</span>
      <div className="debate-title"><h2 tabIndex={-1}>Hear them argue it out.</h2>
      {done ? (
        <Primary label="Review the plans" onClick={() => advance("debate")} />
      ) : (
        <div className="stage-action split">
          <button className="text-button" onClick={() => advance("debate")}>Skip debate</button>
          <button className="cosmic-primary" onClick={() => dispatch({ type: "line", line: shown + 1 })}>
            Next line <ArrowRight size={15} />
          </button>
        </div>
      )}
      </div>
      <div className="debate-theatre">
      <div className="debate-stage-fallback"><DebatePersonas speaker={speaker} playing={auto&&!done&&!asking} answering={asked?.line===shown} mood={current.speaker===speaker?current.mood:undefined} onSelect={d=>{setAsking(d);setAsked(null);setAuto(false);}}/></div>
      <div className="debate-dialogue">
      <div className="now-speaking" style={{ "--voice": color(speaker ?? "N") } as CSSProperties} aria-live="polite">
        {speaker === null ? <span className="line-mark">✳</span> : <VoiceIcon d={speaker} size={40} speaking={auto&&!done} />}
        <span>
          <small>{asked?.line===shown ? "ANSWERING YOUR QUESTION" : `LINE ${shown + 1} OF ${lines.length}`}</small>
          <b>{speakerName(speaker ?? "N")}</b>
        </span>
        <button className="secondary small" disabled={done} onClick={() => setAuto(!auto)} aria-pressed={auto && !done}>
          {auto && !done ? <Pause size={13} /> : <Play size={13} />} {done ? "Finished" : auto ? "Pause" : "Auto-play"}
        </button>
      </div>
      <details className="debate-ask-details" open={asking!==null} onToggle={e=>{if(e.currentTarget.open&&!asking)setAsking(speaker??"A");else if(!e.currentTarget.open&&asking)setAsking(null);}}><summary>Ask a voice</summary><div className="ask">
        <div className="stage-question-voices" role="group" aria-label="Choose a voice to ask">{districts.map(d=><button key={d} aria-pressed={asking===d} onClick={()=>{setAsking(d);setAsked(null);}}><VoiceIcon d={d} size={21}/>{districtInfo[d].name}</button>)}</div>
        {asking && (
          <div className="ask-questions">
            {questions.map((q, i) => (
              <button key={q} className="text-button" onClick={() => setAsked({ d: asking, q: i, line: shown })}>{q}</button>
            ))}
          </div>
        )}
      </div></details>
      <blockquote className="debate-current-line" key={`${shown}:${asked?.line===shown?asked.q:"line"}:${speaker}`}>
        {asked?.line===shown ? answer(asked.d,asked.q,start,w.proposals,c) : conversationLine(current,start,w.proposals,c)}
      </blockquote>
      </div>
      </div>
      <div className="debate-secondary-tools"><details className="debate-history"><summary>Conversation so far</summary><ol className="transcript">{lines.slice(0,shown+1).map((line,i)=><TranscriptLine key={i} line={line} current={false}/>)}</ol></details>
      <details className="debate-plan-details"><summary>See the plan in this argument</summary>{current.policy !== undefined && <PlanChip policy={w.proposals[current.policy]} f={f[current.policy]} rules={c} />}</details>
      <div className="debate-controls">
        {!soundOn && <button className="text-button" onClick={onSound}>Enable debate sounds</button>}
        <button className="text-button" disabled={done} onClick={() => dispatch({ type: "line", line: lines.length - 1 })}>
          Show full exchange
        </button>
      </div></div>
    </>
  );
}

function TranscriptLine({ line, current }: { line: Line; current: boolean }) {
  return (
    <li className={current ? "line-current" : ""} style={{ "--voice": color(line.speaker) } as CSSProperties}>
      <span className="line-mark" aria-hidden="true">
        {line.speaker === "N" ? symbol("N") : <VoiceIcon d={line.speaker} size={30} speaking={current} />}
      </span>
      <div>
        <b>{speakerName(line.speaker)}</b>
        <p>{line.text}</p>
      </div>
    </li>
  );
}

function Tokens({ policy }: { policy: Policy }) {
  return (
    <span className="tokens" aria-label={districts.map((d) => `${districtInfo[d].name} ${policy.allocation[d]}`).join(", ")}>
      {districts.filter((d) => policy.allocation[d] > 0).map((d) => (
        <span key={d} className="token-chip" style={{ "--voice": districtInfo[d].color } as CSSProperties}>
          <VoiceIcon d={d} size={18} />
          {districtInfo[d].name} <b>×{policy.allocation[d]}</b>
        </span>
      ))}
    </span>
  );
}
function allocationText(p: Policy) {
  return districts.filter((d) => p.allocation[d] > 0).map((d) => `${districtInfo[d].name} ${p.allocation[d]}`).join(" · ");
}
function PlanChip({ policy, f, rules }: { policy: Policy; f: ReturnType<typeof forecasts>[number]; rules: Config }) {
  return (
    <div className="plan-chip">
      <small>PLAN IN FOCUS · FORECAST</small>
      <b>{policy.name}</b>
      <Tokens policy={policy} />
      <Forecast f={f} rules={rules} />
    </div>
  );
}
function Forecast({ f, rules: c }: { f: ReturnType<typeof forecasts>[number]; rules: Config }) {
  return (
    <dl className="forecast">
      <div><dt>{taskText(c, "Presentation")}</dt><dd>+{fmt(f.taskGain)} pts</dd></div>
      <div><dt>Visit</dt><dd>{f.connectionOpen ? `+${fmt(f.connectionGain)} pts` : "closed"}</dd></div>
      <div><dt>Energy</dt><dd>{signed(f.energyDelta)} tokens</dd></div>
      <div><dt>Method</dt><dd>{f.methodGain > 0 ? `${signed(f.methodGain, 2)}× from tomorrow` : "no change"}</dd></div>
      <span className="sr-only">Energy cap {c.energyCap}</span>
    </dl>
  );
}

function Intervention({ journey: j, dispatch, advance, onSpeaker, onReact }: SceneProps) {
  const w = j.world, c = w.rules;
  const start = actionState(w.state, c);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => () => onSpeaker(null), [onSpeaker]);
  const edited = j.edits.filter((e) => e.day === w.state.day).map((e) => e.policyId);
  const open = w.state.day <= c.connectionLastOpenDay;
  const used = draft ? districts.reduce((s, d) => s + draft.allocation[d], 0) : 0;
  const twins = w.proposals.some((p, i) => w.proposals.slice(i + 1).some((q) => sameAllocation(p.allocation, q.allocation)));
  return <>
    <span className="cosmic-eyebrow">DAY {w.state.day} · BEFORE THE VOTE</span>
    <h2 tabIndex={-1}>How should today look?</h2>
    <p className="stage-lede">Keep these plans, or move the blocks. The residents vote next.</p>
    <div className="plan-legend"><b>{c.dailyBudget} blocks to spend</b>{districts.filter((d) => d !== "C" || open).map((d) => <span key={d} style={{ "--voice": districtInfo[d].color } as CSSProperties}><i />{timeLabels[d]}</span>)}</div>
    {twins && <p className="stage-note">Two plans use the same blocks today. Adjust one to offer a different choice.</p>}
    {!open && c.connectionLastOpenDay > 0 && <p className="stage-foot">The visit has ended. Today’s plans focus on what’s still possible.</p>}
    <div className="plan-list">
      {w.proposals.map((p, i) => {
        const changing = editing === p.id && draft !== null;
        const shown = changing ? draft! : p;
        const f = forecasts(start, [shown], c)[0];
        return <article key={p.id} className={`plan-card ${changing ? "plan-editing" : ""}`} aria-label={p.name} style={{ "--plan": districtInfo[planAccent(p, w.proposals)].color } as CSSProperties}>
          <header><VoiceIcon d={planAccent(p, w.proposals)} size={38} /><div><span className="plan-step">PLAN {i + 1}</span><b>{p.name}</b>{edited.includes(p.id) && <span className="plan-edit-tag">YOUR EDIT</span>}</div></header>
          <TimeBlocks policy={shown} budget={c.dailyBudget} />
          <PlanPreview state={start} policy={shown} rules={c} />
          {changing && <div className="token-tray">
            <small>Remove a block, then put it somewhere else.</small>
            {districts.filter((d) => d !== "C" || open || shown.allocation.C > 0).map((d) => <div key={d} className="tray-row" style={{ "--voice": districtInfo[d].color } as CSSProperties}>
              <span className="tray-name"><VoiceIcon d={d} size={20} />{timeLabels[d]}</span>
              <button aria-label={`Remove a ${timeLabels[d].toLowerCase()} block`} disabled={shown.allocation[d] <= 0} onClick={() => setDraft({ ...shown, allocation: { ...shown.allocation, [d]: shown.allocation[d] - 1 } })}><Minus size={13} /></button>
              <output>{shown.allocation[d]}</output>
              <button aria-label={`Add a ${timeLabels[d].toLowerCase()} block`} disabled={(d === "C" && !open) || used >= c.dailyBudget} onClick={() => setDraft({ ...shown, allocation: { ...shown.allocation, [d]: shown.allocation[d] + 1 } })}><Plus size={13} /></button>
            </div>)}
            <p className={`budget-count ${used === c.dailyBudget ? "budget-ok" : ""}`} role="status">{used === c.dailyBudget ? "All blocks placed" : `${c.dailyBudget - used} block${c.dailyBudget - used === 1 ? "" : "s"} left to place`}</p>
            <button className="secondary small" disabled={!!validatePolicy(shown, c)} onClick={() => {
              const line = reaction(p, shown, start, c);
              if (line.speaker !== "N") { onSpeaker(line.speaker); onReact([{ d: line.speaker, kind: shown.allocation[line.speaker] > p.allocation[line.speaker] ? "cheer" : "sigh" }]); }
              dispatch({ type: "edit", policy: shown }); setEditing(null); setDraft(null); setSaved(true);
            }}>Save changes</button>
          </div>}
          <button className="plan-edit-button" disabled={editing !== null && editing !== p.id} onClick={() => {
            setSaved(false);
            if (changing) { setEditing(null); setDraft(null); return; }
            setEditing(p.id); setDraft(structuredClone(p));
          }}>{changing ? "Cancel edit" : "Adjust blocks"}</button>
          <details className="plan-forecast-details"><summary>Exact forecast</summary><Forecast f={f} rules={c} /></details>
        </article>;
      })}
    </div>
    {saved && <p className="plan-save-feedback" role="status">✓ Your plan is saved. The residents will consider your changes.</p>}
    <details className="equations"><summary>How this works</summary><p>Each plan uses {c.dailyBudget} time blocks. Work moves your {c.taskType} forward. Friends protects the visit while it is possible. Rest restores energy. Ideas improves the method for future work.</p><p>Residents vote for the plan that best fits their priorities. Identical plans are resolved by the existing tie rule: the first listed wins.</p><details><summary>Show the maths</summary><p>Work gain = {c.achievementRate} × work blocks × energy factor × method, capped at the remaining task points. Energy factor = {c.energyFactorFloor} + {c.energyFactorRange} × energy / {c.energyCap}. Visit gain = {c.connectionRate} × friends blocks while open, capped at the remaining visit points. Rest restores {c.recoveryRate} energy per block before costs and capacity limits.</p></details></details>
    <Primary label={edited.length ? "Vote on these plans" : "Keep these plans · Start the vote"} disabled={editing !== null} note={editing !== null ? "Save or cancel your edit first." : undefined} onClick={() => advance("intervention")} />
  </>;
}

function Broadcast({ journey: j, dispatch, advance }: SceneProps) {
  const locked = j.locked!;
  const c = j.world.rules;
  const total = locked.election.ballots.length;
  const counts = revealedCounts(locked, j.revealed);
  const lead = leaders(counts);
  const final = j.revealed >= total;
  const notes = commentary(locked, j.revealed).slice(-4);
  const order = useMemo(() => revealOrder(total), [total]);
  const [resident, setResident] = useState<number | null>(null);
  const shown = new Set(order.slice(0, j.revealed));
  const b = resident !== null && shown.has(resident) ? locked.election.ballots[resident] : null;
  return (
    <>
      <div className="broadcast-head">
        <span className={`live-tag ${final ? "is-final" : ""}`}>
          {final ? "FINAL" : j.revealed === 0 ? "POLLS OPEN" : j.counting ? "COUNTING" : "COUNT PAUSED"}
        </span>
        <span className="cosmic-eyebrow">DAY {locked.day} · ELECTION NIGHT</span>
        <b className="counted">{j.revealed} / {total} <small>ballots counted</small></b>
      </div>
      <h2 tabIndex={-1}>The residents are voting.</h2>
      <div className="bars">
        {locked.proposals.map((p, i) => (
          <div key={p.id} className={`bar-row ${final && i === locked.election.winner ? "bar-winner" : lead.includes(i) ? "bar-leading" : ""}`}
            style={{ "--plan": districtInfo[planAccent(p, locked.proposals)].color } as CSSProperties}>
            <span className="plan-number">{i + 1}</span>
            <div>
              <b>{p.name}</b>
              <small>{allocationText(p)}</small>
              <span className="bar"><i style={{ width: `${(counts[i] / total) * 100}%` }} /></span>
            </div>
            <strong>{counts[i]}</strong>
          </div>
        ))}
      </div>
      <div className="residents-grid" aria-label="Resident ballots">
        {order.map((r, k) => {
          const ballot = locked.election.ballots[r];
          const on = k < j.revealed;
          return (
            <button key={r} disabled={!on} aria-pressed={resident === r}
              aria-label={on ? `Resident ${r + 1}: ${locked.proposals[ballot.choice].name}` : `Resident ${r + 1}: not counted yet`}
              style={on ? ({ "--plan": districtInfo[planAccent(locked.proposals[ballot.choice], locked.proposals)].color } as CSSProperties) : undefined}
              className={on ? "is-counted" : ""}
              onClick={() => setResident(resident === r ? null : r)}>
              {on ? ballot.choice + 1 : ""}
            </button>
          );
        })}
      </div>
      {b && <ResidentCard ballot={b} index={resident!} proposals={locked.proposals} />}
      <ul className="commentary">
        {notes.map((n) => <li key={n}>{n}</li>)}
      </ul>
      <p className="sr-only" aria-live="polite">
        {final ? `Final: ${locked.proposals.map((p, i) => `${p.name} ${locked.election.counts[i]}`).join(", ")}.` : ""}
      </p>
      {final ? (
        <Primary label="See the result" onClick={() => advance("voting")} />
      ) : (
        <div className="stage-action split">
          <button className="secondary small" onClick={() => dispatch({ type: "count", on: !j.counting })}>
            {j.counting ? <Pause size={13} /> : <Play size={13} />} {j.counting ? "Pause count" : "Resume count"}
          </button>
          <button className="cosmic-primary" onClick={() => dispatch({ type: "revealAll" })}>
            Reveal all <FastForward size={15} />
          </button>
        </div>
      )}
      <small className="stage-foot">Each resident votes for the plan with the highest utility for their priorities. District membership doesn't decide a vote. Total {c.residentCount}.</small>
    </>
  );
}

function ResidentCard({ ballot, index, proposals }: { ballot: Journey["locked"] extends infer L ? L extends { election: { ballots: (infer B)[] } } ? B : never : never; index: number; proposals: Policy[] }) {
  const top = [...districts].sort((a, b) => ballot.resident.weights[b] - ballot.resident.weights[a]);
  return (
    <div className="resident-card">
      <b>Resident {index + 1} · lives in {districtInfo[ballot.resident.district].name}</b>
      <p>
        Cares most about {districtInfo[top[0]].name} ({Math.round(ballot.resident.weights[top[0]] * 100)}%) and {districtInfo[top[1]].name} ({Math.round(ballot.resident.weights[top[1]] * 100)}%).
        Voted <b>{proposals[ballot.choice].name}</b>, because it scored highest for those priorities.
      </p>
      <details>
        <summary>Show calculation</summary>
        <ul>
          {proposals.map((p, i) => (
            <li key={p.id}>{p.name}: utility {fmt(ballot.utilities[i], 4)}{i === ballot.choice ? " ← highest" : ""}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Result({ journey: j, advance, onSpeaker, onReact }: SceneProps) {
  const locked = j.locked!;
  const c = j.world.rules;
  const e = locked.election;
  const w = locked.proposals[e.winner];
  const lines = reactions(e.winner, locked.proposals, locked.start, c);
  const f = forecasts(locked.start, [w], c)[0];
  useEffect(() => { onSpeaker(lines[0].speaker === "N" ? null : lines[0].speaker); return () => onSpeaker(null); }, [lines, onSpeaker]);
  const committed = !!roundFor(j.world.history, locked.day);
  useEffect(() => {
    onReact(
      lines.flatMap((l) => (l.speaker !== "N" && l.mood ? [{ d: l.speaker, kind: l.mood }] : [])),
    );
    // Once per result moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked.day]);
  return (
    <>
      <span className="cosmic-eyebrow">DAY {locked.day} · RESULT</span>
      <h2 tabIndex={-1}>{w.name} wins, {e.counts[e.winner]} of {e.ballots.length}.</h2>
      {e.tied && <p className="stage-note">It was a tie at {e.counts[e.winner]}. The model gives ties to the first-listed plan.</p>}
      <div className="winner-card" style={{ "--plan": districtInfo[planAccent(w, locked.proposals)].color } as CSSProperties}>
        <Tokens policy={w} />
        <p>
          This plan governs today's {c.dailyBudget} blocks: {allocationText(w)}. Forecast:
          +{fmt(f.taskGain)}{taskText(c, " presentation, ")}{f.connectionOpen ? `+${fmt(f.connectionGain)} visit, ` : ""}{signed(f.energyDelta)} energy{f.methodGain > 0 ? `, ${signed(f.methodGain, 2)}× method from tomorrow` : ""}.
        </p>
      </div>
      <ol className="transcript">
        {lines.map((l, i) => <TranscriptLine key={i} line={l} current={i === 0} />)}
      </ol>
      <Primary label="Watch today's consequences" onClick={() => advance("result")} note={committed ? "Already resolved: this replays the recorded day." : undefined} />
    </>
  );
}

function Consequences({ journey: j, advance, dispatch, onFocus, soundOn, onSound, onSolo, solo, onListen, listening }: SceneProps) {
  const c = j.world.rules;
  const r = roundFor(j.world.history, j.locked!.day)!;
  const prior = roundFor(j.world.history, r.before.day - 1);
  const [focus, setFocus] = useState<District | null>(null);
  useEffect(() => { onFocus(focus); }, [focus, onFocus]);
  useEffect(() => () => onFocus(null), [onFocus]);
  const score = projectScore(r.after, r, prior, c);
  const allRows: { d: District; name: string; before: string; change: string; after: string; why: string }[] = [
    {
      d: "A", name: taskText(c, "Presentation"), before: `${fmt(r.start.taskProgress)}`, change: `+${fmt(r.activity.taskGain)} pts`, after: `${fmt(r.after.taskProgress)} / ${c.taskGoal}`,
      why: r.after.taskResult !== null
        ? taskText(c, `The presentation ${r.after.taskResult ? `reached the ${c.taskGoal}-point goal on day ${r.before.day}` : `missed the ${c.taskGoal}-point goal at the deadline`}.`)
        : `${r.policy.allocation.A} Achievement blocks at ${fmt(r.activity.energyFactor, 2)}× energy and ${fmt(r.start.method, 2)}× method. ${fmt(Math.max(0, c.taskGoal - r.after.taskProgress))} points remain before day ${c.taskDeadlineDay} ends.`,
    },
    {
      d: "C", name: "Visit", before: `${fmt(r.start.connectionProgress)}`, change: r.activity.connectionOpen ? `+${fmt(r.activity.connectionGain)} pts` : "closed", after: `${fmt(r.after.connectionProgress)} / ${c.connectionGoal}`,
      why: r.after.connectionResult !== null && r.before.day === c.connectionLastOpenDay
        ? `The window has now closed: target ${r.after.connectionResult ? "met" : "missed"}.`
        : r.activity.connectionOpen ? `${r.policy.allocation.C} Connection blocks while the visit was open.` : "The window closed earlier. No plan can change it.",
    },
    {
      d: "R", name: "Energy", before: `${fmt(r.before.energy)}`,
      change: `${r.external.energy ? `${signed(r.external.energy, 0)} event, ` : ""}${signed(r.activity.energyDelta)} activity`,
      after: `${fmt(r.after.energy)} / ${c.energyCap}`,
      why: `${r.external.name}: ${r.external.energy ? `${signed(r.external.energy, 0)} token before the vote` : "no change"}. Today's blocks then ${r.activity.energyDelta < 0 ? "used" : "restored"} ${fmt(Math.abs(r.activity.energyDelta))} tokens, kept between 0 and ${c.energyCap}.`,
    },
    {
      d: "D", name: "Method", before: `${fmt(r.start.method, 2)}×`, change: r.activity.methodGain > 0 ? `${signed(r.activity.methodGain, 2)}×` : "no change", after: `${fmt(r.after.method, 2)}×`,
      why: r.activity.methodGain > 0 ? taskText(c, `Applies to presentation work from day ${r.before.day + 1}, not retroactively.`) : "No Discovery blocks today, so the multiplier holds.",
    },
  ];
  const rows = allRows.filter((row) => row.d !== "C" || c.connectionLastOpenDay > 0);
  const layers: { d: District; text: string }[] = [
    { d: "A", text: taskText(c, `Achievement plays the melody: ${score.density.A} note${score.density.A === 1 ? "" : "s"} per bar from today's presentation gain.`) },
    { d: "C", text: score.density.C ? `Connection adds call and response, from today's visit points.` : c.connectionLastOpenDay ? "Connection is silent: no visit points today." : "Connection is silent: there's no visit in this scenario." },
    { d: "D", text: score.density.D ? `Discovery's counterline plays because the method was above 1× today.` : "Discovery's counterline joins once a method gain is in effect, from the next day." },
    { d: "R", text: score.density.R ? `Recovery contributes the sustained bass, from ${fmt(r.activity.restored)} restored energy.` : "Recovery's bass is quiet: nothing was restored after costs." },
  ];
  return (
    <>
      <span className="cosmic-eyebrow">DAY {r.before.day} · CONSEQUENCES</span>
      <h2 tabIndex={-1}>What {r.policy.name} changed.</h2>
      <p className="stage-lede">The {c.dailyBudget} time blocks flew to their districts. Time blocks, energy tokens, points and the method multiplier are different resources.</p>
      <table className="ledger">
        <thead><tr><th>Resource</th><th>Before</th><th>Change</th><th>After</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.d} className={focus === row.d ? "ledger-focus" : ""} style={{ "--voice": districtInfo[row.d].color } as CSSProperties}>
              <th><button onClick={() => setFocus(focus === row.d ? null : row.d)} aria-expanded={focus === row.d}><VoiceIcon d={row.d} size={18} /> {row.name}</button></th>
              <td>{row.before}</td><td>{row.change}</td><td>{row.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {focus && <p className="ledger-why" style={{ "--voice": districtInfo[focus].color } as CSSProperties}>{rows.find((x) => x.d === focus)!.why}</p>}
      <div className="music-box">
        <div className="music-head">
          <b><Headphones size={15} /> What today sounds like</b>
          {soundOn ? (
            <button className="secondary small" onClick={() => onListen(!listening)}>
              {listening ? <Pause size={13} /> : <Play size={13} />} {listening ? "Pause" : "Hear the composition"}
            </button>
          ) : (
            <button className="secondary small" onClick={onSound}>Enable sound</button>
          )}
        </div>
        <ul>
          {layers.map((l) => (
            <li key={l.d} style={{ "--voice": districtInfo[l.d].color } as CSSProperties}>
              <span>{l.text}</span>
              <button className="text-button" aria-pressed={solo === l.d} onClick={() => onSolo(solo === l.d ? null : l.d)}>
                {solo === l.d ? "Unsolo" : "Solo"}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="stage-action split">
        <button className="text-button" onClick={() => dispatch({ type: "back", from: "consequences" })}><ArrowLeft size={13} /> Back to result</button>
        <button className="cosmic-primary" onClick={() => advance("consequences")}>Reflect on day {r.before.day} <ArrowRight size={15} /></button>
      </div>
    </>
  );
}

function Reflection({ journey: j, advance }: SceneProps) {
  const c = j.world.rules;
  const r = roundFor(j.world.history, j.locked!.day)!;
  const last = isWorldComplete(r.after, c);
  const story = r.before.day === 1 ? "one-day" : `${r.before.day}-day`;
  return (
    <>
      <span className="cosmic-eyebrow">DAY {r.before.day} · REFLECTION</span>
      <h2 tabIndex={-1}>Day {r.before.day}, in one breath.</h2>
      <p className="stage-lede">
        {r.policy.name} won {r.election.counts[r.election.winner]} of {r.election.ballots.length}{taskText(c, ". The presentation is at ")}{fmt(r.after.taskProgress)} of {c.taskGoal}
        {r.after.taskResult === null ? `, due in ${c.taskDeadlineDay - r.before.day} day${c.taskDeadlineDay - r.before.day === 1 ? "" : "s"}` : r.after.taskResult ? ": goal met" : ": goal missed"}.
        {c.connectionLastOpenDay > 0 ? ` The visit ${r.after.connectionResult === null ? `is at ${fmt(r.after.connectionProgress)} of ${c.connectionGoal}` : r.after.connectionResult ? "goal was met" : "goal was missed"}.` : ""} Energy ends at {fmt(r.after.energy)} of {c.energyCap}; method at {fmt(r.after.method, 2)}×.
      </p>
      <Primary label={last ? `See your ${story} story` : `Begin day ${r.before.day + 1}`} onClick={() => advance("reflection")} />
    </>
  );
}

function Summary({ journey: j, onExplore, onObservatory, advance }: SceneProps) {
  const c = j.world.rules;
  const days = j.world.history.filter((r) => r.before.day <= lastGuidedDay(c));
  const end = days.at(-1)?.after ?? j.world.state;
  const endDay = days.at(-1)?.before.day ?? 0;
  return (
    <>
      <span className="cosmic-eyebrow">YOUR COMPLETED STORY</span>
      <h2 tabIndex={-1}>{end.taskResult ? taskText(c, "The presentation made it.") : taskText(c, "The presentation fell short.")}</h2>
      <ul className="since-list">
        <li>{taskText(c, "Presentation: ")}{fmt(end.taskProgress)} of {c.taskGoal} points{endDay ? ` at the end of day ${endDay}` : " at the start"}: {end.taskResult ? "met" : "missed"}.</li>
        {c.connectionLastOpenDay > 0 && (
          <li>Visit: {fmt(end.connectionProgress)} of {c.connectionGoal} points: {end.connectionResult === null ? "window still open when the scenario ended" : end.connectionResult ? "protected" : "lost"}.</li>
        )}
        <li>Energy: ended at {fmt(end.energy)} of {c.energyCap} tokens. Method: {fmt(end.method, 2)}×.</li>
      </ul>
      <ol className="day-strip">
        {days.map((r) => (
          <li key={r.id}>
            <span className="portrait-art">
              {districts.map((d) => <i key={d} style={{ height: `${8 + r.policy.allocation[d] * 8}px`, background: districtInfo[d].color }} />)}
            </span>
            <b>Day {r.before.day}</b>
            <small>{r.policy.name} · {r.election.counts[r.election.winner]}/{r.election.ballots.length}</small>
          </li>
        ))}
      </ol>
      <p className="stage-note">The world's composition: each day's allocation became the art above.</p>
      <div className="secondary-row">
        <button className="text-button" onClick={onObservatory}>How did this work?</button>
        <button className="text-button" onClick={onExplore}>Explore freely</button>
      </div>
      <Primary label="What if another plan had won?" disabled={!days.length} onClick={() => advance("summary")} />
    </>
  );
}

function Branch({ journey: j, onBranch, advance }: SceneProps) {
  const c = j.world.rules;
  const days = j.world.history.filter((r) => r.before.day <= lastGuidedDay(c));
  const [day, setDay] = useState(days[0].before.day);
  const round = days.find((r) => r.before.day === day)!;
  const options = round.policies.filter((p) => p.id !== round.policy.id);
  const [policyId, setPolicyId] = useState(options[0]?.id ?? "");
  const chosen = options.find((p) => p.id === policyId) ?? options[0];
  return (
    <>
      <span className="cosmic-eyebrow">A COUNTERFACTUAL INTERVENTION</span>
      <h2 tabIndex={-1}>What if another plan had won?</h2>
      <p className="stage-lede">Choose a day. Change the plan. Watch a different future unfold.</p>
      <fieldset className="choice-set">
        <legend>Day to change</legend>
        {days.map((r) => (
          <label key={r.id}>
            <input type="radio" name="branch-day" checked={day === r.before.day}
              onChange={() => { setDay(r.before.day); setPolicyId(r.policies.find((p) => p.id !== r.policy.id)?.id ?? ""); }} />
            Day {r.before.day}: <b>{r.policy.name}</b> won {r.election.counts[r.election.winner]}/{r.election.ballots.length}
          </label>
        ))}
      </fieldset>
      <fieldset className="choice-set">
        <legend>Force this plan instead</legend>
        {options.map((p) => (
          <label key={p.id}>
            <input type="radio" name="branch-plan" checked={chosen?.id === p.id} onChange={() => setPolicyId(p.id)} />
            <b>{p.name}</b> <Tokens policy={p} />
          </label>
        ))}
      </fieldset>
      <p className="stage-note">
        The comparison ends when either task is complete or the deadline arrives.
      </p>
      <Primary
        label="Open Parallel Worlds"
        disabled={!chosen}
        onClick={() => { onBranch(day, chosen.id); advance("branch"); }}
      />
    </>
  );
}

function SideBySide({ journey: j, horizon, unfold, onUnfold, advance, ...props }: SceneProps) {
  const [catalogue,setCatalogue]=useState(false);
  if (!horizon) return null;
  const i = Math.min(unfold, horizon.a.length - 1);
  return <>
    <span className="cosmic-eyebrow">PARALLEL WORLDS · DAY {horizon.a[i].before.day}</span>
    {!catalogue && <h2 tabIndex={-1}>One decision. Two living futures.</h2>}
    <ParallelWorlds a={horizon.a[i]} b={horizon.b[i]} rules={j.world.rules} mix={props.mix} onMix={props.onMix} playing={props.loops} onPlaying={props.onLoops} soundOn={props.soundOn} onSound={props.onSound} solo={props.solo} onSolo={props.onSolo} mixer={true} onScenarioChange={setCatalogue} />
    {!catalogue && (i < horizon.a.length - 1
      ? <Primary label={`Follow the ripples into day ${horizon.a[i + 1].before.day}`} onClick={() => onUnfold(i + 1)} />
      : <Primary label="Reflect on these paths" onClick={() => advance("comparison")} />)}
  </>;
}

function Listen({ journey: j, horizon, advance, ...props }: SceneProps) {
  const [catalogue,setCatalogue]=useState(false);
  if (!horizon) return null;
  return <>
    <span className="cosmic-eyebrow">PARALLEL WORLDS · THE COMPOSITION</span>
    {!catalogue && <h2 tabIndex={-1}>Feel the difference.</h2>}
    <ParallelWorlds a={horizon.a.at(-1)!} b={horizon.b.at(-1)!} rules={j.world.rules} mix={props.mix} onMix={props.onMix} playing={props.loops} onPlaying={props.onLoops} soundOn={props.soundOn} onSound={props.onSound} solo={props.solo} onSolo={props.onSolo} onScenarioChange={setCatalogue} />
    {!catalogue && <Primary label="Take the story with you" onClick={() => advance("listen")} />}
  </>;
}

function Closing({ journey: j, horizon, onObservatory, advance }: SceneProps) {
  if (!horizon) return null;
  const a = horizon.a.at(-1)!, b = horizon.b.at(-1)!;
  return <>
    <span className="cosmic-eyebrow">A COMPOSITION OF CHOICES</span>
    <h2 tabIndex={-1}>Small choices leave different traces.</h2>
    <p className="stage-lede">One plan changed on day {horizon.day}. These are both worlds at the end of day {a.before.day}.</p>
    <div className="future-duet">
      <article className="future-world"><header><h3>What happened</h3></header><p className="future-caption">{worldCaption(a, j.world.rules)}</p></article>
      <article className="future-world future-b"><header><h3>Your alternative</h3></header><p className="future-caption">{worldCaption(b, j.world.rules)}</p></article>
    </div>
    <button className="text-button" onClick={onObservatory}>Explore the mathematics behind the art</button>
    <Primary label="Explore freely" onClick={() => advance("closing")} />
  </>;
}

function Ribbon({ state: s, rules: c }: { state: State; rules: Config }) {
  const items = [
    { d: "A" as District, name: taskText(c, "Presentation"), value: `${fmt(s.taskProgress)} / ${c.taskGoal} pts`, note: s.taskResult === null ? `due end of day ${c.taskDeadlineDay}` : s.taskResult ? "met" : "missed" },
    { d: "C" as District, name: "Visit", value: `${fmt(s.connectionProgress)} / ${c.connectionGoal} pts`, note: s.connectionResult === null ? `closes end of day ${c.connectionLastOpenDay}` : s.connectionResult ? "met · closed" : "missed · closed" },
    { d: "R" as District, name: "Energy", value: `${fmt(s.energy)} / ${c.energyCap} tokens`, note: "shared reserve" },
    { d: "D" as District, name: "Method", value: `${fmt(s.method, 2)}×`, note: "future work" },
  ].filter((x) => x.d !== "C" || c.connectionLastOpenDay > 0);
  return (
    <section className="resource-ribbon" aria-label="Shared resources">
      <span className="ribbon-blocks"><b>{c.dailyBudget}</b> time blocks / day</span>
      {items.map((x) => (
        <span key={x.name} style={{ "--voice": districtInfo[x.d].color } as CSSProperties}>
          <i aria-hidden="true"><VoiceIcon d={x.d} size={22} /></i>
          <small>{x.name}</small>
          <b>{x.value}</b>
          <em>{x.note}</em>
        </span>
      ))}
    </section>
  );
}

export type { Round };

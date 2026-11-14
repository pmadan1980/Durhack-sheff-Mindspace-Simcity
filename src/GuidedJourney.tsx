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
  actionState,
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
import { projectScore } from "./audio";
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
  const day = j.locked?.day ?? w.state.day;
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
        className={`journey-stage scene-${j.scene} ${wide ? "stage-wide" : ""}`}
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
      {!post && <Ribbon state={w.state} rules={c} />}
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
    ? "Your presentation is due at the end of today."
    : `Your presentation is due in ${c.taskDeadlineDay} days.`;

/** The single place to confirm or change the authored scenario's assumptions. */
function Clarify({ journey: j, dispatch, thought, advance }: SceneProps) {
  const s = j.setup;
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
      <p className="stage-lede">
        MINDSPACE runs one authored model: a presentation deadline, maybe a visit
        competing for your time, {j.world.rules.dailyBudget} blocks a day and one
        energy reserve. It only spots a few literal keywords, so please confirm the
        rest. Change anything that isn’t true.
      </p>
      <fieldset className="choice-set">
        <legend>When is the presentation due?</legend>
        {tag(false)}
        <div className="chip-row">
          {Array.from({ length: maxDeadlineDay }, (_, i) => i + 1).map((d) => (
            <button key={d} aria-pressed={s.taskDeadlineDay === d} onClick={() => set({ taskDeadlineDay: d })}>
              {d === 1 ? "End of today" : `End of day ${d}`}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="choice-set">
        <legend>Is a visit competing for your time?</legend>
        {from.visit ? tag(true, "friend / visit") : <span className="answer-tag">Suggested example: you didn’t mention one</span>}
        <div className="chip-row">
          <button aria-pressed={s.visitLastDay > 0} onClick={() => set({ visitLastDay: Math.max(1, s.visitLastDay || 1) })}>
            Yes, a friend’s visit
          </button>
          <button aria-pressed={s.visitLastDay === 0} onClick={() => set({ visitLastDay: 0 })}>
            No, just the presentation
          </button>
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
      </fieldset>
      <fieldset className="choice-set">
        <legend>How far along is the presentation?</legend>
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
          <span>presentation points, due end of day {c.taskDeadlineDay}{w.state.taskProgress >= c.taskGoal ? " · already complete" : ""}</span>
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
          <p>
            <b>Built from your answers</b>, using local rules, not AI. The four voices and the 24 residents are part of the authored model.
          </p>
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
  const d = districts[Math.min(j.line, 3)];
  useEffect(() => { onSpeaker(d); return () => onSpeaker(null); }, [d, onSpeaker]);
  const s = j.world.state, c = j.world.rules;
  const value = { A: `${fmt(s.taskProgress)} / ${c.taskGoal}`, C: `${fmt(s.connectionProgress)} / ${c.connectionGoal}`, D: `${fmt(s.method, 2)}×`, R: `${fmt(s.energy)} / ${c.energyCap}` }[d];
  return (
    <>
      <span className="cosmic-eyebrow">MEET YOUR VOICES · {j.line + 1} OF 4</span>
      <h2 tabIndex={-1}>Four voices, one shared day.</h2>
      <p className="stage-lede">They speak for different priorities. They don't vote: {c.residentCount} residents do.</p>
      <article className="persona-card" style={{ "--voice": districtInfo[d].color } as CSSProperties} key={d}>
        <span className="persona-mark"><VoiceIcon d={d} size={64} speaking /></span>
        <div>
          <b>{districtInfo[d].name}</b>
          <q>{voices[d].line}</q>
          <small>Guards: {voices[d].guards} · now {value}</small>
        </div>
      </article>
      <div className="persona-dots" aria-hidden="true">
        {districts.map((k, i) => <i key={k} style={{ background: i <= j.line ? districtInfo[k].color : undefined }} />)}
      </div>
      {j.line < 3 ? (
        <div className="stage-action split">
          <button className="text-button" onClick={() => advance("introductions")}>Skip introductions</button>
          <button className="cosmic-primary" onClick={() => dispatch({ type: "line", line: j.line + 1 })}>
            Next voice <ArrowRight size={15} />
          </button>
        </div>
      ) : (
        <Primary label="Hear the debate" onClick={() => advance("introductions")} />
      )}
    </>
  );
}

function Debate({ journey: j, dispatch, advance, onSpeaker }: SceneProps) {
  const w = j.world, c = w.rules;
  const start = actionState(w.state, c);
  const lines = useMemo(() => debate(start, w.proposals, c), [start, w.proposals, c]);
  const shown = Math.min(j.line, lines.length - 1);
  const current = lines[shown];
  const [asking, setAsking] = useState<District | null>(null);
  const [asked, setAsked] = useState<{ d: District; q: number } | null>(null);
  const speaker = asked?.d ?? (current.speaker === "N" ? null : current.speaker);
  useEffect(() => { onSpeaker(speaker); return () => onSpeaker(null); }, [speaker, onSpeaker]);
  const f = forecasts(start, w.proposals, c);
  const done = shown >= lines.length - 1;
  // Auto-play at reading pace; it stops at the end, on Pause, or while the reader scrolls back.
  const [auto, setAuto] = useState(true);
  const [pinned, setPinned] = useState(true);
  const box = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el && pinned) el.scrollTop = el.scrollHeight;
  }, [shown, pinned]);
  useEffect(() => {
    if (!auto || !pinned || done || asking) return;
    const words = current.text.split(/\s+/).length;
    const timer = window.setTimeout(() => {
      if (!document.hidden) dispatch({ type: "line", line: shown + 1 });
    }, 1800 + words * 260);
    return () => window.clearTimeout(timer);
  }, [auto, pinned, done, asking, shown, current.text, dispatch]);
  return (
    <>
      <span className="cosmic-eyebrow">DAY {w.state.day} · THE DEBATE · DECISION CHAMBER</span>
      <h2 tabIndex={-1}>Hear them argue it out.</h2>
      <div className="now-speaking" style={{ "--voice": color(current.speaker) } as CSSProperties} aria-live="polite">
        {current.speaker === "N" ? <span className="line-mark">✳</span> : <VoiceIcon d={current.speaker} size={40} speaking />}
        <span>
          <small>NOW SPEAKING · LINE {shown + 1} OF {lines.length}</small>
          <b>{speakerName(current.speaker)}</b>
        </span>
        <button className="secondary small" disabled={done} onClick={() => setAuto(!auto)} aria-pressed={auto && !done}>
          {auto && !done ? <Pause size={13} /> : <Play size={13} />} {done ? "Finished" : auto ? "Pause" : "Auto-play"}
        </button>
      </div>
      <ol
        className="transcript transcript-box"
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          setPinned(el.scrollTop + el.clientHeight >= el.scrollHeight - 24);
        }}
      >
        {lines.slice(0, shown + 1).map((l, i) => (
          <TranscriptLine key={i} line={l} current={i === shown} />
        ))}
      </ol>
      {!pinned && (
        <button className="jump-latest" onClick={() => { setPinned(true); box.current?.scrollTo({ top: box.current.scrollHeight }); }}>
          Jump to the latest line ↓
        </button>
      )}
      {current.policy !== undefined && (
        <PlanChip policy={w.proposals[current.policy]} f={f[current.policy]} rules={c} />
      )}
      <div className="debate-controls">
        <button className="text-button" disabled={done} onClick={() => dispatch({ type: "line", line: lines.length - 1 })}>
          Show full exchange
        </button>
      </div>
      <div className="ask">
        <span>Ask a voice</span>
        <div>
          {districts.map((d) => (
            <button key={d} aria-pressed={asking === d} onClick={() => setAsking(asking === d ? null : d)}
              style={{ "--voice": districtInfo[d].color } as CSSProperties}>
              <VoiceIcon d={d} size={20} /> {districtInfo[d].name}
            </button>
          ))}
        </div>
        {asking && (
          <div className="ask-questions">
            {questions.map((q, i) => (
              <button key={q} className="text-button" onClick={() => setAsked({ d: asking, q: i })}>{q}</button>
            ))}
          </div>
        )}
        {asked && (
          <p className="ask-answer" style={{ "--voice": districtInfo[asked.d].color } as CSSProperties}>
            <b>{districtInfo[asked.d].name}:</b> {answer(asked.d, asked.q, start, w.proposals, c)}
          </p>
        )}
      </div>
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
      <div><dt>Presentation</dt><dd>+{fmt(f.taskGain)} pts</dd></div>
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
  const f = forecasts(start, w.proposals, c);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [said, setSaid] = useState<Line | null>(null);
  useEffect(() => { onSpeaker(said && said.speaker !== "N" ? said.speaker : null); return () => onSpeaker(null); }, [said, onSpeaker]);
  const edited = j.edits.filter((e) => e.day === w.state.day).map((e) => e.policyId);
  const open = w.state.day <= c.connectionLastOpenDay;
  const draftError = draft ? validatePolicy(draft, c) : null;
  const twins = w.proposals.flatMap((p, i) =>
    w.proposals.slice(i + 1).filter((q) => sameAllocation(p.allocation, q.allocation)).map((q) => [p.name, q.name]),
  );
  const used = draft ? districts.reduce((s, d) => s + draft.allocation[d], 0) : 0;
  return (
    <>
      <span className="cosmic-eyebrow">DAY {w.state.day} · YOUR INTERVENTION</span>
      <h2 tabIndex={-1}>Would you keep these plans, or change one?</h2>
      <p className="stage-lede">You shape the choices. The {c.residentCount} residents decide between them. Numbers below are forecasts.</p>
      {twins.length > 0 && (
        <p className="stage-note">
          {twins.map(([a, b]) => `${a} and ${b}`).join("; ")} are identical today{open || c.connectionLastOpenDay === 0 ? "" : " because the visit window closed and its blocks moved to Achievement"}. Identical plans split nothing: ties go to the first listed. Edit one to give residents a real choice.
        </p>
      )}
      <div className="plan-list">
        {w.proposals.map((p, i) => (
          <article key={p.id} className={`plan-card ${editing === p.id ? "plan-editing" : ""}`}
            style={{ "--plan": districtInfo[planAccent(p, w.proposals)].color } as CSSProperties}>
            <header>
              <span className="plan-number">{i + 1}</span>
              <div>
                <b>{p.name}</b>
                <small>{edited.includes(p.id) ? "EDITED BY YOU" : p.description}</small>
              </div>
              <button className="text-button" disabled={editing !== null && editing !== p.id}
                onClick={() => {
                  if (editing === p.id) { setEditing(null); setDraft(null); return; }
                  setEditing(p.id); setDraft(structuredClone(p));
                }}>
                {editing === p.id ? "Cancel" : "Edit plan"}
              </button>
            </header>
            {editing === p.id && draft ? (
              <div className="token-tray">
                {districts.map((d) => {
                  const blocked = d === "C" && !open;
                  return (
                    <div key={d} className="tray-row" style={{ "--voice": districtInfo[d].color } as CSSProperties}>
                      <span className="tray-name"><VoiceIcon d={d} size={20} /> {districtInfo[d].name}</span>
                      <button aria-label={`Remove a ${districtInfo[d].name} block`} disabled={draft.allocation[d] <= 0}
                        onClick={() => setDraft({ ...draft, allocation: { ...draft.allocation, [d]: draft.allocation[d] - 1 } })}>
                        <Minus size={13} />
                      </button>
                      <output aria-live="off">{draft.allocation[d]}</output>
                      <button aria-label={`Add a ${districtInfo[d].name} block`} disabled={blocked || used >= c.dailyBudget}
                        title={blocked ? "The visit window has closed" : undefined}
                        onClick={() => setDraft({ ...draft, allocation: { ...draft.allocation, [d]: draft.allocation[d] + 1 } })}>
                        <Plus size={13} />
                      </button>
                    </div>
                  );
                })}
                <p className={`budget-count ${used === c.dailyBudget ? "budget-ok" : ""}`} role="status">
                  {used} of {c.dailyBudget} blocks allocated
                </p>
                {!open && <small>{c.connectionLastOpenDay > 0 ? "The visit window has closed" : "There's no visit in this scenario"}, so Connection blocks can't be added.</small>}
                <Forecast f={forecasts(start, [draft], c)[0]} rules={c} />
                <button className="secondary small" disabled={!!draftError}
                  onClick={() => {
                    const line = reaction(p, draft, start, c);
                    setSaid(line);
                    if (line.speaker !== "N")
                      onReact([{ d: line.speaker, kind: draft.allocation[line.speaker] > p.allocation[line.speaker] ? "cheer" : "sigh" }]);
                    dispatch({ type: "edit", policy: draft });
                    setEditing(null); setDraft(null);
                  }}>
                  {draftError ?? "Save plan"}
                </button>
              </div>
            ) : (
              <>
                <Tokens policy={p} />
                <Forecast f={f[i]} rules={c} />
              </>
            )}
          </article>
        ))}
      </div>
      {said && (
        <ol className="transcript reaction"><TranscriptLine line={said} current /></ol>
      )}
      <details className="equations">
        <summary>Show the equations</summary>
        <p>Presentation = {c.achievementRate} × Achievement blocks × energy factor ({fmt(f[0].energyFactor, 3)}) × method ({fmt(start.method, 2)}).</p>
        <p>Energy factor = {c.energyFactorFloor} + {c.energyFactorRange} × energy / {c.energyCap}. Visit = {c.connectionRate} × Connection blocks while open.</p>
        <p>Energy change = {c.recoveryRate} × Recovery − ({c.achievementEnergyCost}A + {c.connectionEnergyCost}C + {c.discoveryEnergyCost}D), kept between 0 and {c.energyCap}. Method += {c.discoveryMethodGain} × Discovery, from tomorrow, capped at {c.methodCap}×.</p>
      </details>
      <Primary
        label={edited.length ? "Open the polls with your edit" : "Keep these plans · Open the polls"}
        disabled={editing !== null}
        note={editing !== null ? "Save or cancel your edit first." : undefined}
        onClick={() => advance("intervention")}
      />
    </>
  );
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
          +{fmt(f.taskGain)} presentation, {f.connectionOpen ? `+${fmt(f.connectionGain)} visit, ` : ""}{signed(f.energyDelta)} energy{f.methodGain > 0 ? `, ${signed(f.methodGain, 2)}× method from tomorrow` : ""}.
        </p>
        <small>A plan won, not a voice. Every voice still lives with the result.</small>
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
      d: "A", name: "Presentation", before: `${fmt(r.start.taskProgress)}`, change: `+${fmt(r.activity.taskGain)} pts`, after: `${fmt(r.after.taskProgress)} / ${c.taskGoal}`,
      why: r.after.taskResult !== null
        ? `Deadline day: the presentation ${r.after.taskResult ? "made" : "missed"} the ${c.taskGoal}-point goal.`
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
      why: r.activity.methodGain > 0 ? `Applies to presentation work from day ${r.before.day + 1}, not retroactively.` : "No Discovery blocks today, so the multiplier holds.",
    },
  ];
  const rows = allRows.filter((row) => row.d !== "C" || c.connectionLastOpenDay > 0);
  const layers: { d: District; text: string }[] = [
    { d: "A", text: `Achievement plays the melody: ${score.density.A} note${score.density.A === 1 ? "" : "s"} per bar from today's presentation gain.` },
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
  const last = r.before.day >= lastGuidedDay(c);
  const story = c.taskDeadlineDay === 1 ? "one-day" : `${c.taskDeadlineDay}-day`;
  return (
    <>
      <span className="cosmic-eyebrow">DAY {r.before.day} · REFLECTION</span>
      <h2 tabIndex={-1}>Day {r.before.day}, in one breath.</h2>
      <p className="stage-lede">
        {r.policy.name} won {r.election.counts[r.election.winner]} of {r.election.ballots.length}. The presentation is at {fmt(r.after.taskProgress)} of {c.taskGoal}
        {r.after.taskResult === null ? `, due in ${c.taskDeadlineDay - r.before.day} day${c.taskDeadlineDay - r.before.day === 1 ? "" : "s"}` : r.after.taskResult ? ": goal met" : ": goal missed"}.
        {c.connectionLastOpenDay > 0 ? ` The visit ${r.after.connectionResult === null ? `is at ${fmt(r.after.connectionProgress)} of ${c.connectionGoal}` : r.after.connectionResult ? "goal was met" : "goal was missed"}.` : ""} Energy ends at {fmt(r.after.energy)} of {c.energyCap}; method at {fmt(r.after.method, 2)}×.
      </p>
      <p className="stage-note">Nothing advances until you choose to.</p>
      <Primary label={last ? `See your ${story} story` : `Begin day ${r.before.day + 1}`} onClick={() => advance("reflection")} />
    </>
  );
}

function Summary({ journey: j, onExplore, onObservatory, advance }: SceneProps) {
  const c = j.world.rules;
  const days = j.world.history.filter((r) => r.before.day <= lastGuidedDay(c));
  const end = days.at(-1)!.after;
  return (
    <>
      <span className="cosmic-eyebrow">THE {c.taskDeadlineDay === 1 ? "ONE" : c.taskDeadlineDay}-DAY STORY</span>
      <h2 tabIndex={-1}>{end.taskResult ? "The presentation made it." : "The presentation fell short."}</h2>
      <ul className="since-list">
        <li>Presentation: {fmt(end.taskProgress)} of {c.taskGoal} points by the end of day {c.taskDeadlineDay}: {end.taskResult ? "met" : "missed"}.</li>
        {c.connectionLastOpenDay > 0 && (
          <li>Visit: {fmt(end.connectionProgress)} of {c.connectionGoal} points before the window closed: {end.connectionResult ? "protected" : "lost"}.</li>
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
      <p className="stage-note">The world's composition: each day's allocation became the art above and the music in the Symphony Chamber.</p>
      <div className="secondary-row">
        <button className="text-button" onClick={onObservatory}>How did this work?</button>
        <button className="text-button" onClick={onExplore}>Explore freely</button>
      </div>
      <Primary label="What if another plan had won?" onClick={() => advance("summary")} />
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
      <p className="stage-lede">
        Pick one completed day and force a different plan. That day replays from its recorded start, with the same morning event.
        Every later day up to day {lastGuidedDay(c)} is then replayed with residents voting on the same proposals you saw.
        Your original world is kept unchanged.
      </p>
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
        This compares days {day}–{lastGuidedDay(c)} in both worlds ({lastGuidedDay(c) - day + 1} day{day === lastGuidedDay(c) ? "" : "s"}). It's an intervention, not a new election result.
      </p>
      <Primary
        label="Open Parallel Worlds"
        disabled={!chosen}
        onClick={() => { onBranch(day, chosen.id); advance("branch"); }}
      />
    </>
  );
}

const worldStats = (s: State, c: Config) =>
  [
    { d: "A" as District, name: "Presentation", v: `${fmt(s.taskProgress)} / ${c.taskGoal}` },
    { d: "C" as District, name: "Visit", v: `${fmt(s.connectionProgress)} / ${c.connectionGoal}` },
    { d: "R" as District, name: "Energy", v: `${fmt(s.energy)} / ${c.energyCap}` },
    { d: "D" as District, name: "Method", v: `${fmt(s.method, 2)}×` },
  ].filter((x) => x.d !== "C" || c.connectionLastOpenDay > 0);

function SideBySide({ journey: j, horizon, unfold, onUnfold, advance }: SceneProps) {
  const c = j.world.rules;
  if (!horizon) return null;
  const last = horizon.a.length - 1;
  const i = Math.min(unfold, last);
  return (
    <>
      <span className="cosmic-eyebrow">PARALLEL WORLDS · SIDE BY SIDE</span>
      <h2 tabIndex={-1}>World B unfolds next to World A.</h2>
      <p className="stage-lede">
        Same start, same morning events. On day {horizon.day}, World B was given <b>{horizon.b[0].policy.name}</b> instead of <b>{horizon.a[0].policy.name}</b>.
        After that, its residents vote normally on the same proposals.
      </p>
      <ol className="unfold">
        {horizon.a.slice(0, i + 1).map((ra, k) => {
          const rb = horizon.b[k];
          return (
            <li key={ra.id} className={k === i ? "unfold-current" : ""}>
              <b className="unfold-day">Day {ra.before.day}</b>
              {[["A", ra], ["B", rb]].map(([label, r]) => {
                const round = r as Round;
                return (
                  <div key={label as string} className={`unfold-world world-${(label as string).toLowerCase()}`}>
                    <small>WORLD {label as string}{k === 0 && label === "B" ? " · INTERVENTION" : ""}</small>
                    <span>{round.policy.name}{k > 0 || label === "A" ? ` · ${round.election.counts[round.election.winner]}/${round.election.ballots.length} votes` : ""}</span>
                    <span className="unfold-stats">
                      {worldStats(round.after, c).map((x) => (
                        <em key={x.name}><VoiceIcon d={x.d} size={16} /> {x.name} {x.v}</em>
                      ))}
                    </span>
                  </div>
                );
              })}
            </li>
          );
        })}
      </ol>
      {i < last ? (
        <Primary label={`Show day ${horizon.a[i + 1].before.day}`} onClick={() => onUnfold(i + 1)} />
      ) : (
        <Primary label="Listen to both worlds" onClick={() => advance("comparison")} />
      )}
    </>
  );
}

function Listen({ journey: j, horizon, mix, onMix, loops, onLoops, soundOn, onSound, solo, onSolo, advance }: SceneProps) {
  const c = j.world.rules;
  if (!horizon) return null;
  const a = horizon.a.at(-1)!, b = horizon.b.at(-1)!;
  const sa = projectScore(a.after, a, horizon.a.at(-2), c);
  const sb = projectScore(b.after, b, horizon.b.at(-2), c);
  const layers: { d: District; what: string; a: string; b: string }[] = [
    { d: "A", what: "Melody: more notes for more presentation progress that day", a: `${sa.density.A} notes`, b: `${sb.density.A} notes` },
    { d: "C", what: "Call and response: visit points that day", a: sa.density.C ? `${sa.density.C} calls` : "silent", b: sb.density.C ? `${sb.density.C} calls` : "silent" },
    { d: "D", what: "Counterline: plays once a method gain is in effect", a: sa.density.D ? "playing" : "silent", b: sb.density.D ? "playing" : "silent" },
    { d: "R", what: "Sustained bass: energy actually restored that day", a: sa.density.R ? "sustained" : "quiet", b: sb.density.R ? "sustained" : "quiet" },
  ];
  return (
    <>
      <span className="cosmic-eyebrow">PARALLEL WORLDS · LISTEN</span>
      <h2 tabIndex={-1}>Hear both worlds.</h2>
      <p className="stage-lede">
        Each world plays its last day (day {a.before.day}) as music. The slider blends the two
        soundtracks. <b>It blends sound, not outcomes:</b> no number changes.
      </p>
      {!soundOn ? (
        <button className="secondary" onClick={onSound}><Headphones size={14} /> Enable sound</button>
      ) : (
        <button className="secondary" onClick={() => onLoops(!loops)}>
          {loops ? <Pause size={14} /> : <Play size={14} />} {loops ? "Pause both worlds" : "Play both worlds"}
        </button>
      )}
      <div className="mix-control">
        <button aria-pressed={mix === 0} onClick={() => onMix(0)}>World A only</button>
        <input type="range" min={0} max={1} step={0.01} value={mix} aria-label="Blend World A and World B" onChange={(e) => onMix(+e.target.value)} />
        <button aria-pressed={mix === 1} onClick={() => onMix(1)}>World B only</button>
      </div>
      <p className="mix-readout">{Math.round((1 - mix) * 100)}% World A · {Math.round(mix * 100)}% World B</p>
      <table className="ledger layer-table">
        <thead><tr><th>Layer</th><th>World A</th><th>World B</th><th /></tr></thead>
        <tbody>
          {layers.map((l) => (
            <tr key={l.d} className={solo === l.d ? "ledger-focus" : ""} style={{ "--voice": districtInfo[l.d].color } as CSSProperties}>
              <th><span className="layer-name"><VoiceIcon d={l.d} size={20} /> {districtInfo[l.d].name}</span><small>{l.what}</small></th>
              <td>{l.a}</td><td>{l.b}</td>
              <td><button className="text-button" aria-pressed={solo === l.d} onClick={() => onSolo(solo === l.d ? null : l.d)}>{solo === l.d ? "Unsolo" : "Solo"}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Primary label="Reflect on the difference" onClick={() => advance("listen")} />
    </>
  );
}

function Closing({ journey: j, horizon, onObservatory, advance }: SceneProps) {
  const c = j.world.rules;
  if (!horizon) return null;
  const a = horizon.a.at(-1)!.after, b = horizon.b.at(-1)!.after;
  const rows = worldStats(a, c).map((x, i) => {
    const key = (["taskProgress", "connectionProgress", "energy", "method"] as const)[["A", "C", "R", "D"].indexOf(x.d)];
    return { ...x, va: a[key], vb: b[key], i };
  });
  return (
    <>
      <span className="cosmic-eyebrow">PARALLEL WORLDS · REFLECT</span>
      <h2 tabIndex={-1}>One decision, two worlds.</h2>
      <p className="stage-lede">
        Changing only day {horizon.day} from {horizon.a[0].policy.name} to {horizon.b[0].policy.name} gives this by the end of day {c.taskDeadlineDay}:
      </p>
      <table className="ledger">
        <thead><tr><th>Resource</th><th>World A</th><th>World B</th><th>B − A</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} style={{ "--voice": districtInfo[r.d].color } as CSSProperties}>
              <th><span className="layer-name"><VoiceIcon d={r.d} size={18} /> {r.name}</span></th>
              <td>{fmt(r.va, 2)}</td><td>{fmt(r.vb, 2)}</td>
              <td>{signed(r.vb - r.va, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="since-list">
        <li>Deadline: World A {a.taskResult ? "met" : "missed"} it; World B {b.taskResult ? "met" : "missed"} it.</li>
        {c.connectionLastOpenDay > 0 && <li>Visit: World A {a.connectionResult ? "protected" : "lost"} it; World B {b.connectionResult ? "protected" : "lost"} it.</li>}
      </ul>
      <p className="stage-note">World B is an intervention, not a new election result. Your original world is unchanged.</p>
      <div className="secondary-row">
        <button className="text-button" onClick={onObservatory}>How did this work?</button>
      </div>
      <Primary label="Explore freely" onClick={() => advance("closing")} />
    </>
  );
}

function Ribbon({ state: s, rules: c }: { state: State; rules: Config }) {
  const items = [
    { d: "A" as District, name: "Presentation", value: `${fmt(s.taskProgress)} / ${c.taskGoal} pts`, note: s.taskResult === null ? `due end of day ${c.taskDeadlineDay}` : s.taskResult ? "met" : "missed" },
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

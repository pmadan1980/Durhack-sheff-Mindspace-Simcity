import { useEffect,useMemo,useRef,useState,type CSSProperties } from "react";
import { motion } from "motion/react";
import ParallelTimeline, { playbackPhase, playbackTransition, useParallelTimeline } from "./ParallelTimeline";
import { getScenario,evaluateDecision,validateDecision,type DecisionInput,type Scenario } from "./engine";
import { assessedVisual,type ArtFrame } from "./scenarioVisuals";

export function ScenarioArt({ frames, position, running, reduced }: { frames: ArtFrame[]; position: number; running: boolean; reduced: boolean }) {
  const index=Math.min(frames.length-1,Math.floor(position*frames.length));
  return <><div className={`everyday-scene clay-scene ${running?"scene-running":"scene-paused"}`} role="img" aria-label={frames[index].action} data-reduced={String(reduced)}
    style={{ "--playback-zoom": reduced ? 1 : 1 + position * .055 } as CSSProperties}>
    {frames.map((frame,i)=><div className={`clay-layer ${i===index?"clay-visible":""}`} key={`${frame.file}:${i}`} aria-hidden="true">{frame.side === undefined ? <img className="clay-still" src={`/art/parallel-clay/${frame.file}`} alt="" draggable={false} /> : <div className="clay-still" style={{backgroundImage:`url(/art/parallel-clay/${frame.file})`,backgroundSize:"200% 100%",backgroundPosition:frame.side===1?"right center":"left center"}} />}</div>)}<div className="clay-lamplight" aria-hidden="true" />
  </div><p className="playback-outcome">{frames[index].action}</p></>;
}
function exampleInput(scenario: Scenario, initialFacts: DecisionInput["facts"] = {}): DecisionInput {
  const facts: DecisionInput["facts"] = {};
  // Illustrate every option by default. Confirmed context overrides any example assumption.
  for (const option of scenario.options) {
    for (const requirement of option.requires ?? []) {
      facts[requirement] = { value: true, source: "hypothetical" };
    }
  }
  if (scenario.id === "scrolling-break") {
    facts.urgent = { value: true, source: "hypothetical" };
    facts.restorative = { value: true, source: "hypothetical" };
  }
  return {
    scenarioId: scenario.id,
    availableMinutes: 240,
    reservedMinutes: 0,
    facts: { ...facts, ...structuredClone(initialFacts) },
    estimates: Object.fromEntries(scenario.options.map((option, index) => [
      option.id, { minutes: [120, 180, 150][index], source: "hypothetical", includesTravelAndSetup: true },
    ])),
  };
}

export interface ScenarioPlaybackProps {
  onEditContext?:()=>void;
  readOnlyContext?:boolean;
  confirmedInput?:DecisionInput;
  initialLeft?:string;
  initialRight?:string;
  scenarioId: string;
  onBack: () => void;
  initialFacts?: DecisionInput["facts"];
}

export default function ScenarioPlayback({ scenarioId, onBack, initialFacts,confirmedInput,initialLeft,initialRight,readOnlyContext=false,onEditContext }: ScenarioPlaybackProps) {
  const scenario = useMemo(() => getScenario(scenarioId), [scenarioId]);
  const [input, setInput] = useState(() => confirmedInput ? structuredClone(confirmedInput) : exampleInput(scenario, initialFacts));
  const [draft, setDraft] = useState(input);
  const [left, setLeft] = useState(initialLeft??scenario.options[0].id);
  const [right, setRight] = useState(initialRight??scenario.options[1].id);
  const timeline = useParallelTimeline(9000, 0);
  const phase = playbackPhase(timeline.progress);
  const stageLabel = { morning: "Start", midday: "Midpoint", evening: "Wrap-up" }[phase];
  const totalMinutes = Math.max(input.estimates[left]?.minutes ?? 0, input.estimates[right]?.minutes ?? 0);
  const elapsedMinutes = timeline.progress * totalMinutes;
  const container = useRef<HTMLDivElement>(null);
  const [editingFacts, setEditingFacts] = useState(false);
  useEffect(() => { container.current?.closest(".journey-stage")?.scrollTo({ top: 0 }); }, []);
  const evaluation=useMemo(()=>{try{return {result:evaluateDecision(input),error:""};}catch(e){return {result:null,error:(e as Error).message};}},[input]);
  const change = (id: string, side: "left" | "right") => {
    timeline.seek(0);
    if (side === "left") setLeft(id);
    else setRight(id);
  };
  const example = [...Object.values(input.estimates), ...Object.values(input.facts)]
    .some(entry => entry.source === "hypothetical");
  const draftErrors = editingFacts ? validateDecision(draft) : [];
  return <div ref={container} className={`parallel-cinema scenario-playback ${timeline.playing ? "is-running" : "is-paused"}`} data-day-phase={phase}>
    <div className="scenario-mini-toolbar"><button className="text-button" onClick={onBack}>← Back to your story</button><span>{example ? "Example assumptions" : "Simulation"}</span></div>
    <h3 className="scenario-preview-title">{scenario.title}</h3>
    {totalMinutes > 0 && <ParallelTimeline timeline={timeline} label="Elapsed time"
      readout={`${timeline.progress === 1 ? "Outcome" : stageLabel} · ${Math.round(elapsedMinutes)} of ${Math.round(totalMinutes)} min`} />}
    <motion.div className="playback-stage is-split" layout={!timeline.reduced} transition={playbackTransition}>
      {([["left", left], ["right", right]] as const).map(([side, id]) => {
        const option = scenario.options.find(entry => entry.id === id)!;
        const assessment = evaluation.result?.assessments.find(entry => entry.optionId === id);
        const visual = assessedVisual(scenarioId, id, assessment);
        const duration = input.estimates[id]?.minutes ?? 0;
        const elapsed = Math.min(duration, elapsedMinutes);
        const progress = duration > 0 ? elapsed / duration : 1;
        return <motion.article className="playback-world" key={side} layout={!timeline.reduced}
          initial={side === "right" && !timeline.reduced ? { opacity: 0, scale: .96, x: -15 } : false}
          animate={{ opacity: 1, scale: 1, x: 0 }} transition={playbackTransition}>
          <header><label>{side === "left" ? "One path" : "Another path"}
            <select aria-label={side === "left" ? "First plan" : "Alternative plan"} value={id}
              onChange={event => change(event.target.value, side)}>
              {scenario.options.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
          </label></header>
          <div className="playback-scene">
            <ScenarioArt frames={visual.frames} position={visual.blocked ? 0 : progress}
              running={timeline.playing && progress < 1 && !visual.blocked} reduced={timeline.reduced} />
          </div>
          {visual.blocked && <button className="plan-edit-button" onClick={() => readOnlyContext ? onEditContext?.() : setEditingFacts(true)}>{readOnlyContext?"Change your details":"Check the details"}</button>}
          {!visual.blocked && duration > 0 && <div className="scenario-time-track">
            <progress max={duration} value={elapsed} aria-label={`${option.label} elapsed time`} />
            <span>{Math.round(elapsed)} / {Math.round(duration)} min</span>
          </div>}
          {progress >= 1 && assessment?.status === "feasible" && <p className="scenario-fit fit-feasible" role="status">
            {example ? "Fits the example schedule" : "Fits the schedule"}
            {assessment.spareMinutes !== null && <small>{assessment.spareMinutes} minutes left</small>}
          </p>}
          <details className="future-inspect"><summary>Plan details</summary><p>{option.description}</p>
            {assessment?.reasons.map(reason => <p key={reason}>{reason}</p>)}
          </details>
        </motion.article>;
      })}
    </motion.div>

    {!readOnlyContext&&<details className="scenario-inputs" open={editingFacts} onToggle={event => setEditingFacts(event.currentTarget.open)}>
      <summary>Adjust timing and details (optional)</summary>
      <form onSubmit={event => {
        event.preventDefault();
        if (draftErrors.length) return;
        timeline.seek(0);
        setInput(draft);
        setEditingFacts(false);
      }}>
        <div className="scenario-time-inputs">
          <label>Time available (minutes)
            <input type="number" min="0" max="525600" required
              value={Number.isNaN(draft.availableMinutes) ? "" : draft.availableMinutes}
              onChange={event => setDraft({ ...draft, availableMinutes: event.target.valueAsNumber })} />
          </label>
          <label>Time already committed (minutes)
            <input type="number" min="0" max="525600" required
              value={Number.isNaN(draft.reservedMinutes) ? "" : draft.reservedMinutes}
              onChange={event => setDraft({ ...draft, reservedMinutes: event.target.valueAsNumber })} />
          </label>
        </div>
        {scenario.options.map(option => <label key={option.id}>
          {option.label} — total minutes
          <input type="number" min="0" max="525600" value={draft.estimates[option.id]?.minutes ?? ""}
            onChange={event => {
              const estimates = { ...draft.estimates };
              if (event.target.value === "") delete estimates[option.id];
              else estimates[option.id] = { minutes: event.target.valueAsNumber, source: "user", includesTravelAndSetup: true };
              setDraft({ ...draft, estimates });
            }} />
        </label>)}
        {Object.entries(scenario.questions).map(([key, question]) => <label key={key}>
          {question}
          <select value={draft.facts[key] === undefined ? "unknown" : String(draft.facts[key].value)}
            onChange={event => {
              const facts = { ...draft.facts };
              if (event.target.value === "unknown") delete facts[key];
              else facts[key] = { value: event.target.value === "true", source: "user" };
              setDraft({ ...draft, facts });
            }}>
            <option value="unknown">Not sure yet</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
          {draft.facts[key]?.source === "hypothetical" && <small>Example answer</small>}
        </label>)}
        <button className="plan-edit-button" disabled={draftErrors.length > 0}>Update comparison</button>
      </form>
    </details>}
    {evaluation.error && <p className="stage-note" role="alert">{evaluation.error}</p>}
  </div>;
}

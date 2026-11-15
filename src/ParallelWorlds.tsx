import { useState, type CSSProperties, type FormEvent } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import ParallelTimeline, { playbackPhase, playbackTransition, useParallelTimeline } from "./ParallelTimeline";
import ScenarioPlayback from "./ScenarioPlayback";
import { inheritedScenarioFacts } from "./scenarioVisuals";
import { listScenarios, routeThought } from "./engine";
import VoiceIcon from "./VoiceIcon";
import EverydayScene from "./EverydayScene";
import { activityAt, activityCopy, planTrack, splitBlock, tileLabel } from "./planPlayback";
import { districtInfo, type Config, type Round } from "./simulation";
import { comparisonMeasures, sameState } from "./parallelStory";

interface Props {
  a: Round;
  b: Round;
  rules: Config;
  matchedScenarioId?: string;
  familyTime?: boolean;
  onScenarioChange?: (catalogue: boolean) => void;
}

export default function ParallelWorlds({ a, b, rules, matchedScenarioId, familyTime, onScenarioChange }: Props) {
  const [situation, setSituation] = useState("current");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<string[] | null>(null);
  const scenarios = listScenarios();
  const matchedScenario = scenarios.find(scenario => scenario.id === matchedScenarioId);
  function findSituation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ids = routeThought(query).candidates.map(candidate => candidate.id);
    setMatches(ids);
    if (ids.length === 1) chooseSituation(ids[0]);
  }
  function chooseSituation(id: string) {
    setSituation(id);
    onScenarioChange?.(id !== "current");
  }
  if (situation !== "current") {
    return <ScenarioPlayback key={situation} scenarioId={situation}
      initialFacts={inheritedScenarioFacts(situation, rules, a.before.day)}
      onBack={() => {
        setQuery("");
        setMatches(null);
        chooseSituation("current");
      }} />;
  }
  return <>
    <PlanComparison key={JSON.stringify([a.id, b.id, a.policy.allocation, b.policy.allocation])} a={a} b={b} rules={rules} familyTime={familyTime} />
    {matchedScenario && <button type="button" className="secondary small" onClick={() => chooseSituation(matchedScenario.id)}>
      Compare {matchedScenario.title}
    </button>}
    <details className="future-inspect compare-scenarios">
      <summary>Try a different situation</summary>
      <form className="compare-scenario-search" onSubmit={findSituation}>
        <label>Find a situation <input type="search" value={query} maxLength={10000}
          placeholder="e.g. time with family" onChange={e => { setQuery(e.target.value); setMatches(null); }} /></label>
        <button className="secondary small" disabled={!query.trim()}>Find</button>
      </form>
      {matches && <p role="status">{matches.length === 0 ? "No match. Add a detail or pick a situation below." :
        matches.length > 1 ? "Several situations fit. Pick one below." : "One match found."}</p>}
      <label>Situation <select aria-label="Situation" value={situation} onChange={e => chooseSituation(e.target.value)}>
        <option value="current">Your current story</option>
        {scenarios.filter(s => !matches?.length || matches.includes(s.id))
          .map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
      </select></label>
    </details>
  </>;
}

function PlanComparison({ a, b, rules, familyTime }: Pick<Props, "a" | "b" | "rules" | "familyTime">) {
  const budget = rules.dailyBudget;
  const timeline = useParallelTimeline(budget * 1500, 0);
  const position = timeline.progress * budget;
  const block = Math.ceil(position);
  const firstSplit = splitBlock(a, b);
  const ended = timeline.progress === 1;
  const phase = playbackPhase(timeline.progress);
  const phaseLabel = { morning: "Morning", midday: "Midday", evening: "Evening" }[phase];
  const readout = block === 0 ? "Before the choice" : ended ? "The day’s outcome" : `${phaseLabel} · Block ${block} of ${budget}`;
  const stats = comparisonMeasures(a.after, b.after, rules);
  const changes = stats.filter(stat => stat.changed);

  return (
    <section className="parallel-cinema plan-playback" aria-label="Compare both paths" data-day-phase={phase}>
      <header className="compare-simple-header">
        <div><h3>Day {a.before.day} outcomes</h3><p>{sameState(a.before, b.before) ? "Same starting point, two plans." : "See how the choices played out."}</p></div>
      </header>
      <ParallelTimeline timeline={timeline} label={`Day ${a.before.day}`} readout={readout}
        split={firstSplit === null ? undefined : firstSplit / budget} />
      <motion.div className="playback-stage is-split" layout={!timeline.reduced} transition={playbackTransition}>
        {([["a", a, "What happened"], ["b", b, "Your alternative"]] as const).map(([side, round, label]) => (
          <motion.article className="playback-world" key={side} layout={!timeline.reduced}
            initial={side === "b" && !timeline.reduced ? { opacity: 0, scale: .96, x: -15 } : false}
            animate={{ opacity: 1, scale: 1, x: 0 }} transition={playbackTransition}>
            <header><span>{round.policy.name}</span><small>{label}</small></header>
            <div className="playback-scene">
              <EverydayScene round={round} rules={rules} position={position} running={timeline.playing} reduced={timeline.reduced} solo={null} familyTime={familyTime} />
            </div>
            <div className="playback-tiles" style={{ gridTemplateColumns: `repeat(${budget}, minmax(0, 1fr))` }} aria-label={`${label} time blocks`}>
              {planTrack(round).map((district, index) => {
                const filled = Math.max(0, Math.min(1, position - index));
                return <div key={index} className={`playback-tile ${filled > 0 ? "is-used" : ""} ${timeline.progress < 1 && block === index + 1 ? "is-now" : ""}`}
                  style={{ "--tile": districtInfo[district].color, "--fill": filled } as CSSProperties}>
                  <i /><VoiceIcon d={district} size={23} /><span>{tileLabel(district, rules, familyTime)}</span>
                </div>;
              })}
            </div>
            {timeline.progress < 1 && <p className="playback-outcome">{activityCopy(activityAt(round, position), round, rules, familyTime)}</p>}
          </motion.article>
        ))}
      </motion.div>
      {!ended && firstSplit !== null && position > firstSplit && <div className="playback-turn">
        <Sparkles size={15} aria-hidden="true" /><span>Here’s where the plans split.</span>
      </div>}
      <div className="compare-outcomes">
        <h3>{changes.length ? "What changed" : "Both plans reach the same outcome"}</h3>
        <table>
          <thead><tr><th scope="col">Resource</th><th scope="col">Chosen plan</th><th scope="col">What if</th></tr></thead>
          <tbody>{stats.map(stat => <tr key={stat.district} data-changed={stat.changed}>
            <th scope="row"><span><VoiceIcon d={stat.district} size={21} />{familyTime && stat.district === "C" ? "Family time" : stat.label}</span></th>
            {([stat.a, stat.b]).map((value, index) => <td key={index}>
              <strong>{value.text}</strong>{value.result !== null && <small data-result={value.result ? "met" : "missed"}>{value.result ? "Met" : "Missed"}</small>}
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

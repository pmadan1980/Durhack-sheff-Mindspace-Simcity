import { useState, type CSSProperties } from "react";
import VoiceIcon from "./VoiceIcon";
import { districtInfo, type District } from "./simulation";
import { listScenarios, getScenario, routeThought, evaluateDecision, compareDecisions, reflectOnDecision,
  type DecisionInput, type DecisionResult, type Priority } from "./engine";
import "./scenario-council.css";

const districts: Record<Priority, District> = { achievement: "A", recovery: "R", discovery: "D", connection: "C" };
function demo(id: string): DecisionInput {
  const s = getScenario(id);
  return { scenarioId: id, availableMinutes: 300, reservedMinutes: 60,
    facts: Object.fromEntries(Object.keys(s.questions).map(key => [key, { value: key === "prepared" ? false : true, source: "hypothetical" }])),
    estimates: Object.fromEntries(s.options.map((o, i) => [o.id, { minutes: i === 0 ? 120 : 180, source: "hypothetical", includesTravelAndSetup: true }])) };
}
export default function ScenarioCouncil() {
  const [input, setInput] = useState(() => demo("test-and-invitation"));
  const [thought, setThought] = useState("");
  const [routing, setRouting] = useState<ReturnType<typeof routeThought> | null>(null);
  const [stage, setStage] = useState<"context" | "council" | "reflection">("context");
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [baseline, setBaseline] = useState<DecisionInput | null>(null);
  const [chosen, setChosen] = useState("");
  const [reflection, setReflection] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const scenario = getScenario(input.scenarioId);
  const selectScenario = (id: string) => { setInput(demo(id)); setResult(null); setBaseline(null); setChosen(""); setSaved(""); setError(""); setReflection(""); setStage("context"); };
  const compare = result && baseline ? compareDecisions(baseline, result.input) : null;
  function run() {
    try { const next = evaluateDecision(input); setResult(next); setBaseline(baseline ?? structuredClone(input)); setError(""); setChosen(""); setStage("council"); }
    catch (e) { setError((e as Error).message); }
  }
  const label = (id: string | null) => scenario.options.find(o => o.id === id)?.label ?? "No single preference";
  return <main className="sc-app">
    <header className="sc-header"><a href="/">✧ MINDSPACE</a><span>THE COUNCIL</span><a href="/">Back to brain world ↗</a></header>
    <div className="sc-shell">
      <nav className="sc-steps" aria-label="Decision progress">{["context", "council", "reflection"].map((s, i) => <span key={s} aria-current={stage === s ? "step" : undefined}>{i + 1} · {s}</span>)}</nav>
      <div className="sc-title"><p>FOUR VOICES. YOUR CHOICE.</p><h1>{stage === "context" ? "Give your dilemma some space." : stage === "council" ? "Hear every side." : "What happened next?"}</h1><p>{stage === "context" ? "Choose a situation, adjust the facts, then hear the council." : scenario.title}</p></div>
      {error && <p className="sc-error" role="alert">{error}</p>}
      {stage === "context" && <>
        <section className="sc-panel"><label htmlFor="sc-thought">What's on your mind?</label><div className="sc-row"><input id="sc-thought" value={thought} maxLength={10000} onChange={e => setThought(e.target.value)} placeholder="My friend invited me out, but I have an exam tomorrow…"/><button onClick={() => setRouting(routeThought(thought))}>Find a situation</button></div>
          {routing && <div className="sc-routing" aria-live="polite">{routing.candidates.length ? <><p>Does one of these match? Confirm a situation to continue.</p>{routing.candidates.map(c => <button key={c.id} onClick={() => selectScenario(c.id)}>{getScenario(c.id).title}</button>)}</> : <p>No clear match yet. Choose a situation below; we won’t guess your facts.</p>}</div>}
          <label htmlFor="sc-scenario">Or choose from 15 situations</label><select id="sc-scenario" value={input.scenarioId} onChange={e => selectScenario(e.target.value)}>{listScenarios().map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
          <p>{scenario.summary}</p>
        </section>
        <div className="sc-notice">✧ Starts with illustrative demo assumptions. Edit them to explore your situation. This is a rules-based simulation, not a prediction.</div>
        <div className="sc-columns"><section className="sc-panel"><h2>The time you have</h2><div className="sc-fields"><label>Available minutes<input type="number" min="0" max="525600" value={Number.isNaN(input.availableMinutes) ? "" : input.availableMinutes} onChange={e => setInput({...input, availableMinutes: e.target.valueAsNumber})}/></label><label>Protected minutes<input type="number" min="0" max="525600" value={Number.isNaN(input.reservedMinutes) ? "" : input.reservedMinutes} onChange={e => setInput({...input, reservedMinutes: e.target.valueAsNumber})}/></label></div><p>Keep existing commitments protected. Use the same time period for every plan.</p>
          {Object.entries(scenario.questions).map(([key, question]) => <label className="sc-question" key={key}>{question}<select value={input.facts[key] === undefined ? "unknown" : String(input.facts[key].value)} onChange={e => { const facts = {...input.facts}; if (e.target.value === "unknown") delete facts[key]; else facts[key] = {value: e.target.value === "true", source: "user"}; setInput({...input, facts}); }}><option value="unknown">Not sure yet</option><option value="true">Yes</option><option value="false">No</option></select><small>{input.facts[key]?.source === "hypothetical" ? "Demo assumption" : input.facts[key] ? "Your answer" : "Unknown — not assumed"}</small></label>)}
        </section><section className="sc-panel"><h2>Three possible plans</h2><p>Estimate each complete plan, including required work, travel and setup.</p>{scenario.options.map(o => <div className="sc-plan" key={o.id}><h3>{o.label}</h3><p>{o.description}</p><label>Total minutes<input aria-label={`${o.label} total minutes`} type="number" min="0" max="525600" value={input.estimates[o.id]?.minutes ?? ""} onChange={e => {const estimates = {...input.estimates}; if(e.target.value === "") delete estimates[o.id]; else estimates[o.id] = {minutes: e.target.valueAsNumber, source: "user", includesTravelAndSetup: true}; setInput({...input, estimates}); }}/></label><small>{input.estimates[o.id]?.source === "hypothetical" ? "Illustrative estimate" : input.estimates[o.id] ? "Your estimate" : "Needs an estimate"}</small></div>)}</section></div>
        <button className="sc-primary" onClick={run}>{baseline ? "Compare this version →" : "Bring it to the council →"}</button>
      </>}
      {stage === "council" && result && <>
        {compare && compare.changedFields.length > 0 && <div className="sc-notice" role="status">Compared with your first version: {compare.changedBallots.length ? `${compare.changedBallots.map(p => districtInfo[districts[p]].name).join(", ")} changed their vote.` : "The council's votes stayed the same."} Your original version is preserved.</div>}
        <section className="sc-voices">{result.ballots.map(b => {const d = districts[b.resident]; const opening = result.arguments.find(a => a.id === `opening-${b.resident}`)!; const previous = compare?.before.ballots.find(a => a.resident === b.resident)?.choice; return <article className="sc-voice" key={b.resident} style={{"--voice": districtInfo[d].color} as CSSProperties}><VoiceIcon d={d} size={64}/><h2>{districtInfo[d].name}</h2><span className="sc-vote">{label(b.choice)}</span><p>{opening.text}</p>{b.tiedOptions.length > 1 && <small>Tied: {b.tiedOptions.map(label).join(" · ")}</small>}{previous !== undefined && previous !== b.choice && <small>Previously: {label(previous)}</small>}</article>;})}</section>
        {result.arguments.some(a => a.replyTo) && <section className="sc-panel"><h2>Around the table</h2>{result.arguments.filter(a => a.replyTo).map(a => <p className="sc-reply" key={a.id}><strong>{districtInfo[districts[a.resident]].name} → {districtInfo[districts[result.arguments.find(b => b.id === a.replyTo)!.resident]].name}</strong>{a.text}</p>)}</section>}
        <section><h2>Your options, side by side</h2><p>Four simulated resident votes. You decide; the majority does not choose for you.</p><div className="sc-options">{result.assessments.map(a => <article className="sc-panel" key={a.optionId}><span className={`sc-status sc-${a.status}`}>{a.status === "feasible" ? "Fits the supplied time" : a.status === "conditional" ? "Needs confirmation" : "Doesn't fit this plan"}</span><h3>{a.label}</h3><p>{result.counts[a.optionId]} / 4 resident votes</p><p>{a.spareMinutes !== null ? `${a.spareMinutes < 0 ? Math.abs(a.spareMinutes) + " minutes over" : a.spareMinutes + " minutes left"} after protected time.` : "Duration needed."}</p>{a.reasons.map(r => <p key={r}>{r}</p>)}<button disabled={a.status !== "feasible"} onClick={() => {setChosen(a.optionId); setSaved(""); setReflection(""); setStage("reflection");}}>Choose this plan</button></article>)}</div><p>{result.abstentions > 0 ? `${result.abstentions} resident(s) abstained because of a tie or no feasible option.` : "All four resident ballots are recorded."}</p></section>
        {result.questions.length > 0 && <div className="sc-notice"><strong>Still worth clarifying</strong>{result.questions.map(q => <p key={q}>{q}</p>)}</div>}
        <button className="sc-primary" onClick={() => setStage("context")}>Change a fact & compare →</button>
        <details className="sc-panel"><summary>How this comparison works</summary>{result.caveats.map(c => <p key={c}>{c}</p>)}</details>
      </>}
      {stage === "reflection" && result && <section className="sc-panel sc-reflection"><span className="sc-status">YOUR CHOICE</span><h2>{label(chosen)}</h2><p>{scenario.reflection}</p><label htmlFor="sc-reflection">Your reflection</label><textarea id="sc-reflection" maxLength={10000} rows={5} value={reflection} onChange={e => setReflection(e.target.value)} placeholder="What happened? What would you change?"/><button className="sc-primary" disabled={!reflection.trim()} onClick={() => {try {const next = reflectOnDecision(result.input, {chosenOptionId: chosen, observation: reflection}); setSaved(next.explanation); setError("");} catch(e) {setError((e as Error).message);} }}>Record this reflection</button>{saved && <p role="status">{saved}</p>}<small>Kept only in this open session. Refreshing or leaving clears it.</small><div className="sc-row"><button onClick={() => setStage("council")}>Back to council</button><button onClick={() => setStage("context")}>Update facts & reconsider</button></div></section>}
      <footer className="sc-footer">A space to explore trade-offs. Not a forecast of your future.</footer>
    </div>
  </main>;
}

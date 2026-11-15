import { useState } from "react";
import { getScenario, listScenarios } from "./engine";
import ScenarioPlayback from "./ScenarioPlayback";

export default function ScenarioJourney({thought,candidates,onBack}:{thought:string;candidates:string[];onBack:()=>void}) {
  const [selected,setSelected]=useState(candidates[0]);
  const [confirmed,setConfirmed]=useState(false);
  return <>
    <nav className="journey-strip" aria-label="Journey progress"><ol><li className={!confirmed?"step-current":"step-done"}>Your situation</li><li className={confirmed?"step-current":""}>Compare paths</li></ol><div className="journey-tools"><button onClick={onBack}>New thought</button></div></nav>
    <section className="journey-stage scene-comparison scenario-entry">
      {!confirmed ? <><span className="cosmic-eyebrow">BEFORE WE START</span><h2>Is this your situation?</h2><blockquote className="thought-quote">“{thought}”</blockquote>
        <label className="inline-field">Situation<select value={selected} onChange={e=>setSelected(e.target.value)}>{listScenarios().map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
        <p>{getScenario(selected).summary}</p><button className="playback-primary" onClick={()=>setConfirmed(true)}>Yes, set up my paths</button><button className="text-button" onClick={onBack}>← Edit my thought</button>
      </> : <ScenarioPlayback key={selected} scenarioId={selected} setupFirst onBack={()=>setConfirmed(false)} />}
    </section>
  </>;
}

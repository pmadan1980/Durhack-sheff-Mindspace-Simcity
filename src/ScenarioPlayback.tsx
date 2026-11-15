import { BrainTransition } from "./BrainCinema";
import { districts, type District } from "./simulation";
import { useEffect,useMemo,useRef,useState,type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import { getScenario,evaluateDecision,type DecisionInput } from "./engine";
import { assessedVisual,type ArtFrame } from "./scenarioVisuals";

function Art({ frames,position,running }: { frames:ArtFrame[];position:number;running:boolean }) {
  const index=Math.min(frames.length-1,Math.floor(position*frames.length));
  return <><div className={`everyday-scene clay-scene ${running?"scene-running":"scene-paused"}`} role="img" aria-label={frames[index].action}>
    {frames.map((frame,i)=><div className={`clay-layer ${i===index?"clay-visible":""}`} key={`${frame.file}:${i}`} aria-hidden="true">{frame.side === undefined ? <img className="clay-still" src={`/art/parallel-clay/${frame.file}`} alt="" draggable={false} /> : <div className="clay-still" style={{backgroundImage:`url(/art/parallel-clay/${frame.file})`,backgroundSize:"200% 100%",backgroundPosition:frame.side===1?"right center":"left center"}} />}</div>)}<div className="clay-lamplight" aria-hidden="true" />
  </div><p className="playback-outcome">{frames[index].action}</p></>;
}
export default function ScenarioPlayback({ scenarioId,onBack,initialFacts={},setupFirst=false }: { scenarioId:string;onBack:()=>void;initialFacts?:DecisionInput["facts"];setupFirst?:boolean }) {
  const scenario=useMemo(()=>getScenario(scenarioId),[scenarioId]);
  const [input,setInput]=useState<DecisionInput>(()=>({scenarioId,availableMinutes:240,reservedMinutes:0,facts:structuredClone(initialFacts),estimates:setupFirst ? {} : Object.fromEntries(scenario.options.map((o,i)=>[o.id,{minutes:[120,180,150][i],source:"hypothetical",includesTravelAndSetup:true}]))}));
  const [left,setLeft]=useState(scenario.options[0].id),[right,setRight]=useState(scenario.options[1].id);
  const [position,setPosition]=useState(0),[playing,setPlaying]=useState(false),[error,setError]=useState("");
  const container=useRef<HTMLDivElement>(null);
  const cursor=useRef(0); const reduced=!!useReducedMotion();
  const [editingFacts,setEditingFacts]=useState(setupFirst);
  const [confirmed,setConfirmed]=useState(!setupFirst);
  const [cinema,setCinema]=useState(false);
  useEffect(()=>{ container.current?.closest(".journey-stage")?.scrollTo({top:0}); },[confirmed]);
  const evaluation=useMemo(()=>{try{return {result:evaluateDecision(input),error:""};}catch(e){return {result:null,error:(e as Error).message};}},[input]);
  useEffect(()=>{
    if (!playing||reduced) return;
    let request=0,last=0;
    const tick=(now:number)=>{
      if(document.hidden){setPlaying(false);return;}
      if(!last)last=now;
      if(now-last>=1000/30){const next=Math.min(1,cursor.current+Math.min(now-last,100)/7000);last=now;cursor.current=next;setPosition(next);if(next>=1){setPlaying(false);return;}}
      request=requestAnimationFrame(tick);
    }; request=requestAnimationFrame(tick);return()=>cancelAnimationFrame(request);
  },[playing,reduced]);
  const reset=()=>{setPlaying(false);cursor.current=0;setPosition(0);};
  const change=(id:string,side:"left"|"right")=>{reset();side==="left"?setLeft(id):setRight(id);};
  const priorityKeys={A:"achievement",C:"connection",D:"discovery",R:"recovery"} as const;
  const active:District[]=districts.filter(d=>evaluation.result?.assessments.some(a=>(a.optionId===left || a.optionId===right) && a.status==="feasible" && a.scores[priorityKeys[d]]>0));
  const example=Object.values(input.estimates).some(e=>e.source==="hypothetical");
  return <div ref={container} className={`parallel-cinema scenario-playback ${playing?"is-running":"is-paused"}`}>
    {cinema&&<BrainTransition thought={scenario.title} beat="split" active={active} onDone={()=>setCinema(false)} />}
    <div className="scenario-mini-toolbar"><button className="text-button" onClick={onBack}>{setupFirst ? "← Back" : "← Back to your story"}</button><span>{!confirmed ? "Set your timing" : example?"Example timing":"Your timing"}</span></div>
    <h3 className="scenario-preview-title">{scenario.title}</h3>
    {confirmed && <>
    <section className="playback-controls" aria-label="Scenario playback controls"><div className="playback-clock"><span>PLAN PREVIEW</span><strong>{position===0?"Two possible paths":position>=1?"What each plan needs":"Watch the choices unfold"}</strong></div>
      <input type="range" min="0" max="1" step=".01" value={position} aria-label="Scrub through this situation" onChange={e=>{setPlaying(false);cursor.current=+e.target.value;setPosition(+e.target.value);}} />
      <div className="playback-actions"><button className="playback-primary" onClick={()=>{if(playing){setPlaying(false);return;}if(reduced){cursor.current=1;setPosition(1);return;}if(position>=1){cursor.current=0;setPosition(0);}setPlaying(true);}}>{playing?"Pause":position>=1?"Replay paths":"Compare paths"}</button><button onClick={()=>{setPlaying(false);cursor.current=1;setPosition(1);}}>See the outcome</button><button onClick={reset}>Start over</button></div>
    </section>
    <div className="playback-stage is-split">
      {([['left',left],['right',right]] as const).map(([side,id])=>{const option=scenario.options.find(o=>o.id===id)!;const assessment=evaluation.result?.assessments.find(a=>a.optionId===id);const visual=assessedVisual(scenarioId,id,assessment);return <article className="playback-world" key={side}>
        <header><label>{side==="left"?"One path":"Another path"}<select aria-label={side==="left"?"First plan":"Alternative plan"} value={id} onChange={e=>change(e.target.value,side)}>{scenario.options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label></header>
        <Art frames={visual.frames} position={position} running={playing && !visual.blocked} />
        {visual.blocked && <button className="plan-edit-button" onClick={()=>setEditingFacts(true)}>Check the details</button>}
        {position>=1&&assessment?.status==="feasible"&&<p className={`scenario-fit fit-${assessment.status}`} role="status">{"Fits the time you entered"}{assessment.spareMinutes!==null&&<small>{assessment.spareMinutes>=0?`${assessment.spareMinutes} minutes left`:`${Math.abs(assessment.spareMinutes)} minutes over`}</small>}</p>}
        <details className="future-inspect"><summary>Plan details</summary><p>{option.description}</p>{assessment?.reasons.map(r=><p key={r}>{r}</p>)}</details>
      </article>;})}
    </div>

    </>}
    <details className="scenario-inputs" open={editingFacts} onToggle={e=>setEditingFacts(e.currentTarget.open)}><summary>{confirmed ? "Change the timing & details" : "Your time & situation"}</summary><div className="scenario-time-inputs"><label>Time available (minutes)<input type="number" min="0" max="525600" value={Number.isNaN(input.availableMinutes)?"":input.availableMinutes} onChange={e=>{reset();setInput({...input,availableMinutes:e.target.valueAsNumber});}} /></label><label>Time already committed<input type="number" min="0" max="525600" value={Number.isNaN(input.reservedMinutes)?"":input.reservedMinutes} onChange={e=>{reset();setInput({...input,reservedMinutes:e.target.valueAsNumber});}} /></label></div>
      {scenario.options.map(o=><label key={o.id}>{o.label} — total minutes<input type="number" min="0" max="525600" value={input.estimates[o.id]?.minutes??""} onChange={e=>{reset();const estimates={...input.estimates};if(e.target.value==="")delete estimates[o.id];else estimates[o.id]={minutes:e.target.valueAsNumber,source:"user",includesTravelAndSetup:true};setInput({...input,estimates});}} /></label>)}
      {Object.entries(scenario.questions).map(([key,question])=><label key={key}>{question}<select value={input.facts[key]===undefined?"unknown":String(input.facts[key].value)} onChange={e=>{reset();const facts={...input.facts};if(e.target.value==="unknown")delete facts[key];else facts[key]={value:e.target.value==="true",source:"user"};setInput({...input,facts});}}><option value="unknown">Not sure yet</option><option value="true">Yes</option><option value="false">No</option></select></label>)}
      <button className="plan-edit-button" disabled={!evaluation.result || (setupFirst && scenario.options.some(o => !input.estimates[o.id]))} onClick={()=>{setInput({...input,estimates:Object.fromEntries(Object.entries(input.estimates).map(([id,e])=>[id,{...e,source:"user" as const}]))});setError("");setConfirmed(true);setEditingFacts(false);setCinema(setupFirst);}}>Compare my paths</button>
    </details>
    {(error||evaluation.error)&&<p className="stage-note" role="alert">{error||evaluation.error}</p>}
  </div>;
}

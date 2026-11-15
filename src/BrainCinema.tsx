import { useContext, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import { districtInfo, districts, type Config, type District, type Policy, type Round } from "./simulation";
import { allocationActivation, brainRegions, thoughtActivation } from "./thoughtActivation";
import VoiceIcon from "./VoiceIcon";
import { audio } from "./audio";
import { BrainMotionContext } from "./brainMotion";
import EverydayScene from "./EverydayScene";

export type BrainBeat = "awakening" | "choice" | "memory" | "split" | "dream";

export function BrainWorld({active,speaker,mode="awakening",onRegionSelect}:{active:District[];speaker?:District|null;mode?:BrainBeat|"debate";onRegionSelect?:(d:District)=>void}) {
  const [failed,setFailed]=useState(false);
  const neonId=useId().replaceAll(":", "");
  return <div className={`brain-world brain-${mode}`} data-speaker={mode==="debate" ? speaker ?? undefined : undefined} style={speaker?{"--speaking-color":brainRegions[speaker].color} as CSSProperties:undefined} role={onRegionSelect?"group":"img"} aria-label={`${mode==="debate" && speaker ? `${districtInfo[speaker].name} is speaking. ` : ""}Inner world. Active priorities: ${active.map(d=>districtInfo[d].name).join(", ") || "none selected yet"}. ${districts.some(d=>!active.includes(d)) ? `${districts.filter(d=>!active.includes(d)).map(d=>districtInfo[d].name).join(", ")} quiet.` : ""}`}>
    {!failed && <img className="brain-dormant" src="/art/brain-world/dormant.png" alt="" draggable={false} onError={()=>setFailed(true)} />}
    {active.map((d,i)=><img key={d} className={`brain-awake ${speaker===d?"region-speaking":"region-listening"}`} src="/art/brain-world/awake.png" alt="" draggable={false} style={{maskImage:`radial-gradient(ellipse 28% 30% at ${brainRegions[d].x}% ${brainRegions[d].y}%, black 55%, transparent 100%)`,"--wake-delay":`${i*.4}s`} as CSSProperties} />)}
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="brain-signals" aria-hidden="true">
      <defs><filter id={neonId}><feGaussianBlur stdDeviation=".65" /></filter></defs>
      {active.map((d,i)=>{const p=brainRegions[d];const path=speaker===d ? `M ${p.x} ${p.y} Q ${p.x} 49 50 49` : `M 50 49 Q ${p.x} 49 ${p.x} ${p.y}`;return <g key={d} style={{"--signal":p.color,"--signal-duration":`${speaker===d?1.1:2.5+i*.32}s`,"--wake-delay":`${i*.4}s`} as CSSProperties} className={`brain-route ${speaker===d?"is-speaking":""}`}>
        <path d={path} className="signal-halo" style={{filter:`url(#${neonId})`}} /><path d={path} className="signal-track" /><path d={path} className="signal-runner" />
        {mode==="debate"&&<circle cx={p.x} cy={p.y} r="4.1" className="speaker-ring" />}
        <circle cx={p.x} cy={p.y} r="2.8" className="signal-node-halo" style={{filter:`url(#${neonId})`}} /><circle cx={p.x} cy={p.y} r=".65" className="signal-node" />
      </g>;})}
      {active.length>0&&<><circle className="brain-junction-halo" style={{filter:`url(#${neonId})`}} cx="50" cy="49" r="3" /><circle className="brain-junction" cx="50" cy="49" r=".8" /></>}
    </svg>
    {onRegionSelect&&<div className="brain-region-targets">{districts.map(d=><button key={d} style={{left:`${brainRegions[d].x}%`,top:`${brainRegions[d].y}%`,"--region":brainRegions[d].color} as CSSProperties} aria-label={`Ask ${districtInfo[d].name} a question`} onClick={()=>onRegionSelect(d)}><span>Ask {districtInfo[d].name} ↗</span></button>)}</div>}
    {mode==="dream"&&<div className="dream-moon" aria-hidden="true">☾</div>}
    <div className="brain-region-labels" aria-hidden="true">{districts.map(d=><span key={d} className={`${active.includes(d)?"region-on":"region-off"} ${speaker===d?"label-speaking":""}`} style={{left:`${brainRegions[d].x}%`,top:`${brainRegions[d].y+13}%`,"--region":brainRegions[d].color} as CSSProperties}>{districtInfo[d].name}</span>)}</div>
  </div>;
}

const beatCopy:Record<BrainBeat,[string,string]>={
  awakening:["A thought becomes a world.","Your priorities are waking up."],
  choice:["A choice finds its path.","The elected plan connects these priorities."],
  memory:["Today leaves a trace.","Your choices become memories in this world."],
  split:["One memory. Two possibilities.","Follow the same beginning into two different plans."],
  dream:["Let the day settle.","The world replays what happened."],
};

export function BrainTransition({thought,beat="awakening",active:given,policy,memories=[],previews=[],rules,familyTime,onDone}:{thought:string;beat?:BrainBeat;active?:District[];policy?:Policy;memories?:Round[];previews?:Round[];rules?:Config;familyTime?:boolean;onDone:()=>void}) {
  const [active,setActive]=useState(()=>given??thoughtActivation(thought));
  const [paused,setPaused]=useState(false),[elapsed,setElapsed]=useState(0);
  const [ready,setReady]=useState(false);
  const systemReduced=!!useReducedMotion();
  const reduced=useContext(BrainMotionContext)||systemReduced;
  const dialog=useRef<HTMLDialogElement>(null),done=useRef(onDone);done.current=onDone;
  const elapsedRef=useRef(0),initialFocus=useRef<HTMLElement|null>(null);
  const duration=beat==="awakening"?8500:5500;
  useEffect(()=>{
    initialFocus.current=document.activeElement as HTMLElement;
    const element=dialog.current; if(element&&!element.open)element.showModal();
    let cancelled=false;
    void Promise.all(["dormant", "awake"].map(name=>new Promise<void>(resolve=>{
      const image=new Image();image.onload=()=>resolve();image.onerror=()=>resolve();image.src=`/art/brain-world/${name}.png`;
    }))).then(()=>{if(!cancelled)setReady(true);});
    return()=>{cancelled=true;element?.close();initialFocus.current?.focus?.({preventScroll:true});};
  },[]);
  useEffect(()=>{
    if(paused||reduced||!ready)return;
    let last=performance.now();
    const timer=window.setInterval(()=>{
      const now=performance.now();if(!document.hidden)elapsedRef.current+=Math.min(now-last,300);last=now;
      setElapsed(elapsedRef.current);if(elapsedRef.current>=duration)done.current();
    },100);
    return()=>window.clearInterval(timer);
  },[paused,reduced,ready,duration]);
  const [title,caption]=beatCopy[beat];
  return <dialog ref={dialog} className={`brain-transition ${paused?"brain-paused":""} ${reduced?"brain-still":""}`} onCancel={e=>{e.preventDefault();onDone();}} aria-labelledby="brain-transition-title">
    <div className="brain-transition-header"><span>MINDSPACE · THE WORLD WITHIN</span><div>{!reduced&&<button onClick={()=>setPaused(!paused)} aria-pressed={paused}>{paused?"Resume":"Pause"}</button>}<button onClick={onDone}>Skip animation →</button></div></div>
    <h2 id="brain-transition-title">{title}</h2>
    {beat==="awakening"&&<blockquote className="thought-release">{thought.split(/\s+/).map((word,i)=><span key={i} style={{"--word-delay":`${Math.min(i*.07,.9)}s`} as CSSProperties}>{word} </span>)}</blockquote>}
    <div className={`brain-camera camera-${beat}`}>{ready ? <BrainWorld active={active} mode={beat} /> : <div className="brain-image-loading" aria-label="Preparing the inner world"><span>✳</span></div>}
      {beat==="split"&&<div className={`memory-split ${previews.length?"has-scenes":""}`} aria-label="Two possible futures">{previews.length&&rules ? previews.map((round,i)=><article key={i}><small>{i===0?"What happened":"What if…"}</small><EverydayScene round={round} rules={rules} position={reduced ? rules.dailyBudget : Math.max(0,Math.min(rules.dailyBudget,(elapsed/duration-.35)/.65*rules.dailyBudget))} running={!paused&&!reduced} reduced={reduced} solo={null} familyTime={familyTime}/><strong>{round.policy.name}</strong></article>) : <><span>One path</span><i>✳</i><span>Another path</span></>}</div>}
      {(beat==="memory"||beat==="dream")&&<div className="brain-memory-orbs" aria-label="Recorded days">{memories.map((r,i)=><span key={r.id} style={{"--orb-index":i} as CSSProperties}>Day {r.before.day}<small>{r.policy.name}</small></span>)}</div>}
    </div>
    <p className="brain-transition-caption">{policy?.name ?? caption}</p>
    {beat==="awakening"&&<div className="brain-voice-switches" aria-label="Priorities in your thought">{districts.map(d=><button key={d} aria-pressed={active.includes(d)} style={{"--region":brainRegions[d].color} as CSSProperties} onClick={()=>{setPaused(true);setActive(active.includes(d)?active.filter(x=>x!==d):[...active,d]);}}><VoiceIcon d={d} size={23}/>{districtInfo[d].name}<small>{active.includes(d)?"Awake":"Quiet"}</small></button>)}</div>}
    <footer><div className="brain-transition-progress" aria-hidden="true"><i style={{transform:`scaleX(${reduced?1:Math.min(1,elapsed/duration)})`}}/></div><button className="brain-continue" onClick={onDone}>{beat==="awakening"?"Enter this world":"Continue"} →</button></footer>
  </dialog>;
}

export function JourneyCinema({scene,thought,policy,memories,day,soundOn=false,previews,rules,familyTime}:{scene:string;thought:string;policy?:Policy;memories:Round[];day:number;soundOn?:boolean;previews?:Round[];rules?:Config;familyTime?:boolean}) {
  const [dismissed,setDismissed]=useState("");
  const beat=({result:"choice",summary:"memory",comparison:"split",reflection:"dream",closing:"dream"} as Record<string,BrainBeat>)[scene];
  const key=`${scene}:${day}`;
  useEffect(()=>{
    if(beat!=="dream" || dismissed===key || !soundOn || !policy)return;
    const timer=window.setTimeout(()=>audio.resolveComposition(allocationActivation(policy.allocation)),100);
    return()=>{window.clearTimeout(timer);audio.stop();};
  },[key,beat,soundOn,policy,dismissed]);
  if(!beat||dismissed===key)return null;
  const active=beat==="split" && previews?.length ? districts.filter(d=>previews.some(round=>round.policy.allocation[d]>0)) : policy?allocationActivation(policy.allocation):thoughtActivation(thought);
  return <BrainTransition key={key} beat={beat} thought={thought} active={active} policy={policy} memories={memories} previews={previews} rules={rules} familyTime={familyTime} onDone={()=>setDismissed(key)} />;
}

export function PlanBridge({policy,budget}:{policy:Policy;budget:number}) {
  const blocks=districts.flatMap(d=>Array.from({length:policy.allocation[d]},()=>d));
  const key=blocks.join("");
  return <div className="plan-bridge" aria-label="Your blocks build the path" role="img">
    <div className="bridge-island island-start">✳</div><div className="bridge-span">{Array.from({length:budget},(_,i)=>{const d=blocks[i];return <span key={i} className={`bridge-stone ${d?"":"stone-empty"}`} style={{"--stone":d?brainRegions[d].color:"#655b70","--stone-step":i} as CSSProperties} title={d?districtInfo[d].name:"Unplaced block"}>{d&&<VoiceIcon d={d} size={20}/>}</span>;})}
      {blocks.length===budget&&<i key={key} className="bridge-traveller" aria-hidden="true"><VoiceIcon d={blocks[0]} size={25}/></i>}
    </div><div className="bridge-island island-end">✧</div>
  </div>;
}

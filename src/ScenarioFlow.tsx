import ParallelTimeline,{useParallelTimeline} from "./ParallelTimeline";
import { useEffect,useMemo,useRef,useState,type CSSProperties } from "react";
import { ArrowRight,Pause,Play } from "lucide-react";
import { getScenario,type DecisionInput } from "./engine";
import { config,districts,districtInfo,type District } from "./simulation";
import { revealOrder,type Cue,type Scene,sceneRoom } from "./journey";
import { scenarioInput,scenarioElection,scenarioStagePlans,priorityDistrict,districtPriority } from "./scenarioJourneyModel";
import ScenarioPlayback,{ScenarioArt} from "./ScenarioPlayback";
import { assessedVisual } from "./scenarioVisuals";
import VoiceIcon from "./VoiceIcon";
import ScenarioPlanCards from "./ScenarioPlanCards";
import type { Location } from "./MindUniverse";
import { audio } from "./audio";

export interface ScenarioNavigation { room:Location;key:number }
interface Props {scenarioId:string;thought:string;onVisual:(cue:Cue|null,room?:Location)=>void;onExit:()=>void;navigation:ScenarioNavigation|null;soundOn:boolean;onSound:()=>void}
const stages:Scene[]=["clarify","briefing","debate","intervention","voting","result","consequences","summary","branch","comparison","closing"];
const labels:Record<string,string>={clarify:"Setup",briefing:"Today",debate:"Debate",intervention:"Plans",voting:"Vote",result:"Result",consequences:"Consequences",summary:"Story",branch:"What if",comparison:"Side by side",closing:"Reflect",math:"The maths"};

export default function ScenarioFlow({scenarioId,thought,onVisual,onExit,navigation,soundOn,onSound}:Props) {
  const scenario=useMemo(()=>getScenario(scenarioId),[scenarioId]);
  const [input,setInput]=useState(()=>scenarioInput(scenarioId,thought));
  const [phase,setPhase]=useState<Scene|"math">("clarify"),[confirmed,setConfirmed]=useState(false);
  const [line,setLine]=useState(0),[auto,setAuto]=useState(true),[revealed,setRevealed]=useState(0),[counting,setCounting]=useState(true);
  const [frozen,setFrozen]=useState<ReturnType<typeof scenarioElection>&{input:DecisionInput}|null>(null);
  const [alternative,setAlternative]=useState(scenario.options[1].id);
  const [asking,setAsking]=useState<District|null>(null),[question,setQuestion]=useState<number|null>(null),[resident,setResident]=useState<number|null>(null);
  const panel=useRef<HTMLElement>(null);
  const walkthrough=useParallelTimeline(9000,0);
  useEffect(()=>{walkthrough.seek(0);},[phase]);
  const evaluation=useMemo(()=>{try{return {value:scenarioElection(input),error:""};}catch(e){return {value:null,error:(e as Error).message};}},[input]);
  const election=frozen??evaluation.value;
  const args=evaluation.value?.result.arguments??[];
  const current=args[Math.min(line,Math.max(0,args.length-1))];
  const speaker=phase==="debate"?(asking&&question!==null?asking:current?priorityDistrict[current.resident]:null):null;
  const visualPlans=useMemo(()=>scenarioStagePlans(scenarioId),[scenarioId]);
  const order=useMemo(()=>revealOrder(config.residentCount),[]);
  const shownCounts=visualPlans.map((_,i)=>frozen?order.slice(0,revealed).filter(n=>frozen.ballots[n].choice===i).length:0);
  const countsKey=shownCounts.join(":");
  const cue=useMemo<Cue>(()=>({scene:phase==="math"?"closing":phase,speaker,focus:null,plans:visualPlans,votes:frozen?frozen.ballots.map((b,i)=>order.slice(0,revealed).includes(i)?b.choice:null):[],counts:frozen?shownCounts:null,winner:frozen&&revealed===config.residentCount?frozen.winner:null,flights:null,thought:phase==="briefing",reactions:[]}),[phase,speaker,visualPlans,frozen,revealed,countsKey]);
  useEffect(()=>{onVisual(cue,phase==="math"?"observatory":sceneRoom[phase]);},[cue,onVisual]);
  useEffect(()=>()=>{onVisual(null);audio.setDebateSpeaker(undefined);audio.stop();},[onVisual]);
  useEffect(()=>{panel.current?.scrollTo({top:0});panel.current?.querySelector<HTMLElement>("h2")?.focus({preventScroll:true});},[phase]);
  useEffect(()=>{
    if(!navigation)return;
    const room=navigation.room;
    if(room==="observatory")setPhase("math");
    else if(room==="headquarters")setPhase("clarify");
    else if(room==="decision")setPhase(confirmed?"debate":"clarify");
    else if(room==="memory")setPhase(frozen?"summary":"briefing");
    else if(room==="parallel"&&frozen)setPhase("comparison");
  },[navigation?.key]);
  useEffect(()=>{
    if(phase!=="debate"||!auto||asking||line>=args.length-1)return;
    const timer=window.setTimeout(()=>{if(!document.hidden)setLine(n=>n+1);},1800+(current?.text.split(/\s+/).length??0)*220);
    return()=>window.clearTimeout(timer);
  },[phase,auto,asking,line,args.length,current?.text]);
  useEffect(()=>{
    if(phase!=="voting"||!counting||revealed>=config.residentCount)return;
    const timer=window.setInterval(()=>{if(!document.hidden)setRevealed(n=>Math.min(config.residentCount,n+1));},config.guidedCountSeconds*1000/config.residentCount);
    return()=>window.clearInterval(timer);
  },[phase,counting,revealed]);
  useEffect(()=>{
    audio.setDebateSpeaker(phase==="debate"?speaker:undefined);
    const scores=election?.result.assessments.find(a=>a.optionId===current?.optionId)?.scores;
    if(scores)audio.setFrame({a:{density:Object.fromEntries(districts.map(d=>[d,Math.max(0,Math.min(6,Math.round(scores[districtPriority[d]])))])) as Record<District,number>,methodLift:0,recoveryEcho:false,energy:.5}});
    audio.play(soundOn&&phase==="debate"&&auto&&!asking);
  },[phase,speaker,soundOn,auto,asking,current?.optionId,election]);
  const update=(next:DecisionInput)=>{setInput(next);setFrozen(null);setRevealed(0);};
  const go=(next:Scene|"math")=>{setAsking(null);setQuestion(null);setPhase(next);};
  const back=()=>{if(phase==="math")go(frozen?"result":"clarify");else {const i=stages.indexOf(phase);if(i>0)go(stages[i-1]);else onExit();}};
  const freeze=()=>{
    const accepted={...input,estimates:Object.fromEntries(Object.entries(input.estimates).map(([id,v])=>[id,{...v,source:"user" as const}]))};
    const result=scenarioElection(accepted);if(result.winner===null)return;
    setAlternative(scenario.options.find(o=>o.id!==scenario.options[result.winner!].id)!.id);
    setInput(accepted);setFrozen({...result,input:structuredClone(accepted)});setRevealed(0);setCounting(true);go("voting");
  };
  const winner=frozen?.winner===null||frozen?.winner===undefined?undefined:scenario.options[frozen.winner];
  const selected=frozen&&winner?frozen.result.assessments.find(a=>a.optionId===winner.id):undefined;
  const selectedVisual=winner?assessedVisual(scenarioId,winner.id,selected):undefined;
  const nextButton=(text:string,next:Scene|"math",disabled=false)=><div className="stage-action"><button className="cosmic-primary" disabled={disabled} onClick={()=>go(next)}>{text}<ArrowRight size={15}/></button></div>;
  const askText=()=>{
    if(!asking)return "";
    const priority=districtPriority[asking];
    if(question===0)return args.find(a=>a.resident===priority&&!a.replyTo)?.text??"I need more context before favouring a plan.";
    const best=election?.result.assessments.filter(a=>a.status==="feasible").sort((a,b)=>b.scores[priority]-a.scores[priority])[0];
    const option=scenario.options.find(o=>o.id===best?.optionId);
    return option?`${option.label}: ${option.description}`:"No plan is confirmed to fit yet. Check the timing and required details.";
  };
  const after=stages.indexOf(phase as Scene)>=stages.indexOf("summary");
  return <>
    <nav className="journey-strip" aria-label="Journey progress"><span className="journey-day">YOUR CHOICE</span><ol>{(after?stages.slice(stages.indexOf("summary")):stages.slice(0,stages.indexOf("summary"))).map(s=><li key={s} className={phase===s?"step-current":""}>{labels[s]}</li>)}</ol><div className="journey-tools"><button onClick={back}>← Back</button><button onClick={onExit} aria-label="Start a new thought">New thought</button></div></nav>
    <section ref={panel} className={`journey-stage scene-${phase} scenario-guided ${phase==="debate"?"debate-studio":""} ${phase==="voting"?"stage-wide":""}`} aria-label="Journey stage">
      <span className="cosmic-eyebrow">{scenario.title}</span>
      {phase==="clarify"&&<><h2>Check your starting point</h2><blockquote className="thought-quote">“{thought}”</blockquote>
        {Object.entries(scenario.questions).map(([key,text])=><fieldset key={key} className="choice-set"><legend>{text}</legend><div className="chip-row">{[{label:"Yes",value:true},{label:"No",value:false},{label:"Not sure yet",value:undefined}].map(answer=><button key={answer.label} aria-pressed={input.facts[key]?.value===answer.value} onClick={()=>{const facts={...input.facts};if(answer.value===undefined)delete facts[key];else facts[key]={value:answer.value,source:"user"};update({...input,facts});}}>{answer.label}</button>)}</div></fieldset>)}
        <fieldset className="choice-set"><legend>Time available for this decision</legend><div className="chip-row">{[30,60,120,240].map(n=><button key={n} aria-pressed={input.availableMinutes===n} onClick={()=>update({...input,availableMinutes:n})}>{n<60?`${n} min`:`${n/60} hour${n>60?"s":""}`}</button>)}</div><label className="inline-field">Minutes<input type="number" min="0" max="525600" value={Number.isNaN(input.availableMinutes)?"":input.availableMinutes} onChange={e=>update({...input,availableMinutes:e.target.valueAsNumber})}/></label></fieldset>
        <div className="stage-action"><button className="cosmic-primary" disabled={!evaluation.value} onClick={()=>{setConfirmed(true);go("briefing");}}>Confirm setup<ArrowRight size={15}/></button></div></>}
      {phase==="briefing"&&<><h2>Today’s priorities</h2><p className="stage-lede">{scenario.summary}</p><div className="scenario-choice-list">{scenario.options.map(o=><article key={o.id}><b>{o.label}</b><p>{o.description}</p></article>)}</div>{nextButton("Hear the debate","debate")}</>}
      {phase==="debate"&&<><div className="debate-title"><h2>Hear them argue it out.</h2><div className="stage-action split"><button className="text-button" onClick={()=>go("intervention")}>Skip debate</button><button className="cosmic-primary" onClick={()=>{setQuestion(null);setAsking(null);if(line<args.length-1)setLine(n=>n+1);else go("intervention");}}>{line<args.length-1?"Next line":"Review the plans"}<ArrowRight size={15}/></button></div></div><div className="debate-dialogue"><div className="now-speaking" style={{"--voice":speaker?districtInfo[speaker].color:"#bca7d1"} as CSSProperties}>{speaker&&<VoiceIcon d={speaker} size={36} speaking={auto&&!asking}/>}<span><small>{asking&&question!==null?"ANSWERING YOUR QUESTION":`LINE ${line+1} OF ${args.length}`}</small><b>{speaker?districtInfo[speaker].name:"Your voices"}</b></span><button className="secondary small" onClick={()=>setAuto(!auto)} aria-pressed={auto}>{auto?<Pause size={13}/>:<Play size={13}/>} {auto?"Pause":"Auto-play"}</button></div><blockquote className="debate-current-line">{asking&&question!==null?askText():current?.text}</blockquote><details className="debate-ask-details"><summary>Ask a voice</summary><div className="stage-question-voices">{districts.map(d=><button key={d} onClick={()=>{setAsking(d);setQuestion(null);setAuto(false);}}><VoiceIcon d={d} size={21}/>{districtInfo[d].name}</button>)}</div>{asking&&<div className="ask-questions">{["Why do you care today?","What would your plan mean?"].map((q,i)=><button className="text-button" key={q} onClick={()=>setQuestion(i)}>{q}</button>)}</div>}</details></div></>}
      {phase==="intervention"&&<><h2>How should today look?</h2><p className="stage-lede">Keep these plans, or adjust the time. The residents vote next.</p><ScenarioPlanCards scenario={scenario} input={input} assessments={evaluation.value?.result.assessments??[]} onChange={update}/><button className="text-button" onClick={()=>go("clarify")}>Change the details</button><div className="stage-action"><button className="cosmic-primary" disabled={!evaluation.value||evaluation.value.winner===null} onClick={freeze}>Keep these plans · Start the vote<ArrowRight size={15}/></button>{evaluation.value?.winner===null&&<small>No plan fits yet. Check the time and required details.</small>}</div></>}
      {phase==="voting"&&frozen&&<><div className="broadcast-head"><span className={`live-tag ${revealed===24?"is-final":""}`}>{revealed===24?"FINAL":"COUNTING"}</span><b>{revealed} / {config.residentCount} ballots counted</b></div><h2>The residents are voting.</h2><div className="bars">{scenario.options.map((o,i)=><div className="bar-row" key={o.id} style={{"--plan":districtInfo[visualPlans[i].accent!].color} as CSSProperties}><span className="plan-number">{i+1}</span><div><b>{o.label}</b><span className="bar"><i style={{width:`${shownCounts[i]/24*100}%`}}/></span></div><strong>{shownCounts[i]}</strong></div>)}</div><div className="residents-grid" aria-label="Resident ballots">{order.map((i,k)=>{const b=frozen.ballots[i],on=k<revealed;return <button key={b.resident.id} className={on?"is-counted":""} disabled={!on} aria-label={on?`${b.resident.name}: ${b.choice===null?"Abstained":scenario.options[b.choice].label}`:`${b.resident.name}: not counted yet`} style={b.choice!==null?{"--plan":districtInfo[visualPlans[b.choice].accent!].color} as CSSProperties:undefined} onClick={()=>setResident(i)}><span className="resident-initials">{b.resident.name.slice(0,2)}</span>{on&&<small className="resident-plan-badge">{b.choice===null?"—":b.choice+1}</small>}</button>;})}</div>{resident!==null&&<div className="resident-card"><b>{frozen.ballots[resident].resident.name}</b><p>{frozen.ballots[resident].resident.background}</p><p>{frozen.ballots[resident].choice===null?"No confirmed plan fits yet.":`Chose ${scenario.options[frozen.ballots[resident].choice!].label}, the best score for these priorities.`}</p></div>}{revealed<24?<div className="stage-action split"><button className="secondary" onClick={()=>setCounting(!counting)}>{counting?"Pause count":"Resume count"}</button><button className="cosmic-primary" onClick={()=>setRevealed(24)}>Reveal all</button></div>:nextButton("See the winning plan","result")}</>}
      {phase==="result"&&winner&&frozen&&<><h2>{winner.label} wins, {frozen.counts[frozen.winner!]} of 24.</h2>{frozen.tied&&<p className="stage-note">The vote tied. The first listed tied plan wins under this voting rule.</p>}<p className="stage-lede">{winner.description}</p>{nextButton("Watch the plan unfold","consequences")}</>}
      {phase==="consequences"&&winner&&selectedVisual&&<><h2>{winner.label}, visualised.</h2><ParallelTimeline timeline={walkthrough} label="Plan preview" readout={`${Math.round(walkthrough.progress*frozen!.input.estimates[winner.id].minutes)} / ${frozen!.input.estimates[winner.id].minutes} min`}/><div className="scenario-result-art"><ScenarioArt frames={selectedVisual.frames} position={walkthrough.progress} running={walkthrough.playing} reduced={walkthrough.reduced}/></div><p>{winner.description}</p><p className="scenario-fit">Fits the confirmed time: {frozen!.input.estimates[winner.id].minutes} minutes. {selected?.spareMinutes} minutes left.</p>{nextButton("See your story","summary")}</>}
      {phase==="summary"&&winner&&<><h2>Your choice, in one breath.</h2><blockquote className="thought-quote">“{thought}”</blockquote><p><b>{winner.label}</b></p><p>{winner.description}</p>{nextButton("What if another plan had won?","branch")}</>}
      {phase==="branch"&&winner&&<><h2>What would you change?</h2><fieldset className="choice-set"><legend>Compare the elected plan with</legend><div className="chip-row">{scenario.options.filter(o=>o.id!==winner.id).map(o=><button key={o.id} aria-pressed={alternative===o.id} onClick={()=>setAlternative(o.id)}>{o.label}</button>)}</div></fieldset>{nextButton("Open Parallel Worlds","comparison",alternative===winner.id)}</>}
      {phase==="comparison"&&frozen&&winner&&<><h2>Compare your plans.</h2><ScenarioPlayback key={`${winner.id}:${alternative}`} scenarioId={scenarioId} confirmedInput={frozen.input} initialLeft={winner.id} initialRight={alternative} readOnlyContext onEditContext={()=>go("clarify")} onBack={()=>go("branch")}/>{nextButton("Reflect on these paths","closing")}</>}
      {phase==="closing"&&<><h2>One choice, different possibilities.</h2><p>{scenario.reflection}</p><button className="text-button" onClick={()=>go("math")}>Explore the mathematics behind the choice</button><div className="stage-action"><button className="cosmic-primary" onClick={onExit}>Start a new thought<ArrowRight size={15}/></button></div></>}
      {phase==="math"&&<><h2>The maths behind this choice.</h2><p>Each of the 24 residents weighs the four priorities differently. Only plans that fit the confirmed timing and required conditions can receive votes.</p><div className="table-wrap"><table><thead><tr><th>Plan</th>{districts.map(d=><th key={d}>{districtInfo[d].name}</th>)}<th>Votes</th></tr></thead><tbody>{election?.result.assessments.map((a,i)=><tr key={a.optionId}><th>{a.label}<small>{a.status}</small></th>{districts.map(d=><td key={d}>{a.scores[districtPriority[d]]}</td>)}<td>{frozen?frozen.counts[i]:"Not counted"}</td></tr>)}</tbody></table></div><p>Scores are authored comparison units. A resident’s score is the sum of each priority score multiplied by that resident’s preference weight. Equal scores use the first listed feasible plan.</p><button className="text-button" onClick={back}>Back to your choice</button></>}
      {evaluation.error&&<p className="stage-note" role="alert">{evaluation.error}</p>}
    </section>
  </>;
}

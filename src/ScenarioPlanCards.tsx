import { useState,type CSSProperties } from "react";
import type { Assessment,DecisionInput,Scenario } from "./engine";
import { districtInfo,type District } from "./simulation";
import VoiceIcon from "./VoiceIcon";

/** Reuse the original intervention cards without applying the presentation model to other choices. */
export default function ScenarioPlanCards({scenario,input,assessments,onChange}:{scenario:Scenario;input:DecisionInput;assessments:Assessment[];onChange:(input:DecisionInput)=>void}) {
  const [editing,setEditing]=useState<string|null>(null);
  const available=Math.max(0,input.availableMinutes-input.reservedMinutes);
  return <div className="plan-list">{scenario.options.map((option,i)=>{
    const assessment=assessments.find(a=>a.optionId===option.id);
    const minutes=input.estimates[option.id]?.minutes??0;
    const accent=(["A","C","D"] as District[])[i];
    const fits=assessment?.status==="feasible";
    return <article key={option.id} className="plan-card" aria-label={option.label} style={{"--plan":districtInfo[accent].color} as CSSProperties}>
      <header><VoiceIcon d={accent} size={38}/><div><span className="plan-step">PLAN {i+1}</span><b>{option.label}</b></div></header>
      <p className="scenario-card-description">{option.description}</p>
      <div className="plan-preview">
        <div className="visual-outcome" style={{"--outcome":districtInfo[accent].color} as CSSProperties}><span className="outcome-mark" aria-hidden="true">◷</span><div><b>{minutes} minutes planned</b><span className="plan-progress" role="progressbar" aria-label={`${option.label} time used`} aria-valuemin={0} aria-valuemax={Math.max(1,available,minutes)} aria-valuenow={minutes}><i style={{width:`${available>0?Math.min(100,minutes/available*100):0}%`}}/></span></div></div>
        <div className="visual-outcome" style={{"--outcome":fits?districtInfo.R.color:"#e4be8b"} as CSSProperties}><span className="outcome-mark" aria-hidden="true">{fits?"✓":"—"}</span><div><b>{fits?`${assessment.spareMinutes} minutes left`:assessment?.status==="conditional"?"Needs confirmation":"Doesn’t fit yet"}</b></div></div>
      </div>
      {editing===option.id&&<label className="inline-field">Total minutes<input autoFocus type="number" min="0" max="525600" aria-label={`${option.label} total minutes`} value={input.estimates[option.id]?.minutes??""} onChange={e=>{const estimates={...input.estimates};if(e.target.value==="")delete estimates[option.id];else estimates[option.id]={minutes:e.target.valueAsNumber,source:"user",includesTravelAndSetup:true};onChange({...input,estimates});}}/></label>}
      <button className="plan-edit-button" onClick={()=>setEditing(editing===option.id?null:option.id)}>{editing===option.id?"Done":"Adjust time"}</button>
      <details className="plan-forecast-details"><summary>Plan details</summary><p>{fits?"Fits the available time and confirmed details.":assessment?.reasons.join(" ")}</p><p>Time includes travel and preparation. Check the example duration before voting.</p></details>
    </article>;
  })}</div>;
}

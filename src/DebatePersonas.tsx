import type { CSSProperties } from "react";
import { districts, districtInfo, type District } from "./simulation";
import VoiceIcon from "./VoiceIcon";

export default function DebatePersonas({speaker,playing,answering=false,mood,onSelect}:{speaker:District|null;playing:boolean;answering?:boolean;mood?:"cheer"|"sigh";onSelect:(d:District)=>void}) {
  const speakerIndex=speaker?districts.indexOf(speaker):-1;
  return <div className="debate-personas" role="group" aria-label="Your inner voices">{districts.map((d,i)=>{
    const active=speaker===d;
    const status=active?(answering?"Answering":playing?"Speaking":"Paused"):"Listening";
    return <button key={d} className={`debate-persona ${active?"persona-active":"persona-listening"} ${active&&mood?`persona-${mood}`:""}`} style={{"--persona":districtInfo[d].color,"--attention":`${active||speakerIndex<0?0:i<speakerIndex?4:-4}deg`} as CSSProperties} onClick={()=>onSelect(d)} aria-label={`Talk to ${districtInfo[d].name}`} aria-pressed={active}>
      <span className="persona-stage" aria-hidden="true"><i className="persona-spotlight"/><span className={`persona-performer ${active&&(playing||answering)?"performer-speaking":""}`}><VoiceIcon d={d} size={57} speaking={active&&(playing||answering)}/></span><i className="persona-floor"/></span>
      <strong>{districtInfo[d].name}</strong><small><i/>{status}</small>
    </button>;
  })}</div>;
}

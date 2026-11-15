import ParallelTimeline,{playbackPhase,useParallelTimeline} from "./ParallelTimeline";
import EverydayScene from "./EverydayScene";
import { activityAt,activityCopy } from "./planPlayback";
import type { Config,Round } from "./simulation";

export default function DayPlayback({round,rules}:{round:Round;rules:Config}) {
  const timeline=useParallelTimeline(rules.dailyBudget*1500,0);
  const position=timeline.progress*rules.dailyBudget;
  const phase=playbackPhase(timeline.progress);
  const readout=timeline.progress===0?"Before the day":timeline.progress===1?"End of the day":{morning:"Morning",midday:"Afternoon",evening:"Evening"}[phase];
  return <div className="day-playback parallel-cinema" data-day-phase={phase}>
    <ParallelTimeline timeline={timeline} label={`Day ${round.before.day}`} readout={readout} single/>
    <div className="playback-scene"><EverydayScene round={round} rules={rules} position={position} running={timeline.playing} reduced={timeline.reduced} solo={null}/></div>
    <p className="playback-outcome">{timeline.progress===1?`That's the day under ${round.policy.name}.`:activityCopy(activityAt(round,position),round,rules)}</p>
  </div>;
}

import type { CSSProperties } from "react";
import { districtInfo, districts, forecast, taskText, type Config, type District, type Policy, type State } from "./simulation";
import VoiceIcon from "./VoiceIcon";

export const timeLabels: Record<District, string> = { A: "Work", C: "Friends", D: "Ideas", R: "Rest" };

export function TimeBlocks({ policy, budget }: { policy: Policy; budget: number }) {
  const blocks = districts.flatMap((d) => Array.from({ length: policy.allocation[d] }, () => d));
  return <div className="visual-time" role="img" aria-label={districts.map((d) => `${policy.allocation[d]} ${timeLabels[d].toLowerCase()} blocks`).join(", ")}>
    {Array.from({ length: budget }, (_, i) => <span key={i} className={blocks[i] ? "time-slot is-filled" : "time-slot"} style={blocks[i] ? { "--slot": districtInfo[blocks[i]].color } as CSSProperties : undefined} title={blocks[i] ? timeLabels[blocks[i]] : "Free block"}>{blocks[i] ? <VoiceIcon d={blocks[i]} size={21} /> : <span>+</span>}</span>)}
  </div>;
}

function Progress({ before, after, goal, label }: { before: number; after: number; goal: number; label: string }) {
  return <span className="plan-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(goal, after)}>
    <i style={{ width: `${Math.min(100, after / goal * 100)}%` }} /><i className="progress-before" style={{ width: `${Math.min(100, before / goal * 100)}%` }} />
  </span>;
}

export default function PlanPreview({ state, policy, rules: c }: { state: State; policy: Policy; rules: Config }) {
  const f = forecast(state, policy, c);
  const taskReady = state.taskProgress + f.taskGain >= c.taskGoal;
  const visitReady = state.connectionProgress + f.connectionGain >= c.connectionGoal;
  const main = taskReady ? taskText(c, "Presentation ready") : f.taskGain > 0 ? taskText(c, "Presentation moves forward") : taskText(c, "No presentation progress");
  return <div className="plan-preview">
    <div className="visual-outcome" style={{ "--outcome": districtInfo.A.color } as CSSProperties}>
      <span className="outcome-mark" aria-hidden="true">{taskReady ? "✓" : f.taskGain > 0 ? "↗" : "—"}</span><div><b>{main}</b><Progress before={state.taskProgress} after={state.taskProgress + f.taskGain} goal={c.taskGoal} label={`Expected ${c.taskType} progress`} /></div>
    </div>
    {c.connectionLastOpenDay > 0 && state.day <= c.connectionLastOpenDay && <div className="visual-outcome" style={{ "--outcome": districtInfo.C.color } as CSSProperties}>
      <span className="outcome-mark" aria-hidden="true">{visitReady ? "♡" : f.connectionGain > 0 ? "◐" : "—"}</span><div><b>{visitReady ? "Time for your friend" : f.connectionGain > 0 ? "Some time for your friend" : "No time for the visit"}</b><Progress before={state.connectionProgress} after={state.connectionProgress + f.connectionGain} goal={c.connectionGoal} label="Expected visit progress" /></div>
    </div>}
    <div className="visual-outcome" style={{ "--outcome": districtInfo.R.color } as CSSProperties}>
      <span className="outcome-mark" aria-hidden="true">{f.energyDelta > 0 ? "↑" : f.energyDelta < 0 ? "↓" : "≈"}</span><div><b>{f.energyDelta > 0.001 ? "More energy left" : f.energyDelta < -0.001 ? "Less energy left" : "Energy stays steady"}</b><Progress before={state.energy} after={state.energy + f.energyDelta} goal={c.energyCap} label="Expected energy remaining" /></div>
    </div>
    {f.methodGain > 0 && <span className="method-hint">✧ {state.day < c.taskDeadlineDay ? "Makes future work easier" : "Better method, after the deadline"}</span>}
  </div>;
}

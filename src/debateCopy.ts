import { fmt, forecast, type Config, type Policy, type State } from "./simulation";
import type { Line } from "./dialogue";

/** The main stage explains the same model; exact authored calculations stay in history. */
export function conversationLine(line:Line,start:State,policies:Policy[],rules:Config):string {
  const chosen=line.policy===undefined?undefined:policies[line.policy];
  const result=chosen?forecast(start,chosen,rules):undefined;
  const work=policies.reduce((best,p)=>p.allocation.A>best.allocation.A?p:best,policies[0]);
  if(line.speaker==="A"&&chosen&&result){
    if(start.taskProgress>=rules.taskGoal)return `Your ${rules.taskType} is already finished. We can focus on what else needs attention.`;
    const progress=start.taskProgress+result.taskGain>=rules.taskGoal?`It could finish your ${rules.taskType} today.`:`It adds ${fmt(result.taskGain, 2)} points to your ${rules.taskType} today.`;
    return `I'd back ${chosen.name}. ${progress}${start.day===rules.taskDeadlineDay?" Today is the deadline.":""}`;
  }
  if(line.speaker==="C"){
    if(rules.connectionLastOpenDay===0)return "No visit is competing for time today. I'm listening to what the others need.";
    if(start.day>rules.connectionLastOpenDay)return "The visit has ended. Let's focus on the choices we still have.";
    if(chosen?.allocation.C===0)return "No current plan leaves time for the visit. We can change one before voting.";
    if(chosen && result)return work.allocation.C===0?`That leaves no time to spend together. ${chosen.name} adds ${fmt(result.connectionGain, 2)} visit points.`:`We can make progress and still spend time together. ${chosen.name} adds ${fmt(result.connectionGain, 2)} visit points.`;
    return line.text;
  }
  if(line.speaker==="R"&&chosen&&result){
    const alternative=forecast(start,work,rules);
    if(chosen.id!==work.id&&result.energyDelta>alternative.energyDelta)return `${work.name} takes more out of us. ${chosen.name} leaves more energy for what comes next.`;
    return result.energyDelta>0?`${chosen.name} gives us a chance to recover some energy.`:result.energyDelta<0?`${chosen.name} uses some of our energy. Let's be careful about what we take on next.`:`${chosen.name} keeps our energy steady.`;
  }
  if(line.speaker==="D"){
    if(!chosen)return "No plan makes time to try a better approach. We could adjust one.";
    if(result?.methodGain === 0)return "Changing the method won't improve our pace any further today.";
    if(start.day>=rules.taskDeadlineDay)return `${chosen.name} invests in an easier way to work, but the benefit comes after this deadline.`;
    return `${chosen.name} adds ${fmt(result?.methodGain ?? 0, 2)}× to the work method from tomorrow.`;
  }
  if(line.speaker==="N")return "We've heard the trade-offs. You can adjust the plans before the residents vote.";
  return line.text;
}

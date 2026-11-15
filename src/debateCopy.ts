import { forecast,type Config,type District,type Policy,type State } from "./simulation";
import type { Line } from "./dialogue";

/** Person-facing explanations of the same forecasts used by the election. */
export function conversationLine(line:Line,start:State,policies:Policy[],rules:Config):string {
  const chosen=line.policy===undefined?undefined:policies[line.policy];
  const result=chosen?forecast(start,chosen,rules):undefined;
  const work=policies.reduce((best,p)=>p.allocation.A>best.allocation.A?p:best,policies[0]);
  if(line.speaker==="A"&&chosen&&result){
    if(start.taskProgress>=rules.taskGoal)return `Your ${rules.taskType} is already finished. You can focus on what else needs attention.`;
    const progress=start.taskProgress+result.taskGain>=rules.taskGoal?`It could help you finish your ${rules.taskType} today.`:result.taskGain>0?`It gives you time to move your ${rules.taskType} forward, though there would still be work left.`:`It doesn't leave time to move your ${rules.taskType} forward today.`;
    return `I'd back ${chosen.name}. ${progress}${start.day===rules.taskDeadlineDay?" It's due tonight.":""}`;
  }
  if(line.speaker==="C"){
    if(rules.connectionLastOpenDay===0)return "No visit is competing for your time today. I'm listening to what else matters to you.";
    if(start.day>rules.connectionLastOpenDay)return "The visit has ended. Let's focus on the choices you still have.";
    if(start.connectionProgress>=rules.connectionGoal)return "You've already made time together. You can give the other parts of your day some attention too.";
    if(chosen?.allocation.C===0)return "None of these plans leaves time together. You can change one before voting.";
    const urgency=start.day===rules.connectionLastOpenDay?" This is your last chance to meet before they leave.":"";
    return work.allocation.C===0?`${work.name} leaves no time together. I'd choose ${chosen?.name} so you can see your friend.${urgency}`:`You can move your work forward and still make time for your friend. I'd choose ${chosen?.name}.${urgency}`;
  }
  if(line.speaker==="R"&&chosen&&result){
    const alternative=forecast(start,work,rules);
    if(chosen.id!==work.id&&result.energyDelta>alternative.energyDelta)return `${work.name} asks more of you. ${chosen.name} leaves you more energy for what comes next.`;
    return result.energyDelta>0?`${chosen.name} gives you a chance to recover.`:result.energyDelta<0?`${chosen.name} could leave you more tired. Let's be careful about what you take on next.`:`${chosen.name} balances what you do with time to recover.`;
  }
  if(line.speaker==="D"){
    if(!chosen)return "None of these plans leaves room to try a different approach. You could adjust one.";
    if(result?.methodGain===0)return "Spending more time changing your approach wouldn't make the work easier right now.";
    if(start.day>=rules.taskDeadlineDay)return `${chosen.name} makes room to find an easier way to work, but the benefit comes after this deadline.`;
    return `${chosen.name} gives you time to try an approach that could make tomorrow's work easier. It takes time away from doing the work today.`;
  }
  return "You've heard what each choice means for your day. You can adjust the plans before the residents vote.";
}

export function conversationAnswer(d:District,q:number,start:State,policies:Policy[],rules:Config):string {
  const forecasts=policies.map(p=>forecast(start,p,rules));
  const values=policies.map((p,i)=>d==="R"?forecasts[i].energyDelta:p.allocation[d]);
  const backed=values.indexOf(Math.max(...values)),chosen=policies[backed];
  if(q===0){
    if(d==="A")return start.taskProgress>=rules.taskGoal?`Your ${rules.taskType} is finished. I don't want you to feel you have to keep working for its own sake.`:`I want you to have enough time for your ${rules.taskType} before ${start.day===rules.taskDeadlineDay?"tonight's deadline":"the deadline"}, rather than leave it all to the last minute.`;
    if(d==="C")return rules.connectionLastOpenDay===0?"There's no visit planned. I won't assume someone else needs your time.":start.day>rules.connectionLastOpenDay?"The visit has passed. I'm thinking about the choices that are still open to you.":start.day===rules.connectionLastOpenDay?"Your friend leaves tonight. Time together is a chance you won't be able to move to tomorrow.":"You still have a chance to see your friend. I want that to have a place alongside your work.";
    if(d==="D")return start.method>=rules.methodCap?"Your current approach is already working as well as this model allows. More experimenting wouldn't help here.":"A different approach could make future work easier. But learning it takes time, so it needs to earn its place in your day.";
    return "Your energy matters too. I want you to have time to recover, rather than plan as if you can keep going without a break.";
  }
  const own=forecasts[backed];
  const gaps=[
    {value:(i:number)=>forecasts[i].taskGain-own.taskGain,text:`less progress on your ${rules.taskType}`},
    {value:(i:number)=>forecasts[i].connectionGain-own.connectionGain,text:"less time together"},
    {value:(i:number)=>forecasts[i].energyDelta-own.energyDelta,text:"less energy left for what comes next"},
    {value:(i:number)=>(forecasts[i].methodGain-own.methodGain)*20,text:"less time invested in an easier way to work"},
  ].map(g=>({...g,index:policies.reduce((best,_,i)=>g.value(i)>g.value(best)?i:best,0)})).filter(g=>g.value(g.index)>.001).sort((a,b)=>b.value(b.index)-a.value(a.index));
  if(!gaps.length)return `${chosen.name} doesn't give up anything the other plans offer in this comparison. That doesn't mean it guarantees how your day will feel.`;
  const gap=gaps[0];
  return `I'd choose ${chosen.name}, but it means ${gap.text} than ${policies[gap.index].name}. That's the trade-off I want you to see.`;
}

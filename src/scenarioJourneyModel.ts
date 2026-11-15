import { evaluateDecision,getScenario,type DecisionInput,type Priority } from "./engine";
import { config,residents,type District,type Policy } from "./simulation";

export const priorityDistrict:Record<Priority,District>={achievement:"A",connection:"C",discovery:"D",recovery:"R"};
export const districtPriority:Record<District,Priority>={A:"achievement",C:"connection",D:"discovery",R:"recovery"};
const timings:Record<string,number[]>={"family-time":[60,15],"family-deadline":[120,120,120],"test-and-invitation":[120,120,120],"shift-and-coursework":[180,120,150],"hackathon-scope":[90,60,75],"study-format":[60,60,75],"new-tool":[90,120,120],"help-moving":[120,90,120],"drained-invitation":[90,60,60],"team-boundaries":[120,90,90],"scrolling-break":[15,25,15],"new-club":[90,60,60],"housemate-conversation":[20,30,10],"polish-or-submit":[15,45,30],"two-invitations":[120,120,150]};
export function scenarioInput(id:string,thought:string):DecisionInput {
  const scenario=getScenario(id),durations=timings[id]??[60,90,75];
  const facts:DecisionInput["facts"]={};
  // Only unambiguous assertions prefill facts. Missing answers remain unknown.
  // Being finished does not establish that submission checks passed. Ask rather than infer.
  return {scenarioId:id,availableMinutes:Math.max(120,...durations),reservedMinutes:0,facts,estimates:Object.fromEntries(scenario.options.map((o,i)=>[o.id,{minutes:durations[i],source:"hypothetical" as const,includesTravelAndSetup:true as const}]))};
}
export function scenarioElection(input:DecisionInput) {
  const result=evaluateDecision(input),scenario=getScenario(input.scenarioId);
  const viable=result.assessments.filter(a=>a.status==="feasible");
  const people=residents(config);
  const ballots=people.map(resident=>{
    const utilities=scenario.options.map(o=>{const a=viable.find(a=>a.optionId===o.id);return a?Object.entries(districtPriority).reduce((sum,[d,p])=>sum+resident.weights[d as District]*a.scores[p],0):null;});
    const best=Math.max(...utilities.filter((v):v is number=>v!==null));
    const choice=utilities.findIndex(v=>v!==null&&Math.abs(v-best)<1e-10);
    return {resident,utilities,choice:choice<0?null:choice};
  });
  const counts=scenario.options.map((_,i)=>ballots.filter(b=>b.choice===i).length),highest=Math.max(...counts);
  const winner=highest>0?counts.indexOf(highest):null;
  return {result,ballots,counts,winner,tied:winner!==null&&counts.filter(n=>n===highest).length>1,abstentions:ballots.filter(b=>b.choice===null).length};
}
/** Native stage labels and palette only; zero allocations never enter the daily simulator. */
export function scenarioStagePlans(id:string):Policy[] {
  return getScenario(id).options.map((o,i)=>({id:o.id,name:o.label,description:o.description,accent:(["A","C","D"] as District[])[i],allocation:{A:0,C:0,D:0,R:0}}));
}

import { describe,it,expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { getScenario,evaluateDecision,type DecisionInput } from "../src/engine";
import { assessedVisual,inheritedScenarioFacts } from "../src/scenarioVisuals";
import { judgeSetup,createWorld,setupForThought } from "../src/simulation";
import { introLine } from "../src/dialogue";
import ScenarioPlayback from "../src/ScenarioPlayback";

function inputFor(id:string):DecisionInput {
 const s=getScenario(id);
 return {scenarioId:id,availableMinutes:240,reservedMinutes:0,facts:{},estimates:Object.fromEntries(s.options.map(o=>[o.id,{minutes:60,source:"user",includesTravelAndSetup:true}]))};
}
describe("scene and context agreement",()=>{
 it.each(["My assignment is nearly done","No friends to visit, just my project","My visit is cancelled"])("does not invent a visit from %s",thought=>{
  const setup=setupForThought(thought,judgeSetup);
  expect(setup.visitLastDay).toBe(0);
  expect(introLine("C",createWorld(setup).rules)).toBe("No visit is competing for time today.");
 });
 it("carries a confirmed no-visit answer into catalogue art and eligibility",()=>{
  const {rules}=createWorld({...judgeSetup,visitLastDay:0});
  const input=inputFor("presentation-and-visit");
  input.facts=inheritedScenarioFacts(input.scenarioId,rules,1);
  expect(input.facts.visitAvailable.value).toBe(false);
  const result=evaluateDecision(input);
  for(const id of ["visit","split"]){
   const assessment=result.assessments.find(a=>a.optionId===id)!;
   expect(assessment.status).toBe("infeasible");
   const scene=assessedVisual(input.scenarioId,id,assessment);
   expect(scene.blocked).toBe(true);
   expect(scene.frames.every(f=>f.file==="empty.png")).toBe(true);
  }
  const html=renderToStaticMarkup(createElement(ScenarioPlayback,{scenarioId:input.scenarioId,onBack:()=>{},initialFacts:input.facts}));
  expect(html).toContain("empty.png");
  expect(html).not.toContain('aria-label="Meeting while the visit is possible"');
 });
 it("waits for unknown requirements and enables art only when they are confirmed",()=>{
  const input=inputFor("presentation-and-visit");
  let assessment=evaluateDecision(input).assessments.find(a=>a.optionId==="visit")!;
  expect(assessment.status).toBe("conditional");
  expect(assessedVisual(input.scenarioId,"visit",assessment).blocked).toBe(true);
  input.facts.visitAvailable={value:true,source:"user"};
  assessment=evaluateDecision(input).assessments.find(a=>a.optionId==="visit")!;
  expect(assessedVisual(input.scenarioId,"visit",assessment).blocked).toBe(false);
 });
});
describe("context-based scrolling",()=>{
 it("has no predetermined better or worse option without answers",()=>{
  const result=evaluateDecision(inputFor("scrolling-break"));
  expect(result.abstentions).toBe(4);
  expect(result.assessments.every(a=>Object.values(a.scores).every(n=>n===0))).toBe(true);
 });
 it("can favour scrolling as restorative and social, while a deadline favours starting work",()=>{
  const input=inputFor("scrolling-break");
  input.facts={restorative:{value:true,source:"user"},socialConnection:{value:true,source:"user"},urgent:{value:true,source:"user"}};
  const result=evaluateDecision(input);
  expect(result.ballots.find(b=>b.resident==="recovery")!.choice).toBe("continue");
  expect(result.ballots.find(b=>b.resident==="connection")!.choice).toBe("continue");
  expect(result.ballots.find(b=>b.resident==="achievement")!.choice).toBe("restart");
 });
 it("does not infer that another break is restorative without the user saying so",()=>{
  const input=inputFor("scrolling-break");
  input.facts.restorative={value:false,source:"user"};
  const result=evaluateDecision(input);
  expect(result.assessments.find(a=>a.optionId==="different")!.scores.recovery).toBe(0);
 });
});

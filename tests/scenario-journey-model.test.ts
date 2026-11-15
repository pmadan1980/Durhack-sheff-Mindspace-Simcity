import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,it,expect } from "vitest";
import { listScenarios } from "../src/engine";
import { scenarioInput,scenarioElection,scenarioStagePlans } from "../src/scenarioJourneyModel";
import ScenarioPlayback from "../src/ScenarioPlayback";
import { assessedVisual } from "../src/scenarioVisuals";
import { inferTaskType,setupForThought,judgeSetup } from "../src/simulation";

describe("scenario-aware guided journey",()=>{
  it.each(listScenarios().filter(s=>s.id!=="presentation-and-visit"))("uses the $id facts and options for all 24 votes and the pictures",scenario=>{
    const input=scenarioInput(scenario.id,scenario.example);
    input.facts=Object.fromEntries(Object.keys(scenario.questions).map(key=>[key,{value:true,source:"user" as const}]));
    const elected=scenarioElection(input);
    expect(elected.ballots).toHaveLength(24);
    expect(elected.counts.reduce((a,b)=>a+b,0)+elected.abstentions).toBe(24);
    expect(elected.winner).not.toBeNull();
    for(const ballot of elected.ballots){
      expect(ballot.choice).not.toBeNull();
      expect(ballot.utilities[ballot.choice!]).toBe(Math.max(...ballot.utilities.filter((v):v is number=>v!==null)));
      expect(elected.result.assessments[ballot.choice!].status).toBe("feasible");
    }
    expect(scenarioStagePlans(scenario.id).map(p=>p.id)).toEqual(scenario.options.map(o=>o.id));
    const confirmed={...input,estimates:Object.fromEntries(Object.entries(input.estimates).map(([id,v])=>[id,{...v,source:"user" as const}]))};
    const html=renderToStaticMarkup(createElement(ScenarioPlayback,{scenarioId:scenario.id,confirmedInput:confirmed,readOnlyContext:true,initialLeft:scenario.options[elected.winner!].id,initialRight:scenario.options.find((_,i)=>i!==elected.winner)!.id,onBack:()=>{}}));
    expect(html).not.toContain("Example assumptions");
    expect(html).not.toContain("Adjust timing and details");
  });
  it("does not invent availability or vote for a blocked family plan",()=>{
    const input=scenarioInput("family-time","I want to spend time with family.");
    expect(input.facts).toEqual({});
    input.facts.availableNow={value:false,source:"user"};
    const result=scenarioElection(input);
    expect(result.counts[0]).toBe(0);
    expect(assessedVisual(input.scenarioId,"together",result.result.assessments[0]).blocked).toBe(true);
  });
  it("has no fake election if every option exceeds the available time",()=>{
    const input=scenarioInput("scrolling-break","Scrolling but I have work to do");
    input.availableMinutes=0;
    const result=scenarioElection(input);
    expect(result.winner).toBeNull();expect(result.abstentions).toBe(24);
  });
  it("keeps replies consistent with the same confirmed fact as the opening",()=>{
    const input=scenarioInput("test-and-invitation","My friend invited me out but I have an exam tomorrow.");
    input.facts={prepared:{value:false,source:"user"},restorative:{value:true,source:"user"},canLeaveEarly:{value:true,source:"user"}};
    const result=scenarioElection(input);
    const recovery=result.result.arguments.filter(a=>a.resident==="recovery");
    expect(recovery.length).toBeGreaterThan(1);
    expect(recovery.every(a=>a.text.includes("restorative"))).toBe(true);
    expect(recovery.every(a=>!a.text.includes("unknown"))).toBe(true);
  });
  it("keeps ordinary conversation distinct from giving a presentation",()=>{
    expect(inferTaskType("My housemate leaves the kitchen messy and I want to talk.")).toBe("task");
    expect(inferTaskType("I need to give a talk tomorrow")).toBe("presentation");
  });
  it("keeps an explicitly tomorrow visit open through tomorrow",()=>{
    expect(setupForThought("My presentation is due soon and my friend leaves tomorrow.",judgeSetup).visitLastDay).toBe(2);
  });
});

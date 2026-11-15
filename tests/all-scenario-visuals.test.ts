import { existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it } from "vitest";
import { listScenarios } from "../src/engine";
import { scenarioVisuals,taskArtwork,visualFor } from "../src/scenarioVisuals";
import { taskTypes } from "../src/simulation";
import ScenarioPlayback from "../src/ScenarioPlayback";
import { initialJourney,journeyReducer,previousScene } from "../src/journey";
import { judgeSetup } from "../src/simulation";

describe("complete visual catalogue",()=>{
  it("covers every situation, every option, and every task type with existing assets",()=>{
    const scenarios=listScenarios();
    expect(Object.keys(scenarioVisuals).sort()).toEqual(scenarios.map(s=>s.id).sort());
    for(const s of scenarios){
      expect(Object.keys(scenarioVisuals[s.id]).sort()).toEqual(s.options.map(o=>o.id).sort());
      for(const o of s.options) for(const f of visualFor(s.id,o.id)){
        expect(f.action.length).toBeGreaterThan(0);
        expect(existsSync(new URL(`../public/art/parallel-clay/${f.file}`,import.meta.url))).toBe(true);
      }
    }
    for(const t of taskTypes) expect(existsSync(new URL(`../public/art/parallel-clay/${taskArtwork[t].file}`,import.meta.url))).toBe(true);
  });
  it.each(listScenarios())("renders $id without losing its actual choice labels",scenario=>{
    const html=renderToStaticMarkup(createElement(ScenarioPlayback,{scenarioId:scenario.id,onBack:()=>{}}));
    for(const option of scenario.options) expect(html).toContain(option.id);
    expect(html).toContain("Example assumptions");
    expect(html).not.toContain("NaN");
  });
});

describe("Back navigation",()=>{
  it("returns from comparison to its plan choice without changing the world",()=>{
    const j={...initialJourney(judgeSetup),scene:"comparison" as const};
    const before=JSON.stringify(j.world);
    expect(previousScene(j)).toBe("branch");
    const back=journeyReducer(j,{type:"back",from:"comparison"});
    expect(back.scene).toBe("branch");
    expect(JSON.stringify(back.world)).toBe(before);
    expect(journeyReducer(back,{type:"back",from:"comparison"})).toBe(back);
  });
  it("can revisit the previous day's reflection without resolving again",()=>{
    let j=initialJourney(judgeSetup);
    j=journeyReducer(j,{type:"begin",setup:judgeSetup});
    for(const from of ["clarify","briefing","introductions","debate","intervention"] as const)j=journeyReducer(j,{type:"advance",from});
    j=journeyReducer(j,{type:"revealAll"});
    for(const from of ["voting","result","consequences","reflection"] as const)j=journeyReducer(j,{type:"advance",from});
    const before=JSON.stringify(j.world);
    expect(j.scene).toBe("briefing");
    j=journeyReducer(j,{type:"back",from:"briefing"});
    expect(j.scene).toBe("reflection");
    expect(j.locked?.day).toBe(1);
    expect(JSON.stringify(j.world)).toBe(before);
  });
});

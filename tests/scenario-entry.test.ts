import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { listScenarios, routeThought } from "../src/engine";
import ScenarioPlayback from "../src/ScenarioPlayback";
import { initialJourney, journeyReducer, previousScene, worldSteps } from "../src/journey";
import { judgeSetup } from "../src/simulation";

describe("scenario entry", () => {
  it.each(listScenarios())("routes the $id example to its own questions", scenario => {
    expect(routeThought(scenario.example).candidates.map(s => s.id)).toContain(scenario.id);
    const html = renderToStaticMarkup(createElement(ScenarioPlayback, {scenarioId:scenario.id, setupFirst:true, onBack:()=>{}}));
    for (const question of Object.values(scenario.questions)) expect(html).toContain(question.replaceAll("&", "&amp;"));
    expect(html).not.toContain("Is a visit competing for your time?");
    expect(html).not.toContain('aria-label="Scenario playback controls"');
    expect(html).not.toContain('value="120"');
  });
  it("recognises the exact scrolling report without inventing a visit", () => {
    expect(routeThought("Scrolling but I have work to do").candidates.map(s=>s.id)).toEqual(["scrolling-break"]);
    const html=renderToStaticMarkup(createElement(ScenarioPlayback,{scenarioId:"scrolling-break",setupFirst:true,onBack:()=>{}}));
    expect(html).toContain("Is this scrolling break helping you recharge?");
    expect(html).not.toMatch(/friend|presentation|visit/i);
  });
  it("goes from comparison to reflection with a matching back button", () => {
    const start={...initialJourney(judgeSetup),scene:"comparison" as const};
    const end=journeyReducer(start,{type:"advance",from:"comparison"});
    expect(end.scene).toBe("closing");
    expect(previousScene(end)).toBe("comparison");
    expect(worldSteps.some(step=>step.scene==="listen")).toBe(false);
  });
});

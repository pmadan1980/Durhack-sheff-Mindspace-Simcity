import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { listScenarios, routeThought } from "../src/engine";
import ScenarioPlayback from "../src/ScenarioPlayback";
import { initialJourney, journeyReducer, previousScene, worldSteps } from "../src/journey";
import { judgeSetup, setupForThought } from "../src/simulation";

describe("scenario entry", () => {
  it.each(listScenarios())("routes the $id example to an immediate comparison with its own questions", scenario => {
    expect(routeThought(scenario.example).candidates.map(s => s.id)).toEqual([scenario.id]);
    const html = renderToStaticMarkup(createElement(ScenarioPlayback, {scenarioId:scenario.id, onBack:()=>{}}));
    for (const question of Object.values(scenario.questions)) expect(html).toContain(question.replaceAll("&", "&amp;"));
    expect(html).toContain('aria-label="Scrub through both paths"');
    expect(html).toContain("Example assumptions");
    expect(html).toContain('aria-label="First plan"');
    expect(html).toContain('<details class="scenario-inputs"><summary>Adjust timing and details (optional)');
  });
  it("recognises the exact scrolling report without inventing a visit", () => {
    expect(routeThought("Scrolling but I have work to do").candidates.map(s=>s.id)).toEqual(["scrolling-break"]);
    const html=renderToStaticMarkup(createElement(ScenarioPlayback,{scenarioId:"scrolling-break",onBack:()=>{}}));
    expect(html).toContain("Is this scrolling break helping you recharge?");
    expect(html).not.toMatch(/friend|presentation|visit/i);
  });
  it("keeps family time and family deadlines separate from break scenarios", () => {
    expect(routeThought("time with family").candidates.map(s => s.id)).toEqual(["family-time"]);
    expect(setupForThought("time with family", judgeSetup).visitLastDay).toBeGreaterThan(0);
    expect(setupForThought("My family dinner was cancelled", judgeSetup).visitLastDay).toBe(0);
    expect(routeThought("Dinner with my parents but I have an assignment due").candidates.map(s => s.id)).toEqual(["family-deadline"]);
    expect(routeThought("I am thinking about tomorrow").status).toBe("unsupported");
  });
  it("goes from comparison to reflection with a matching back button", () => {
    const start={...initialJourney(judgeSetup),scene:"comparison" as const};
    const end=journeyReducer(start,{type:"advance",from:"comparison"});
    expect(end.scene).toBe("closing");
    expect(previousScene(end)).toBe("comparison");
    expect(worldSteps.some(step=>step.scene==="listen")).toBe(false);
  });
});

import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import JourneyStage from "../src/GuidedJourney";
import { initialJourney, journeyReducer } from "../src/journey";
import { debate } from "../src/dialogue";
import { judgeSetup, setupForThought, taskTypes, taskText } from "../src/simulation";

const noop = () => {};
function renderQuestions(taskType: typeof taskTypes[number]) {
  const setup = { ...judgeSetup, taskType };
  const journey = journeyReducer(initialJourney(setup), { type: "begin", setup });
  const props: ComponentProps<typeof JourneyStage> = {
    journey, dispatch: noop, thought: "", soundOn: false, solo: null,
    onSound: noop, onListen: noop, listening: false, onSolo: noop,
    onSpeaker: noop, onFocus: noop, onExplore: noop, onObservatory: noop,
    onRestart: noop, onBranch: noop, onReact: noop, horizon: null,
    unfold: 0, onUnfold: noop,
  };
  return renderToStaticMarkup(createElement(JourneyStage, props));
}

describe("scenario-aware frontend options", () => {
  it.each(taskTypes)("keeps %s questions, options and dialogue in sync", (taskType) => {
    const html = renderQuestions(taskType);
    expect(html).toContain(`When is the ${taskType} due?`);
    expect(html).toContain(`How far along is the ${taskType}?`);
    expect(html).toContain(`No, just the ${taskType}`);
    expect(html).toContain(`<option value="${taskType}" selected="">`);
    const setup = { ...judgeSetup, taskType };
    const j = initialJourney(setup);
    const lines = debate(j.world.state, j.world.proposals, j.world.rules).map((l) => l.text).join(" ");
    expect(lines).toContain(taskType);
    if (taskType !== "presentation") expect(lines).not.toMatch(/\bpresentation\b/i);
    expect(taskText(j.world.rules, "Presentation points")).toBe(`${taskType[0].toUpperCase()}${taskType.slice(1)} points`);
  });
  it("suggests assignment from the user's sentence and permits correcting it", () => {
    const setup = setupForThought("My assignment is nearly done, but I'm exhausted and my friend is leaving tonight.", judgeSetup);
    expect(setup.taskType).toBe("assignment");
    let j = journeyReducer(initialJourney(setup), { type: "begin", setup });
    j = journeyReducer(j, { type: "assume", setup: { ...setup, taskType: "report" } });
    expect(j.world.rules.taskType).toBe("report");
    expect(j.setup.taskType).toBe("report");
    expect(setupForThought("I need to prepare for my exam", judgeSetup).taskType).toBe("exam preparation");
    expect(setupForThought("Something unfamiliar", judgeSetup).taskType).toBe("task");
  });
});


it("suggests a deadline without treating a friend mentioned in passing as a visit", () => {
  const setup = setupForThought("My friend helped with my coursework. It is due tomorrow and I am not tired.", judgeSetup);
  expect(setup).toMatchObject({ taskType: "assignment", taskDeadlineDay: 2, visitLastDay: 0, energy: judgeSetup.energy });
  expect(setupForThought("My slides are due tonight, but my friend is only here today.", judgeSetup))
    .toMatchObject({ taskType: "presentation", taskDeadlineDay: 1, visitLastDay: 1 });
});

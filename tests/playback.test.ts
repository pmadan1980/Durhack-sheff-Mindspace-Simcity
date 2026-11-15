import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import EverydayScene from "../src/EverydayScene";
import { activityAt, planTrack, sceneProfiles, splitBlock } from "../src/planPlayback";
import { branch, createWorld, judgeSetup, policies, resolve, taskTypes } from "../src/simulation";

describe("scenario playback", () => {
  it("plays exactly the recorded blocks and splits at the first differing allocation", () => {
    const { state, rules } = createWorld(judgeSetup);
    const a = resolve(state, policies, rules);
    const b = branch(a, "prepare", rules);
    const before = JSON.stringify([a,b]);
    expect(planTrack(a)).toEqual(["A","A","C","C","R","R"]);
    expect(planTrack(b)).toEqual(["A","A","A","A","R","R"]);
    expect(splitBlock(a,b)).toBe(2);
    expect(splitBlock(a,branch(a,a.policy.id,rules))).toBeNull();
    expect(activityAt(a,0)).toBeNull();
    expect(activityAt(a,2)).toBe("A");
    expect(activityAt(a,2.01)).toBe("C");
    expect(activityAt(a,6)).toBe("R");
    expect(JSON.stringify([a,b])).toBe(before);
  });
  it.each(taskTypes)("renders a matching %s scene at the start and end", (taskType) => {
    const { state,rules } = createWorld({ ...judgeSetup, taskType });
    const round=resolve(state,policies,rules);
    expect(sceneProfiles[taskType]).toBeDefined();
    const start=renderToStaticMarkup(createElement(EverydayScene,{ round,rules,position:0,running:false,reduced:true,solo:null }));
    const end=renderToStaticMarkup(createElement(EverydayScene,{ round,rules,position:6,running:false,reduced:true,solo:null }));
    expect(start).toContain(sceneProfiles[taskType].work);
    expect(end).toContain(sceneProfiles[taskType].work);
    expect(start).not.toContain("NaN");
    expect(end).not.toContain("NaN");
  });
});

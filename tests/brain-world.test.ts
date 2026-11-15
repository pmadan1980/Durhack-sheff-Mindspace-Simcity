import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,it,expect } from "vitest";
import { BrainMotionContext } from "../src/brainMotion";
import { thoughtActivation, allocationActivation } from "../src/thoughtActivation";
import { BrainWorld, PlanBridge, BrainTransition } from "../src/BrainCinema";

describe("thought pathways",()=>{
  it.each([
    ["I’m exhausted, but my assignment is due tonight.",["A","R"]],
    ["My friend invited me out but I have an exam tomorrow.",["A","C"]],
    ["No friends to visit. My project is due and I am tired.",["A","R"]],
    ["Should I learn a new tool for my project?",["A","D"]],
    ["Scrolling but I have work to do",["A","R"]],
    ["I am not tired and have no visit. My report is due.",["A"]],
    ["hello",[]],
  ])("activates only stated priorities for %s",(text,expected)=>{
    expect(thoughtActivation(text as string)).toEqual(expected);
  });
  it("does not reveal a quiet region's illuminated image or route",()=>{
    const html=renderToStaticMarkup(createElement(BrainWorld,{active:["A","R"]}));
    expect(html.match(/class="brain-awake /g)).toHaveLength(2);
    expect(html.match(/class="brain-route/g)).toHaveLength(2);
    expect(html).toContain("Connection, Discovery quiet.");
  });
  it.each(["A","D","R"] as const)("coordinates the artwork and signal with speaker %s",speaker=>{
    const html=renderToStaticMarkup(createElement(BrainWorld,{active:["A","D","R"],speaker,mode:"debate"}));
    expect(html).toContain(`data-speaker="${speaker}"`);
    expect(html.match(/class="brain-awake region-speaking"/g)).toHaveLength(1);
    expect(html.match(/class="brain-awake region-listening"/g)).toHaveLength(2);
    expect(html.match(/class="brain-route is-speaking"/g)).toHaveLength(1);
  });
  it("makes regions accessible as question targets when interactive",()=>{
    const html=renderToStaticMarkup(createElement(BrainWorld,{active:["A","R"],speaker:"A",mode:"debate",onRegionSelect:()=>{}}));
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Ask Achievement a question"');
    expect(html).toContain('aria-label="Ask Recovery a question"');
  });
  it("honours the app's reduced motion setting without an automatic animation clock",()=>{
    const html=renderToStaticMarkup(createElement(BrainMotionContext.Provider,{value:true},createElement(BrainTransition,{thought:"My assignment is due and I am tired",onDone:()=>{}})));
    expect(html).toContain("brain-still");
    expect(html).not.toContain(">Pause</button>");
    expect(html).toContain("Skip animation");
    expect(html).toContain("Enter this world");
  });
  it("keeps allocation-derived routes and all bridge stones in sync",()=>{
    const allocation={A:3,C:0,D:1,R:2};
    expect(allocationActivation(allocation)).toEqual(["A","D","R"]);
    const policy={id:"test",name:"Test",description:"",allocation};
    const html=renderToStaticMarkup(createElement(PlanBridge,{policy,budget:6}));
    expect(html.match(/class="bridge-stone /g)).toHaveLength(6);
    expect(html).not.toContain("stone-empty");
    expect(html).not.toContain('title="Connection"');
  });
});

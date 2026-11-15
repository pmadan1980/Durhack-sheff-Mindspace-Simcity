import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,it,expect } from "vitest";
import DebatePersonas from "../src/DebatePersonas";
import { conversationLine } from "../src/debateCopy";
import { initialJourney } from "../src/journey";
import { judgeSetup,actionState } from "../src/simulation";
import { debate } from "../src/dialogue";

describe("shared debate stage",()=>{
  it("keeps all four personas visible with only one active speaker",()=>{
    const html=renderToStaticMarkup(createElement(DebatePersonas,{speaker:"R",playing:true,onSelect:()=>{}}));
    expect(html.match(/class="debate-persona /g)).toHaveLength(4);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/Listening/g)).toHaveLength(3);
    expect(html).toContain("Speaking");
  });
  it("distinguishes a paused speaker from an answering voice",()=>{
    const paused=renderToStaticMarkup(createElement(DebatePersonas,{speaker:"D",playing:false,onSelect:()=>{}}));
    expect(paused).toContain("Paused");expect(paused).not.toContain("performer-speaking");
    const answering=renderToStaticMarkup(createElement(DebatePersonas,{speaker:"D",playing:false,answering:true,onSelect:()=>{}}));
    expect(answering).toContain("Answering");expect(answering).toContain("performer-speaking");
  });
  it("does not promise completion when the actual forecast leaves work unfinished",()=>{
    const {world:w}=initialJourney({...judgeSetup,taskProgress:0,visitLastDay:0});
    const start=actionState(w.state,w.rules),lines=debate(start,w.proposals,w.rules);
    expect(conversationLine(lines[0],start,w.proposals,w.rules)).not.toContain("finish your");
    expect(conversationLine(lines[1],start,w.proposals,w.rules)).toContain("No visit");
  });
  it("keeps a method investment after today's deadline explicit",()=>{
    const {world:w}=initialJourney({...judgeSetup,taskDeadlineDay:1});
    const start=actionState(w.state,w.rules),line=debate(start,w.proposals,w.rules).find(l=>l.speaker==="D")!;
    expect(conversationLine(line,start,w.proposals,w.rules)).toContain("after this deadline");
  });
});

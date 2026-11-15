import { describe,it,expect } from "vitest";
import { config,createWorld,judgeSetup,residents,elect,policies,districts } from "../src/simulation";
import { revealOrder } from "../src/journey";

describe("individual resident preferences",()=>{
  it("creates 24 unique, named profiles with finite, positive, normalised priorities",()=>{
    const people=residents(config);
    expect(people).toHaveLength(24);
    expect(new Set(people.map(p=>JSON.stringify(p.weights))).size).toBe(24);
    expect(new Set(people.map(p=>p.name)).size).toBe(24);
    expect(new Set(people.map(p=>p.background)).size).toBeGreaterThan(12);
    for(const person of people){
      expect(districts.every(d=>Number.isFinite(person.weights[d])&&person.weights[d]>0)).toBe(true);
      expect(Object.values(person.weights).reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);
    }
  });
  it("reproduces a population from its seed and changes preferences with a new seed",()=>{
    expect(residents(config)).toEqual(residents(config));
    expect(residents({...config,seed:config.seed+1}).map(p=>p.weights)).not.toEqual(residents(config).map(p=>p.weights));
    for(const district of districts){
      const group=residents(config).filter(p=>p.district===district);
      expect(new Set(group.map(p=>districts.reduce((a,b)=>p.weights[a]>p.weights[b]?a:b))).size).toBeGreaterThan(1);
    }
  });
  it("always chooses each resident's best actual utility, even if that produces a majority",()=>{
    const {state,rules}=createWorld(judgeSetup);
    const result=elect({...state,taskProgress:10},policies,rules);
    for(const ballot of result.ballots)expect(ballot.utilities[ballot.choice]).toBe(Math.max(...ballot.utilities));
    // Prepare now is strictly dominated here: no extra progress, less connection and energy.
    expect(result.counts[0]).toBe(0);
    expect(result.counts.reduce((a,b)=>a+b,0)).toBe(24);
  });
  it("reveals a stable permutation without grouping the old repeated profile blocks",()=>{
    const order=revealOrder(24);
    expect(order).toEqual(revealOrder(24));
    expect([...order].sort((a,b)=>a-b)).toEqual(Array.from({length:24},(_,i)=>i));
    expect(order.slice(0,4)).not.toEqual([0,6,12,18]);
  });
});

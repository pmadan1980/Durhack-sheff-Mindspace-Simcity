import { expect, it } from "vitest";
import { listScenarios, getScenario, evaluateDecision, compareDecisions, type DecisionInput } from "../src/engine";
function inputFor(id: string): DecisionInput {
  const scenario = getScenario(id);
  return { scenarioId: id, availableMinutes: 300, reservedMinutes: 60,
    facts: Object.fromEntries(Object.keys(scenario.questions).map((key) => [key, { value: true, source: "user" }])),
    estimates: Object.fromEntries(scenario.options.map((o) => [o.id, { minutes: 120, source: "user", includesTravelAndSetup: true }])) };
}

it("runs all fifteen scenarios with four recorded ballots", () => {
 expect(listScenarios()).toHaveLength(15);
 for (const s of listScenarios()) {
  const r = evaluateDecision(inputFor(s.id));
  expect(Object.values(r.counts).reduce((a,b)=>a+b,0)+r.abstentions).toBe(4);
 }
});
it("changes position when preparation is complete", () => {
 const a = inputFor("test-and-invitation"); a.facts.prepared.value=false;
 const b = structuredClone(a); b.facts.prepared.value=true;
 const r = compareDecisions(a,b);
 expect(r.before.ballots.find(b=>b.resident==="achievement")!.choice).toBe("prepare");
 expect(r.after.ballots.find(b=>b.resident==="achievement")!.choice).toBe("attend");
});
it("blocks impossible plans and invalid time", () => {
 const a = inputFor("test-and-invitation"); a.availableMinutes=60;
 expect(evaluateDecision(a).abstentions).toBe(4);
 a.availableMinutes=NaN; expect(()=>evaluateDecision(a)).toThrow();
});

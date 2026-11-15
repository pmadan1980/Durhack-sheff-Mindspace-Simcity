import type { Config, TaskType } from "./simulation";
import type { Assessment, DecisionInput } from "./engine";
export interface ArtFrame { file: string; side?: 0 | 1; action: string }
const clip = (file: string, side: 0 | 1, action: string): ArtFrame => ({ file:`${file}.png`,side,action });
const rest: ArtFrame = { file:"rest.png",action:"Taking time to rest" };
const work = clip("reference",0,"Making progress on your own work");
const friend = clip("reference",1,"Meeting your friend");
export const taskArtwork: Record<TaskType,ArtFrame> = {
  presentation:clip("presentation",0,"Rehearsing your presentation"), assignment:work,
  report:clip("polish",0,"Writing your report"), project:clip("tools",1,"Building your project"),
  "exam preparation":clip("study",0,"Preparing for your exam"), revision:clip("study",0,"Revising with flashcards"),
  task:clip("scroll",1,"Working through the next step"),
};
export const scenarioVisuals: Record<string,Record<string,ArtFrame[]>> = {
  "test-and-invitation": { prepare:[clip("study",0,"Preparing for the test")], attend:[friend], brief:[friend,clip("study",0,"Returning to preparation")] },
  "presentation-and-visit": { prepare:[taskArtwork.presentation], visit:[clip("presentation",1,"Meeting while the visit is possible")], split:[taskArtwork.presentation,clip("presentation",1,"Making room for a shorter visit")] },
  "shift-and-coursework": { work:[clip("shift",0,"Taking the extra shift")], study:[clip("shift",1,"Protecting coursework time")], swap:[clip("shift",0,"A shorter shift, if approved"),clip("shift",1,"Returning to coursework")] },
  "hackathon-scope": { feature:[clip("hackathon",0,"Building the new feature")], stabilise:[clip("hackathon",1,"Checking and rehearsing the demo")], trial:[clip("hackathon",0,"Trying a small experiment"),clip("hackathon",1,"Returning to the fallback")] },
  "study-format": { solo:[clip("study",0,"Studying independently")], group:[clip("study",1,"Working through questions together")], questions:[clip("study",0,"Preparing questions"),clip("study",1,"Taking questions to the group")] },
  "new-tool": { familiar:[clip("tools",0,"Using the familiar method")], new:[clip("tools",1,"Learning the new tool")], trial:[clip("tools",1,"Trying the tool"),clip("tools",0,"Keeping a familiar fallback")] },
  "help-moving": { help:[clip("moving",0,"Helping with the move")], decline:[clip("moving",1,"Protecting your own work time")], bounded:[clip("moving",0,"Helping with one useful task"),clip("moving",1,"Returning to your work")] },
  "drained-invitation": { attend:[friend], rest:[rest], short:[friend,rest] },
  "team-boundaries": { accept:[clip("boundaries",0,"Taking on the extra work")], boundary:[clip("tools",0,"Keeping your current scope")], redistribute:[clip("boundaries",1,"Agreeing a smaller shared plan")] },
  "family-deadline": { attend:[clip("family",0,"Making time for family")], project:[clip("family",1,"Protecting project time")], partial:[clip("family",0,"Attending part of the occasion"),clip("family",1,"Returning to the project")] },
  "scrolling-break": { continue:[clip("scroll",0,"Choosing a bounded scrolling break")], restart:[clip("scroll",1,"Starting one small task")], different:[rest] },
  "new-club": { join:[clip("club",0,"Joining the new activity")], defer:[clip("club",1,"Keeping your current commitments")], trial:[clip("club",0,"Trying one session"),clip("club",1,"Reviewing your commitments")] },
  "housemate-conversation": { talk:[clip("housemates",0,"Making a calm, specific request")], schedule:[clip("housemates",1,"Preparing what to say"),clip("housemates",0,"Talking at the agreed time")], message:[clip("housemates",1,"Writing a neutral request")] },
  "polish-or-submit": { submit:[clip("polish",1,"Checking and submitting")], polish:[clip("polish",0,"Revising the work")], timebox:[clip("polish",0,"Making one bounded improvement"),clip("polish",1,"Leaving time to submit")] },
  "two-invitations": { first:[clip("invitations",0,"Attending the first event")], second:[clip("invitations",1,"Attending the second event")], split:[clip("invitations",0,"Spending part of the evening here"),clip("invitations",1,"Moving to the other invitation")] },
};
export function visualFor(scenarioId:string,optionId:string):ArtFrame[] {
  const frames=scenarioVisuals[scenarioId]?.[optionId];
  if (!frames?.length) throw new Error(`Missing visual plan: ${scenarioId}/${optionId}`);
  return frames;
}

/** Availability is assessed once, then shared by text and artwork. */
export function assessedVisual(scenarioId: string, optionId: string, assessment?: Assessment) {
  if (assessment?.status === "feasible") return { frames: visualFor(scenarioId, optionId), blocked: false, message: "" };
  const visitUnavailable = scenarioId === "presentation-and-visit" &&
    assessment?.reasons.some(reason => reason.startsWith("Required condition is false:") && reason.includes("visit"));
  const message = visitUnavailable ? "The visit isn’t available" : assessment?.status === "infeasible" ? "This plan doesn’t fit your details" : "Confirm the details for this plan";
  return { frames: [{file:"empty.png",action:message}] as ArtFrame[], blocked: true, message };
}
export function inheritedScenarioFacts(scenarioId: string, rules: Config, day: number): DecisionInput["facts"] {
  return scenarioId === "presentation-and-visit"
    ? {visitAvailable:{value:rules.connectionLastOpenDay > 0 && day <= rules.connectionLastOpenDay,source:"user"}}
    : {};
}

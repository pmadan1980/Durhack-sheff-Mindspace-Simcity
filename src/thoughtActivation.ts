import { districts, type Allocation, type District } from "./simulation";

// Explicit text cues drive a visual metaphor, never a diagnosis or a neural measurement.
export function thoughtActivation(thought: string): District[] {
  const text = thought.toLowerCase()
    .replace(/\b(?:no|without)\s+(?:(?:a|any|my)\s+)?(?:friends?(?:\s+to\s+visit)?|visits?|guests?|team|group|family)\b/g, "")
    .replace(/\bnot\s+(?:visiting(?:\s+anyone)?|tired|exhausted|learning|studying|working)\b/g, "");
  const cues: Record<District, RegExp> = {
    A: /\b(work|working|assignment|essay|report|project|presentation|deadline|due|exam|test|revision|revise|study|studying|coursework|task|submit|submission|demo|shift|overtime|polish|polishing)\b/,
    C: /\b(friend|friends|visit|visiting|invited|invitation|invitations|party|family|relative|partner|housemate|roommate|teammate|colleague|group|social|club|society|help moving)\b/,
    D: /\b(learn|learning|new tool|new method|new approach|new feature|framework|discover|discovery|explore|exploring|experiment|curious|novelty|research)\b/,
    R: /\b(tired|exhausted|drained|burnt out|burned out|sleep|sleepy|rest|resting|break|scroll|scrolling|overwhelmed|recover|recovery|energy)\b/,
  };
  return districts.filter(d => cues[d].test(text));
}

export function allocationActivation(allocation: Allocation): District[] {
  return districts.filter(d => allocation[d] > 0);
}

export const brainRegions: Record<District, { x: number; y: number; color: string; clip: string }> = {
  A:{x:32,y:34,color:"#ffd071",clip:"polygon(0 0,50% 0,50% 49%,0 49%)"},
  C:{x:68,y:34,color:"#ff91bf",clip:"polygon(50% 0,100% 0,100% 49%,50% 49%)"},
  D:{x:32,y:67,color:"#82caff",clip:"polygon(0 49%,50% 49%,50% 100%,0 100%)"},
  R:{x:68,y:67,color:"#a9f5bd",clip:"polygon(50% 49%,100% 49%,100% 100%,50% 100%)"},
};

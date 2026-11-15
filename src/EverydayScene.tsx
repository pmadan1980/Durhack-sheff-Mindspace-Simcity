import { taskArtwork } from "./scenarioVisuals";
import type { CSSProperties } from "react";
import { districtInfo, type Config, type District, type Round } from "./simulation";
import { activityAt, activityCopy, sceneProfiles } from "./planPlayback";

const art = "/art/parallel-clay/";
const frames = ["work", "friend", "ideas", "rest", "empty"] as const;

export default function EverydayScene({ round, rules, position, running, reduced, solo }: {
  round: Round; rules: Config; position: number; running: boolean; reduced: boolean; solo: District | null;
}) {
  const active = activityAt(round,position);
  const frame = active === "C" ? (round.activity.connectionOpen && rules.connectionLastOpenDay > 0 ? "friend" : "empty") : active === "D" ? "ideas" : active === "R" ? "rest" : "work";
  const ready = position >= rules.dailyBudget && round.after.taskResult === true;
  return <div className={`everyday-scene clay-scene ${running ? "scene-running" : "scene-paused"} clay-${frame}`} data-reduced={reduced ? "true" : "false"}
    role="img" aria-label={`${sceneProfiles[rules.taskType].work}: ${activityCopy(active,round,rules)}${ready ? ". Task complete." : ""}`}
    style={{ "--scene-accent": districtInfo[solo ?? active ?? "A"].color } as CSSProperties}>
    {frames.map((name) => <div key={name} className={`clay-layer ${name === frame ? "clay-visible" : ""}`} aria-hidden="true">
      {name === "work" || name === "friend"
        ? <div className={`clay-still clay-reference clay-reference-${name}`} style={{ backgroundImage:`url(${art}${name === "work" ? taskArtwork[rules.taskType].file : "reference.png"})`,backgroundPosition:(name === "work" ? taskArtwork[rules.taskType].side : 1) === 1 ? "right center" : "left center" }} />
        : <img className="clay-still" src={`${art}${name}.png`} alt="" draggable={false} decoding="async" />}
    </div>)}
    <div className="clay-lamplight" aria-hidden="true" />
    {(frame === "friend" || frame === "rest") && <svg className={`clay-steam ${frame === "rest" ? "steam-rest" : ""}`} viewBox="0 0 60 60" aria-hidden="true"><path d="M15,50 C3,37 28,31 16,17 M35,51 C23,36 47,28 35,11" /></svg>}
    {frame === "ideas" && <div className="clay-idea-glow" aria-hidden="true" />}
    {ready && <span className="clay-ready">✓ Ready</span>}
  </div>;
}

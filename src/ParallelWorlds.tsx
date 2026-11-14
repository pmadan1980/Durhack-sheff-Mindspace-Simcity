import { useEffect, useState, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import { BookOpen, GitBranch, Headphones, Heart, Pause, Play, RotateCcw, Sparkles, Zap } from "lucide-react";
import { districtInfo, districts, fmt, type Config, type District, type Round } from "./simulation";
import VoiceIcon from "./VoiceIcon";
import { comparisonMeasures, sameState } from "./parallelStory";

interface Props {
  a: Round;
  b: Round;
  rules: Config;
  mix: number;
  onMix: (n: number) => void;
  playing: boolean;
  onPlaying: (v: boolean) => void;
  soundOn: boolean;
  onSound: () => void;
  solo: District | null;
  onSolo: (d: District | null) => void;
  mixer?: boolean;
}

const steps = ["Starting point", "The plans", "Outcomes"] as const;
const instruments = { A: BookOpen, C: Heart, D: Sparkles, R: Zap };
type Measure = ReturnType<typeof comparisonMeasures>[number];

function WorldArt({ measures, side, showDifference, solo }: {
  measures: Measure[];
  side: "a" | "b";
  showDifference: boolean;
  solo: District | null;
}) {
  return (
    <div className="future-art" aria-hidden="true">
      <div className="future-orbit future-orbit-outer" />
      <div className="future-orbit future-orbit-inner" />
      <div className="future-platform" />
      <div className="future-landmarks">
        {measures.map(({ district, changed, ...values }) => {
          const value = values[side];
          return <div
            key={district}
            className="future-landmark"
            data-focused={solo === district || (showDifference && changed)}
            data-muted={solo !== null && solo !== district}
            style={{ "--voice": districtInfo[district].color, "--level": value.level } as CSSProperties}
          >
            <div className="future-crystal"><VoiceIcon d={district} size={52} /></div>
            <div className="future-crystal-foot" />
          </div>;
        })}
      </div>
    </div>
  );
}

function PlanBlocks({ round, rules }: { round: Round; rules: Config }) {
  const allocated = districts.filter(d => round.policy.allocation[d] > 0);
  return (
    <div className="future-allocation">
      <div className="future-blocks" aria-hidden="true">
        {allocated.flatMap(d => Array.from({ length: round.policy.allocation[d] }, (_, i) =>
          <span key={`${d}-${i}`} style={{ "--voice": districtInfo[d].color } as CSSProperties}>
            {districtInfo[d].symbol}
          </span>,
        ))}
      </div>
      <div className="future-budget">
        <span>{rules.dailyBudget} time blocks</span>
        <span>{allocated.map(d => `${round.policy.allocation[d]} ${districtInfo[d].name.toLowerCase()}`).join(" · ")}</span>
      </div>
    </div>
  );
}

function Comparison({
  a, b, rules, mix, onMix, playing, onPlaying, soundOn, onSound, solo, onSolo, mixer = true,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(() => !document.hidden);

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!playing || !visible || step === 2) return;
    const timeout = window.setTimeout(() => setStep(step + 1), step === 0 ? 1000 : 1850);
    return () => window.clearTimeout(timeout);
  }, [playing, visible, step]);

  const shared = sameState(a.before, b.before);
  const final = step === 2;
  const outcomes = comparisonMeasures(a.after, b.after, rules);
  const measures = final ? outcomes : comparisonMeasures(a.before, b.before, rules);
  const changes = outcomes.filter(measure => measure.changed);
  const storyLabel = step === 0
    ? shared ? "Shared starting point" : "Two starting points"
    : step === 1 ? "How each plan spends time"
    : changes.length ? `What changed · ${changes.map(measure => measure.label).join(", ")}` : "Same outcomes at this point";

  return (
    <div className="parallel-cinema" data-step={step} data-reduced={reduceMotion ? "true" : "false"}>
      <div className="future-origin" role="status">
        <GitBranch size={15} aria-hidden="true" />
        <span>{storyLabel}</span>
        <small>Day {a.before.day}</small>
      </div>
      <div className="future-fork" data-shared={shared} aria-hidden="true">
        <span className="future-thread" />
        <span className="future-seed" />
        <span className="future-seed" />
      </div>
      <div className="future-duet">
        {([["a", a, "What happened"], ["b", b, "Your alternative"]] as const).map(([id, round, title]) => (
          <article key={id} className="future-world">
            <header>
              <span className="future-world-id" aria-hidden="true">{id.toUpperCase()}</span>
              <div><p>{title}</p><h3>{step === 0 ? "Before the choice" : round.policy.name}</h3></div>
            </header>
            <WorldArt measures={measures} side={id} showDifference={final} solo={solo} />
            {step === 1 ? <PlanBlocks round={round} rules={rules} /> :
              <div className="future-measures">
                {measures.map(measure => {
                  const value = measure[id];
                  const Icon = instruments[measure.district];
                  return <div key={measure.district} className="future-measure" data-changed={final && measure.changed}
                    style={{ "--voice": districtInfo[measure.district].color } as CSSProperties}>
                    <span><Icon size={13} aria-hidden="true" />{measure.label}</span>
                    <strong>{value.text}</strong>
                    {value.result !== null && <small>{value.result ? "Met" : "Missed"}</small>}
                    <div className="future-meter" aria-hidden="true"><span style={{ width: `${100 * value.level}%` }} /></div>
                  </div>;
                })}
              </div>
            }
          </article>
        ))}
      </div>
      <div className="future-toolbar">
        <div className="future-steps" aria-label="Comparison steps">
          {steps.map((label, index) => <button key={label} type="button" aria-pressed={step === index}
            onClick={() => { onPlaying(false); setStep(index); }}>{label}</button>)}
        </div>
        <button type="button" className="text-button" onClick={() => {
          if (final) { setStep(0); onPlaying(true); }
          else onPlaying(!playing);
        }}>
          {final ? <RotateCcw size={14} /> : playing ? <Pause size={14} /> : <Play size={14} />}
          {final ? "Replay comparison" : playing ? "Pause" : "Play comparison"}
        </button>
        {!soundOn && <button type="button" className="text-button" onClick={onSound}><Headphones size={14} /> Enable sound</button>}
      </div>
      {mixer && <div className="future-mixer">
        <label>
          <Headphones size={15} aria-hidden="true" /> Blend soundtracks
          <input type="range" min="0" max="1" step="0.01" value={mix}
            onChange={e => onMix(Number(e.target.value))} />
        </label>
        <button type="button" className="text-button" onClick={() => onPlaying(!playing)}>{playing ? "Pause audio" : "Play audio"}</button>
        <div><span>What happened</span><span>Your alternative</span></div>
      </div>}
      {mixer && <div className="future-legend" aria-label="Focus an instrument">
        {outcomes.map(({ district }) => {
          const Icon = instruments[district];
          return <button key={district} type="button" aria-pressed={solo === district}
            style={{ "--voice": districtInfo[district].color } as CSSProperties}
            onClick={() => onSolo(solo === district ? null : district)}>
            <Icon size={14} aria-hidden="true" /> {districtInfo[district].name}
          </button>;
        })}
      </div>}
      <details className="future-inspect">
        <summary>Simulation details</summary>
        <table>
          <thead><tr><th>End of day {a.before.day}</th><th>What happened</th><th>Your alternative</th></tr></thead>
          <tbody>{([
            ["taskProgress", rules.taskType],
            ["connectionProgress", "Visit"],
            ["method", "Method"],
            ["energy", "Energy"],
          ] as const).filter(([key]) => key !== "connectionProgress" || rules.connectionGoal > 0).map(([key, label]) =>
            <tr key={key}><th scope="row">{label}</th><td>{fmt(a.after[key], 2)}</td><td>{fmt(b.after[key], 2)}</td></tr>,
          )}</tbody>
        </table>
      </details>
    </div>
  );
}

export default function ParallelWorlds(props: Props) {
  const { a, b } = props;
  return <Comparison key={`${a.id}:${b.id}`} {...props} />;
}

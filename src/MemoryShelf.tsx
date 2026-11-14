import { useState, type CSSProperties } from "react";
import { ArrowRight, BookOpen, GitBranch, Heart, Sparkles, Zap } from "lucide-react";
import { districtInfo, fmt, type Config, type District, type Round } from "./simulation";
import type { Memory } from "./memories";
import VoiceIcon from "./VoiceIcon";

const symbols = { A: BookOpen, C: Heart, D: Sparkles, R: Zap };

export default function MemoryShelf({ history, rules, memories, memory, onSelect, onInspect, onReplay, onFirstDay }: {
  history: Round[];
  rules: Config;
  memories: Memory[];
  memory: Memory | undefined;
  onSelect: (id: string | null) => void;
  onInspect: (day: number) => void;
  onReplay: (day: number) => void;
  onFirstDay: () => void;
}) {
  const [selectedDay, setSelectedDay] = useState<number>();
  const round = history.find(r => r.before.day === (memory?.day ?? selectedDay)) ?? history.at(-1);

  if (!round) return (
    <section className="memory-shelf memory-replay cosmic-panel glass" aria-label="Memory replay">
      <div className="memory-empty-art" aria-hidden="true"><VoiceIcon d="D" size={80} /></div>
      <h2>See what your choices leave behind</h2>
      <p>Resolve a day to save its decision and the changes it made to your world.</p>
      <button className="journey-link" onClick={onFirstDay}>Go to Decisions <ArrowRight size={15} /></button>
    </section>
  );

  const day = round.before.day;
  const moments = memories.filter(m => m.day === day);
  const selected = memory ?? moments[0];
  const values: { district: District; label: string; start: number; end: number; unit: string }[] = [
    { district: "A", label: rules.taskType, start: round.start.taskProgress, end: round.after.taskProgress, unit: "" },
    ...(rules.connectionGoal > 0 ? [{ district: "C" as const, label: "Visit", start: round.start.connectionProgress, end: round.after.connectionProgress, unit: "" }] : []),
    { district: "D", label: "Method", start: round.start.method, end: round.after.method, unit: "×" },
    { district: "R", label: "Energy", start: round.start.energy, end: round.after.energy, unit: "" },
  ];

  return (
    <section className="memory-shelf memory-replay cosmic-panel glass" aria-label="Memory replay">
      <h2>Replay a day</h2>
      <p>See which plan ran and what changed by the end of the day.</p>
      <div className="memory-day-tabs" role="group" aria-label="Recorded days">
        {history.map(entry => (
          <button key={entry.id} type="button" aria-pressed={entry.before.day === day}
            onClick={() => { onSelect(null); setSelectedDay(entry.before.day); }}>
            Day {entry.before.day}
          </button>
        ))}
      </div>
      <div className="memory-vignette" key={selected?.id ?? round.id} style={{ "--moment": selected ? districtInfo[selected.district].color : "#cbacf5" } as CSSProperties}>
        {selected && <span className="memory-vignette-art"><VoiceIcon d={selected.district} size={76} /></span>}
        <div>
          <small>{round.manual ? "Your intervention" : "Elected plan"}</small>
          <h3>{round.policy.name}</h3>
          {selected && <p>{selected.title}</p>}
        </div>
      </div>
      {moments.length > 1 && <div className="memory-moment-tabs" role="group" aria-label="Highlights from this day">
        {moments.map(moment => {
          const Icon = symbols[moment.district];
          return <button key={moment.id} type="button" aria-label={moment.title} title={moment.title}
            aria-pressed={selected?.id === moment.id} onClick={() => onSelect(moment.id)}
            style={{ "--moment": districtInfo[moment.district].color } as CSSProperties}><Icon size={17} /></button>;
        })}
      </div>}
      {selected && <p className="memory-outcome">{selected.outcome}</p>}
      <div className="memory-ledger" aria-label="Before the choice and end of day">
        <div className="memory-ledger-head" aria-hidden="true"><span>Resource</span><span>Before</span><span /><span>After</span></div>
        {values.map(({ district, label, start, end, unit }) => {
          const Icon = symbols[district];
          return <div key={district} className="memory-ledger-row" data-changed={start !== end}
            style={{ "--moment": districtInfo[district].color } as CSSProperties}>
            <span><Icon size={14} aria-hidden="true" /> {label}</span>
            <span>{fmt(start, 2)}{unit}</span><ArrowRight size={12} aria-hidden="true" />
            <strong>{fmt(end, 2)}{unit}</strong>
          </div>;
        })}
      </div>
      <div className="memory-actions">
        {round.policies.some(p => p.id !== round.policy.id) && <button type="button" className="secondary small"
          onClick={() => onReplay(day)}><GitBranch size={14} /> Try another choice</button>}
        <button type="button" className="text-button" onClick={() => onInspect(day)}>Inspect day <ArrowRight size={13} /></button>
      </div>
    </section>
  );
}

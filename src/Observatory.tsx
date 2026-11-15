import { useState, type CSSProperties } from "react";
import { ArrowRight, GitBranch } from "lucide-react";
import { districtInfo, fmt, type Config, type Round, type State, type Election, type Policy } from "./simulation";
import VoiceIcon from "./VoiceIcon";

interface Props {
  round?: Round;
  state: State;
  rules: Config;
  history: Round[];
  election: Election;
  policies: Policy[];
  onSelectDay: (day: number) => void;
  onBranch: () => void;
}

const signed = (value: number) => `${value > 0 ? "+" : ""}${fmt(value, 2)}`;

function Trace({ values, floor, cap, selected }: {
  values: number[]; floor: number; cap: number; selected: number;
}) {
  const max = Math.max(cap, ...values);
  const y = (value: number) => 39 - (value - floor) / Math.max(0.001, max - floor) * 34;
  const x = (index: number) => 4 + index / Math.max(1, values.length - 1) * 124;
  return (
    <svg className="observe-trace" viewBox="0 0 132 44" aria-hidden="true">
      <path d={`M4 ${y(cap)}H128`} stroke="currentColor" opacity=".22" strokeDasharray="2 4" />
      {values.length > 1 && <polyline fill="none" stroke="currentColor" strokeWidth="2"
        points={values.map((value, index) => `${x(index)},${y(value)}`).join(" ")} />}
      <circle cx={x(selected)} cy={y(values[selected])} r="3.3" fill="currentColor" />
    </svg>
  );
}

export default function Observatory({ round, state, rules, history, election, policies, onSelectDay, onBranch }: Props) {
  const [residentIndex, setResidentIndex] = useState(0);
  const result = round?.after ?? state;
  const before = round?.before ?? state;
  const recorded = [history[0]?.before ?? state, ...history.map(entry => entry.after)];
  const day = round?.before.day;
  const selectedIndex = round ? history.findIndex(entry => entry.id === round.id) + 1 : recorded.length - 1;
  const votes = round?.election ?? election;
  const plans = round?.policies ?? policies;
  const resident = votes.ballots[Math.min(residentIndex, votes.ballots.length - 1)];
  const stats = [
    { district: "A", label: rules.taskType, key: "taskProgress", cap: rules.taskGoal, floor: 0, unit: "pts", status: result.taskResult },
    { district: "C", label: "Visit", key: "connectionProgress", cap: rules.connectionGoal, floor: 0, unit: "pts", status: result.connectionResult },
    { district: "D", label: "Method", key: "method", cap: rules.methodCap, floor: 1, unit: "×", status: null },
    { district: "R", label: "Energy", key: "energy", cap: rules.energyCap, floor: 0, unit: "tokens", status: null },
  ] as const;

  return (
    <section className="observe-view" aria-label="Observatory statistics">
      <header className="observe-header">
        <div>
          <h2>{day === undefined ? "Starting state" : `Day ${day} at a glance`}</h2>
          <p>{round ? round.policy.name : "Resolve a day to see how your world changes."}</p>
        </div>
        {round && round.policies.some(plan => plan.id !== round.policy.id) && (
          <button type="button" className="secondary small" onClick={onBranch}><GitBranch size={14} /> Try another choice</button>
        )}
      </header>
      {history.length > 1 && <div className="memory-day-tabs" role="group" aria-label="Observe a day">
        {history.map(entry => <button key={entry.id} type="button"
          aria-pressed={entry.before.day === day} onClick={() => onSelectDay(entry.before.day)}>Day {entry.before.day}</button>)}
      </div>}
      <div className="observe-stats">
        {stats.filter(stat => stat.district !== "C" || rules.connectionGoal > 0).map(stat => {
          const change = result[stat.key] - before[stat.key];
          return <article className="observe-stat" key={stat.key}
            style={{ "--stat": districtInfo[stat.district].color } as CSSProperties}>
            <div className="observe-stat-label"><VoiceIcon d={stat.district} size={30} /><h3>{stat.label}</h3></div>
            <strong>{fmt(result[stat.key], 2)}<small>{stat.unit === "×" ? "×" : ` / ${stat.cap} ${stat.unit}`}</small></strong>
            <Trace values={recorded.map(entry => entry[stat.key])} floor={stat.floor} cap={stat.cap} selected={selectedIndex} />
            <div className="observe-stat-foot">
              <span>{round ? `${signed(change)} ${stat.unit} this day` : "Starting value"}</span>
              {stat.status !== null && <b>{stat.status ? "Met" : "Missed"}</b>}
            </div>
          </article>;
        })}
      </div>
      <section className="observe-votes" aria-labelledby="observe-votes-title">
        <h3 id="observe-votes-title">{round ? "How residents voted" : "Vote forecast"}</h3>
        {plans.map((plan, index) => <div className="observe-vote" key={plan.id}>
          <span>{plan.name}</span>
          <meter min={0} max={Math.max(1, votes.ballots.length)} value={votes.counts[index] ?? 0}
            aria-label={`${plan.name} votes`} />
          <strong>{votes.counts[index] ?? 0}<small> / {votes.ballots.length}</small></strong>
        </div>)}
      </section>
      {round && <details className="observe-details">
        <summary>How this day was calculated</summary>
        <dl>
          <dt>{round.external.name}</dt><dd>Energy {fmt(round.before.energy, 2)} <ArrowRight size={12} /> {fmt(round.start.energy, 2)} before the plan.</dd>
          <dt>Task progress</dt><dd>{rules.achievementRate} × {round.policy.allocation.A} blocks × {fmt(round.activity.energyFactor, 3)} energy factor × {fmt(round.start.method, 2)} method = {fmt(round.activity.taskGain, 2)} pts.</dd>
          <dt>Energy</dt><dd>{signed(round.activity.energyDelta)} tokens from the plan, after recovery and activity costs.</dd>
          <dt>Method</dt><dd>{fmt(round.start.method, 2)}× <ArrowRight size={12} /> {fmt(round.after.method, 2)}× available next day.</dd>
        </dl>
      </details>}
      {resident && <details className="observe-details">
        <summary>Inspect one resident’s vote</summary>
        <label>Resident <select value={residentIndex} onChange={event => setResidentIndex(Number(event.target.value))}>
          {votes.ballots.map((ballot, index) => <option key={ballot.resident.id} value={index}>{index + 1} · {districtInfo[ballot.resident.district].name}</option>)}
        </select></label>
        <p>{plans[resident.choice]?.name} had the highest score for this resident.</p>
        <ul>{plans.map((plan, index) => <li key={plan.id}>{plan.name} <b>{fmt(resident.utilities[index], 4)}</b></li>)}</ul>
      </details>}
    </section>
  );
}

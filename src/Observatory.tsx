import { useState } from "react";
import { ArrowUpRight, Info } from "lucide-react";
import {
  config,
  districts,
  districtInfo,
  fmt,
  type Config,
  type Round,
  type State,
  type Election,
  type Policy,
} from "./simulation";
import { audioConfig, projectScore } from "./audio";
import VoiceIcon from "./VoiceIcon";

interface Props {
  round?: Round;
  prior?: Round;
  state: State;
  rules: Config;
  history: Round[];
  election: Election;
  policies: Policy[];
}
export default function Observatory({
  round,
  prior,
  state,
  rules: c,
  history,
  election,
  policies,
}: Props) {
  const [residentIndex, setResidentIndex] = useState(0);
  const e = round?.election ?? election;
  const ps = round?.policies ?? policies;
  const b = e.ballots[residentIndex];
  const score = projectScore(round?.after ?? state, round, prior, c);
  return (
    <section className="observatory">
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE OBSERVATORY</span>
          <h1>Nothing behind the curtain.</h1>
          <p>Every outcome has inputs. Every sound has a source.</p>
        </div>
        <span className="stamp">
          {c.modelVersion} / SEED {c.seed}
        </span>
      </div>
      <div className="obs-grid">
        <article className="panel calculation">
          <div className="panel-heading">
            <h2>The anatomy of a day</h2>
            <span className="tag">
              {round
                ? `RESOLVED · DAY ${round.before.day}`
                : "AWAITING FIRST ROUND"}
            </span>
          </div>
          {round ? (
            <>
              <div className="outcome-number">
                +{fmt(round.activity.taskGain, 3)}
                <span>presentation points</span>
              </div>
              <p className="note">
                External event: {round.external.name}. Energy before event{" "}
                {fmt(round.before.energy, 3)}{" "}
                {round.external.energy >= 0 ? "+" : "−"}{" "}
                {Math.abs(round.external.energy)} → {fmt(round.start.energy, 3)}{" "}
                after clamping. Both branches receive this same event.
              </p>
              <div className="equation">
                <small>START-OF-ACTION ENERGY FACTOR</small>
                <code>
                  {c.energyFactorFloor} + {c.energyFactorRange} ×{" "}
                  {fmt(round.start.energy, 3)} / {c.energyCap} ={" "}
                  <b>{fmt(round.activity.energyFactor, 4)}</b>
                </code>
              </div>
              <div className="equation">
                <small>REALISED PRESENTATION GAIN</small>
                <code>
                  {c.achievementRate} × {round.policy.allocation.A} blocks ×{" "}
                  {fmt(round.activity.energyFactor, 4)} ×{" "}
                  {fmt(round.start.method, 3)} method ={" "}
                  <b>{fmt(round.activity.taskGain, 3)}</b>
                </code>
              </div>
              <div className="equation">
                <small>SHARED ENERGY, AFTER CLAMPING TO 0…{c.energyCap}</small>
                <code>
                  clamp({fmt(round.start.energy)} + {c.recoveryRate}×
                  {round.policy.allocation.R} − {c.achievementEnergyCost}×
                  {round.policy.allocation.A} − {c.connectionEnergyCost}×
                  {round.policy.allocation.C} − {c.discoveryEnergyCost}×
                  {round.policy.allocation.D}) ={" "}
                  <b>{fmt(round.after.energy, 3)}</b>
                </code>
              </div>
              <div className="equation">
                <small>NEXT-DAY METHOD / CONNECTION ACTIVITY</small>
                <code>
                  min({c.methodCap}, {fmt(round.start.method, 3)} +{" "}
                  {c.discoveryMethodGain}×{round.policy.allocation.D}) ={" "}
                  <b>{fmt(round.after.method, 3)}×</b>
                </code>
                <code>
                  {round.activity.connectionOpen
                    ? `${c.connectionRate} × ${round.policy.allocation.C}`
                    : "Window closed"}{" "}
                  ={" "}
                  <b>{fmt(round.activity.connectionGain)} connection points</b>
                </code>
              </div>
              <p className="note">
                <Info size={14} /> Recovery and Discovery affect later rounds,
                not today’s productivity. Progress can exceed a goal; deadline
                results are latched separately.
              </p>
            </>
          ) : (
            <div className="empty-observation">
              <span>∑</span>
              <h3>A world of possibilities, not results. Yet.</h3>
              <p>
                Step or play one day to see actual substituted equations.
                Election forecasts are already inspectable below.
              </p>
            </div>
          )}
        </article>
        <article className="panel">
          <div className="panel-heading">
            <h2>Traces through time</h2>
            <span className="tag">LIVE WORLD A</span>
          </div>
          <HistoryGraph
            history={history}
            initial={history[0]?.before ?? state}
            rules={c}
          />
          <div className="graph-legend">
            <span>
              <i style={{ background: districtInfo.A.color }} />
              Presentation / {c.taskGoal}
            </span>
            <span>
              <i style={{ background: districtInfo.R.color }} />
              Energy / {c.energyCap}
            </span>
            <span>
              <i style={{ background: districtInfo.C.color }} />
              Visit / {c.connectionGoal}
            </span>
          </div>
          <p className="note">
            Fixed goal/cap reference scales. Lines stop at 100%; raw progress
            remains visible in the world. {history.length} of {c.maxDays} days
            resolved.
          </p>
          <div className="event-list">
            <span className="eyebrow">
              {round
                ? `DAY ${round.before.day} · EVENT LEDGER`
                : "WAITING FOR EVENTS"}
            </span>
            {round?.events.map((event) => (
              <div key={event.id}>
                <span className="district-symbol">
                  <VoiceIcon d={event.district} size={22} />
                </span>
                <span>{event.label}</span>
                <b>
                  {event.amount > 0 ? "+" : ""}
                  {fmt(event.amount, 3)} {event.unit}
                </b>
              </div>
            ))}
          </div>
        </article>
        <article className="panel ballot-panel">
          <div className="panel-heading">
            <h2>One resident. One vote.</h2>
            <select
              aria-label="Inspect resident"
              value={residentIndex}
              onChange={(e) => setResidentIndex(+e.target.value)}
            >
              {e.ballots.map((x, i) => (
                <option key={x.resident.id} value={i}>
                  Resident {i + 1}
                </option>
              ))}
            </select>
          </div>
          <p className="muted">
            {b.resident.id} lives in {districtInfo[b.resident.district].name}.
            Their preferences are independent of their address.
          </p>
          <div className="weight-row">
            {districts.map((d) => (
              <span key={d}>
                <VoiceIcon d={d} size={18} />{" "}
                {districtInfo[d].name}{" "}
                <b>{fmt(b.resident.weights[d] * 100, 0)}%</b>
              </span>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Proposal</th>
                  <th>Weighted one-round utility</th>
                  <th>Score</th>
                  <th>All votes</th>
                </tr>
              </thead>
              <tbody>
                {ps.map((p, i) => (
                  <tr key={p.id} className={b.choice === i ? "chosen-row" : ""}>
                    <td>
                      {p.name}
                      {b.choice === i && <small>THIS RESIDENT’S VOTE</small>}
                    </td>
                    <td className="utility">
                      {districts.map((d, n) => (
                        <span key={d}>
                          {n > 0 ? " + " : ""}
                          {fmt(b.resident.weights[d], 2)}×
                          {fmt(b.signals[i][d], 3)}
                        </span>
                      ))}
                    </td>
                    <td>{fmt(b.utilities[i], 4)}</td>
                    <td>
                      {e.counts[i]} / {c.residentCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>How are signals normalised?</summary>
            <p>
              Utility = wA×A + wC×C + wD×D + wR×R. Task and visit gains are
              capped at their remaining goals, then divided by fixed one-round
              bounds: task{" "}
              {fmt(c.achievementRate * c.dailyBudget * c.methodCap)}, visit{" "}
              {fmt(c.connectionRate * c.dailyBudget)}, method{" "}
              {fmt(c.discoveryMethodGain * c.dailyBudget)}, recovery{" "}
              {fmt(c.recoveryRate * c.dailyBudget)}. Recovery uses the signed
              net energy change after clamping; its signal can be negative.
              Discovery is a one-round proxy, not an optimal future plan.
              Candidate and ballot ties go to the first listed proposal.
            </p>
          </details>
        </article>
        <article className="panel audio-mapping">
          <div className="panel-heading">
            <h2>From activity to composition</h2>
            <ArrowUpRight size={19} />
          </div>
          <p className="muted">
            One clock. {audioConfig.bpm} BPM. C-major pentatonic. Patterns swap
            at bar boundaries, never with simulation speed.
          </p>
          {districts.map((d) => (
            <div className="mapping-row" key={d}>
              <span
                className="district-symbol"
              >
                <VoiceIcon d={d} size={22} />
              </span>
              <div>
                <b>
                  {districtInfo[d].name} <small>{districtInfo[d].voice}</small>
                </b>
                <p>
                  {d === "A"
                    ? `Task gain sets density (${score.density.A}/8 steps). A method already in use shifts the motif by ${score.methodLift} notes.`
                    : d === "C"
                      ? `Actual visit activity sets ${score.density.C} phrase units; zero activity is silent.`
                      : d === "D"
                        ? `Acquired method used this round sets ${score.density.D} counterline units.`
                        : `Recovery surviving the cap sets ${score.density.R} bass units. Energy sets a ${fmt(0.6 + score.energy * 0.8, 2)}s envelope.`}
                </p>
              </div>
            </div>
          ))}
          <p className="note">
            Cross-district response:{" "}
            {score.recoveryEcho
              ? "previous-round replenishment adds an octave to Achievement’s opening note."
              : "replenishment in a prior round will add an octave to a later Achievement opening."}{" "}
            Visual district size is fixed; shared-resource labels and activity
            trails carry the changing state.
          </p>
        </article>
      </div>
      <details className="assumptions panel">
        <summary>Fictional model, explicit assumptions</summary>
        <p>
          These are invented game units, not empirical measurements of a person.
          The energy model has a {config.energyFactorFloor} productivity floor
          and clamps at its editable capacity; it is not a physical conservation
          model. External events are indexed by day, so both branches see the
          same event. Closed-window authored proposals move Connection blocks to
          Achievement. User-edited proposals are never silently changed.
          Residents only forecast one round. Deadline checks happen after
          actions on that day and never change later. No accounts, server, AI
          calls, personal text storage or remote audio samples.
        </p>
      </details>
    </section>
  );
}

function HistoryGraph({
  history,
  initial,
  rules: c,
}: {
  history: Round[];
  initial: State;
  rules: Config;
}) {
  const states = [initial, ...history.map((r) => r.after)];
  const x = (i: number) => 36 + (i / Math.max(3, history.length)) * 420;
  const y = (v: number) => 170 - Math.min(1, Math.max(0, v)) * 140;
  return (
    <svg
      className="history-graph"
      viewBox="0 0 490 210"
      role="img"
      aria-label={`History of presentation, visit and energy over ${history.length} completed days`}
    >
      {[0, 0.5, 1].map((n) => (
        <g key={n}>
          <path d={`M36 ${y(n)}H461`} stroke="#deded4" strokeDasharray="3 5" />
          <text x="4" y={y(n) + 4}>
            {n * 100}%
          </text>
        </g>
      ))}
      {(
        [
          ["taskProgress", c.taskGoal, districtInfo.A.color],
          ["energy", c.energyCap, districtInfo.R.color],
          ["connectionProgress", c.connectionGoal, districtInfo.C.color],
        ] as const
      ).map(([key, bound, color]) => (
        <g key={key}>
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            points={states
              .map((s, i) => `${x(i)},${y(s[key] / bound)}`)
              .join(" ")}
          />
          {states.map((s, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(s[key] / bound)}
              r="3.5"
              fill={color}
            />
          ))}
        </g>
      ))}
      {states.map((_, i) => (
        <text key={i} x={x(i)} y="197" textAnchor="middle">
          {i === 0 ? "Start" : i}
        </text>
      ))}
    </svg>
  );
}

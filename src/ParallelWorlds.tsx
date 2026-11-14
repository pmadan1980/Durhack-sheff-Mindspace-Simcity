import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Headphones, Pause, Play, Sparkles } from "lucide-react";
import { districtInfo, districts, fmt, type Config, type District, type Round } from "./simulation";
import { impactMoments, networkStrength, sameWorld, worldCaption } from "./parallelStory";

interface Props {
  a: Round; b: Round; rules: Config;
  mix: number; onMix: (n: number) => void;
  playing: boolean; onPlaying: (v: boolean) => void;
  soundOn: boolean; onSound: () => void;
  solo: District | null; onSolo: (d: District | null) => void;
  mixer?: boolean;
}
const centres: Record<District, [number, number]> = { A: [110, 127], C: [163, 239], D: [264, 89], R: [326, 211] };
// Identical deterministic topology in both futures; only recorded state changes its expression.
const nodes = districts.flatMap((district, z) => Array.from({ length: 15 }, (_, i) => {
  const angle = i * 2.39996 + z * 0.4;
  const radius = 13 + Math.sqrt(i) * 14;
  const [x, y] = centres[district];
  return { district, x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius * 0.78, i };
}));
const descriptions: Record<District, string> = { A: "Golden structures · task progress", C: "Coral threads · time for connection", D: "Blue branches · a better method", R: "Mint halo · remaining energy" };

function Network({ round, rules, solo }: { round: Round; rules: Config; solo: District | null }) {
  const strength = networkStrength(round, rules);
  return (
    <svg className="future-network" viewBox="40 28 360 260" role="img" aria-label={`${worldCaption(round, rules)} Gold shows task progress, coral connection, blue method and mint energy.`}>
      <g className="network-drift">
        <ellipse className="network-orbit" cx="220" cy="169" rx="190" ry="116" fill="none" stroke="#b3a0ed" strokeOpacity=".12" />
        {districts.map((d, z) => {
          const [cx, cy] = centres[d];
          const level = strength[d];
          const points = nodes.filter((n) => n.district === d);
          return (
            <g key={d} className="network-district" style={{ opacity: solo && solo !== d ? 0.13 : 1 }}>
              {d === "R" && <circle cx={cx} cy={cy} r="57" fill={districtInfo[d].color} className="network-halo" style={{ opacity: 0.03 + level * 0.17 }} />}
              {points.map((n, i) => {
                const next = points[(i + 4) % points.length];
                const active = i / points.length <= level;
                return <g key={i}>
                  <path d={`M${n.x},${n.y} L${next.x},${next.y}`} fill="none" stroke={districtInfo[d].color} strokeWidth={active ? 1.5 : 0.6} opacity={active ? 0.8 : 0.12} />
                  {i % 4 === 0 && active && <path className="network-signal" pathLength="1" d={`M${n.x},${n.y} L${next.x},${next.y}`} fill="none" stroke={districtInfo[d].color} strokeWidth="2.5" style={{ animationDelay: `${-i * 0.7 - z}s` }} />}
                  <circle cx={n.x} cy={n.y} r={active ? 2.8 : 1.1} fill={districtInfo[d].color} opacity={active ? 0.95 : 0.22} />
                  {d === "A" && active && <path d={`M${n.x},${n.y} v-${5 + level * 16} l5,3 v${5 + level * 16}`} fill="none" stroke={districtInfo[d].color} strokeWidth=".8" opacity=".6" />}
                  {d === "D" && active && <path d={`M${n.x},${n.y} l10,-13 m-6,8 l-9,-8`} fill="none" stroke={districtInfo[d].color} strokeWidth="1" opacity=".7" />}
                </g>;
              })}
              <circle cx={cx} cy={cy} r="34" fill="none" stroke={districtInfo[d].color} strokeWidth="1.8" strokeDasharray={`${level * 210} 220`} transform={`rotate(-90 ${cx} ${cy})`} opacity=".65" />
              <text x={cx} y={cy + 5} textAnchor="middle" fill={districtInfo[d].color} fontSize="17">{districtInfo[d].symbol}</text>
            </g>
          );
        })}
        {districts.map((d, i) => {
          const [x, y] = centres[d], [nx, ny] = centres[districts[(i + 1) % 4]];
          return <path key={d} d={`M${x},${y} Q220,165 ${nx},${ny}`} fill="none" stroke={districtInfo.C.color} strokeWidth={0.6 + strength.C * 1.5} opacity={0.07 + strength.C * 0.42} className="network-thread" />;
        })}
      </g>
    </svg>
  );
}

function Attention({ a, b, rules, running }: { a: Round; b: Round; rules: Config; running: boolean }) {
  const moments = useMemo(() => impactMoments(a, b, rules), [a, b, rules]);
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();
  const i = Math.min(index, moments.length - 1);
  useEffect(() => {
    if (!running || i >= moments.length - 1) return;
    const timer = window.setTimeout(() => setIndex((n) => n + 1), 7500);
    return () => window.clearTimeout(timer);
  }, [running, i, moments.length]);
  const moment = moments[i];
  return <div className="future-attention" style={{ "--impact": districtInfo[moment.district].color } as CSSProperties}>
    <span className="attention-kicker"><Sparkles size={13} /> {moment.id === "converge" ? "THE STORY SO FAR" : "ATTENTION · A TURNING POINT"}</span>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={moment.id} role="status" aria-live="polite" initial={{ opacity: 0, y: reduced ? 0 : 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -5 }} transition={{ duration: 0.4 }}>
        <strong>{moment.title}</strong><p>{moment.detail}</p>
      </motion.div>
    </AnimatePresence>
    {moments.length > 1 && <div className="impact-dots" aria-label="Story moments">{moments.map((m, n) => <button key={m.id} aria-label={`Show moment: ${m.title}`} aria-pressed={i === n} onClick={() => setIndex(n)}><span /></button>)}</div>}
  </div>;
}

export default function ParallelWorlds({ a, b, rules, mix, onMix, playing, onPlaying, soundOn, onSound, solo, onSolo, mixer = true }: Props) {
  const reduced = useReducedMotion();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update(); document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const running = playing && !hidden && !reduced;
  const [origin, setOrigin] = useState(false);
  const first = origin ? { ...a, after: a.before } : a;
  const second = origin ? { ...b, after: b.before } : b;
  const sharedStart = sameWorld({ ...a, after: a.before }, { ...b, after: b.before });
  return <div className={`parallel-cinema ${running ? "is-running" : "is-paused"}`} data-reduced={reduced ? "true" : "false"}>
    <div className="future-origin"><span /><small>{sharedStart ? "ONE SHARED START" : "THE RIPPLES CONTINUE"} · DAY {a.before.day}</small><span /></div>
    <div className="future-duet">
      {([['a', first, 'What happened'], ['b', second, 'Your alternative']] as const).map(([id, r, title]) => (
        <article key={id} className={`future-world future-${id}`} style={{ "--presence": mixer ? 0.45 + (id === 'a' ? 1 - mix : mix) * 0.55 : 1 } as CSSProperties}>
          <header><span className="future-world-id">{id.toUpperCase()}</span><div><h3>{title}</h3><p>{origin ? "Before the decision" : r.policy.name}</p></div></header>
          <div className="future-art"><Network round={r} rules={rules} solo={solo} /></div>
          <p className="future-caption">{origin ? `Resources before this day’s decision. Watch how each plan changes its world.` : worldCaption(r, rules)}</p>
        </article>
      ))}
    </div>
    <div className="future-toolbar">
      <button className="text-button" onClick={() => { if (origin) setOrigin(false); onPlaying(!playing); }}>{playing ? <Pause size={13} /> : <Play size={13} />}{playing ? "Pause motion & music" : "Play motion & music"}</button>
      <button className="text-button" aria-pressed={origin} onClick={() => { if (!origin) onPlaying(false); setOrigin(!origin); }}>{origin ? "Show the consequences" : sharedStart ? "Look back at the shared start" : "Look back before today’s choices"}</button>
      {!soundOn && <button className="text-button" onClick={() => { setOrigin(false); onSound(); onPlaying(true); }}><Headphones size={13} /> Enable sound</button>}
    </div>
    {!origin && <Attention key={`${a.id}:${b.id}`} a={a} b={b} rules={rules} running={running} />}
    {mixer && <div className="future-mixer">
      <label htmlFor="future-blend">Explore both futures</label>
      <input id="future-blend" type="range" min="0" max="1" step="0.01" value={mix} aria-label="Explore both futures" aria-valuetext={mix < 0.2 ? "Focused on what happened" : mix > 0.8 ? "Focused on your alternative" : "Between both futures"} onChange={(e) => onMix(+e.target.value)} />
      <div><button aria-pressed={mix === 0} onClick={() => onMix(0)}>What happened</button><span>Colour & sound</span><button aria-pressed={mix === 1} onClick={() => onMix(1)}>What if…</button></div>
      <small>The slider blends your experience of the worlds. Their outcomes stay unchanged.</small>
    </div>}
    <div className="future-legend" aria-label="Explore the composition">{districts.filter((d) => d !== 'C' || rules.connectionLastOpenDay > 0).map((d) => <button key={d} style={{ "--voice": districtInfo[d].color } as CSSProperties} aria-pressed={solo === d} onClick={() => onSolo(solo === d ? null : d)}><span>{districtInfo[d].symbol}</span>{descriptions[d]}<small>{solo === d ? 'Show & hear all layers' : 'Focus this layer'}</small></button>)}</div>
    <details className="future-inspect"><summary>Inspect the model</summary><p>Recorded outcomes at the end of day {a.before.day}. B is a counterfactual intervention; no new decisions are made by this visualisation.</p><table><thead><tr><th>Resource</th><th>What happened</th><th>Your alternative</th></tr></thead><tbody>{([['taskProgress',rules.taskType],['connectionProgress','Visit'],['energy','Energy'],['method','Method']] as const).filter(([key]) => key !== 'connectionProgress' || rules.connectionLastOpenDay > 0).map(([key,label]) => <tr key={key}><th>{label}</th><td>{fmt(a.after[key],2)}</td><td>{fmt(b.after[key],2)}</td></tr>)}</tbody></table></details>
  </div>;
}

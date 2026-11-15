import ScenarioPlayback from "./ScenarioPlayback";
import { inheritedScenarioFacts } from "./scenarioVisuals";
import { listScenarios } from "./engine";
import VoiceIcon from "./VoiceIcon";
import EverydayScene from "./EverydayScene";
import { activityAt, activityCopy, planTrack, splitBlock, tileLabel } from "./planPlayback";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Headphones, Pause, Play, Sparkles } from "lucide-react";
import { districtInfo, districts, fmt, type Config, type District, type Round } from "./simulation";
import { impactMoments, sameWorld, worldCaption } from "./parallelStory";

interface Props {
  a: Round; b: Round; rules: Config;
  mix: number; onMix: (n: number) => void;
  playing: boolean; onPlaying: (v: boolean) => void;
  soundOn: boolean; onSound: () => void;
  solo: District | null; onSolo: (d: District | null) => void;
  mixer?: boolean;
  onScenarioChange?: (catalogue: boolean) => void;
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

export default function ParallelWorlds(props: Props) {
  const [situation,setSituation]=useState("current");
  return <>
    <div className="scenario-picker"><label>Situation<select aria-label="Situation" value={situation} onChange={e=>{props.onPlaying(false);setSituation(e.target.value);props.onScenarioChange?.(e.target.value!=="current");}}><option value="current">Your current story</option>{listScenarios().map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label></div>
    {situation === "current" ? <PlanPlayback key={`${props.a.id}:${props.b.id}`} {...props} /> : <ScenarioPlayback key={situation} scenarioId={situation} initialFacts={inheritedScenarioFacts(situation,props.rules,props.a.before.day)} onBack={()=>{setSituation("current");props.onScenarioChange?.(false);}} />}
  </>;
}

function PlanPlayback({ a,b,rules,mix,onMix,playing,onPlaying,soundOn,onSound,solo,onSolo,mixer=true }: Props) {
  const reduced = !!useReducedMotion();
  const [hidden,setHidden] = useState(false);
  const [position,setPosition] = useState(0);
  const playhead = useRef(0);
  const [started,setStarted] = useState(false);
  const budget = rules.dailyBudget;
  const ended = position >= budget;
  const firstSplit = splitBlock(a,b);
  const shared = sameWorld({ ...a,after:a.before },{ ...b,after:b.before });
  const split = true;
  const running = started && playing && !hidden && !reduced && !ended;
  const seek = (n: number) => { playhead.current=n; setPosition(n); };
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update(); document.addEventListener("visibilitychange",update);
    return () => document.removeEventListener("visibilitychange",update);
  },[]);
  useEffect(() => {
    if (!started || !playing || hidden || reduced) return;
    let frame=0, previous=0;
    const tick = (now: number) => {
      if (!previous) previous=now;
      const dt=now-previous;
      if (dt >= 1000/30) {
        previous=now;
        const next=Math.min(budget,playhead.current + Math.min(dt,100)/1500);
        playhead.current=next; setPosition(next);
        if (next >= budget) { setStarted(false); return; }
      }
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  },[started,playing,hidden,reduced,budget]);
  const start = () => {
    if (reduced) { seek(budget); return; }
    if (ended) { seek(0); }
    setStarted(true); onPlaying(true);
  };
  const caption = ended ? "See what this choice left behind." : position === 0 ? "Same start. One different plan." : split ? `What happened: ${activityCopy(activityAt(a,position),a,rules)}. Your alternative: ${activityCopy(activityAt(b,position),b,rules)}.` : `Both paths: ${activityCopy(activityAt(a,position),a,rules)}.`;
  return <div className={`parallel-cinema plan-playback ${running ? "is-running" : "is-paused"}`} data-reduced={reduced ? "true" : "false"}>
    <section className="playback-controls" aria-label="Plan playback controls">
      <div className="playback-clock"><span>DAY {a.before.day}</span><strong>{position === 0 ? "Before the choice" : ended ? "The day’s outcome" : `Block ${Math.min(budget,Math.max(1,Math.ceil(position)))} of ${budget}`}</strong></div>
      <div className="playback-scrub"><input type="range" min="0" max={budget} step="0.01" value={position} aria-label="Scrub through the plans" aria-valuetext={position === 0 ? "Before the choice" : ended ? "Day complete" : `Partway through block ${Math.min(budget,Math.max(1,Math.ceil(position)))}`} onChange={(e) => { setStarted(false); onPlaying(false); seek(+e.target.value); }} />{firstSplit !== null && <i style={{ left:`${firstSplit / budget * 100}%` }} title="The plans first differ here" />}</div>
      <p className="playback-caption">{caption}</p>
      <div className="playback-actions">{running ? <button className="playback-primary" onClick={() => { setStarted(false);onPlaying(false); }}><Pause size={14} /> Pause</button> : <button className="playback-primary" onClick={start}><Play size={14} />{ended ? "Replay paths" : position > 0 ? "Continue" : "Compare paths"}</button>}
        {!ended && <button onClick={() => {setStarted(false);seek(budget);}}>See the outcome</button>}
        {!soundOn && <button onClick={() => {onSound();onPlaying(true);}}><Headphones size={14} /> Sound</button>}
      </div>
    </section>
    <motion.div layout={!reduced} className={`playback-stage ${split ? "is-split" : ""}`} transition={{ duration:.65,ease:[.22,.8,.25,1] }}>
      {([['a',a,'What happened'],['b',b,'Your alternative']] as const).filter(([id]) => id === 'a' || split).map(([id,r,title]) => <motion.article layout={!reduced} key={id} className={`playback-world world-${id}`} initial={id === 'b' && !reduced ? { opacity:0,scale:.96,x:-15 } : false} animate={{ opacity:1,scale:1,x:0 }} transition={{ duration:.65,ease:[.22,.8,.25,1] }}>
        <header><span>{split ? title : "Both paths begin here"}</span><small>{r.policy.name}</small></header>
        <div className="playback-scene" style={{ opacity:mixer && split ? .65 + (id === 'a' ? 1-mix : mix)*.35 : 1 }}><EverydayScene round={r} rules={rules} position={position} running={running} reduced={reduced} solo={solo} /></div>
        <div className="playback-tiles" style={{ gridTemplateColumns:`repeat(${budget},minmax(0,1fr))` }} aria-label={`${title}: time blocks`}>
          {planTrack(r).map((d,i) => {
            const filled=Math.max(0,Math.min(1,position-i));
            return <div className={`playback-tile ${filled > 0 ? 'is-used' : ''} ${position > i && position < i+1 ? 'is-now' : ''}`} key={i} style={{ '--tile':districtInfo[d].color,'--fill':filled } as CSSProperties} title={`Block ${i+1}: ${tileLabel(d,rules)}`}><i /><VoiceIcon d={d} size={23} /><span>{tileLabel(d,rules)}</span></div>;
          })}
        </div>
        <p className="playback-outcome">{ended ? worldCaption(r,rules) : activityCopy(activityAt(r,position),r,rules)}</p>
      </motion.article>)}
    </motion.div>

    {split && !ended && firstSplit !== null && position > firstSplit && <div className="playback-turn" role="status"><Sparkles size={15} /><span>Here’s where the plans split.</span></div>}
    {ended && <Attention key={`${a.id}:${b.id}`} a={a} b={b} rules={rules} running={playing && !hidden && !reduced} />}
    {mixer && split && <div className="future-mixer playback-mixer"><label htmlFor="future-blend">Listen between the paths</label><input id="future-blend" type="range" min="0" max="1" step="0.01" value={mix} aria-label="Explore both futures" onChange={(e) => onMix(+e.target.value)} /><div><button onClick={() => onMix(0)}>What happened</button><span>Colour & sound</span><button onClick={() => onMix(1)}>What if…</button></div></div>}
    <details className="future-inspect"><summary>Explore the layers</summary><div className="future-legend">{districts.filter((d) => d !== 'C' || rules.connectionLastOpenDay > 0).map((d) => <button key={d} style={{ '--voice':districtInfo[d].color } as CSSProperties} aria-pressed={solo === d} onClick={() => onSolo(solo === d ? null : d)}>{districtInfo[d].name}<small>{solo === d ? 'Hear all layers' : 'Focus this layer'}</small></button>)}</div></details>
    <details className="future-inspect"><summary>Exact outcomes</summary><table><thead><tr><th>Resource</th><th>What happened</th><th>Your alternative</th></tr></thead><tbody>{([['taskProgress',rules.taskType],['connectionProgress','Visit'],['energy','Energy'],['method','Method']] as const).filter(([key]) => key !== 'connectionProgress' || rules.connectionLastOpenDay > 0).map(([key,label]) => <tr key={key}><th>{label}</th><td>{fmt(a.after[key],2)}</td><td>{fmt(b.after[key],2)}</td></tr>)}</tbody></table></details>
  </div>;
}

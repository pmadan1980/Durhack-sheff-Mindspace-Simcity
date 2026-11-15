import { useContext } from "react";
import { BrainMotionContext } from "./brainMotion";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useReducedMotion } from "motion/react";

export const playbackTransition = { duration: .65, ease: [.22, .8, .25, 1] as const };

export function playbackPhase(progress: number) {
  return progress < 1 / 3 ? "morning" : progress < 2 / 3 ? "midday" : "evening";
}

export function useParallelTimeline(duration: number, start = 1) {
  const systemReduced = !!useReducedMotion();
  const reduced = useContext(BrainMotionContext) || systemReduced;
  const cursor = useRef(start);
  const [progress, setProgress] = useState(start);
  const [playing, setPlaying] = useState(false);

  function seek(next: number) {
    cursor.current = next;
    setProgress(next);
    setPlaying(false);
  }

  function toggle() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (cursor.current >= 1) seek(0);
    setPlaying(true);
  }

  useEffect(() => {
    if (!playing || reduced) return;
    let frame = 0;
    let previous = performance.now();
    const pauseWhenHidden = () => {
      if (document.hidden) setPlaying(false);
    };

    function tick(now: number) {
      const elapsed = now - previous;
      if (elapsed >= 1000 / 30) {
        cursor.current = Math.min(1, cursor.current + Math.min(elapsed, 100) / duration);
        previous = now;
        setProgress(cursor.current);
      }
      if (cursor.current < 1) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    }

    document.addEventListener("visibilitychange", pauseWhenHidden);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", pauseWhenHidden);
    };
  }, [playing, reduced, duration]);

  useEffect(() => {
    if (reduced) setPlaying(false);
  }, [reduced]);

  return { progress, playing, reduced, seek, toggle };
}

interface Props {
  timeline: ReturnType<typeof useParallelTimeline>;
  label: string;
  readout: string;
  split?: number;
  single?: boolean;
}

export default function ParallelTimeline({ timeline, label, readout, split, single=false }: Props) {
  const { progress, playing, reduced, seek, toggle } = timeline;
  return <section className="playback-controls" aria-label="Time progression">
    <div className="playback-clock"><span>{label}</span><strong>{readout}</strong></div>
    <div className="playback-scrub">
      <input type="range" min="0" max="100" step="1" value={Math.round(progress * 100)}
        aria-label={single?"Scrub through the day":"Scrub through both paths"} aria-valuetext={readout}
        onChange={event => seek(event.target.valueAsNumber / 100)} />
      {split !== undefined && <i style={{ left: `${split * 100}%` }} title="The paths first differ here" />}
    </div>
    {!reduced && <div className="playback-actions">
      <button type="button" className="playback-primary" onClick={toggle}>
        {playing ? <Pause size={14} /> : progress === 1 ? <RotateCcw size={14} /> : <Play size={14} />}
        {playing ? "Pause" : progress === 1 ? (single?"Replay day":"Replay paths") : progress === 0 ? (single?"Play day":"Play paths") : "Resume"}
      </button>
    </div>}
  </section>;
}

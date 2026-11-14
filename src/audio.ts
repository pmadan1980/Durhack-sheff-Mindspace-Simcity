import {
  config,
  districts,
  type Config,
  type District,
  type Round,
  type State,
} from "./simulation";

export const audioConfig = {
  bpm: 88,
  beatsPerBar: 4,
  referenceBarsPerDay: 2,
  masterVolumeDefault: 0.35,
  headroom: 0.22,
  maxDensity: 7,
  attack: 0.025,
  maxTail: 1.5,
  notes: [60, 62, 64, 67, 69, 72, 74, 76],
  voices: { A: "triangle", C: "sine", D: "sine", R: "triangle" } as Record<
    District,
    OscillatorType
  >,
};
export interface Score {
  density: Record<District, number>;
  methodLift: number;
  recoveryEcho: boolean;
  energy: number;
}
export function projectScore(
  s: State,
  round: Round | undefined,
  prior: Round | undefined,
  c: Config = config,
): Score {
  return {
    density: {
      A: round
        ? Math.min(
            audioConfig.maxDensity,
            Math.ceil(
              (round.activity.taskGain /
                (c.achievementRate * c.dailyBudget * c.methodCap)) *
                audioConfig.maxDensity,
            ),
          )
        : 1,
      C: round
        ? Math.min(
            4,
            Math.ceil(round.activity.connectionGain / c.connectionRate),
          )
        : 0,
      D:
        round && round.start.method > 1
          ? Math.min(
              4,
              Math.ceil(((round.start.method - 1) / (c.methodCap - 1)) * 4),
            )
          : 0,
      R: round
        ? Math.min(4, Math.ceil(round.activity.restored / c.recoveryRate))
        : 1,
    },
    methodLift: round && round.start.method > 1 ? 2 : 0,
    recoveryEcho: (prior?.activity.restored ?? 0) > 0,
    energy: s.energy / c.energyCap,
  };
}
export function mixGains(x: number): [number, number] {
  const bounded = Math.max(0, Math.min(1, x));
  return [Math.cos((bounded * Math.PI) / 2), Math.sin((bounded * Math.PI) / 2)];
}
interface Frame {
  a: Score;
  b?: Score;
}
// Native Web Audio: one clock, one scheduler, no samples or per-render synths.
class AudioEngine {
  context?: AudioContext;
  private master?: GainNode;
  private channels: GainNode[][] = [];
  private timer?: ReturnType<typeof setInterval>;
  private beat = 0;
  private nextTime = 0;
  private frame?: Frame;
  private pending?: Frame;
  private volume = audioConfig.masterVolumeDefault;
  private muted = false;
  private solo: District | null = null;
  private mix = 0;
  private voices = new Set<OscillatorNode>();
  async enable() {
    if (!this.context || this.context.state === "closed") {
      const ctx = new AudioContext();
      this.context = ctx;
      this.master = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      this.master.connect(limiter).connect(ctx.destination);
      this.channels = [0, 1].map(() =>
        districts.map(() => {
          const gain = ctx.createGain();
          gain.connect(this.master!);
          return gain;
        }),
      );
      this.updateGains();
    }
    await this.context.resume();
    return this.context.state === "running";
  }
  setFrame(frame: Frame) {
    this.pending = frame;
  }
  setMix(x: number, solo: District | null, volume: number, muted: boolean) {
    this.mix = x;
    this.solo = solo;
    this.volume = volume;
    this.muted = muted;
    this.updateGains();
  }
  private updateGains() {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(
      this.muted ? 0 : this.volume * audioConfig.headroom,
      now,
      0.04,
    );
    const gains = mixGains(this.mix);
    this.channels.forEach((world, i) =>
      world.forEach((gain, d) => {
        gain.gain.setTargetAtTime(
          !this.solo || this.solo === districts[d] ? gains[i] : 0,
          now,
          0.04,
        );
      }),
    );
  }
  play(active: boolean) {
    if (!active) {
      this.stop();
      return;
    }
    if (this.timer || !this.context || this.context.state !== "running") return;
    this.beat = 0;
    this.nextTime = this.context.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }
  private schedule() {
    const ctx = this.context!;
    // Never catch up a throttled browser with a burst of late notes.
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.04;
    while (this.nextTime < ctx.currentTime + 0.12) {
      if (this.beat % 8 === 0 && this.pending) {
        this.frame = this.pending;
        this.pending = undefined;
      }
      const frame = this.frame;
      if (frame)
        [frame.a, frame.b].forEach((score, world) => {
          if (!score) return;
          districts.forEach((d, part) => {
            const beat = this.beat % 8;
            const density = score.density[d];
            const hit =
              d === "R"
                ? beat % 4 === 0 && density > 0
                : d === "C"
                  ? (beat === 1 ||
                      beat === 5 ||
                      (density > 1 && (beat === 3 || beat === 7))) &&
                    density > 0
                  : d === "D"
                    ? beat % 2 === 1 && density > beat / 2
                    : beat < density;
            if (!hit) return;
            const index =
              (beat +
                (d === "C" ? 2 : d === "D" ? 4 : 0) +
                (d === "A" ? score.methodLift : 0)) %
              audioConfig.notes.length;
            let midi =
              d === "R" ? 36 + (beat === 4 ? 7 : 0) : audioConfig.notes[index];
            if (d === "A" && score.recoveryEcho && beat === 0) midi += 12;
            this.note(
              midi,
              d,
              world,
              part,
              this.nextTime,
              d === "R" ? 0.6 + score.energy * 0.8 : d === "C" ? 0.4 : 0.22,
            );
          });
        });
      this.beat++;
      this.nextTime += 60 / audioConfig.bpm / 2;
    }
  }
  private note(
    midi: number,
    d: District,
    world: number,
    part: number,
    time: number,
    duration: number,
  ) {
    const ctx = this.context!;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = audioConfig.voices[d];
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(
      d === "R" ? 0.35 : 0.3,
      time + audioConfig.attack,
    );
    envelope.gain.exponentialRampToValueAtTime(
      0.001,
      time + Math.min(duration, audioConfig.maxTail),
    );
    osc.connect(envelope).connect(this.channels[world][part]);
    this.voices.add(osc);
    osc.onended = () => {
      this.voices.delete(osc);
      osc.disconnect();
      envelope.disconnect();
    };
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }
  stop() {
    clearInterval(this.timer);
    this.timer = undefined;
    this.voices.forEach((voice) => {
      try {
        voice.stop();
      } catch {
        /* already ended */
      }
    });
    this.voices.clear();
  }
  reset() {
    this.stop();
    this.frame = undefined;
    this.pending = undefined;
    this.beat = 0;
  }
  dispose() {
    this.reset();
    void this.context?.close();
    this.context = undefined;
    this.channels = [];
  }
}
export const audio = new AudioEngine();

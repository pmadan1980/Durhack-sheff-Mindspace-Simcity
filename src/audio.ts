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
const debateScore: Score = {
  density: { A: 4, C: 2, D: 2, R: 1 },
  methodLift: 0,
  recoveryEcho: false,
  energy: 0.55,
};

// Preserve the chamber rhythm, with a distinct register and timbre for each speaker.
const debateInstruments = {
  A: { harmonics: [1, 0.45, 0.2, 0.08], transpose: 0, attack: 0.009, tail: 0.25 }, // plucked keys
  C: { harmonics: [1, 0.08, 0.32], transpose: -5, attack: 0.065, tail: 0.55 }, // warm reed
  D: { harmonics: [1, 0, 0.58, 0, 0.26], transpose: 12, attack: 0.007, tail: 0.38 }, // bright bell
  R: { harmonics: [1, 0.12], transpose: 12, attack: 0.19, tail: 1.35 }, // sustained bass
} satisfies Record<District, { harmonics: number[]; transpose: number; attack: number; tail: number }>;

interface Frame {
  a: Score;
  b?: Score;
}
// Native Web Audio: one clock, one scheduler, no samples or per-render synths.
class AudioEngine {
  context?: AudioContext;
  private master?: GainNode;
  private channels: GainNode[][] = [];
  private meters: AnalyserNode[][] = [];
  private meterData = new Float32Array(32);
  private timer?: ReturnType<typeof setInterval>;
  private beat = 0;
  private debateWaves = new Map<District, PeriodicWave>();
  private debateSpeaker: District | null | undefined;
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
      this.meters = [0, 1].map(() =>
        districts.map(() => {
          const meter = ctx.createAnalyser();
          meter.fftSize = 32;
          meter.connect(this.master!);
          return meter;
        }),
      );
      this.channels = [0, 1].map((_, world) =>
        districts.map((_, part) => {
          const gain = ctx.createGain();
          gain.connect(this.meters[world][part]);
          return gain;
        }),
      );
      this.updateGains();
    }
    await this.context.resume();
    return this.context.state === "running";
  }
  setDebateSpeaker(speaker: District | null | undefined) {
    this.debateSpeaker = speaker;
    this.updateGains();
  }
  level(district: District) {
    let energy = 0;
    for (const world of this.meters) {
      world[districts.indexOf(district)].getFloatTimeDomainData(this.meterData);
      for (const sample of this.meterData) energy += sample * sample;
    }
    return Math.min(1, Math.sqrt(energy / this.meterData.length) * 10);
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
    const debating = this.debateSpeaker !== undefined;
    this.channels.forEach((world, i) =>
      world.forEach((gain, d) => {
        gain.gain.setTargetAtTime(
          debating
            ? i === 0 ? (this.debateSpeaker === districts[d] ? 1 : 0.12) : 0
            : (!this.solo || this.solo === districts[d] ? gains[i] : 0),
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
      const frame = this.debateSpeaker === undefined ? this.frame : { a: debateScore, b: undefined };
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
    const instrument = this.debateSpeaker === undefined ? undefined : debateInstruments[d];
    if (instrument) {
      let wave = this.debateWaves.get(d);
      if (!wave) {
        const harmonics = new Float32Array([0, ...instrument.harmonics]);
        wave = ctx.createPeriodicWave(new Float32Array(harmonics.length), harmonics);
        this.debateWaves.set(d, wave);
      }
      osc.setPeriodicWave(wave);
      midi += instrument.transpose;
      duration = instrument.tail;
    } else {
      osc.type = audioConfig.voices[d];
    }
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(
      d === "R" ? 0.35 : 0.3,
      time + (instrument?.attack ?? audioConfig.attack),
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
    this.setDebateSpeaker(undefined);
    this.frame = undefined;
    this.pending = undefined;
    this.beat = 0;
  }
  dispose() {
    this.reset();
    void this.context?.close();
    this.context = undefined;
    this.debateWaves.clear();
    this.channels = [];
    this.meters = [];
  }
}
export const audio = new AudioEngine();

import type { AppStore } from "@/app/store";
import type { KeyValueStore } from "@/persistence/autosave";
import { beatFrequency } from "@/kinematics/escapement";
import { isValidToothCount } from "@/math/gearMath";
import { audioContext } from "./audioContext";

/**
 * The watch's tick (follow-up 30 and 31, ASM-0084): a short mechanical tick on every beat of the
 * escapement, alternating a higher "tick" and a lower "tock". The beat rate is the model's own: the
 * escape arbor's solved speed times the escape wheel's teeth times two beats per tooth
 * (`beatFrequency`, ASM-0021), 5 beats a second (18,000 beats an hour) for the teaching movement. The
 * sound itself is a decorative synthesis, not a recording of a real watch, and the balance's real
 * beat is not simulated tick by tick (ASM-0024): the tick follows simulated time at the model's
 * average rate. A movement with no escapement, or an escape arbor the train does not drive, is silent.
 */
export const TICK_SOUND = {
  /** Above real-time playback the ticks would run together, so they are muted. */
  maxPlaybackRate: 1,
  /** A longer gap between frames than this many beats is a jump (setting, reset, set-to-browser-time), not ticks. */
  maxBeatsPerFrame: 3,
  peakGain: 0.07,
  burstSeconds: 0.012,
  bandHz: { tick: 3200, tock: 2300 },
  pingHz: { tick: 1900, tock: 1350 },
  pingSeconds: 0.03,
  storageKey: "mw3d.tick",
} as const;

/** The model's beat frequency in Hz for the first escapement, or null without a driven escape arbor. */
export function modelBeatHertz(store: AppStore): number | null {
  const escapement = Object.values(store.movement.escapements)[0];
  if (escapement === undefined || !isValidToothCount(escapement.escapeWheel.toothCount)) return null;
  const omega = store.analysis.train.shaftAngularVelocity.get(escapement.escapeArborShaftId);
  if (omega === undefined || omega === 0) return null;
  const hertz = beatFrequency(omega, escapement.escapeWheel.toothCount);
  return Number.isFinite(hertz) && hertz > 0 ? hertz : null;
}

/** The index of the beat a simulated time falls in. */
export function beatIndex(simulatedSeconds: number, beatHertz: number): number {
  return Math.floor(simulatedSeconds * beatHertz);
}

/**
 * Whether going from one beat index to another is a forward tick: one or a few beats ahead (a slow
 * frame can span more than one beat; it still plays a single tick). A jump, a repeat or a backward
 * move is not a tick, and neither is anything above `maxPlaybackRate`.
 */
export function isForwardBeat(previous: number, next: number, playbackRate: number): boolean {
  return playbackRate <= TICK_SOUND.maxPlaybackRate && next > previous && next - previous <= TICK_SOUND.maxBeatsPerFrame;
}

/** Play one tick (`alternate` false) or tock (true). */
export function playTick(alternate: boolean): void {
  const context = audioContext();
  if (context?.state !== "running") return;
  try {
    const v = TICK_SOUND;
    const now = context.currentTime;
    const which = alternate ? "tock" : "tick";
    const samples = Math.max(1, Math.floor(context.sampleRate * v.burstSeconds));
    const buffer = context.createBuffer(1, samples, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / samples) ** 3;
    const burst = context.createBufferSource();
    burst.buffer = buffer;
    const band = context.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = v.bandHz[which];
    band.Q.value = 1.4;
    const burstGain = context.createGain();
    burstGain.gain.value = v.peakGain * 2.2;
    burst.connect(band).connect(burstGain).connect(context.destination);
    burst.start(now);

    const ping = context.createOscillator();
    ping.type = "triangle";
    ping.frequency.value = v.pingHz[which];
    const pingGain = context.createGain();
    pingGain.gain.setValueAtTime(v.peakGain * 0.5, now);
    pingGain.gain.exponentialRampToValueAtTime(0.0001, now + v.pingSeconds);
    ping.connect(pingGain).connect(context.destination);
    ping.start(now);
    ping.stop(now + v.pingSeconds);
  } catch {
    // Audio unavailable: stay silent.
  }
}

/**
 * Ticks on each escapement beat while the simulation runs (see `TICK_SOUND`), with a "Tick" toggle
 * button the caller places in the toolbar; the choice is remembered. Returns the button.
 */
export function mountTickSound(store: AppStore, storage: KeyValueStore | null): HTMLButtonElement {
  let enabled = ((): boolean => {
    try { return storage?.getItem(TICK_SOUND.storageKey) !== "off"; } catch { return true; }
  })();
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.dataset.testid = "tick-toggle";
  toggle.title = "Tick on every escapement beat (the model's own beat rate) while the simulation runs at real time or slower. Decorative sound, ASM-0084";
  const render = (): void => {
    toggle.textContent = enabled ? "Tick: on" : "Tick: off";
    toggle.setAttribute("aria-pressed", String(enabled));
  };
  render();
  toggle.addEventListener("click", () => {
    enabled = !enabled;
    try { storage?.setItem(TICK_SOUND.storageKey, enabled ? "on" : "off"); } catch { /* not remembered */ }
    render();
  });

  let previous: number | null = null;
  const loop = (): void => {
    const beatHertz = store.playing ? modelBeatHertz(store) : null;
    if (beatHertz === null) {
      previous = null;
    } else {
      const index = beatIndex(store.simulation.time, beatHertz);
      if (previous !== null && index !== previous && enabled && isForwardBeat(previous, index, store.playbackRate)) {
        playTick(index % 2 !== 0);
      }
      previous = index;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return toggle;
}

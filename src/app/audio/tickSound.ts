import type { AppStore } from "@/app/store";
import type { KeyValueStore } from "@/persistence/autosave";
import { readHand } from "@/kinematics/timeDisplay";
import { audioContext } from "./audioContext";

/**
 * The second hand's tick (follow-up 30, ASM-0084): a short mechanical tick each time the simulated
 * seconds hand advances onto the next whole second of its dial, alternating a higher "tick" and a
 * lower "tock". Decorative: the hand sweeps continuously in this model, so this is one tick per
 * dial second, NOT the escapement's own beat (a real balance beats several times a second), and it
 * is silent whenever the simulation is faster than real time or paused.
 */
export const TICK_SOUND = {
  /** Above real-time playback the ticks would run together, so they are muted. */
  maxPlaybackRate: 1,
  peakGain: 0.07,
  burstSeconds: 0.012,
  bandHz: { tick: 3200, tock: 2300 },
  pingHz: { tick: 1900, tock: 1350 },
  pingSeconds: 0.03,
  storageKey: "mw3d.tick",
} as const;

/** The dial second a seconds-hand angle (radians) is on: 0-59. */
export function secondsStep(angle: number): number {
  return Math.min(59, Math.floor(readHand("SECONDS", angle)));
}

/**
 * Whether going from one dial second to another is a forward tick: exactly the next second (59 wraps
 * to 0). A jump (setting the hands, resetting, set-to-browser-time) or a backward move is not a tick,
 * and neither is anything above `maxPlaybackRate`.
 */
export function isForwardTick(previous: number, next: number, playbackRate: number): boolean {
  return playbackRate <= TICK_SOUND.maxPlaybackRate && next === (previous + 1) % 60;
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
 * Ticks the second hand while the simulation runs (see `TICK_SOUND`), with a "Tick" toggle button the
 * caller places in the toolbar; the choice is remembered. Returns the button.
 */
export function mountTickSound(store: AppStore, storage: KeyValueStore | null): HTMLButtonElement {
  let enabled = ((): boolean => {
    try { return storage?.getItem(TICK_SOUND.storageKey) !== "off"; } catch { return true; }
  })();
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.dataset.testid = "tick-toggle";
  toggle.title = "Tick the second hand once per dial second while the simulation runs at real time or slower (decorative, ASM-0084)";
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
  let alternate = false;
  const loop = (): void => {
    const hand = Object.values(store.movement.shafts).find((s) => s.hand === "SECONDS");
    if (hand === undefined || !store.playing) {
      previous = null;
    } else {
      const step = secondsStep(store.simulation.shaftAngle[hand.id] ?? 0);
      if (previous !== null && step !== previous && enabled && isForwardTick(previous, step, store.playbackRate)) {
        playTick(alternate);
        alternate = !alternate;
      }
      previous = step;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return toggle;
}

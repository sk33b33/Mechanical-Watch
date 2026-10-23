/**
 * The soft mechanical click played when the splash screen is entered, synthesised with the Web Audio
 * API (no audio files): a short band-passed noise burst for the tick and a quiet, quickly decaying
 * low tone under it. Decorative only. It is called from the tap that enters, so the browser's
 * autoplay rules allow it; any failure (no Web Audio, blocked context) is silent.
 */
const SOUND = { peakGain: 0.12, tickSeconds: 0.05, toneHz: 180, toneSeconds: 0.22, tickBandHz: 2400 } as const;

export function playEntryClick(): void {
  try {
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const now = context.currentTime;

    const samples = Math.max(1, Math.floor(context.sampleRate * SOUND.tickSeconds));
    const noise = context.createBuffer(1, samples, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < samples; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / samples) ** 2;
    const tick = context.createBufferSource();
    tick.buffer = noise;
    const band = context.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = SOUND.tickBandHz;
    const tickGain = context.createGain();
    tickGain.gain.value = SOUND.peakGain;
    tick.connect(band).connect(tickGain).connect(context.destination);
    tick.start(now);

    const tone = context.createOscillator();
    tone.frequency.setValueAtTime(SOUND.toneHz, now);
    tone.frequency.exponentialRampToValueAtTime(SOUND.toneHz / 2, now + SOUND.toneSeconds);
    const toneGain = context.createGain();
    toneGain.gain.setValueAtTime(SOUND.peakGain * 0.6, now);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + SOUND.toneSeconds);
    tone.connect(toneGain).connect(context.destination);
    tone.start(now);
    tone.stop(now + SOUND.toneSeconds);
    tone.addEventListener("ended", () => { void context.close(); });
  } catch {
    // No Web Audio, or the context was refused: the splash simply enters silently.
  }
}

/**
 * One shared Web Audio context for the app's decorative sounds (the splash click and the second-hand
 * tick). Browsers keep a context suspended until a user gesture, so `unlockAudio` is called from the
 * splash tap and from the first pointer press or key press anywhere. Any failure is silent.
 */
let shared: AudioContext | null = null;

export function audioContext(): AudioContext | null {
  try {
    shared ??= new window.AudioContext();
    return shared;
  } catch {
    return null;
  }
}

export function unlockAudio(): void {
  const context = audioContext();
  if (context !== null && context.state === "suspended") void context.resume().catch(() => undefined);
}

/** Resume the context on the first user gesture, for sessions that never see the splash screen. */
export function unlockAudioOnFirstGesture(): void {
  const once = (): void => {
    unlockAudio();
    window.removeEventListener("pointerdown", once, true);
    window.removeEventListener("keydown", once, true);
  };
  window.addEventListener("pointerdown", once, true);
  window.addEventListener("keydown", once, true);
}

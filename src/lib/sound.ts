/**
 * Web Audio API based alert sounds — no audio files needed.
 * Works on all modern browsers. Requires user interaction first
 * (browsers block autoplay until user taps something on the page).
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

/** Plays a triple-beep loud alert — used when a new order arrives */
export function playNewOrderAlert(): void {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const beepCount = 3;
    const beepDuration = 0.18;   // seconds each beep
    const pauseDuration = 0.10;  // gap between beeps
    const frequency = 880;       // Hz — high, attention-grabbing A5 note
    const volume = 1.0;          // 0–1, max volume

    for (let i = 0; i < beepCount; i++) {
      const startTime = ctx.currentTime + i * (beepDuration + pauseDuration);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'square';       // square wave is harsher = more noticeable
      osc.frequency.value = frequency;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
      gain.gain.setValueAtTime(volume, startTime + beepDuration - 0.02);
      gain.gain.linearRampToValueAtTime(0, startTime + beepDuration);

      osc.start(startTime);
      osc.stop(startTime + beepDuration);
    }
  } catch {
    // Silently fail if audio not available
  }
}

/** Softer single ping — used when order status changes to Ready */
export function playReadyAlert(): void {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.value = 1046; // C6 — pleasant ding

    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.8, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    osc.start(t);
    osc.stop(t + 0.6);
  } catch {
    // Silently fail
  }
}

/** Call once on first user interaction to unlock AudioContext on iOS/Safari */
export function unlockAudio(): void {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    // ignore
  }
}

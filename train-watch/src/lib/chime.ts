/**
 * ブラウザのWeb Push通知は端末の既定通知音しか鳴らせない（アプリ側から音源や
 * 再生時間を指定できないOSの制約）。そのため、通知をタップしてアプリを開いた
 * 瞬間に、アプリ内で「3秒鳴って止まるチャイム」をWeb Audio APIで合成して鳴らす。
 */
export function playThreeSecondChime(): void {
  if (typeof window === "undefined") return;
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  const notes = [880, 1108.73, 1318.51]; // A5 -> C#6 -> E6 の軽やかなチャイム
  const noteDuration = 0.9;
  const gap = 0.05;

  notes.forEach((freq, i) => {
    const startAt = ctx.currentTime + i * (noteDuration + gap);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startAt);

    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(0.28, startAt + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + noteDuration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startAt);
    osc.stop(startAt + noteDuration);
  });

  const totalDuration = notes.length * (noteDuration + gap);
  setTimeout(() => {
    ctx.close().catch(() => undefined);
  }, totalDuration * 1000 + 200);
}

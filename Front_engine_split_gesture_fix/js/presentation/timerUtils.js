export function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function formatDuration(totalSeconds) {
  const secs = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(secs / 60);
  const remainder = secs % 60;
  if (!minutes) return `${remainder}초`;
  return `${minutes}분 ${String(remainder).padStart(2, "0")}초`;
}

export function getProgressPercent(elapsedSeconds, expectedMinutes) {
  const expectedSeconds = Math.max(1, expectedMinutes * 60);
  return Math.floor((elapsedSeconds / expectedSeconds) * 100);
}

const QUEUE_KEY = "airnote.annotationQueue";
const MAX_QUEUE_SIZE = 200;

function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.warn("AirNote annotationQueue: queue persist failed.", error);
  }
}

export function enqueueAnnotation(fields) {
  const queue = loadQueue();
  if (queue.length >= MAX_QUEUE_SIZE) queue.shift();
  queue.push({ ...fields, _queuedAt: new Date().toISOString() });
  saveQueue(queue);
}

export function peekQueue() {
  return loadQueue();
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export async function flushAnnotationQueue(saveAnnotationFn) {
  const queue = loadQueue();
  if (!queue.length) return { flushed: 0, failed: 0 };
  let flushed = 0;
  let failed = 0;
  const remaining = [];
  for (const item of queue) {
    try {
      const { _queuedAt: _ignored, ...fields } = item;
      await saveAnnotationFn(fields);
      flushed++;
    } catch {
      remaining.push(item);
      failed++;
    }
  }
  saveQueue(remaining);
  return { flushed, failed };
}

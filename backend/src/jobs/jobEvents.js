import { EventEmitter } from "events";

const bus = new EventEmitter();
bus.setMaxListeners(1000);

function eventKey(jobId) {
  return `job:${jobId}`;
}

export function emitJobEvent(jobId, payload = {}) {
  if (!jobId) return;
  bus.emit(eventKey(jobId), {
    ...payload,
    emitted_at: new Date().toISOString(),
  });
}

export function subscribeJob(jobId, handler) {
  const key = eventKey(jobId);
  bus.on(key, handler);
  return () => bus.off(key, handler);
}

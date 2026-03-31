const jobs = new Map();

function nowIso() {
  return new Date().toISOString();
}

export function createJob(meta = {}) {
  const jobId =
    "job_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8);

  const job = {
    job_id: jobId,
    status: "queued",
    created_at: nowIso(),
    updated_at: nowIso(),
    started_at: null,
    completed_at: null,
    error: null,
    meta,
    result: null,
  };

  jobs.set(jobId, job);
  return { ...job };
}

export function getJob(jobId) {
  const job = jobs.get(jobId);
  return job ? { ...job } : null;
}

export function updateJob(jobId, patch = {}) {
  const existing = jobs.get(jobId);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...patch,
    updated_at: nowIso(),
  };

  jobs.set(jobId, updated);
  return { ...updated };
}

export function listJobs() {
  return Array.from(jobs.values())
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((job) => ({ ...job }));
}

import { emitJobEvent } from "./jobEvents.js";
import { redis } from "../lib/redis.js";

const JOB_KEY_PREFIX = "job";

function nowIso() {
  return new Date().toISOString();
}

function jobKey(jobId) {
  return `${JOB_KEY_PREFIX}:${jobId}`;
}

async function saveJob(job) {
  await redis.set(jobKey(job.job_id), JSON.stringify(job));
  return { ...job };
}

async function readJob(jobId) {
  const raw = await redis.get(jobKey(jobId));
  return raw ? JSON.parse(raw) : null;
}

export async function createJob(meta = {}) {
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
    progress: null,
  };

  await saveJob(job);

  emitJobEvent(jobId, {
    type: "job_created",
    job: { ...job },
  });

  return { ...job };
}

export async function getJob(jobId) {
  return await readJob(jobId);
}

export async function updateJob(jobId, patch = {}) {
  const existing = await readJob(jobId);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...patch,
    updated_at: nowIso(),
  };

  await saveJob(updated);

  emitJobEvent(jobId, {
    type: "job_updated",
    job: { ...updated },
  });

  return { ...updated };
}

export async function listJobs(limit = 100) {
  const keys = await redis.keys(`${JOB_KEY_PREFIX}:*`);
  const rows = [];

  for (const key of keys) {
    const raw = await redis.get(key);
    if (!raw) continue;
    rows.push(JSON.parse(raw));
  }

  return rows
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

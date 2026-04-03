import { redis } from "../lib/redis.js";

const LOCK_PREFIX = "lock:project";

function lockKey(projectId) {
  return `${LOCK_PREFIX}:${projectId}`;
}

export async function acquireProjectLock(
  projectId,
  ownerId,
  ttlMs = 30 * 60 * 1000,
) {
  const result = await redis.set(
    lockKey(projectId),
    ownerId,
    "PX",
    ttlMs,
    "NX",
  );
  return result === "OK";
}

export async function releaseProjectLock(projectId, ownerId) {
  const key = lockKey(projectId);
  const current = await redis.get(key);
  if (current === ownerId) {
    await redis.del(key);
    return true;
  }
  return false;
}

export async function extendProjectLock(
  projectId,
  ownerId,
  ttlMs = 30 * 60 * 1000,
) {
  const key = lockKey(projectId);
  const current = await redis.get(key);
  if (current === ownerId) {
    await redis.pexpire(key, ttlMs);
    return true;
  }
  return false;
}

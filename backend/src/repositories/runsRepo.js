import { pool } from "../db/postgres.js";

function normalizeIncludeTypes(includeTypes) {
  return Array.isArray(includeTypes) ? includeTypes : [];
}

function normalizeCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function createGenerationRun({
  projectId,
  orgId,
  createdBy,
  generationMode,
  includeTypes,
  env,
  authProfile,
  endpointCount,
  progressTotal,
}) {
  const safeEndpointCount = normalizeCount(endpointCount);
  const safeProgressTotal =
    progressTotal == null ? safeEndpointCount : normalizeCount(progressTotal);

  const query = `
    INSERT INTO generation_runs (
      project_id,
      org_id,
      created_by,
      status,
      generation_mode,
      include_types,
      env,
      auth_profile,
      endpoint_count,
      progress_total,
      started_at
    )
    VALUES ($1, $2, $3, 'running', $4, $5::jsonb, $6, $7, $8, $9, NOW())
    RETURNING *
  `;

  const values = [
    projectId,
    orgId,
    createdBy,
    generationMode ?? null,
    JSON.stringify(normalizeIncludeTypes(includeTypes)),
    env ?? null,
    authProfile ?? null,
    safeEndpointCount,
    safeProgressTotal,
  ];

  const result = await pool.query(query, values);
  return result.rows[0] ?? null;
}

export async function completeGenerationRun(runId, caseCount) {
  const query = `
    UPDATE generation_runs
    SET
      status = 'completed',
      case_count = $2,
      progress_current = progress_total,
      completed_at = NOW()
    WHERE run_id = $1
    RETURNING *
  `;

  const result = await pool.query(query, [runId, normalizeCount(caseCount)]);
  return result.rows[0] ?? null;
}

export async function failGenerationRun(runId, errorMessage) {
  const query = `
    UPDATE generation_runs
    SET
      status = 'failed',
      error_message = $2,
      completed_at = NOW()
    WHERE run_id = $1
    RETURNING *
  `;

  const result = await pool.query(query, [runId, errorMessage ?? null]);
  return result.rows[0] ?? null;
}

export async function updateRunProgress(runId, current) {
  const query = `
    UPDATE generation_runs
    SET progress_current = $2
    WHERE run_id = $1
    RETURNING run_id, progress_current, progress_total, status
  `;

  const result = await pool.query(query, [runId, normalizeCount(current)]);
  return result.rows[0] ?? null;
}

export async function getRunById(runId) {
  const result = await pool.query(
    `SELECT * FROM generation_runs WHERE run_id = $1`,
    [runId],
  );
  return result.rows[0] ?? null;
}

export async function deleteRunById(runId) {
  await pool.query(`DELETE FROM generation_runs WHERE run_id = $1`, [runId]);
}

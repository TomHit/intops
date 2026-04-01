import { pool } from "../db/postgres.js";

export async function createProjectRecord({
  projectId,
  orgId,
  name,
  specSource,
}) {
  const result = await pool.query(
    `
      INSERT INTO projects (
        project_id,
        org_id,
        name,
        spec_source,
        generation_status
      )
      VALUES ($1, $2, $3, $4, 'idle')
      RETURNING *
    `,
    [projectId, orgId, name, specSource || null],
  );

  return result.rows[0] || null;
}

export async function setProjectCurrentRun(projectId, runId) {
  const query = `
    UPDATE projects
    SET
      current_run_id = $2,
      generation_status = 'idle',
      updated_at = NOW()
    WHERE project_id = $1
    RETURNING *
  `;

  const result = await pool.query(query, [projectId, runId]);
  return result.rows[0];
}

export async function setProjectGenerationStatus(projectId, status) {
  const query = `
    UPDATE projects
    SET
      generation_status = $2,
      updated_at = NOW()
    WHERE project_id = $1
    RETURNING *
  `;

  const result = await pool.query(query, [projectId, status]);
  return result.rows[0] || null;
}

export async function getProjectById(projectId) {
  const result = await pool.query(
    `SELECT * FROM projects WHERE project_id = $1`,
    [projectId],
  );
  return result.rows[0] || null;
}

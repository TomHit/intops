import { pool } from "../db/postgres.js";

export async function createProjectRecord({
  projectId,
  orgId,
  name,
  description = "",
  specSourceType = "url",
  specSource = "",
  specFormat = "auto",
  docsStatus = "missing",
}) {
  const result = await pool.query(
    `
      INSERT INTO projects (
        project_id,
        org_id,
        name,
        description,
        spec_source_type,
        spec_source,
        spec_format,
        docs_status,
        generation_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'idle')
      RETURNING *
    `,
    [
      projectId,
      orgId,
      name,
      description || "",
      specSourceType || "url",
      specSource || null,
      specFormat || "auto",
      docsStatus || "missing",
    ],
  );

  return result.rows[0] || null;
}

export async function listProjectsByOrg(orgId) {
  const result = await pool.query(
    `
      SELECT *
      FROM projects
      WHERE org_id = $1
      ORDER BY name ASC
    `,
    [orgId],
  );

  return result.rows || [];
}

export async function listAllProjects() {
  const result = await pool.query(
    `
      SELECT *
      FROM projects
      ORDER BY name ASC
    `,
  );

  return result.rows || [];
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
  return result.rows[0] || null;
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

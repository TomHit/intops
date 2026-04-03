import { pool } from "../db/postgres.js";

const DEFAULT_INSERT_CHUNK_SIZE = 200;

function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function insertGeneratedCasesChunk(client, caseRows) {
  if (!Array.isArray(caseRows) || caseRows.length === 0) {
    return 0;
  }

  const values = [];
  const placeholders = [];

  caseRows.forEach((row, index) => {
    const base = index * 11;

    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}::jsonb)`,
    );

    values.push(
      row.case_id,
      row.run_id,
      row.project_id,
      row.org_id,
      row.method,
      row.path,
      row.test_type,
      row.priority ?? null,
      row.title,
      row.module ?? null,
      JSON.stringify(row.payload ?? {}),
    );
  });

  const query = `
    INSERT INTO generated_cases (
      case_id,
      run_id,
      project_id,
      org_id,
      method,
      path,
      test_type,
      priority,
      title,
      module,
      payload
    )
    VALUES ${placeholders.join(",")}
    ON CONFLICT (run_id, case_id) DO NOTHING
    RETURNING case_id
  `;

  const result = await client.query(query, values);
  return result.rowCount || 0;
}

export async function insertGeneratedCases(caseRows = [], options = {}) {
  if (!Array.isArray(caseRows) || caseRows.length === 0) {
    return 0;
  }

  const chunkSize = normalizePositiveInt(
    options.chunkSize,
    DEFAULT_INSERT_CHUNK_SIZE,
  );

  const client = await pool.connect();

  try {
    let insertedCount = 0;
    const chunks = chunkArray(caseRows, chunkSize);

    for (const chunk of chunks) {
      insertedCount += await insertGeneratedCasesChunk(client, chunk);
    }

    return insertedCount;
  } finally {
    client.release();
  }
}

export async function countCasesByRun(runId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM generated_cases WHERE run_id = $1`,
    [runId],
  );
  return result.rows[0]?.count || 0;
}

export async function deleteCasesByRun(runId) {
  await pool.query(`DELETE FROM generated_cases WHERE run_id = $1`, [runId]);
}

export async function getCasesByRunPaginated(runId, page = 1, pageSize = 50) {
  const limit = Math.max(1, Number(pageSize) || 50);
  const offset = (Math.max(1, Number(page) || 1) - 1) * limit;

  const totalResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM generated_cases WHERE run_id = $1`,
    [runId],
  );

  const rowsResult = await pool.query(
    `
      SELECT
        case_id,
        run_id,
        project_id,
        org_id,
        method,
        path,
        test_type,
        priority,
        title,
        module,
        payload,
        created_at
      FROM generated_cases
      WHERE run_id = $1
      ORDER BY created_at ASC, case_id ASC
      LIMIT $2 OFFSET $3
    `,
    [runId, limit, offset],
  );

  return {
    total: totalResult.rows[0]?.total || 0,
    cases: rowsResult.rows,
  };
}

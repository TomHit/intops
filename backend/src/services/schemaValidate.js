import fs from "fs/promises";
import path from "path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  allowUnionTypes: true,
});

addFormats(ajv);

let validateFn = null;

export async function getValidator() {
  if (validateFn) return validateFn;

  const schemaPath = path.join(
    process.cwd(),
    "src",
    "schema",
    "testplan.schema.json",
  );

  let raw;
  try {
    raw = await fs.readFile(schemaPath, "utf-8");
  } catch (e) {
    const err = new Error(`Unable to read schema file at: ${schemaPath}`);
    err.details = { schemaPath, cause: String(e?.message || e) };
    throw err;
  }

  let schema;
  try {
    schema = JSON.parse(raw);
  } catch (e) {
    const err = new Error(`Invalid JSON in schema file: ${schemaPath}`);
    err.details = { schemaPath, cause: String(e?.message || e) };
    throw err;
  }

  validateFn = ajv.compile(schema);
  return validateFn;
}

export async function validateTestPlanOrThrow(obj) {
  const validate = await getValidator();
  const ok = validate(obj);

  if (!ok) {
    const errors = (validate.errors || []).map((e) => ({
      path: e.instancePath || "/",
      message: e.message,
      keyword: e.keyword,
      params: e.params,
      schemaPath: e.schemaPath,
    }));

    console.log("AJV ERRORS:", JSON.stringify(errors, null, 2));

    const err = new Error("Schema validation failed");
    err.details = { errors };
    throw err;
  }

  return true;
}

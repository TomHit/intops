import fs from "fs/promises";
import path from "path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, strict: false });
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
  const raw = await fs.readFile(schemaPath, "utf-8");
  const schema = JSON.parse(raw);

  validateFn = ajv.compile(schema);
  return validateFn;
}

export async function validateTestPlanOrThrow(obj) {
  const validate = await getValidator();
  const ok = validate(obj);

  if (!ok) {
    const errors = (validate.errors || []).map((e) => ({
      path: e.instancePath,
      message: e.message,
      keyword: e.keyword,
      params: e.params,
    }));
    console.log("AJV ERRORS:", JSON.stringify(errors, null, 2));

    const err = new Error("Schema validation failed");
    err.details = { errors };
    throw err;
  }
}

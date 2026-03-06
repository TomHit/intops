import fs from "fs";
import path from "path";
import csv from "csv-parser";

const RULES_PATH = path.join(
  process.cwd(),
  "src",
  "rules",
  "api_test_rules_catalog.csv",
);

let cachedRules = null;

export async function loadRuleCatalog() {
  if (cachedRules) return cachedRules;

  const rules = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(RULES_PATH)
      .pipe(csv())
      .on("data", (row) => rules.push(row))
      .on("end", resolve)
      .on("error", reject);
  });

  cachedRules = rules;
  return rules;
}

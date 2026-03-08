import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { TEMPLATE_REGISTRY } from "../services/templateRegistry.js";

const RULES_PATH = path.join(
  process.cwd(),
  "src",
  "rules",
  "api_test_rules_catalog.csv",
);

let cachedRules = null;

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeRuleRow(row) {
  const normalized = {
    rule_id: clean(row.rule_id),
    category: clean(row.category).toLowerCase(),
    scenario: clean(row.scenario),
    applies_when: clean(row.applies_when),
    test_case_title: clean(row.test_case_title),
    priority: clean(row.priority).toUpperCase(),
    severity: clean(row.severity).toLowerCase(),
    method_filter: clean(row.method_filter),
    entity_scope: clean(row.entity_scope),
    notes: clean(row.notes),
    template_key: clean(row.template_key),
  };

  if (
    normalized.template_key &&
    !Object.prototype.hasOwnProperty.call(
      TEMPLATE_REGISTRY,
      normalized.template_key,
    )
  ) {
    console.warn(
      `Unknown template_key in rules CSV: ${normalized.template_key} (rule_id=${normalized.rule_id})`,
    );
  }

  return normalized;
}

export async function loadRuleCatalog() {
  if (cachedRules) return cachedRules;

  const rules = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(RULES_PATH)
      .pipe(csv())
      .on("data", (row) => {
        try {
          rules.push(normalizeRuleRow(row));
        } catch (err) {
          console.error("Failed to normalize rule row:", row, err);
        }
      })
      .on("end", resolve)
      .on("error", reject);
  });

  cachedRules = rules;
  return rules;
}

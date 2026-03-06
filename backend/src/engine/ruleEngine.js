import { loadRuleCatalog } from "../rules/loadRuleCatalog.js";
import { RULE_CONDITION_MAP } from "../rules/ruleConditionMap.js";

export async function evaluateRules(endpoint, options = {}) {
  const include = options?.include || ["contract", "schema"];

  const rules = await loadRuleCatalog();
  const matchedRules = [];

  for (const rule of rules) {
    if (!include.includes(rule.category)) continue;

    const conditionFn = RULE_CONDITION_MAP[rule.applies_when];

    if (!conditionFn) continue;

    try {
      if (conditionFn(endpoint)) {
        matchedRules.push(rule);
      }
    } catch (err) {
      console.error("Rule evaluation failed:", rule.rule_id, err);
    }
  }

  return matchedRules;
}

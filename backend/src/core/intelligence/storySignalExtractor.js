function cleanText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function lower(value = "") {
  return cleanText(value).toLowerCase();
}

function unique(items = []) {
  return [...new Set((items || []).filter(Boolean))];
}

function detectActors(text = "") {
  const t = lower(text);
  const actors = [];

  if (/\bmerchant\b/.test(t)) actors.push("merchant");
  if (/\bcustomer\b/.test(t)) actors.push("customer");
  if (/\buser\b/.test(t)) actors.push("user");
  if (/\badmin\b/.test(t)) actors.push("admin");
  if (/\boperator\b/.test(t)) actors.push("operator");
  if (/\bagent\b/.test(t)) actors.push("agent");
  if (/\bbuyer\b/.test(t)) actors.push("buyer");
  if (/\bseller\b/.test(t)) actors.push("seller");
  if (/\bpatient\b/.test(t)) actors.push("patient");
  if (/\bdoctor\b/.test(t)) actors.push("doctor");
  if (/\bmanager\b/.test(t)) actors.push("manager");
  if (/\bemployee\b/.test(t)) actors.push("employee");

  return unique(actors);
}

function detectIntent(text = "") {
  const t = cleanText(text);

  const asMatch = t.match(
    /as\s+a?n?\s+(.+?)(?:,|\s+i\s+want|\s+i\s+should|\s+i\s+can|$)/i,
  );
  const wantMatch = t.match(
    /i\s+(?:want\s+to|should\s+be\s+able\s+to|can)\s+(.+?)(?:\s+so\s+that|\.$|$)/i,
  );
  const soThatMatch = t.match(/so\s+that\s+(.+?)(?:\.$|$)/i);

  return {
    actor_phrase: asMatch?.[1]?.trim() || "",
    action_phrase: wantMatch?.[1]?.trim() || "",
    benefit_phrase: soThatMatch?.[1]?.trim() || "",
  };
}

function detectDomainHints(text = "") {
  const t = lower(text);
  const out = [];

  if (
    /\bpayment\b|\bupi\b|\brefund\b|\bsettlement\b|\btransaction\b|\bnet banking\b|\bwallet\b|\bchargeback\b|\bdispute\b/.test(
      t,
    )
  ) {
    out.push("banking_finance");
  }

  if (
    /\bpatient\b|\bclaim\b|\bdiagnosis\b|\bhospital\b|\bmedical\b|\bhealth\b/.test(
      t,
    )
  ) {
    out.push("healthcare");
  }

  if (
    /\bchat\b|\bprompt\b|\bmodel\b|\brag\b|\bknowledge base\b|\bembedding\b/.test(
      t,
    )
  ) {
    out.push("ai_system");
  }

  if (/\border\b|\bcart\b|\bcheckout\b|\bshipment\b|\binventory\b/.test(t)) {
    out.push("ecommerce");
  }

  return unique(out);
}

function detectActionHints(text = "") {
  const t = lower(text);
  const out = [];

  if (/\bpay\b|\bpayment\b|\bcollect\b/.test(t)) out.push("payment");
  if (/\brefund\b/.test(t)) out.push("refund");
  if (/\bsettlement\b/.test(t)) out.push("settlement");
  if (/\bdispute\b|\bchargeback\b/.test(t)) out.push("dispute");
  if (/\bnotify\b|\bemail\b|\bsms\b|\balert\b/.test(t)) {
    out.push("notification");
  }
  if (/\blogin\b|\bauth\b|\bsign in\b/.test(t)) out.push("authentication");
  if (/\bupload\b|\battachment\b|\bfile\b/.test(t)) out.push("upload");
  if (/\bsearch\b|\bretrieve\b|\bquery\b/.test(t)) out.push("search");

  return unique(out);
}

function detectConstraints(text = "") {
  const t = lower(text);
  const out = [];

  if (/\bretry\b/.test(t)) out.push("retry handling");
  if (/\bidempot/i.test(t)) out.push("idempotency");
  if (/\breal[- ]?time\b/.test(t)) out.push("real-time behavior");
  if (/\blatency\b|\bperformance\b/.test(t)) {
    out.push("performance expectations");
  }
  if (/\bsecure\b|\bencrypt\b|\btoken\b|\b2fa\b/.test(t)) {
    out.push("security controls");
  }

  return unique(out);
}

export function extractStorySignals({
  story = "",
  acceptanceCriteria = "",
  comments = "",
} = {}) {
  const combined = [story, acceptanceCriteria, comments]
    .map(cleanText)
    .filter(Boolean)
    .join("\n\n");

  const actors = detectActors(combined);
  const intent = detectIntent(story || combined);
  const domain_hints = detectDomainHints(combined);
  const action_hints = detectActionHints(combined);
  const constraints = detectConstraints(combined);

  return {
    source_type: "user_story",
    has_content: Boolean(cleanText(combined)),
    raw_text: combined,
    source_parts: {
      story: cleanText(story),
      acceptance_criteria: cleanText(acceptanceCriteria),
      comments: cleanText(comments),
    },
    actors,
    intent,
    domain_hints,
    action_hints,
    constraints,
  };
}

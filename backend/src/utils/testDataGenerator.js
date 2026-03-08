function randomInt(min = 1, max = 1000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomString(len = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function randomEmail() {
  return `qa_${randomString(6)}@example.com`;
}

function randomUuid() {
  return crypto.randomUUID();
}

function randomDateTime() {
  return new Date().toISOString();
}

export function generateValueFromSchema(prop, name) {
  if (!prop) return `<valid_${name}>`;

  if (prop.enum && prop.enum.length > 0) {
    return prop.enum[0];
  }

  const type = prop.type || "string";
  const format = prop.format;

  if (format === "email") return randomEmail();
  if (format === "uuid") return randomUuid();
  if (format === "date-time") return randomDateTime();

  if (type === "string") {
    return randomString();
  }

  if (type === "integer" || type === "number") {
    return randomInt();
  }

  if (type === "boolean") {
    return true;
  }

  if (type === "array") {
    return [generateValueFromSchema(prop.items || {}, name)];
  }

  if (type === "object") {
    const obj = {};
    const props = prop.properties || {};
    for (const k of Object.keys(props)) {
      obj[k] = generateValueFromSchema(props[k], k);
    }
    return obj;
  }

  return `<valid_${name}>`;
}

export function generateObjectFromSchema(schema) {
  if (!schema || !schema.properties) return null;

  const obj = {};
  const props = schema.properties;

  for (const key of Object.keys(props)) {
    obj[key] = generateValueFromSchema(props[key], key);
  }

  return obj;
}

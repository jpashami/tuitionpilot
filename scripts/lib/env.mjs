// Minimal .env.local reader/writer for the setup scripts. Never prints values.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const ENV_PATH = join(process.cwd(), ".env.local");

export function readEnv() {
  if (!existsSync(ENV_PATH)) return {};
  const env = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

export function updateEnv(values) {
  const lines = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8").split(/\r?\n/) : [];
  for (const [key, value] of Object.entries(values)) {
    const i = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (i >= 0) lines[i] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  writeFileSync(ENV_PATH, lines.filter((l, i) => l !== "" || i < lines.length - 1).join("\n") + "\n");
}

export function requireEnv(...keys) {
  const env = readEnv();
  const missing = keys.filter((k) => !env[k]);
  if (missing.length) {
    console.error(`Missing in .env.local: ${missing.join(", ")}`);
    process.exit(1);
  }
  return env;
}

export const BASE_URL =
  readEnv().GOBTC_BASE_URL || "https://api.gobtcpay.com/public/api/v1.2";

// POST JSON and unwrap GoBTC's { result: { $case } } envelope.
export async function gobtc(path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${path}: HTTP ${res.status} non-JSON response: ${text.slice(0, 200)}`);
  }
  const result = json.result;
  if (result?.$case === "success") return result.success;
  if (result?.$case === "failure") {
    const f = result.failure;
    throw new Error(`${path}: ${f.code ?? ""} ${f.data?.type ?? ""} ${f.message ?? ""} (trace ${json.meta?.traceId})`);
  }
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${text.slice(0, 200)}`);
  return json;
}

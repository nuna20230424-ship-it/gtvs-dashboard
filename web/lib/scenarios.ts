// 시나리오 YAML 메타 로드 — qa-automation/gtvs_updater/scenarios/*.yaml 파싱
import "server-only";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

export interface ScenarioStep {
  id: string;
  desc: string;
  risky?: boolean;
}

export interface ScenarioSpec {
  package: string;
  app_name: string;
  ref: string;
  auto_steps: ScenarioStep[];
  manual_checks: ScenarioStep[];
}

const CACHE: { specs?: Map<string, ScenarioSpec>; mtimeMax?: number } = {};

function specsDir(): string | null {
  const dir = process.env.GTVS_UPDATER_BAT_DIR;
  if (!dir) return null;
  return path.join(dir, "gtvs_updater", "scenarios");
}

// 디렉토리 mtime 변경 시 캐시 무효화 — 운영 중 yaml 수정 즉시 반영
function dirSignature(dir: string): number {
  try {
    const entries = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"));
    let m = 0;
    for (const e of entries) {
      const s = fs.statSync(path.join(dir, e));
      if (s.mtimeMs > m) m = s.mtimeMs;
    }
    return m;
  } catch {
    return -1;
  }
}

export function loadAllSpecs(): Map<string, ScenarioSpec> {
  const dir = specsDir();
  if (!dir) return new Map();
  const sig = dirSignature(dir);
  if (CACHE.specs && CACHE.mtimeMax === sig) return CACHE.specs;

  const out = new Map<string, ScenarioSpec>();
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"));
  } catch {
    return out;
  }
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const doc = yaml.load(raw) as Partial<ScenarioSpec> | undefined;
      if (!doc?.package || !doc?.ref) continue;
      out.set(doc.package, {
        package: doc.package,
        app_name: doc.app_name ?? doc.ref,
        ref: doc.ref,
        auto_steps: (doc.auto_steps ?? []).map((s) => ({
          id: s.id,
          desc: s.desc ?? "",
          risky: !!s.risky,
        })),
        manual_checks: (doc.manual_checks ?? []).map((s) => ({
          id: s.id,
          desc: s.desc ?? "",
        })),
      });
    } catch {
      // 한 파일 깨져도 나머지 진행
    }
  }
  CACHE.specs = out;
  CACHE.mtimeMax = sig;
  return out;
}

export function loadSpec(packageName: string): ScenarioSpec | undefined {
  return loadAllSpecs().get(packageName);
}

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { ClustersFile } from "./types";

// WHY 경로 변경: 기존 `process.cwd()/../config/clusters.yaml`는 webapp/ 디렉토리
// 기준으로 한 단계 위(레포 루트)를 참조했다.
// Vercel에서 Root Directory를 webapp/으로 설정하면 상위 디렉토리가 배포 번들에
// 포함되지 않아 ENOENT 오류로 즉시 크래시가 발생할 수 있다.
//
// WHY webapp/data/에 복사본을 두는가:
// webapp은 독립 배포 단위여야 한다. loaders.ts의 JSON 데이터들도 모두
// webapp/data/에 있으며, clusters 설정도 같은 위치로 통일한다.
// config/clusters.yaml(레포 루트)은 Python CLI prototype용으로 그대로 유지한다.
const CONFIG_PATH = path.resolve(process.cwd(), "data", "clusters.yaml");

let cached: ClustersFile | null = null;

export function loadClusters(): ClustersFile {
  if (cached) return cached;
  const text = fs.readFileSync(CONFIG_PATH, "utf-8");
  cached = yaml.load(text) as ClustersFile;
  return cached;
}

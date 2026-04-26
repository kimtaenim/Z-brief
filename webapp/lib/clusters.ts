import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { ClustersFile } from "./types";

const CONFIG_PATH = path.resolve(process.cwd(), "..", "config", "clusters.yaml");

let cached: ClustersFile | null = null;

export function loadClusters(): ClustersFile {
  if (cached) return cached;
  const text = fs.readFileSync(CONFIG_PATH, "utf-8");
  cached = yaml.load(text) as ClustersFile;
  return cached;
}

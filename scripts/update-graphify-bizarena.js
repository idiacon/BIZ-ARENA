const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const graphifyOut = path.join(repoRoot, "graphify-out");

function assertInsideRepo(targetPath) {
  const resolved = path.resolve(targetPath);
  if (resolved !== repoRoot && !resolved.startsWith(repoRoot + path.sep)) {
    throw new Error(`Refusing to touch path outside repo: ${resolved}`);
  }
  return resolved;
}

function nextBackupPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  let candidate = path.join(repoRoot, `graphify-out.backup-${stamp}`);
  let index = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(repoRoot, `graphify-out.backup-${stamp}-${index}`);
    index += 1;
  }
  return candidate;
}

function moveExistingGraph() {
  if (!fs.existsSync(graphifyOut)) {
    return null;
  }
  const backupPath = assertInsideRepo(nextBackupPath());
  fs.renameSync(assertInsideRepo(graphifyOut), backupPath);
  return backupPath;
}

function restoreBackup(backupPath) {
  if (!backupPath || fs.existsSync(graphifyOut) || !fs.existsSync(backupPath)) {
    return;
  }
  fs.renameSync(backupPath, graphifyOut);
}

function runGraphify() {
  const command = process.platform === "win32" ? "graphify.exe" : "graphify";
  return spawnSync(command, ["update", repoRoot, "--no-cluster"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
  });
}

function validateGraph() {
  const graphPath = path.join(graphifyOut, "graph.json");
  const rootPath = path.join(graphifyOut, ".graphify_root");
  if (!fs.existsSync(graphPath)) {
    throw new Error("graphify did not create graphify-out/graph.json");
  }
  const graphSize = fs.statSync(graphPath).size;
  const rootValue = fs.existsSync(rootPath) ? fs.readFileSync(rootPath, "utf8").trim() : "";
  return { graphSize, rootValue };
}

function main() {
  assertInsideRepo(graphifyOut);
  const ignorePath = path.join(repoRoot, ".graphifyignore");
  if (!fs.existsSync(ignorePath)) {
    throw new Error("Missing .graphifyignore; refusing to run an unbounded graphify update.");
  }

  const backupPath = moveExistingGraph();
  if (backupPath) {
    console.log(`[graphify] Moved existing graph to ${backupPath}`);
  }

  const result = runGraphify();
  if (result.status !== 0) {
    restoreBackup(backupPath);
    process.exit(result.status || 1);
  }

  try {
    const { graphSize, rootValue } = validateGraph();
    console.log(`[graphify] New graph: ${graphSize.toLocaleString("en-US")} bytes`);
    console.log(`[graphify] Root: ${rootValue || "(not recorded)"}`);
    if (backupPath) {
      console.log(`[graphify] Previous graph kept at ${backupPath}`);
    }
  } catch (error) {
    restoreBackup(backupPath);
    throw error;
  }
}

main();

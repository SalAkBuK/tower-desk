import fs from "fs";
import path from "path";

const vulnerableRscVersions = new Set(["19.0.0", "19.1.0", "19.1.1", "19.2.0"]);
const packagesToCheck = [
  "next",
  "react",
  "react-dom",
  "react-server-dom-webpack",
  "react-server-dom-turbopack",
];

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const extractVersion = (value) => {
  if (!value) return null;
  const match = String(value).match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? match[0] : null;
};

const compareSemver = (a, b) => {
  const [aM, aN, aP] = a.split(".").map(Number);
  const [bM, bN, bP] = b.split(".").map(Number);
  if (aM !== bM) return aM - bM;
  if (aN !== bN) return aN - bN;
  return aP - bP;
};

const repoRoot = process.cwd();
const packageJsonPath = path.join(repoRoot, "package.json");
const lockPath = path.join(repoRoot, "package-lock.json");

const packageJson = readJson(packageJsonPath);
const lock = fs.existsSync(lockPath) ? readJson(lockPath) : null;

const versions = {};

for (const name of packagesToCheck) {
  const lockEntry = lock?.packages?.[`node_modules/${name}`]?.version;
  const pkgEntry = packageJson?.dependencies?.[name] || packageJson?.devDependencies?.[name];
  versions[name] = extractVersion(lockEntry || pkgEntry);
}

const failures = [];

const reactVersion = versions["react"];
const reactDomVersion = versions["react-dom"];

for (const pkgName of ["react", "react-dom", "react-server-dom-webpack", "react-server-dom-turbopack"]) {
  const version = versions[pkgName];
  if (version && vulnerableRscVersions.has(version)) {
    failures.push(`${pkgName}@${version} is vulnerable to CVE-2025-55182 (React2Shell).`);
  }
}

if (reactVersion && reactDomVersion && reactVersion !== reactDomVersion) {
  failures.push(`react@${reactVersion} and react-dom@${reactDomVersion} must match.`);
}

const nextVersion = versions["next"];
if (nextVersion) {
  const [major] = nextVersion.split(".").map(Number);
  if (major === 14 && compareSemver(nextVersion, "14.2.25") < 0) {
    failures.push(`next@${nextVersion} is below the CVE-2025-29927 fixed version 14.2.25.`);
  }
  if (major === 15 && compareSemver(nextVersion, "15.2.3") < 0) {
    failures.push(`next@${nextVersion} is below the CVE-2025-29927 fixed version 15.2.3.`);
  }
  if (major < 14) {
    failures.push(`next@${nextVersion} is below the supported fixed versions for CVE-2025-29927.`);
  }
}

if (failures.length) {
  console.error("Security version check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Security version check passed.");

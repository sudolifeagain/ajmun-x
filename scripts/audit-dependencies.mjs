import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// No patched braces release exists. This is used only by ESLint's repository
// file globbing, never shipped in production. Fail closed after the review date.
const exception = {
    package: "braces",
    advisory: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
    version: "3.0.3",
    expires: "2026-11-14T00:00:00Z",
};

export function auditFailures(report, lock, now = new Date(), allowDevException = true) {
    const vulnerabilities = report.vulnerabilities ?? {};
    function reviewed(name, seen = new Set()) {
        const vulnerability = vulnerabilities[name];
        if (!vulnerability || seen.has(name) || !vulnerability.via?.length) return false;
        const visited = new Set([...seen, name]);
        return vulnerability.via.every(via => {
            if (typeof via === "string") return reviewed(via, visited);
            return allowDevException && now < new Date(exception.expires) && name === exception.package &&
                via.url === exception.advisory && vulnerability.nodes.every(path =>
                    lock.packages[path]?.dev === true && lock.packages[path]?.version === exception.version);
        });
    }
    return Object.keys(vulnerabilities).filter(name => !reviewed(name));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const npmCli = process.env.npm_execpath;
    if (!npmCli) throw new Error("Run this audit using npm run audit");
    const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
    for (const production of [true, false]) {
        const args = [npmCli, "audit", "--json", ...(production ? ["--omit=dev"] : [])];
        const result = spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
        if (result.error) throw result.error;
        const report = JSON.parse(result.stdout);
        if (report.error || !report.metadata || !report.vulnerabilities) {
            console.error("Audit failed:", report.error?.summary || result.stderr);
            process.exitCode = 1;
            break;
        }
        const failures = auditFailures(report, lock, new Date(), !production);
        console.log(`${production ? "Production" : "Full"} audit: ${JSON.stringify(report.metadata.vulnerabilities)}`);
        if (failures.length) {
            console.error("Unresolved vulnerabilities:", failures.join(", "));
            process.exitCode = 1;
        } else if (Object.keys(report.vulnerabilities).length) {
            console.warn(`Reviewed dev-only braces 3.0.3 exception; expires ${exception.expires}.`);
        }
    }
}

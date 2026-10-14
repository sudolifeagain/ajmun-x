import assert from "node:assert/strict";
import test from "node:test";
import { auditFailures } from "../scripts/audit-dependencies.mjs";

test("The audit gate allows only the exact dev advisory and expires automatically", () => {
    const lock = { packages: { "node_modules/braces": { version: "3.0.3", dev: true } } };
    const report = { vulnerabilities: {
        braces: { via: [{ url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm" }], nodes: ["node_modules/braces"] },
        parent: { via: ["braces"], nodes: ["node_modules/parent"] },
    } };
    assert.deepEqual(auditFailures(report, lock, new Date("2026-10-14")), []);
    assert.deepEqual(auditFailures(report, lock, new Date("2026-11-15")), ["braces", "parent"]);
    assert.deepEqual(auditFailures(report, lock, new Date("2026-10-14"), false), ["braces", "parent"]);
    const changed = structuredClone(report);
    changed.vulnerabilities.braces.via.push({ url: "https://github.com/advisories/NEW" });
    assert.deepEqual(auditFailures(changed, lock, new Date("2026-10-14")), ["braces", "parent"]);
    lock.packages["node_modules/braces"].dev = false;
    assert.deepEqual(auditFailures(report, lock, new Date("2026-10-14")), ["braces", "parent"]);
});

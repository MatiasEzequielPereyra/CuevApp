import test from "node:test";
import assert from "node:assert/strict";
import { validateAudit } from "../scripts/check-dependency-audit.mjs";

const graph = {
  "@next/eslint-plugin-next": [">=14.3.0-canary.0", ["fast-glob"]],
  "@typescript-eslint/eslint-plugin": [">=8.47.1-alpha.0", ["@typescript-eslint/parser", "@typescript-eslint/type-utils", "@typescript-eslint/utils"]],
  "@typescript-eslint/parser": [">=8.47.1-alpha.0", ["@typescript-eslint/typescript-estree"]],
  "@typescript-eslint/type-utils": [">=8.47.1-alpha.0", ["@typescript-eslint/typescript-estree", "@typescript-eslint/utils"]],
  "@typescript-eslint/typescript-estree": [">=8.47.1-alpha.0", ["tinyglobby"]],
  "@typescript-eslint/utils": [">=8.47.1-alpha.0", ["@typescript-eslint/typescript-estree"]],
  "eslint-config-next": [">=14.3.0-canary.0", ["@next/eslint-plugin-next", "typescript-eslint"]],
  "eslint-import-resolver-typescript": [">=3.8.0", ["tinyglobby"]],
  "fast-glob": [">=3.0.0", ["micromatch"]],
  "fdir": [">=5.2.1", ["picomatch"]],
  "micromatch": [">=4.0.0", ["picomatch"]],
  "picomatch": ["*", ["advisory"]],
  "tinyglobby": ["*", ["fdir", "picomatch"]],
  "typescript-eslint": [">=8.47.1-alpha.0", ["@typescript-eslint/eslint-plugin", "@typescript-eslint/parser", "@typescript-eslint/typescript-estree", "@typescript-eslint/utils"]],
};

const installed = {
  "@next/eslint-plugin-next": ["node_modules/@next/eslint-plugin-next", "16.4.6"],
  "@typescript-eslint/eslint-plugin": ["node_modules/@typescript-eslint/eslint-plugin", "8.72.1"],
  "@typescript-eslint/parser": ["node_modules/@typescript-eslint/parser", "8.72.1"],
  "@typescript-eslint/type-utils": ["node_modules/@typescript-eslint/type-utils", "8.72.1"],
  "@typescript-eslint/typescript-estree": ["node_modules/@typescript-eslint/typescript-estree", "8.72.1"],
  "@typescript-eslint/utils": ["node_modules/@typescript-eslint/utils", "8.72.1"],
  "eslint-config-next": ["node_modules/eslint-config-next", "16.4.6"],
  "eslint-import-resolver-typescript": ["node_modules/eslint-config-next/node_modules/eslint-import-resolver-typescript", "3.10.1"],
  "fast-glob": ["node_modules/fast-glob", "3.3.1"],
  "fdir": ["node_modules/tinyglobby/node_modules/fdir", "6.5.0"],
  "micromatch": ["node_modules/micromatch", "4.0.8"],
  "tinyglobby": ["node_modules/tinyglobby", "0.2.17"],
  "typescript-eslint": ["node_modules/typescript-eslint", "8.72.1"],
};

const advisory = {
  name: "picomatch",
  title: "picomatch vulnerable to ReDoS through single-branch repeated extglobs",
  range: "<=4.0.7",
  url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
};

function fixture() {
  const vulnerabilities = {};
  for (const [name, [range, via]] of Object.entries(graph)) {
    vulnerabilities[name] = {
      severity: "high",
      range,
      via: via.map(entry => entry === "advisory" ? { ...advisory } : entry),
    };
  }

  const packages = {};
  for (const [, [path, version]] of Object.entries(installed)) {
    packages[path] = { version, dev: true };
  }
  packages["node_modules/picomatch"] = { version: "2.3.2", dev: true };
  packages["node_modules/tinyglobby/node_modules/picomatch"] = { version: "4.0.7", dev: true };

  return {
    audit: {
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 14, critical: 0, total: 14 } },
      vulnerabilities,
    },
    lock: { packages },
  };
}

test("acepta exactamente el grafo conocido", () => {
  const { audit, lock } = fixture();
  assert.equal(validateAudit(audit, lock), true);
});

test("rechaza advisory adicional", () => {
  const { audit, lock } = fixture();
  audit.vulnerabilities.extra = {};
  assert.throws(() => validateAudit(audit, lock), /conjunto/);
});

test("rechaza versión nueva/desconocida", () => {
  const { audit, lock } = fixture();
  lock.packages["node_modules/picomatch"].version = "4.0.8";
  assert.throws(() => validateAudit(audit, lock), /instalaciones/);
});

test("rechaza paquete afectado runtime", () => {
  const { audit, lock } = fixture();
  lock.packages["node_modules/fast-glob"].dev = false;
  assert.throws(() => validateAudit(audit, lock), /fuera de la excepción/);
});

test("rechaza advisory alterado", () => {
  const { audit, lock } = fixture();
  audit.vulnerabilities.picomatch.via[0].range = "<4.0.7";
  assert.throws(() => validateAudit(audit, lock), /advisory/);
});

test("rechaza severidad/cantidad distinta", () => {
  const { audit, lock } = fixture();
  audit.metadata.vulnerabilities.critical = 1;
  assert.throws(() => validateAudit(audit, lock), /cantidad/);
});


test("acepta un informe limpio válido sin exigir el advisory retirado", () => {
  assert.equal(validateAudit({auditReportVersion:2,vulnerabilities:{},metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:0,critical:0,total:0}}}, {}),true);
});
test("rechaza informes vacíos o limpios contradictorios", () => {
  for (const report of [undefined, {}, {auditReportVersion:2,vulnerabilities:{},metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:0,critical:0,total:1}}}]) {
    assert.throws(() => validateAudit(report, {}));
  }
});
test("rechaza forma inválida de un informe aparentemente limpio", () => {
  const base = {auditReportVersion:2,vulnerabilities:{},metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:0,critical:0,total:0}}};
  assert.throws(() => validateAudit({...base,error:{code:"ENOAUDIT"}}, {}));
  assert.throws(() => validateAudit({...base,vulnerabilities:[]}, {}));
  assert.throws(() => validateAudit({...base,auditReportVersion:1}, {}));
  assert.throws(() => validateAudit({...base,metadata:{vulnerabilities:{...base.metadata.vulnerabilities,high:"0"}}}, {}));
});

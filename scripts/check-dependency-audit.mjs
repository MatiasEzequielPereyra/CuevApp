import { readFileSync } from "node:fs";
const expected = {
"@next/eslint-plugin-next":["node_modules/@next/eslint-plugin-next","16.4.6",">=14.3.0-canary.0",["fast-glob"]],
"@typescript-eslint/eslint-plugin":["node_modules/@typescript-eslint/eslint-plugin","8.72.1",">=8.47.1-alpha.0",["@typescript-eslint/parser","@typescript-eslint/type-utils","@typescript-eslint/utils"]],
"@typescript-eslint/parser":["node_modules/@typescript-eslint/parser","8.72.1",">=8.47.1-alpha.0",["@typescript-eslint/typescript-estree"]],
"@typescript-eslint/type-utils":["node_modules/@typescript-eslint/type-utils","8.72.1",">=8.47.1-alpha.0",["@typescript-eslint/typescript-estree","@typescript-eslint/utils"]],
"@typescript-eslint/typescript-estree":["node_modules/@typescript-eslint/typescript-estree","8.72.1",">=8.47.1-alpha.0",["tinyglobby"]],
"@typescript-eslint/utils":["node_modules/@typescript-eslint/utils","8.72.1",">=8.47.1-alpha.0",["@typescript-eslint/typescript-estree"]],
"eslint-config-next":["node_modules/eslint-config-next","16.4.6",">=14.3.0-canary.0",["@next/eslint-plugin-next","typescript-eslint"]],
"eslint-import-resolver-typescript":["node_modules/eslint-config-next/node_modules/eslint-import-resolver-typescript","3.10.1",">=3.8.0",["tinyglobby"]],
"fast-glob":["node_modules/fast-glob","3.3.1",">=3.0.0",["micromatch"]],
"fdir":["node_modules/tinyglobby/node_modules/fdir","6.5.0",">=5.2.1",["picomatch"]],
"micromatch":["node_modules/micromatch","4.0.8",">=4.0.0",["picomatch"]],
"picomatch":[null,null,"*",["advisory"]],
"tinyglobby":["node_modules/tinyglobby","0.2.17","*",["fdir","picomatch"]],
"typescript-eslint":["node_modules/typescript-eslint","8.72.1",">=8.47.1-alpha.0",["@typescript-eslint/eslint-plugin","@typescript-eslint/parser","@typescript-eslint/typescript-estree","@typescript-eslint/utils"]]
};
const advisory = {name:"picomatch",title:"picomatch vulnerable to ReDoS through single-branch repeated extglobs",range:"<=4.0.7",url:"https://github.com/advisories/GHSA-fc5q-39xc-vjpf"};
export function validateAudit(audit, lock) {
 const names = Object.keys(expected).sort();
 if (JSON.stringify(Object.keys(audit?.vulnerabilities ?? {}).sort()) !== JSON.stringify(names)) throw Error("El conjunto de paquetes vulnerables cambió.");
 const c = audit?.metadata?.vulnerabilities;
 if (!c || c.info!==0 || c.low!==0 || c.moderate!==0 || c.high!==14 || c.critical!==0 || c.total!==14) throw Error("La severidad o cantidad de hallazgos cambió.");
 for (const [name,[path,version,range,via]] of Object.entries(expected)) {
  const v=audit.vulnerabilities[name];
  if (v.severity!=="high" || v.range!==range) throw Error("Severidad o rango inesperado: "+name);
  const actual=v.via.map(x=>typeof x==="string"?x:"advisory").sort();
  if (JSON.stringify(actual)!==JSON.stringify([...via].sort())) throw Error("Cadena transitiva inesperada: "+name);
  if (name==="picomatch") { if(v.via.length!==1 || typeof v.via[0]!=="object" || Object.keys(advisory).some(k=>v.via[0][k]!==advisory[k])) throw Error("El advisory de Picomatch cambió."); continue; }
  const p=lock?.packages?.[path];
  if(!p || p.version!==version || p.dev!==true) throw Error("Instalación o versión fuera de la excepción: "+path);
 }
 const pm=Object.entries(lock.packages).filter(([p,x])=>p.endsWith("/picomatch") && x.version && x.dev===true).map(([p,x])=>p+"@"+x.version).sort();
 const allowed=["node_modules/picomatch@2.3.2","node_modules/tinyglobby/node_modules/picomatch@4.0.7"].sort();
 if(JSON.stringify(pm)!==JSON.stringify(allowed)) throw Error("Las instalaciones de Picomatch no coinciden con las dos versiones documentadas.");
 return true;
}
if(process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\","/"))) {
 try { const a=JSON.parse(readFileSync(process.argv[2] ?? "/tmp/npm-audit.json","utf8")); const l=JSON.parse(readFileSync("package-lock.json","utf8")); validateAudit(a,l); console.log("PASS: único riesgo aceptado = GHSA-fc5q-39xc-vjpf en Picomatch dev, árbol y versiones exactos."); }
 catch(e) { console.error("FAIL: "+e.message); process.exitCode=1; }
}
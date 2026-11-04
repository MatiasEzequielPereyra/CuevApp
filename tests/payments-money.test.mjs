import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const load=createRequire(import.meta.url);
const unit={exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/lib/payments/money.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(load,unit,unit.exports);
test('ARS conversion stays exact at cent and limit boundaries',()=>{
 const {toCents,pesos}=unit.exports;
 assert.equal(toCents('0,01'),'1');assert.equal(toCents('40000.01'),'4000001');assert.equal(toCents('1000000000'),'100000000000');
 for(const value of ['0','-1','0.001','1e2','1.000,00','1000000000.01'])assert.throws(()=>toCents(value));
 assert.equal(pesos('1500001'),'$ 15.000,01');
});

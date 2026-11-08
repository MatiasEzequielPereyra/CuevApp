import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const load=createRequire(import.meta.url);
const unit={exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/lib/payments/money.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(load,unit,unit.exports);
test('ARS input accepts whole pesos and converts them exactly to cents internally',()=>{
 const {toCents,pesos}=unit.exports;
 assert.equal(toCents('1'),'100');
 assert.equal(toCents('40000'),'4000000');
 assert.equal(toCents('1000000000'),'100000000000');
 for(const value of ['0','-1','1.00','1,00','0.01','0,01','1.000','1,000','1e2','1000000001',''])assert.throws(()=>toCents(value));
 assert.equal(pesos('1500000'),'$ 15.000');
 assert.equal(pesos('1500001'),'$ 15.000,01');
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {reconciliationDatabaseOptions} from '../scripts/reconcile-student-invitation.mjs';

const project='vbkzoojkdkcugxhneyzi';
const direct=`db.${project}.supabase.co`,pooler='aws-1-ca-central-1.pooler.supabase.com';
const uri=(host=pooler,user=`postgres.${project}`,port='5432',path='/postgres')=>`postgres://${user}:synthetic@${host}${port?':'+port:''}${path}`;

for(const [name,value,host,user] of [
  ['direct explicit',uri(direct,'postgres'),direct,'postgres'],
  ['direct default port',uri(direct,'postgres',''),direct,'postgres'],
  ['direct postgresql',uri(direct,'postgres').replace('postgres:','postgresql:'),direct,'postgres'],
  ['exact session pooler',uri(),pooler,`postgres.${project}`],
  ['session postgresql',uri().replace('postgres:','postgresql:'),pooler,`postgres.${project}`],
  ['encoded password is data',uri().replace(':synthetic@',':synthetic%40%3F%23%2F%3A@'),pooler,`postgres.${project}`],
])test(`accept ${name} with verified TLS`,()=>{
  const options=reconciliationDatabaseOptions(value),client=new pg.Client(options);
  assert.equal(client.connectionParameters.host,host);assert.equal(client.connectionParameters.user,user);
  assert.equal(client.connectionParameters.port,5432);assert.equal(client.connectionParameters.database,'postgres');
  assert.equal(client.connectionParameters.ssl.rejectUnauthorized,true);assert.equal(options.connectionTimeoutMillis,10000);
});

for(const [name,value] of [
  ['other pooler region',uri('aws-1-us-east-1.pooler.supabase.com')],
  ['other pooler instance',uri('aws-0-ca-central-1.pooler.supabase.com')],
  ['host suffix',uri(pooler+'.example.com')],['wildcard host',uri('*.pooler.supabase.com')],
  ['IP host',uri('127.0.0.1')],['IPv6 literal',uri('[::1]')],['other direct project',uri('db.otherproject.supabase.co','postgres')],
  ['bare pooler user',uri(pooler,'postgres')],['other pooler project',uri(pooler,'postgres.otherproject')],
  ['other direct user',uri(direct,'postgres.otherproject')],['service user',uri(pooler,'service_role')],
  ['missing user',`postgres://${pooler}:5432/postgres`],
  ['transaction pooler',uri(pooler,`postgres.${project}`,'6543')],['other port',uri(pooler,`postgres.${project}`,'443')],
  ['pooler port omitted',uri(pooler,`postgres.${project}`,'')],['direct wrong port',uri(direct,'postgres','6543')],
  ['other database',uri(pooler,`postgres.${project}`,'5432','/other')],['trailing path',uri()+'/'],
  ['encoded database alias',uri(pooler,`postgres.${project}`,'5432','/%70ostgres')],
  ['wrong scheme',uri().replace('postgres:','https:')],['malformed password',uri().replace('synthetic','%ZZ')],
  ['fragment',uri()+'#extra'],['empty fragment',uri()+'#'],['empty query',uri()+'?'],
  ...['sslmode=disable','sslmode=require','sslmode=no-verify','sslmode=verify-full','ssl=false','sslrootcert=untrusted','sslcert=untrusted','sslkey=untrusted','host=other','port=6543','user=postgres.otherproject','database=other','options=-c%20role%3Dpostgres','sslnegotiation=direct','application_name=unexpected','%73slmode=disable'].map(p=>[p,uri()+'?'+p]),
])test(`reject ${name}`,()=>assert.throws(()=>reconciliationDatabaseOptions(value),{message:'DATABASE_INVALID'}));

test('PG environment cannot replace destination, user, port or TLS policy',()=>{
  const override={PGHOST:'other.example.com',PGPORT:'6543',PGUSER:'other',PGDATABASE:'other',PGSSLMODE:'no-verify'};
  const previous=Object.fromEntries(Object.keys(override).map(k=>[k,process.env[k]]));
  try{Object.assign(process.env,override);for(const url of [uri(),uri(direct,'postgres','')]){
    const cp=new pg.Client(reconciliationDatabaseOptions(url)).connectionParameters;
    assert.equal(cp.host,new URL(url).hostname);assert.equal(cp.port,5432);assert.equal(cp.user,decodeURIComponent(new URL(url).username));assert.equal(cp.database,'postgres');assert.equal(cp.ssl.rejectUnauthorized,true);
  }}finally{for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});

test('local exception remains explicit and loopback-only',()=>{
  assert.equal(reconciliationDatabaseOptions('postgres://postgres:synthetic@127.0.0.1:5433/postgres',true).ssl,false);
  assert.throws(()=>reconciliationDatabaseOptions(uri(),true),{message:'DATABASE_INVALID'});
  assert.throws(()=>reconciliationDatabaseOptions('postgres://postgres:synthetic@127.0.0.1:5433/postgres'),{message:'DATABASE_INVALID'});
});

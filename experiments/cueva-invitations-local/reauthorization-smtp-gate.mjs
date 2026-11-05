// Synthetic TLS/auth fault server, never part of the application/provider config.
import {createRequire} from 'node:module';
const require=createRequire('/smtp-tools/package.json');
const {SMTPServer}=require('smtp-server'),nodemailer=require('nodemailer');
import {readFileSync} from 'node:fs';
import http from 'node:http';
let code=535,authCommands=0,authSuccess=0,authRejected=0,mailCommands=0,messages=0;
const smtp=new SMTPServer({secure:false,key:readFileSync('/smtp-cert/key.pem'),cert:readFileSync('/smtp-cert/cert.pem'),logger:false,
  disableReverseLookup:true,authMethods:['PLAIN','LOGIN'],socketTimeout:10000,
  onAuth(auth,session,callback){
    authCommands++;
    if(!session.secure)return callback(Object.assign(Error('TLS required'),{responseCode:530}));
    if(code){authRejected++;return callback(Object.assign(Error(code===534?'5.7.9 Application-specific password required':'5.7.8 BadCredentials'),{responseCode:code}));}
    if(auth.password==='wrong-password'){authRejected++;return callback(Object.assign(Error('5.7.8 BadCredentials'),{responseCode:535}));}
    authSuccess++;callback(null,{user:'synthetic'});
  },
  onMailFrom(_address,_session,callback){mailCommands++;callback();},
  onData(stream,session,callback){
    const chunks=[];stream.on('data',d=>chunks.push(d));stream.on('error',()=>callback(Error('Synthetic stream error')));
    stream.on('end',async()=>{const relay=nodemailer.createTransport({host:'mail',port:1025,secure:false,ignoreTLS:true,logger:false,debug:false});try{
      await relay.sendMail({envelope:{from:session.envelope.mailFrom.address,to:session.envelope.rcptTo.map(a=>a.address)},raw:Buffer.concat(chunks)});messages++;callback();
    }catch{callback(Error('Synthetic relay error'));}finally{relay.close();}});
  }});
smtp.on('error',()=>{});smtp.listen(1025,'0.0.0.0');
http.createServer((q,s)=>{
  if(q.method==='POST'&&q.url==='/no-auth'){code=0;smtp.options.disabledCommands=['AUTH'];return s.end('ok');}
  if(q.method==='POST'&&['/repair','/reject/534','/reject/535'].includes(q.url)){code=q.url==='/repair'?0:Number(q.url.slice(-3));smtp.options.disabledCommands=[];return s.end('ok');}
  if(q.url==='/status'){s.setHeader('content-type','application/json');return s.end(JSON.stringify({code,authCommands,authSuccess,authRejected,mailCommands,messages}));}
  if(q.url==='/invite.html'){s.setHeader('content-type','text/html');return s.end(readFileSync('/templates/invite.html'));}
  s.writeHead(404);s.end();
}).listen(8080,'0.0.0.0');

// Synthetic-only SMTP authentication fault. Never records credentials or DATA.
import net from 'node:net';
import http from 'node:http';
import {readFileSync} from 'node:fs';
let repaired=false,rejections=0;
http.createServer((q,s)=>{
  if(q.url==='/repair'&&q.method==='POST'){repaired=true;return s.end('ok');}
  if(q.url==='/reject'&&q.method==='POST'){repaired=false;return s.end('ok');}
  if(q.url==='/status'){s.setHeader('content-type','application/json');return s.end(JSON.stringify({repaired,rejections}));}
  if(q.url==='/invite.html'){s.setHeader('content-type','text/html');return s.end(readFileSync('/templates/invite.html'));}
  s.writeHead(404);s.end();
}).listen(8080,'0.0.0.0');
net.createServer(socket=>{
  socket.on('error',()=>{});
  if(repaired){const upstream=net.connect(1025,'mail');upstream.on('error',()=>socket.destroy());socket.pipe(upstream).pipe(socket);socket.on('close',()=>upstream.destroy());return;}
  socket.write('220 synthetic.local ESMTP\r\n');
  let buffer='';socket.on('data',chunk=>{
    buffer+=chunk.toString();let end;
    while((end=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+2);
      if(/^EHLO/i.test(line))socket.write('250-synthetic.local\r\n250 AUTH PLAIN LOGIN\r\n');
      else if(/^AUTH/i.test(line)){rejections++;socket.write('535 5.7.8 BadCredentials\r\n');}
      else if(/^QUIT/i.test(line))socket.end('221 bye\r\n');
      else socket.write('503 authentication required\r\n');
    }
  });
}).listen(1025,'0.0.0.0');

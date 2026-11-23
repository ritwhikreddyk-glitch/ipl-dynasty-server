const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const teams = ["Chennai Super Kings","Mumbai Indians","Royal Challengers Bengaluru","Kolkata Knight Riders","Sunrisers Hyderabad","Rajasthan Royals","Delhi Capitals","Punjab Kings","Gujarat Titans","Lucknow Super Giants"];
const players = JSON.parse(fs.readFileSync(path.join(ROOT,'players.json'),'utf8'));
const rooms = new Map();
const server = http.createServer((req,res)=>{
  const url = new URL(req.url,'http://localhost');
  if (url.pathname === '/health') { res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify({ok:true,service:'ipl-dynasty-auction',rooms:rooms.size,players:players.length})); }
  const file = url.pathname === '/' ? '/public/index.html' : path.normalize('/public'+url.pathname);
  const full = path.join(ROOT,file);
  if (!full.startsWith(path.join(ROOT,'public'))) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(full,(err,data)=>{ if(err){res.writeHead(404);return res.end('Not found');}
    const ext=path.extname(full); const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json'};
    res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  });
});
const wss = new WebSocket.Server({server});
function code(){let c;do{c=crypto.randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(c));return c;}
function send(ws,obj){if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));}
function broadcast(room){const state=publicState(room);for(const p of room.members.values())send(p.ws,{type:'state',state,host:p.team===room.hostTeam});}
function publicState(r){const p=players[r.lot];return {code:r.code,started:r.started,hostTeam:r.hostTeam,members:[...r.members.values()].map(x=>({team:x.team})),teams,lot:r.lot,player:p||null,bid:r.bid,leader:r.leader,warning:r.warning,warningText:r.warningText,closed:r.closed,done:r.done,sold:r.sold,unsold:r.unsold,purses:r.purses,rosters:r.rosters,message:r.message};}
function stopTimer(r){if(r.timer){clearTimeout(r.timer);r.timer=null;}}
function warn(r){stopTimer(r);if(!r.started||r.closed||!r.leader)return;r.warning=0;r.warningText='';const tick=()=>{if(r.closed||!r.leader)return;r.warning++;r.warningText=['GOING ONCE!','GOING TWICE!','FINAL CALL!'][r.warning-1];r.message=r.warningText+' — '+r.leader+' leads at ₹'+r.bid.toFixed(1)+' Cr';broadcast(r);if(r.warning===3){r.timer=setTimeout(()=>sell(r),1800);}else{r.timer=setTimeout(tick,2200);}};r.timer=setTimeout(tick,500);}
function sell(r){if(r.closed)return;stopTimer(r);r.closed=true;r.done++;if(r.leader){r.rosters[r.leader].push({...players[r.lot],price:r.bid});r.purses[r.leader]=+(r.purses[r.leader]-r.bid).toFixed(1);r.sold++;r.message='SOLD: '+players[r.lot].name+' to '+r.leader+' for ₹'+r.bid.toFixed(1)+' Cr';}else{r.unsold++;r.message=players[r.lot].name+' went UNSOLD.';}broadcast(r);r.timer=setTimeout(()=>{if(r.lot<players.length-1){r.lot++;r.bid=players[r.lot].base;r.leader=null;r.warning=0;r.warningText='';r.closed=false;r.message='Next player: '+players[r.lot].name;}else{r.message='Auction complete — all 300 players processed.';r.started=false;}broadcast(r);},1800);}
function createRoom(ws,team){if(!teams.includes(team))throw Error('Choose a valid franchise.');const c=code();const r={code:c,hostTeam:team,members:new Map(),started:false,lot:0,bid:players[0].base,leader:null,warning:0,warningText:'',closed:false,done:0,sold:0,unsold:0,purses:Object.fromEntries(teams.map(t=>[t,500])),rosters:Object.fromEntries(teams.map(t=>[t,[]])),message:'Room created. Invite at least one more team. Start when 2 or more teams have joined.',timer:null};rooms.set(c,r);joinRoom(ws,r,team);}
function joinRoom(ws,r,team){if(!teams.includes(team))throw Error('Choose a valid franchise.');if(r.started)throw Error('Auction already started.');if(r.members.size>=10)throw Error('Room is full (10 teams maximum).');if([...r.members.values()].some(x=>x.team===team))throw Error('That franchise has already joined. Choose another team.');r.members.set(ws,{ws,team});ws.room=r;ws.team=team;r.message=team+' joined ('+r.members.size+'/10 teams). '+(r.members.size>=2?'The host can start the auction now.':'Waiting for at least one more team.');broadcast(r);}
function handle(ws,msg){if(!msg||typeof msg!=='object')return;
 if(msg.type==='create_room'){createRoom(ws,msg.team);return;}
 if(msg.type==='join_room'){const r=rooms.get(String(msg.code||'').toUpperCase());if(!r)throw Error('Room code not found.');joinRoom(ws,r,msg.team);return;}
 const r=ws.room;if(!r)throw Error('Create or join a room first.');
 if(msg.type==='start'){if(ws.team!==r.hostTeam)throw Error('Only the room creator can start.');if(r.members.size<2)throw Error('At least 2 teams must join before the auction starts.');if(r.started)throw Error('Auction already started.');r.started=true;r.message='Auction started! '+players[0].name+' is up for bidding.';broadcast(r);return;}
 if(msg.type==='bid'){if(!r.started)throw Error('Auction has not started.');if(r.closed)throw Error('This lot is already closed.');const amount=r.leader===null?r.bid:+(r.bid+(r.bid<5?.5:r.bid<10?1:r.bid<20?2:5)).toFixed(1);if(r.rosters[ws.team].length>=24)throw Error('Your squad has reached 24 players.');if(r.purses[ws.team]<amount)throw Error('Not enough purse for this bid.');r.bid=amount;r.leader=ws.team;r.message=ws.team+' bids ₹'+amount.toFixed(1)+' Cr for '+players[r.lot].name+'.';warn(r);broadcast(r);return;}
 if(msg.type==='pass'){if(!r.started||r.closed)throw Error('No active lot.');r.message=ws.team+' passes. Current highest bid remains '+(r.leader||'none')+'.';broadcast(r);return;}
 throw Error('Unknown action.');
}
wss.on('connection',ws=>{send(ws,{type:'hello',teams,playerCount:players.length});ws.on('message',raw=>{try{const m=JSON.parse(raw.toString());handle(ws,m);}catch(e){send(ws,{type:'error',message:e.message||'Invalid request'});}});ws.on('close',()=>{const r=ws.room;if(r){r.members.delete(ws);r.message=ws.team+' disconnected. Room remains open; reconnect support is not enabled yet.';broadcast(r);if(!r.members.size){stopTimer(r);rooms.delete(r.code);}}});});
server.listen(PORT,'0.0.0.0',()=>console.log(`IPL Dynasty server listening on ${PORT}`));

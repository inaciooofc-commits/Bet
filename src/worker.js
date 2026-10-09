import { timingSafeEqual } from 'node:crypto';
const now=()=>Math.floor(Date.now()/1000),uid=()=>crypto.randomUUID();
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const str=(v,min=1,max=150)=>{if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)fail('Texto inválido.');return v.trim();};
const integer=(v,min=1,max=100000)=>{if(!Number.isSafeInteger(v)||v<min||v>max)fail('Número inválido.');return v;};
const date=v=>integer(v,1,4102444800);
const hex=b=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');
async function hash(value){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));}
async function password(value,salt){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(value),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},k,256));}
function json(data,status=200,extra={}){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});}
async function body(request){if(!request.headers.get('content-type')?.includes('application/json'))fail('Envie JSON.',415);const reader=request.body?.getReader();if(!reader)fail('Corpo ausente.');let total=0,chunks=[];for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>16384){await reader.cancel();fail('Pedido muito grande.',413);}chunks.push(value);}try{let bytes=new Uint8Array(total),offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));}catch{fail('JSON inválido.');}}
export default {async fetch(request,env){const url=new URL(request.url),path=url.pathname;try{
 if(!path.startsWith('/api/'))return env.ASSETS.fetch(request);
 const q=(sql,...args)=>env.DB.prepare(sql).bind(...args),all=async(sql,...args)=>(await q(sql,...args).all()).results;
 if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)fail('Origem inválida.',403);
 const get=request.method==='GET',post=request.method==='POST';if(!get&&!post)fail('Método inválido.',405);
 let data=post?await body(request):{};
 if(['/api/register','/api/login'].includes(path)&&post){
 const ip=request.headers.get('CF-Connecting-IP')||'local',key=await hash(ip+':auth:'+Math.floor(now()/900));
 await q('INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',key,now()+900).run();
 if((await q('SELECT count FROM attempts WHERE key=?',key).first()).count>20)fail('Muitas tentativas. Aguarde 15 minutos.',429);
 const email=str(data.email,5,200).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('E-mail inválido.');const pass=str(data.password,10,128);
 let user=await q('SELECT * FROM users WHERE email=?',email).first();
 if(path==='/api/register'){if(user)fail('E-mail já cadastrado.',409);const salt=uid(),id=uid();await q('INSERT INTO users(id,email,name,password,salt,created) VALUES(?,?,?,?,?,?)',id,email,str(data.name,2,40),await password(pass,salt),salt,now()).run();user={id};}
 else {const digest=await password(pass,user?.salt||'dummy-salt');if(!user||digest!==user.password)fail('E-mail ou senha incorretos.',401);}
 const token=hex(crypto.getRandomValues(new Uint8Array(32)));await q('INSERT INTO sessions VALUES(?,?,?)',await hash(token),user.id,now()+604800).run();return json({ok:true},200,{'Set-Cookie':`ui_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${url.protocol==='https:'?'; Secure':''}`});
 }
 if(path==='/api/events'&&get)return json(await all('SELECT e.*,o.id outcome_id,o.label,o.odds FROM events e JOIN outcomes o ON o.event_id=e.id ORDER BY e.closes DESC LIMIT 300'));
 if(path==='/api/prizes'&&get)return json(await all('SELECT * FROM prizes WHERE active=1 ORDER BY cost LIMIT 100'));
 if(path==='/api/ranking'&&get)return json(await all('SELECT name,balance FROM users ORDER BY balance DESC LIMIT 20'));
 const raw=request.headers.get('Cookie')?.match(/(?:^|;\s*)ui_session=([a-f0-9]{64})(?:;|$)/)?.[1];
 const user=raw?await q('SELECT u.id,u.name,u.email,u.role,u.balance FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?',await hash(raw),now()).first():null;
 if(!user)fail('Entre na sua conta.',401);
 if(path==='/api/me'&&get)return json(user);
 if(path==='/api/activate-admin'&&post){if(!env.SETUP_HASH)fail('Ativação indisponível.',403);const digest=await hash(str(data.code,64,64));if(!timingSafeEqual(new TextEncoder().encode(digest),new TextEncoder().encode(env.SETUP_HASH)))fail('Código de ativação inválido.',403);const result=await q("UPDATE users SET role='admin' WHERE id=? AND NOT EXISTS(SELECT 1 FROM users WHERE role='admin')",user.id).run();if(result.meta?.changes===0||result.changes===0)fail('Administração já ativada.',409);return json({ok:true,message:'Sua conta agora é administradora.'});}

 if(path==='/api/logout'&&post){await q('DELETE FROM sessions WHERE token=?',await hash(raw)).run();return json({ok:true},200,{'Set-Cookie':'ui_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'});}
 if(path==='/api/history'&&get)return json({bets:await all('SELECT b.*,o.label,e.title FROM bets b JOIN outcomes o ON o.id=b.outcome_id JOIN events e ON e.id=o.event_id WHERE user_id=? ORDER BY b.created DESC LIMIT 100',user.id),ledger:await all('SELECT amount,kind,created FROM ledger WHERE user_id=? ORDER BY created DESC LIMIT 100',user.id),redemptions:await all('SELECT r.*,p.title FROM redemptions r JOIN prizes p ON p.id=r.prize_id WHERE user_id=? ORDER BY r.created DESC LIMIT 100',user.id)});
 if(path==='/api/bet'&&post){const o=await q('SELECT * FROM outcomes WHERE id=?',str(data.outcome)).first();if(!o)fail('Seleção inexistente.');const id=str(data.id,10,80);await q('INSERT INTO bets(id,user_id,outcome_id,stake,odds,created) VALUES(?,?,?,?,?,?)',id,user.id,o.id,integer(data.stake),o.odds,now()).run();return json({ok:true,id});}
 if(path==='/api/daily'&&post){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());await q('INSERT INTO daily VALUES(?,?,?)',user.id,day,now()).run();return json({ok:true,message:'+100 Ryos recebidos!'});}
 if(path==='/api/bonus'&&post){await q('INSERT INTO bonus_claims VALUES(?,?,?)',user.id,str(data.code,3,40).toUpperCase(),now()).run();return json({ok:true,message:'Código resgatado!'});}
 if(path==='/api/redeem'&&post){const p=await q('SELECT * FROM prizes WHERE id=?',str(data.prize)).first();if(!p)fail('Prêmio inexistente.');await q('INSERT INTO redemptions(id,user_id,prize_id,cost,created) VALUES(?,?,?,?,?)',str(data.id,10,80),user.id,p.id,p.cost,now()).run();return json({ok:true,message:'Resgate solicitado. Acompanhe no histórico.'});}
 if(path.startsWith('/api/admin/')){
 if(user.role!=='admin')fail('Acesso restrito à administração.',403);
 if(path==='/api/admin/data'&&get)return json({events:await all('SELECT * FROM events ORDER BY closes DESC LIMIT 100'),outcomes:await all('SELECT * FROM outcomes LIMIT 500'),prizes:await all('SELECT * FROM prizes LIMIT 100'),bonuses:await all('SELECT * FROM bonuses LIMIT 100'),redemptions:await all('SELECT r.*,u.name,p.title FROM redemptions r JOIN users u ON u.id=r.user_id JOIN prizes p ON p.id=r.prize_id ORDER BY r.created DESC LIMIT 100'),audit:await all('SELECT a.*,u.name FROM audit a JOIN users u ON u.id=a.actor ORDER BY a.created DESC LIMIT 50')});
 const id=uid(),audit=(action,target)=>q('INSERT INTO audit VALUES(?,?,?,?,?)',uid(),user.id,action,target,now());
 if(path==='/api/admin/event'&&post){const closes=date(data.closes);if(closes<=now())fail('Escolha uma data futura.');if(!Array.isArray(data.outcomes)||data.outcomes.length<2||data.outcomes.length>6)fail('Informe de 2 a 6 resultados.');const outcomes=data.outcomes.map(o=>q('INSERT INTO outcomes VALUES(?,?,?,?)',uid(),id,str(o.label,1,80),integer(o.odds,101,10000)));await env.DB.batch([q('INSERT INTO events(id,title,category,closes) VALUES(?,?,?,?)',id,str(data.title),str(data.category,1,40),closes),...outcomes,audit('event.create',id)]);return json({ok:true});}
 if(path==='/api/admin/settle'&&post){const eid=str(data.event),status=data.cancel?'cancelled':'settled';await env.DB.batch([q('UPDATE events SET status=?,winner=? WHERE id=?',status,data.cancel?null:str(data.winner),eid),audit('event.'+status,eid)]);return json({ok:true});}
 if(path==='/api/admin/bonus'&&post){const code=str(data.code,3,40).toUpperCase();if(!/^[A-Z0-9_-]+$/.test(code))fail('Use letras, números, _ ou -.');await env.DB.batch([q('INSERT INTO bonuses(code,amount,starts,ends,max_uses) VALUES(?,?,?,?,?)',code,integer(data.amount),date(data.starts),date(data.ends),integer(data.max_uses,1,1000000)),audit('bonus.create',code)]);return json({ok:true});}
 if(path==='/api/admin/prize'&&post){const pid=data.id?str(data.id):id;await env.DB.batch([q('INSERT INTO prizes VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,cost=excluded.cost,stock=excluded.stock,starts=excluded.starts,ends=excluded.ends,active=excluded.active',pid,str(data.title),str(data.description,1,800),integer(data.cost,1,10000000),integer(data.stock,0,1000000),date(data.starts),date(data.ends),data.active===false?0:1),audit('prize.save',pid)]);return json({ok:true});}
 if(path==='/api/admin/redemption'&&post){if(!['delivered','refunded'].includes(data.status))fail('Status inválido.');const rid=str(data.id);await env.DB.batch([q('UPDATE redemptions SET status=? WHERE id=?',data.status,rid),audit('redemption.'+data.status,rid)]);return json({ok:true});}
 }
 fail('Rota não encontrada.',404);
 }catch(e){const message=e.message||'';const rules=[['UNIQUE constraint','Operação já realizada ou dado já cadastrado.'],['balance','Ryos insuficientes.'],['event_closed','Apostas encerradas para este evento.'],['already_settled','Evento já encerrado.'],['invalid_winner','Resultado inválido.'],['bonus_unavailable','Código esgotado ou fora da validade.'],['prize_unavailable','Prêmio indisponível.'],['already_processed','Resgate já processado.'],['CHECK constraint','Confira os valores e as datas.']];const mapped=rules.find(([key])=>message.includes(key));if(e.status)return json({error:message},e.status);if(mapped)return json({error:mapped[1]},409);console.error(JSON.stringify({event:'request_error',path,message}));return json({error:'Não foi possível concluir. Tente novamente.'},500);}
},async scheduled(controller,env){await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(now()),env.DB.prepare('DELETE FROM attempts WHERE expires<?').bind(now())]);}};

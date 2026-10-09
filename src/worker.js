const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const hash=async x=>hex(await crypto.subtle.digest('SHA-256',enc.encode(x)));
async function password(p,s){const k=await crypto.subtle.importKey('raw',enc.encode(p),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(s),iterations:100000,hash:'SHA-256'},k,256));}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=enc.encode(a),y=enc.encode(b);return x.length===y.length&&crypto.subtle.timingSafeEqual(x,y);}
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function str(x,max=120){if(typeof x!=='string'||!x.trim()||x.length>max)fail('Texto inválido');return x.trim();}
function num(x,min,max){if(!Number.isSafeInteger(x)||x<min||x>max)fail('Número inválido');return x;}
function dates(b){const starts=new Date(b.starts),ends=new Date(b.ends);if(!Number.isFinite(+starts)||!Number.isFinite(+ends)||ends<=starts)fail('Período inválido');return [starts.toISOString(),ends.toISOString()];}
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...extra}});}
const uuid=()=>crypto.randomUUID();
async function handle(req,env){
 const url=new URL(req.url),p=url.pathname,db=env.DB;const q=(s,...v)=>db.prepare(s).bind(...v);
 if(!p.startsWith('/api/')){const path=p==='/'?'/index.html':p;if(!assets[path])return new Response('Não encontrado',{status:404});return new Response(assets[path],{headers:{'Content-Type':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.json')?'application/manifest+json':'text/html'}});}
 if(req.method!=='GET'&&req.headers.get('Origin')!==url.origin)fail('Origem inválida',403);
 let b={};if(req.method!=='GET'){if(Number(req.headers.get('Content-Length')||0)>10000)fail('Requisição grande',413);const raw=await req.text();if(raw.length>10000)fail('Requisição grande',413);try{b=JSON.parse(raw);}catch{fail('JSON inválido');}}
 if(p==='/api/auth/register'||p==='/api/auth/login'){
 const ip=req.headers.get('CF-Connecting-IP')||'local';const bucket=Math.floor(Date.now()/600000);const key=await hash(ip+':'+bucket);const r=await q('INSERT INTO rate_limits VALUES(?,1) ON CONFLICT(key) DO UPDATE SET n=n+1 RETURNING n',key).first();if(r.n>20)fail('Tente novamente em alguns minutos',429);
 const email=str(b.email,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('E-mail inválido');const pass=str(b.password,128);if(pass.length<10)fail('Use senha com pelo menos 10 caracteres');let u;
 if(p.endsWith('register')){const id=uuid(),salt=uuid();await db.batch([q('INSERT INTO users(id,email,name,password,salt) VALUES(?,?,?,?,?)',id,email,str(b.name,40),await password(pass,salt),salt),q('INSERT INTO ledger VALUES(?,?,?,?,CURRENT_TIMESTAMP)',uuid(),id,1000,'Boas-vindas')]);u={id};}
 else{u=await q('SELECT * FROM users WHERE email=?',email).first();const computed=await password(pass,u?.salt||'dummy-salt');if(!u||!equal(computed,u.password))fail('E-mail ou senha incorretos',401);}
 const token=uuid()+uuid();await q('INSERT INTO sessions VALUES(?,?,?)',await hash(token),u.id,Date.now()+7*86400000).run();return json({ok:true},200,{'Set-Cookie':`session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`});
 }
 const token=req.headers.get('Cookie')?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];const u=token?await q('SELECT u.id,u.name,u.email,u.role,u.balance FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',await hash(token),Date.now()).first():null;
 if(p==='/api/state'){
 const events=(await q('SELECT * FROM events ORDER BY closes DESC LIMIT 100').all()).results;const outcomes=(await q('SELECT * FROM outcomes').all()).results;
 const rewards=(await q('SELECT * FROM rewards ORDER BY cost LIMIT 100').all()).results;
 return json({user:u,events:events.map(e=>({...e,outcomes:outcomes.filter(o=>o.event_id===e.id)})),rewards,ranking:(await q("SELECT name,balance FROM users WHERE role='player' ORDER BY balance DESC LIMIT 20").all()).results,bets:u?(await q('SELECT b.*,e.title,o.label FROM bets b JOIN events e ON e.id=b.event_id JOIN outcomes o ON o.id=b.outcome_id WHERE b.user_id=? ORDER BY b.created DESC LIMIT 100',u.id).all()).results:[],ledger:u?(await q('SELECT * FROM ledger WHERE user_id=? ORDER BY created DESC,rowid DESC LIMIT 100',u.id).all()).results:[],redemptions:u?(await q('SELECT * FROM redemptions WHERE user_id=? ORDER BY created DESC LIMIT 100',u.id).all()).results:[]});
 }
 if(req.method!=='POST'&&!(req.method==='GET'&&p==='/api/admin/state'))fail('Método inválido',405);
 if(!u)fail('Entre na sua conta',401);
 if(p==='/api/logout'){await q('DELETE FROM sessions WHERE token=?',await hash(token)).run();return json({ok:true},200,{'Set-Cookie':'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});}
 if(p==='/api/bet'){const o=await q('SELECT * FROM outcomes WHERE id=?',str(b.outcome)).first();if(!o)fail('Opção inválida');num(b.odds,101,10000);if(b.odds!==o.odds)fail('Odd mudou, atualize o bilhete');await q('INSERT INTO bets(id,user_id,event_id,outcome_id,stake,odds) VALUES(?,?,?,?,?,?)',str(b.id,80),u.id,o.event_id,o.id,num(b.stake,10,100000),o.odds).run();return json({ok:true});}
 if(p==='/api/daily'){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());await q('INSERT INTO daily VALUES(?,?)',u.id,day).run();return json({ok:true});}
 if(p==='/api/bonus'){await q('INSERT INTO claims VALUES(?,?,?)',uuid(),u.id,str(b.code,40).toUpperCase()).run();return json({ok:true});}
 if(p==='/api/redeem'){const r=await q('SELECT * FROM rewards WHERE id=?',str(b.reward)).first();if(!r)fail('Prêmio inválido');await q('INSERT INTO redemptions(id,user_id,reward_id,title,cost) VALUES(?,?,?,?,?)',str(b.id,80),u.id,r.id,r.title,r.cost).run();return json({ok:true});}
 if(p==='/api/admin/claim'){
 if(!env.BOOTSTRAP_TOKEN||!equal(b.token,env.BOOTSTRAP_TOKEN))fail('Código administrativo inválido',403);
 const r=await db.batch([q('UPDATE bootstrap SET used=1 WHERE id=1 AND used=0 RETURNING id'),q("UPDATE users SET role='admin' WHERE id=? AND NOT EXISTS(SELECT 1 FROM users WHERE role='admin')",u.id)]);if(!r[0].results.length)fail('Configuração já utilizada',409);return json({ok:true});
 }
 if(!p.startsWith('/api/admin/'))fail('Não encontrado',404);if(u.role!=='admin')fail('Acesso administrativo necessário',403);
 if(p==='/api/admin/state')return json({bonuses:(await q('SELECT * FROM bonuses').all()).results,redemptions:(await q('SELECT r.*,u.name FROM redemptions r JOIN users u ON u.id=r.user_id ORDER BY r.created DESC LIMIT 200').all()).results,audit:(await q('SELECT * FROM audit ORDER BY created DESC LIMIT 100').all()).results});
 let statement;
 if(p==='/api/admin/event'){
 const id=uuid();const closes=new Date(b.closes);if(!Number.isFinite(+closes)||closes<=new Date())fail('Data futura necessária');if(!Array.isArray(b.outcomes)||b.outcomes.length<2||b.outcomes.length>6)fail('Defina 2 a 6 opções');const title=str(b.title),category=str(b.category,40);const rows=b.outcomes.map(o=>q('INSERT INTO outcomes VALUES(?,?,?,?)',uuid(),id,str(o.label,60),num(o.odds,101,10000)));
 await db.batch([q('INSERT INTO events(id,title,category,closes) VALUES(?,?,?,?)',id,title,category,closes.toISOString()),...rows,q('INSERT INTO audit VALUES(?,?,?,?,CURRENT_TIMESTAMP)',uuid(),u.id,p,id)]);return json({ok:true});
 }
 if(p==='/api/admin/settle'){
 const e=await q('SELECT * FROM events WHERE id=?',str(b.event)).first();if(!e||e.status!=='open')fail('Evento já finalizado');if(b.status!=='void'&&!await q('SELECT id FROM outcomes WHERE event_id=? AND id=?',e.id,str(b.winner)).first())fail('Vencedor inválido');statement=q('UPDATE events SET status=?,winner=? WHERE id=? AND status=\'open\'',b.status==='void'?'void':'settled',b.status==='void'?null:b.winner,e.id);
 }
 if(p==='/api/admin/reward'){const [starts,ends]=dates(b);statement=q('INSERT INTO rewards VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,cost=excluded.cost,stock=excluded.stock,starts=excluded.starts,ends=excluded.ends,active=excluded.active',b.id?str(b.id):uuid(),str(b.title),str(b.description,500),num(b.cost,1,10000000),num(b.stock,0,1000000),starts,ends,b.active===false?0:1);}
 if(p==='/api/admin/bonus'){const [starts,ends]=dates(b);const code=str(b.code,40).toUpperCase();if(!/^[A-Z0-9_-]+$/.test(code))fail('Código inválido');statement=q('INSERT INTO bonuses VALUES(?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET amount=excluded.amount,max_uses=excluded.max_uses,starts=excluded.starts,ends=excluded.ends,active=excluded.active',code,num(b.amount,1,1000000),num(b.max_uses,1,1000000),starts,ends,b.active===false?0:1);}
 if(p==='/api/admin/redemption'){if(!['delivered','cancelled'].includes(b.status))fail('Status inválido');statement=q("UPDATE redemptions SET status=? WHERE id=? AND status='pending'",b.status,str(b.id));}
 if(!statement)fail('Não encontrado',404);
 await db.batch([statement,q('INSERT INTO audit VALUES(?,?,?,?,CURRENT_TIMESTAMP)',uuid(),u.id,p,JSON.stringify(b))]);return json({ok:true});
}
export default {async fetch(req,env){let res;try{res=await handle(req,env);}catch(e){console.error(JSON.stringify({error:e.status?e.message:'request_failed',path:new URL(req.url).pathname}));let message=e.status?e.message:'Não foi possível concluir';const t=String(e.message);if(t.includes('UNIQUE'))message='Operação já realizada ou e-mail cadastrado';if(t.includes('CHECK'))message='Saldo insuficiente ou valor inválido';if(/indisponível|encerrado|odd alterada/.test(t))message=t.replace(/^.*?: /,'');res=json({error:message},e.status||400);}const h=new Headers(res.headers);h.set('X-Content-Type-Options','nosniff');h.set('X-Frame-Options','DENY');h.set('Referrer-Policy','same-origin');h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");return new Response(res.body,{status:res.status,headers:h});}};

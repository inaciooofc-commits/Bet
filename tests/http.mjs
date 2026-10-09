import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:8787';let cookie='';
async function call(path,b,expected=200){const r=await fetch(base+'/api/'+path,{method:b?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:b?JSON.stringify(b):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const j=await r.json();assert.equal(r.status,expected,JSON.stringify(j));return j;}
await call('state');
await call('auth/register',{name:'Teste HTTP',email:crypto.randomUUID()+'@example.test',password:'test-password-123'});
assert.equal((await call('state')).user.balance,1000);
await call('daily',{});await call('daily',{},400);
await call('bonus',{code:'UMBRELLA500'});await call('bonus',{code:'UMBRELLA500'},400);
await call('bet',{id:'http-'+crypto.randomUUID(),outcome:'kaito',odds:180,stake:100});
assert.equal((await call('state')).user.balance,1500);
await call('bet',{id:crypto.randomUUID(),outcome:'kaito',odds:900,stake:100},400);
await call('admin/state',undefined,403);
await call('redeem',{id:'http-'+crypto.randomUUID(),reward:'badge'});
assert.equal((await call('state')).user.balance,500);
await call('logout',undefined,405);
await call('logout',{});
assert.equal((await call('state')).user,null);
console.log('HTTP: cadastro, sessão, Ryos, bônus, apostas, resgate e permissões OK');

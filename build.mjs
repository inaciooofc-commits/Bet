import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
mkdirSync('dist',{recursive:true});
const assets=Object.fromEntries(['index.html','app.js','style.css','manifest.json','icon.svg'].map(n=>['/'+n,readFileSync('public/'+n,'utf8')]));
writeFileSync('dist/worker.js','const assets='+JSON.stringify(assets)+';\n'+readFileSync('src/worker.js','utf8'));

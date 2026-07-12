import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(),stamp=new Date().toISOString().replace(/[:.]/g,'-'),target=path.join(root,'backups',stamp);fs.mkdirSync(target,{recursive:true});
for(const name of ['qa-manager.db','uploads']){const src=path.join(root,'data',name);if(fs.existsSync(src))fs.cpSync(src,path.join(target,name),{recursive:true})}
console.log(`Backup criado em ${target}`);

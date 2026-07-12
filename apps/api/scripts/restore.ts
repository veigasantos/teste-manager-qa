import fs from 'node:fs';import path from 'node:path';
const source=process.argv[2];if(!source||!fs.existsSync(source)){console.error('Uso: npm run restore -w @qa/api -- <pasta-do-backup>');process.exit(1)}
const data=path.join(process.cwd(),'data');fs.mkdirSync(data,{recursive:true});for(const name of ['qa-manager.db','uploads']){const src=path.join(source,name);if(fs.existsSync(src))fs.cpSync(src,path.join(data,name),{recursive:true,force:true})}console.log('Backup restaurado.');

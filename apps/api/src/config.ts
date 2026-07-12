import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const apiRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const isProduction=process.env.NODE_ENV==='production';
const developmentSecret='chave-local-desenvolvimento-qa-manager';
const secret=process.env.SESSION_SECRET||developmentSecret;

if(isProduction&&(secret===developmentSecret||secret.length<32)){
  throw new Error('SESSION_SECRET deve ter pelo menos 32 caracteres em producao');
}

export const config={
  port:Number(process.env.PORT||process.env.API_PORT||3333),
  host:process.env.HOST||'127.0.0.1',
  origin:process.env.WEB_ORIGIN||'http://localhost:5173',
  secret,
  uploadDir:path.resolve(apiRoot,process.env.UPLOAD_DIR||'data/uploads'),
  webDir:path.resolve(apiRoot,'../web/dist'),
  isProduction
};

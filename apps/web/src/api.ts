const browserHost=typeof window!=='undefined'&&window.location?.hostname?window.location.hostname:'127.0.0.1';
const isLocalDevelopment=typeof window!=='undefined'&&window.location.port==='5173';
const base=(globalThis as any).__QA_API_URL__||(isLocalDevelopment?`http://${browserHost}:3333/api/v1`:'/api/v1');
export async function api(path:string,options:RequestInit={}):Promise<any>{const hasBody=options.body!==undefined&&options.body!==null;const headers:any={...(hasBody&&!(options.body instanceof FormData)?{'Content-Type':'application/json'}:{}),...options.headers};const r=await fetch(base+path,{...options,headers,credentials:'include'});if(!r.ok){const x=await r.json().catch(()=>null);throw new Error(x?.error?.message||'Não foi possível concluir a operação')}return r.status===204?null:r.json()}
export function download(path:string){window.open(base+path,'_blank')}

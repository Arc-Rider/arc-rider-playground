import {defineConfig,loadEnv} from 'vite';
import {createMinimalLiveApi} from './server/minimal-live-api.mjs';
import {createTriageApi} from './server/triage-api.mjs';

export default defineConfig(({mode})=>{
  const env=loadEnv(mode,process.cwd(),'TYPESAFE_');
  const attach=server=>{
    const credentials={apiKey:process.env.TYPESAFE_API_KEY||env.TYPESAFE_API_KEY,model:process.env.TYPESAFE_MODEL||env.TYPESAFE_MODEL||'jev-latest'};
    server.middlewares.use(createMinimalLiveApi(credentials));
    server.middlewares.use(createTriageApi(credentials));
  };
  return {
    esbuild:{jsx:'automatic'},
    plugins:[{name:'jev-local-api',configureServer:attach,configurePreviewServer:attach}],
    server:{host:'127.0.0.1',port:4192,strictPort:true},
    preview:{host:'127.0.0.1',port:4192,strictPort:true},
  };
});

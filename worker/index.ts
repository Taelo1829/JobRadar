import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { scan, setSetting } from "../lib/radar";

const worker = {
  async scheduled(event: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      await scan();
      await setSetting('schedulerLastRun', String(event.scheduledTime));
    })());
  },
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    if (env.STANDALONE === 'true') {
      if (!env.APP_PASSWORD) return new Response('The owner must configure APP_PASSWORD before opening Job Radar.', {status:503});
      const authorization=request.headers.get('Authorization')||'';
      let password='';
      try { if(authorization.startsWith('Basic '))password=atob(authorization.slice(6)).split(':').slice(1).join(':'); } catch {}
      const digest=async (value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
      const [actual,expected]=await Promise.all([digest(password),digest(env.APP_PASSWORD)]);
      let different=0;for(let i=0;i<actual.length;i++)different|=actual[i]^expected[i];
      if(different) return new Response('Sign in with username owner and your Job Radar password.',{status:401,headers:{'WWW-Authenticate':'Basic realm="Job Radar", charset="UTF-8"','Cache-Control':'no-store'}});
      const headers=new Headers(request.headers);
      headers.set('oai-authenticated-user-id','job-radar-owner');headers.set('oai-authenticated-user-email','owner@jobradar.local');
      request=new Request(request,{headers});
      if(env.ASSETS && ['GET','HEAD'].includes(request.method) && !new URL(request.url).pathname.startsWith('/api/')) {const asset=await env.ASSETS.fetch(request);if(asset.status!==404)return asset;}
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

export default worker;

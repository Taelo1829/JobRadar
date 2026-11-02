import {searchIndexedJobs,JSearchQuotaError} from './jsearch';
import {searchHeadcount} from './headcount';
type State={get:()=>Promise<string|undefined>;set:(value:string)=>Promise<void>};
export async function searchJobs(company:string,role:string,keys:{jsearch?:string;headcount?:string},state:State,fetcher:typeof fetch=fetch,now=Date.now()){
 const pausedUntil=Number(await state.get())||0;
 if(keys.jsearch&&pausedUntil<=now){
  try{return {...await searchIndexedJobs(company,role,keys.jsearch,fetcher),provider:'jsearch'};}
  catch(error){if(!(error instanceof JSearchQuotaError))throw error;await state.set(String(now+24*60*60*1000));if(!keys.headcount)throw error;}
 }
 if(!keys.headcount)throw new Error('Search quota exhausted and no fallback is configured');
 return {...await searchHeadcount(company,role,keys.headcount,fetcher),provider:'headcount'};
}

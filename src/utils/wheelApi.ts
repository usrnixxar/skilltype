import { getSupabaseClient } from './supabaseClient';
export interface WheelPrize { slot:number; title:string; image_path:string|null; chance?:number; }
export interface WheelStatus { success:boolean; earnedToday:number; remainingEarnable:number; available:number; prizes:WheelPrize[]; }
export async function wheelRequest(sessionToken:string,action:'status'|'claim'|'spin',payload:Record<string,unknown>={}):Promise<any>{
 const client=getSupabaseClient();if(!client)throw new Error('Wheel service unavailable');
 const {data,error}=await client.functions.invoke('spin-wheel',{body:{action,sessionToken,...payload}});
 if(error||data?.success!==true){
  let message=data?.error;
  if(error?.context instanceof Response){const result=await error.context.json().catch(()=>({}));message=result.error||message}
  throw new Error(message||'Wheel request failed');
 }
 return data;
}

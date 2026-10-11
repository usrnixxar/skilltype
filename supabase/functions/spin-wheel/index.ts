import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(payload:unknown,status=200)=>new Response(JSON.stringify(payload),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const raw=await req.text();if(raw.length>4096)return reply({error:'Too large'},413);
  const body=JSON.parse(raw);
  if(!['status','claim','spin'].includes(body.action)||typeof body.sessionToken!=='string'||!/^[a-f0-9]{64}$/.test(body.sessionToken))return reply({error:'Invalid request'},400);
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.sessionToken));
  const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  // Authorization is checked by the privileged database RPC, not a client-supplied role.
  const {error:authError}=await client.rpc('admin_manage',{p_hash:hash,p_action:'auth',p_payload:{}});
  if(!authError && body.action!=='claim'){
   const {data:prizes,error:prizeError}=await client.from('spin_prizes').select('slot,title,image_path,chance').order('slot');
   if(prizeError||!prizes)return reply({error:'Wheel unavailable'},503);
   if(body.action==='status')return reply({success:true,adminTestMode:true,earnedToday:0,remainingEarnable:0,available:0,prizes});
   const products=prizes.filter((p:{slot:number;image_path:string|null})=>p.slot>4&&p.image_path);
   const total=products.reduce((n:number,p:{chance:number})=>n+Number(p.chance),0);
   const r=Math.random()*100;
   let slot=1;
   if(r<100-total){slot=Math.min(4,Math.floor(r/Math.max((100-total)/4,0.000001))+1);}
   else {let acc=100-total;for(const prize of products){acc+=Number(prize.chance);if(r<acc){slot=prize.slot;break;}}}
   return reply({success:true,adminTestMode:true,resultSlot:slot,remaining:0});
  }
  const {data,error}=await client.rpc('spin_service',{p_hash:hash,p_action:body.action,p_payload:{gameSessionId:body.gameSessionId,wave:body.wave}});
  if(error)return reply({error:error.code==='28000'?'Log in again':error.code==='42501'?'Student account required':error.code==='22023'?error.message:'Wheel unavailable'},error.code==='28000'?401:error.code==='42501'?403:error.code==='22023'?400:503);
  return reply(data);
 }catch{return reply({error:'Invalid request'},400)}
});
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return new Response(null,{status:405,headers});
 try{
  const data=await req.json();
  if(typeof data.visitorId!=='string'||!/^[a-f0-9]{8}-[a-f0-9-]{27,}$/.test(data.visitorId))return new Response(null,{status:400,headers});
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {error}=await client.rpc('record_site_visit',{p_visitor:data.visitorId});
  return new Response(JSON.stringify({success:!error}),{status:error?503:200,headers});
 }catch{return new Response(null,{status:400,headers})}
});
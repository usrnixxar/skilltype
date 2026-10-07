import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply = (body: unknown,status=200) => new Response(JSON.stringify(body),{status,headers});
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))), b=>b.toString(16).padStart(2,'0')).join('');
Deno.serve(async (req: Request) => {
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
  if(req.method!=='POST') return reply({error:'Method not allowed'},405);
  try {
    const raw=await req.text();
    if(raw.length>4096) return reply({error:'Payload too large'},413);
    const body=JSON.parse(raw);
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
    if(body.action==='logout' || body.action==='validate') {
      if(typeof body.sessionToken!=='string' || !/^[a-f0-9]{64}$/.test(body.sessionToken)) return reply({error:'Please log in again'},401);
      const tokenHash=await hash(body.sessionToken);
      if(body.action==='logout') {
        const {error}=await admin.from('player_sessions').delete().eq('token_hash',tokenHash);
        if(error) return reply({error:'Logout failed. Please retry.'},503);
        return reply({success:true});
      }
      const {data,error}=await admin.from('player_sessions').select('player_id').eq('token_hash',tokenHash).gt('expires_at',new Date().toISOString()).maybeSingle();
      return error ? reply({error:'Session check unavailable'},503) : data ? reply({success:true}) : reply({error:'Please log in again'},401);
    }
    if(body.action!=='login' || !['student','guest'].includes(body.kind)) return reply({error:'Choose Student or Guest'},400);
    const name=typeof body.name==='string' ? body.name.replace(/<[^>]*>?/gm,'').replace(/[\x00-\x1F\x7F]/g,'').trim().replace(/\s+/g,' ') : '';
    if(name.length<2 || name.length>25) return reply({error:'Enter a name of 2–25 characters'},400);
    if(body.kind==='student' && (typeof body.pin!=='string' || !/^\d{6}$/.test(body.pin))) return reply({error:'Enter your 6-digit student PIN'},400);
    const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    const {data,error}=await admin.rpc('login_player',{p_kind:body.kind,p_name:name,p_pin:body.kind==='student'?body.pin:null,p_hash:await hash(token)});
    if(error) return reply({error:error.code==='22023'?error.message:'Login unavailable. Please retry.'},error.code==='22023'?400:503);
    return reply({success:true,profile:{...data,sessionToken:token}});
  } catch { return reply({error:'Unable to process login. Please retry.'},400); }
});

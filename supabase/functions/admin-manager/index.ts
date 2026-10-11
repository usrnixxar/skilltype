import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const MAX_BODY = 2900000;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))), b=>b.toString(16).padStart(2,'0')).join('');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (req.method !== 'POST') return reply({error:'Method not allowed'},405);
  try {
    // Bound the actual streamed body, not just a client-supplied Content-Length.
    const reader=req.body?.getReader(); if(!reader) return reply({error:'Missing request'},400);
    const decoder=new TextDecoder(); let raw=''; let size=0;
    while(true){const {done,value}=await reader.read(); if(done)break; size+=value.length;
      if(size>MAX_BODY){await reader.cancel();return reply({error:'Image must be under 2 MB'},413);} raw+=decoder.decode(value,{stream:true});}
    raw+=decoder.decode(); const body=JSON.parse(raw);
    if(typeof body.sessionToken!=='string'||!/^[a-f0-9]{64}$/.test(body.sessionToken)) return reply({error:'Please log in again'},401);
    const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
    const p_hash=await hash(body.sessionToken);
    const rpc=async(action:string,payload:Record<string,unknown>={})=>{
      const {data,error}=await client.rpc('admin_manage',{p_hash,p_action:action,p_payload:payload});
      if(error)throw error; return data;
    };
    // Never authorize using a player ID sent by the browser.
    await rpc('auth');
    if(body.action==='auth')return reply({success:true,authorized:true});
    if(body.action==='players')return reply({success:true,...await rpc('players',{
      search:typeof body.search==='string'?body.search.slice(0,80):'',
      page:Number.isInteger(body.page)&&body.page>=0?Math.min(body.page,100000):0,
    })});
    if(body.action==='delete-player')return reply({success:true,...await rpc('delete-player',{playerId:body.playerId,confirm:body.confirm})});
    if(body.action==='gifts')return reply({success:true,...await rpc('gifts')});
    if(body.action==='analytics'){
      const {data:visits,error:visitsError}=await client.from('site_visitors').select('visitor_id,visit_day').gte('visit_day',new Date(Date.now()-95*86400000).toISOString().slice(0,10)).limit(100000);
      if(visitsError)return reply({error:'Analytics unavailable'},503);
      return reply({success:true,visits});
    }
    if(body.action==='player-detail'){
      if(typeof body.playerId!=='string'||!uuid.test(body.playerId))return reply({error:'Invalid player'},400);
      const {data:profile,error:profileError}=await client.from('player_profiles').select('id,name,kind,created_at').eq('id',body.playerId).maybeSingle();
      if(profileError||!profile)return reply({error:'Player not found'},404);
      const {data:sessions,error:sessionError}=await client.from('player_sessions').select('last_seen_at,expires_at').eq('player_id',profile.id).order('last_seen_at',{ascending:false}).limit(10);
      if(sessionError)return reply({error:'Activity unavailable'},503);
      const now=Date.now();
      return reply({success:true,profile,online:(sessions||[]).some((row:any)=>Date.parse(row.expires_at)>now&&Date.parse(row.last_seen_at)>now-90000),lastSeen:sessions?.[0]?.last_seen_at||null,recentActivity:(sessions||[]).map((v:any)=>v.last_seen_at)});
    }

    if(body.action==='wheel-prizes'){
      const {data,error}=await client.from('spin_prizes').select('slot,title,image_path,chance').order('slot');
      if(error)return reply({error:'Unable to load wheel prizes'},503);
      return reply({success:true,prizes:data});
    }
    if(body.action==='wheel-save'){
      const slot=Number(body.slot),chance=Number(body.chance);
      if(!Number.isInteger(slot)||slot<5||slot>8||!Number.isFinite(chance)||chance<0||chance>100||Math.abs(chance*100-Math.round(chance*100))>0.000001||typeof body.title!=='string'||body.title.trim().length<1||body.title.trim().length>80)return reply({error:'Invalid wheel slot, title or chance'},400);
      const {data:existing,error:readError}=await client.from('spin_prizes').select('*').order('slot');
      if(readError||!existing)return reply({error:'Unable to read wheel settings'},503);
      const previous=existing.find(p=>p.slot===slot);
      if(!previous)return reply({error:'Unknown wheel slot'},404);
      const total=existing.filter(p=>p.slot>4&&p.slot!==slot&&p.image_path).reduce((s,p)=>s+Number(p.chance),0)+chance;
      if(total>100.00001)return reply({error:'Total product chance cannot exceed 100%'},400);
      let imagePath=previous.image_path;
      if(body.image){
        if(typeof body.image!=='string'||body.image.length>2800000)return reply({error:'Image must be under 2 MB'},400);
        let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(body.image),c=>c.charCodeAt(0));}catch{return reply({error:'Invalid image'},400)}
        const png=bytes.length>8&&bytes.slice(0,8).every((b,i)=>b===[137,80,78,71,13,10,26,10][i]);
        const jpg=bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
        const webp=bytes.length>12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
        if(bytes.length>2097152||bytes.length<12||(!png&&!jpg&&!webp))return reply({error:'Upload a JPG, PNG or WebP under 2MB'},400);
        const ext=png?'png':jpg?'jpg':'webp';imagePath=`wheel-${crypto.randomUUID()}.${ext}`;
        const {error:uploadError}=await client.storage.from('gift-images').upload(imagePath,bytes,{contentType:png?'image/png':jpg?'image/jpeg':'image/webp',upsert:false});
        if(uploadError)return reply({error:'Unable to upload prize image'},503);
      }
      if(!imagePath&&chance>0)return reply({error:'Upload an image before assigning a chance'},400);
      const {error:saveError}=await client.from('spin_prizes').update({title:body.title.trim(),image_path:imagePath,chance,updated_at:new Date().toISOString()}).eq('slot',slot);
      if(saveError)return reply({error:'Unable to save wheel settings'},503);
      if(body.image&&previous.image_path&&previous.image_path!==imagePath)await client.storage.from('gift-images').remove([previous.image_path]);
      return reply({success:true});
    }

    if(body.action==='upload-gift'){
      const section=body.section ?? 'showcase';
      if(!['showcase','achievement'].includes(section))return reply({error:'Invalid product section'},400);
      if(typeof body.title!=='string'||!body.title.trim()||body.title.trim().length>80||!uuid.test(body.id||''))return reply({error:'Enter a gift title (1–80 characters)'},400);
      if(typeof body.image!=='string'||body.image.length>2800000)return reply({error:'Image must be under 2 MB'},400);
      const bytes=Uint8Array.from(atob(body.image),c=>c.charCodeAt(0));
      if(bytes.length<12||bytes.length>2097152)return reply({error:'Choose a JPG, PNG or WebP image under 2 MB'},400);
      const png=bytes.slice(0,8).every((b,i)=>b===[137,80,78,71,13,10,26,10][i]);
      const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
      const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
      if(!png&&!jpg&&!webp)return reply({error:'Only JPG, PNG and WebP images are allowed'},400);
      const ext=png?'png':jpg?'jpg':'webp'; const contentType=png?'image/png':jpg?'image/jpeg':'image/webp';
      const path=`${body.id}.${ext}`;
      const existing=await rpc('gifts');
      const previous=existing.gifts.find((g:any)=>g.id===body.id);
      if(previous)return reply({success:true,gift:previous}); // Safe retry after a lost response.
      const {error:uploadError}=await client.storage.from('gift-images').upload(path,bytes,{contentType,upsert:false,cacheControl:'3600'});
      if(uploadError)return reply({error:'Image upload failed. Please retry with the file again.'},503);
      try {
        const result=await rpc('save-gift',{id:body.id,title:body.title.trim(),imagePath:path,enabled:section==='showcase',sortOrder:0,section});
        return reply({success:true,...result});
      }catch(error){await client.storage.from('gift-images').remove([path]);throw error;}
    }
    if(body.action==='update-gift'||body.action==='delete-gift'){
      if(!uuid.test(body.id||''))return reply({error:'Invalid gift'},400);
      const {gifts}=await rpc('gifts');const gift=gifts.find((g:any)=>g.id===body.id);
      if(!gift)return body.action==='delete-gift'?reply({success:true,deleted:true}):reply({error:'Gift not found'},404);
      if(body.action==='update-gift'){
        if(typeof body.title!=='string'||!body.title.trim()||body.title.trim().length>80||typeof body.enabled!=='boolean'||!Number.isInteger(body.sortOrder)||Math.abs(body.sortOrder)>10000)return reply({error:'Check title and display order (−10000 to 10000)'},400);
        return reply({success:true,...await rpc('save-gift',{id:gift.id,title:body.title.trim(),imagePath:gift.image_path,enabled:body.enabled,sortOrder:body.sortOrder})});
      }
      // Hide before removing the asset; a failed storage removal stays retryable in Admin.
      if(gift.enabled) await rpc('save-gift',{id:gift.id,title:gift.title,imagePath:gift.image_path,enabled:false,sortOrder:gift.sort_order});
      const {error}=await client.storage.from('gift-images').remove([gift.image_path]);
      if(error)return reply({error:'Gift hidden, but image removal failed. Please retry Delete.'},503);
      return reply({success:true,...await rpc('delete-gift',{id:gift.id})});
    }
    return reply({error:'Unknown action'},400);
  }catch(error){
    const e=error as {code?:string;message?:string};
    if(e.code==='28000')return reply({error:'Please log in again'},401);
    if(e.code==='42501')return reply({error:'Admin access required'},403);
    if(e.code==='22023')return reply({error:e.message||'Invalid request'},400);
    return reply({error:'Could not complete this action. Please retry.'},400);
  }
});

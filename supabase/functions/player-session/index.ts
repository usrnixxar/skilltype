import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

const hash = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    ),
    (b) => b.toString(16).padStart(2, '0')
  ).join('');

const getClientIp = (req: Request) => {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
};

const maskGuestName = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((word) => {
      const chars = Array.from(word);
      if (chars.length <= 2) return word;
      return chars[0] + '*'.repeat(chars.length - 2) + chars[chars.length - 1];
    })
    .join(' ');

const derivePin=async(pin:string,salt:string)=>{
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
  const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/../g)!.map(x=>parseInt(x,16))),iterations:120000,hash:'SHA-256'},material,256);
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

  try {
    const raw = await req.text();
    if (raw.length > 4096) return reply({ error: 'Payload too large' }, 413);
    const body = JSON.parse(raw);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    if(body.action==='register-guest'||(body.action==='login'&&body.kind==='guest')){
      const name=typeof body.name==='string'?body.name.trim().replace(/\s+/g,' '):'';
      const pin=body.pin;
      const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
      if(name.length<2||name.length>25||typeof pin!=='string'||!/^\d{6}$/.test(pin))return reply({error:'Enter your name and a 6-digit PIN'},400);
      const normalizedName=name.toLowerCase();
      if(body.action==='register-guest'){
        if(!/^[^ @]+@[^ @]+\.[^ @]+$/.test(email)||email.length>180)return reply({error:'Enter a valid email address'},400);
        const {data:existing}=await admin.from('guest_credentials').select('player_id').or(`email.eq.${email},login_name.eq.${normalizedName}`).limit(1);
        if(existing?.length)return reply({error:'Name or email already registered. Please log in.'},409);
        const {data:profile,error:profileError}=await admin.from('player_profiles').insert({name,kind:'guest'}).select('id').single();
        if(profileError||!profile)return reply({error:'Registration unavailable'},503);
        const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
        const {error:credentialError}=await admin.from('guest_credentials').insert({player_id:profile.id,email,login_name:normalizedName,pin_salt:salt,pin_hash:await derivePin(pin,salt)});
        if(credentialError){await admin.from('player_profiles').delete().eq('id',profile.id);return reply({error:'Name or email already registered'},409);}
        return reply({success:true,registered:true,message:'Registration completed. Log in with your name and PIN.'});
      }
      if(typeof body.deviceId!=='string'||!/^[a-f0-9-]{20,80}$/.test(body.deviceId))return reply({error:'Device verification failed'},400);
      const {data:credential,error:credError}=await admin.from('guest_credentials').select('player_id,pin_hash,pin_salt').eq('login_name',normalizedName).maybeSingle();
      if(credError)return reply({error:'Login unavailable'},503);
      if(!credential||await derivePin(pin,credential.pin_salt)!==credential.pin_hash)return reply({error:'Invalid name or PIN'},401);
      const {data:previous,error:sessionErr}=await admin.from('player_sessions').select('device_id').eq('player_id',credential.player_id).gt('expires_at',new Date().toISOString());
      if(sessionErr)return reply({error:'Session unavailable'},503);
      if(previous?.some((row:any)=>row.device_id!==body.deviceId)&&body.forceLogoutOther!==true)return reply({error:'Account already signed in on another device',code:'ACTIVE_ON_OTHER_DEVICE'},409);
      const {error:deleteError}=await admin.from('player_sessions').delete().eq('player_id',credential.player_id);
      if(deleteError)return reply({error:'Login unavailable'},503);
      const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
      const {error:insertErr}=await admin.from('player_sessions').insert({player_id:credential.player_id,token_hash:await hash(token),device_id:body.deviceId,last_seen_at:new Date().toISOString()});
      if(insertErr)return reply({error:'Login unavailable'},503);
      await admin.from('player_login_events').insert({player_id:credential.player_id});
      const {data:profile}=await admin.from('player_profiles').select('id,name,kind,created_at').eq('id',credential.player_id).single();
      return reply({success:true,profile:{id:credential.player_id,name:maskGuestName(profile?.name||name),kind:'guest',createdAt:Date.parse(profile?.created_at||new Date().toISOString()),sessionToken:token}});
    }

    if (body.action === 'cheaters') {
      const { data, error } = await admin
        .from('player_security')
        .select('distinct_ip_count, flagged_at, player_profiles!inner(name,kind)')
        .eq('is_cheater', true)
        .order('flagged_at', { ascending: false })
        .limit(50);

      if (error) return reply({ error: 'Cheater list unavailable' }, 503);

      return reply({
        success: true,
        cheaters: (data || []).map((row: any) => ({
          name:
            row.player_profiles?.kind === 'guest'
              ? maskGuestName(row.player_profiles?.name || 'Unknown')
              : row.player_profiles?.name || 'Unknown',
          distinctIpCount: row.distinct_ip_count,
          flaggedAt: row.flagged_at,
        })),
      });
    }

    if (body.action === 'presence') {
      if (typeof body.sessionToken !== 'string' || !/^[a-f0-9]{64}$/.test(body.sessionToken)) {
        return reply({ error: 'Please log in again' }, 401);
      }
      const { data, error } = await admin.rpc('get_admin_player_presence', {
        p_hash: await hash(body.sessionToken),
      });
      if (error) {
        return reply({ error: error.code === '42501' ? 'Admin access required' : 'Presence unavailable' },
          error.code === '42501' ? 403 : error.code === '28000' ? 401 : 503);
      }
      return reply({ success: true, ...data });
    }

    if (body.action === 'logout' || body.action === 'validate') {
      if (
        typeof body.sessionToken !== 'string' ||
        !/^[a-f0-9]{64}$/.test(body.sessionToken)
      ) {
        return reply({ error: 'Please log in again' }, 401);
      }

      const tokenHash = await hash(body.sessionToken);

      if (body.action === 'logout') {
        const { error } = await admin
          .from('player_sessions')
          .delete()
          .eq('token_hash', tokenHash);

        if (error) return reply({ error: 'Logout failed. Please retry.' }, 503);
        return reply({ success: true });
      }

      const { data, error } = await admin
        .from('player_sessions')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('token_hash', tokenHash)
        .gt('expires_at', new Date().toISOString())
        .select('player_id')
        .maybeSingle();

      return error
        ? reply({ error: 'Session check unavailable' }, 503)
        : data
          ? reply({ success: true })
          : reply({ error: 'Please log in again' }, 401);
    }

    if (body.action !== 'login' || !['student', 'guest'].includes(body.kind)) {
      return reply({ error: 'Choose Student or Guest' }, 400);
    }

    const name =
      typeof body.name === 'string'
        ? body.name
            .replace(/<[^>]*>?/gm, '')
            .replace(/[\x00-\x1F\x7F]/g, '')
            .trim()
            .replace(/\s+/g, ' ')
        : '';

    if (name.length < 2 || name.length > 25) {
      return reply({ error: 'Enter a name of 2–25 characters' }, 400);
    }

    if (
      body.kind === 'student' &&
      (typeof body.pin !== 'string' || !/^\d{6}$/.test(body.pin))
    ) {
      return reply({ error: 'Enter your 6-digit student PIN' }, 400);
    }

    if (
      typeof body.deviceId !== 'string' ||
      !/^[a-f0-9-]{20,80}$/.test(body.deviceId)
    ) {
      return reply({ error: 'Device verification failed. Refresh and try again.' }, 400);
    }

    if (body.kind === 'student') {
      const { data: existingProfile, error: profileError } = await admin
        .from('player_profiles')
        .select('id,name')
        .eq('pin', body.pin)
        .maybeSingle();

      if (profileError) {
        return reply({ error: 'Login unavailable. Please retry.' }, 503);
      }

      if (existingProfile) {
        const normalizedStoredName = String(existingProfile.name || '')
          .trim()
          .replace(/\s+/g, ' ')
          .toLowerCase();

        if (normalizedStoredName !== name.toLowerCase()) {
          return reply(
            { error: 'This PIN is registered to another name. Enter your original name.' },
            400
          );
        }

        const { data: otherSessions, error: sessionLookupError } = await admin
          .from('player_sessions')
          .select('token_hash')
          .eq('player_id', existingProfile.id)
          .gt('expires_at', new Date().toISOString())
          .neq('device_id', body.deviceId)
          .limit(1);

        if (sessionLookupError) {
          return reply({ error: 'Login unavailable. Please retry.' }, 503);
        }

        if ((otherSessions || []).length > 0) {
          if (body.forceLogoutOther !== true) {
            return reply(
              {
                error: 'This Student ID is already logged in on another device.',
                code: 'ACTIVE_ON_OTHER_DEVICE',
                requiresConfirmation: true,
              },
              409
            );
          }

          const { error: revokeError } = await admin
            .from('player_sessions')
            .delete()
            .eq('player_id', existingProfile.id);

          if (revokeError) {
            return reply(
              { error: 'Could not log out the previous device. Please retry.' },
              503
            );
          }
        }
      }
    }

    const token = Array.from(
      crypto.getRandomValues(new Uint8Array(32)),
      (b) => b.toString(16).padStart(2, '0')
    ).join('');

    const clientIp = getClientIp(req);
    const ipHash = await hash('skilltype-ip|' + clientIp);

    const { data, error } = await admin.rpc('login_player', {
      p_kind: body.kind,
      p_name: name,
      p_pin: body.kind === 'student' ? body.pin : null,
      p_hash: await hash(token),
      p_device_id: body.deviceId,
      p_ip_hash: ipHash,
    });

    if (error) {
      const known = error.code === '22023';
      return reply(
        { error: known ? error.message : 'Login unavailable. Please retry.' },
        known ? 400 : 503
      );
    }

    if(data?.id) await admin.from('player_login_events').insert({player_id:data.id});
    return reply({ success: true, profile: { ...data, sessionToken: token } });
  } catch {
    return reply({ error: 'Unable to process login. Please retry.' }, 400);
  }
});

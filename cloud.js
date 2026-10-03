// LaunchScape shared cloud storage adapter.
// Falls back to browser storage until Supabase is configured and an office user signs in.

const launchscapeCloud = {
  client: null,
  user: null,
  loading: false,
  syncTimer: null,
  lastUpdated: null
};

function cloudConfigured(){
  const cfg=window.LAUNCHSCAPE_SUPABASE||{};
  return /^https:\/\/.+\.supabase\.co$/.test(cfg.url||'') && String(cfg.anonKey||'').length>20;
}

function installCloudUI(){
  const settings=document.getElementById('settings');
  if(!settings || document.getElementById('cloudStorageCard'))return;
  const firstCard=settings.querySelector('.card');
  const card=document.createElement('div');
  card.className='card';
  card.id='cloudStorageCard';
  card.innerHTML=`
    <h3>Office Cloud</h3>
    <p id="cloudStorageStatus"><strong>Checking shared storage…</strong></p>
    <div id="cloudLoginArea">
      <div class="form-grid">
        <label>Office email<input id="cloudEmail" type="email" autocomplete="username" placeholder="name@company.com"></label>
        <label>Password<input id="cloudPassword" type="password" autocomplete="current-password" placeholder="Office password"></label>
      </div>
      <div class="actions">
        <button type="button" class="primary" id="cloudLoginButton">Sign In</button>
        <button type="button" id="cloudLogoutButton" style="display:none">Sign Out</button>
      </div>
    </div>
    <p class="muted" id="cloudStorageDetail">Until cloud storage is connected, LaunchScape keeps a backup in this browser.</p>`;
  if(firstCard)settings.insertBefore(card,firstCard);else settings.appendChild(card);
  document.getElementById('cloudLoginButton').addEventListener('click',cloudSignIn);
  document.getElementById('cloudLogoutButton').addEventListener('click',cloudSignOut);
}

function setCloudStatus(message,detail){
  const status=document.getElementById('cloudStorageStatus');
  const extra=document.getElementById('cloudStorageDetail');
  if(status)status.innerHTML=message;
  if(extra&&detail!==undefined)extra.textContent=detail;
}

function setCloudSessionUI(){
  const signedIn=!!launchscapeCloud.user;
  const login=document.getElementById('cloudLoginButton');
  const logout=document.getElementById('cloudLogoutButton');
  const email=document.getElementById('cloudEmail');
  const password=document.getElementById('cloudPassword');
  if(login)login.style.display=signedIn?'none':'inline-block';
  if(logout)logout.style.display=signedIn?'inline-block':'none';
  if(email){email.disabled=signedIn;if(signedIn)email.value=launchscapeCloud.user.email||'';}
  if(password){password.disabled=signedIn;if(signedIn)password.value='';}
}

async function cloudSignIn(){
  if(!launchscapeCloud.client)return;
  const email=document.getElementById('cloudEmail')?.value.trim();
  const password=document.getElementById('cloudPassword')?.value||'';
  if(!email||!password){setCloudStatus('<strong>Enter your office email and password.</strong>');return;}
  setCloudStatus('<strong>Signing in…</strong>');
  const {data,error}=await launchscapeCloud.client.auth.signInWithPassword({email,password});
  if(error){setCloudStatus('<strong>Sign in failed.</strong>',error.message);return;}
  launchscapeCloud.user=data.user||data.session?.user||null;
  setCloudSessionUI();
  await loadCloudState();
}

async function cloudSignOut(){
  if(!launchscapeCloud.client)return;
  await launchscapeCloud.client.auth.signOut();
  launchscapeCloud.user=null;
  setCloudSessionUI();
  setCloudStatus('<strong>Signed out.</strong>','This browser still has its local backup, but shared office data is not being synced.');
}

async function loadCloudState(){
  if(!launchscapeCloud.client||!launchscapeCloud.user)return;
  launchscapeCloud.loading=true;
  setCloudStatus('<strong>Loading shared office data…</strong>');
  try{
    const {data,error}=await launchscapeCloud.client.from('launchscape_state').select('leads,campaigns,updated_at').eq('id',1).maybeSingle();
    if(error)throw error;
    const localHasData=(Array.isArray(leads)&&leads.length)||(Array.isArray(campaigns)&&campaigns.length);
    const cloudHasData=data&&((Array.isArray(data.leads)&&data.leads.length)||(Array.isArray(data.campaigns)&&data.campaigns.length));
    if(!data || (!cloudHasData&&localHasData)){
      await syncCloudState(true);
      return;
    }
    leads=Array.isArray(data.leads)?data.leads:[];
    campaigns=Array.isArray(data.campaigns)?data.campaigns:[];
    localStorage.setItem('launchscape_leads',JSON.stringify(leads));
    localStorage.setItem('launchscape_campaigns',JSON.stringify(campaigns));
    launchscapeCloud.lastUpdated=data.updated_at||null;
    renderAll();
    setCloudStatus('<strong>Office Cloud: CONNECTED</strong>',`Signed in as ${launchscapeCloud.user.email||'office user'}. Leads and campaigns are shared across signed-in devices.`);
  }catch(e){
    setCloudStatus('<strong>Cloud database needs attention.</strong>',e.message||'Could not load shared office data.');
  }finally{
    launchscapeCloud.loading=false;
  }
}

async function syncCloudState(force=false){
  if(!launchscapeCloud.client||!launchscapeCloud.user||launchscapeCloud.loading&&!force)return;
  clearTimeout(launchscapeCloud.syncTimer);
  try{
    const payload={id:1,leads,campaigns,updated_at:new Date().toISOString()};
    const {data,error}=await launchscapeCloud.client.from('launchscape_state').upsert(payload,{onConflict:'id'}).select('updated_at').single();
    if(error)throw error;
    launchscapeCloud.lastUpdated=data?.updated_at||payload.updated_at;
    setCloudStatus('<strong>Office Cloud: CONNECTED</strong>',`Saved to shared storage as ${launchscapeCloud.user.email||'office user'}.`);
  }catch(e){
    setCloudStatus('<strong>Cloud save failed — local backup kept.</strong>',e.message||'Shared storage could not be updated.');
  }
}

function queueCloudSave(){
  if(!launchscapeCloud.client||!launchscapeCloud.user||launchscapeCloud.loading)return;
  clearTimeout(launchscapeCloud.syncTimer);
  launchscapeCloud.syncTimer=setTimeout(()=>syncCloudState(),350);
}

const browserSave=save;
save=function(){
  localStorage.setItem('launchscape_leads',JSON.stringify(leads));
  localStorage.setItem('launchscape_campaigns',JSON.stringify(campaigns));
  renderAll();
  queueCloudSave();
};

async function initCloud(){
  installCloudUI();
  if(!cloudConfigured()){
    setCloudStatus('<strong>Office Cloud: not connected yet.</strong>','LaunchScape is still using this browser only. Connect the shared database to switch on cross-device storage.');
    return;
  }
  if(!window.supabase?.createClient){
    setCloudStatus('<strong>Cloud library did not load.</strong>','Reload the page and try again.');
    return;
  }
  const cfg=window.LAUNCHSCAPE_SUPABASE;
  launchscapeCloud.client=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data,error}=await launchscapeCloud.client.auth.getSession();
  if(error){setCloudStatus('<strong>Could not check office login.</strong>',error.message);return;}
  launchscapeCloud.user=data.session?.user||null;
  setCloudSessionUI();
  if(launchscapeCloud.user)await loadCloudState();
  else setCloudStatus('<strong>Office Cloud: ready for sign in.</strong>','Sign in with an approved office account to load the shared pipeline.');
  launchscapeCloud.client.auth.onAuthStateChange(async (_event,session)=>{
    const next=session?.user||null;
    const changed=(next?.id||null)!==(launchscapeCloud.user?.id||null);
    launchscapeCloud.user=next;
    setCloudSessionUI();
    if(changed&&next)await loadCloudState();
  });
}

initCloud();

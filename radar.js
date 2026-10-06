// LaunchScape live prospect radar.
// Adds server-side public-data searches so the browser no longer depends on direct ArcGIS CORS access.

const launchscapeOriginalResultToLead=resultToLead;
const launchscapeOriginalSaveProspect=saveProspect;
const launchscapeOriginalOpenResult=openResult;

function prospectEndpoint(){
  if(location.hostname==='ncse1.github.io')return 'https://launchscape-liart.vercel.app/api/prospects';
  return location.origin.replace(/\/$/,'')+'/api/prospects';
}

async function prospectPost(payload){
  const r=await fetch(prospectEndpoint(),{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  let data={};
  try{data=await r.json();}catch{}
  if(!r.ok)throw new Error(data.error||('Lead service returned '+r.status));
  return data;
}

async function pingProspectSources(){
  try{
    const r=await fetch(prospectEndpoint()+'?mode=health',{cache:'no-store'});
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||'Lead service unavailable');
    const parcel=data.status?.parcel==='live';
    const permits=data.status?.permits==='live';
    document.getElementById('sourcePill').textContent=parcel&&permits?'Lead data: LIVE':parcel||permits?'Lead data: PARTIAL':'Lead data: OFFLINE';
    const source=document.getElementById('sourceStatus');
    if(source)source.innerHTML='<strong>'+ (parcel&&permits?'Live / reachable.':'Partially reachable.') +'</strong> Lee County property: '+(parcel?'LIVE':'OFFLINE')+' · Cape Coral permits: '+(permits?'LIVE':'OFFLINE')+'.';
  }catch(e){
    document.getElementById('sourcePill').textContent='Lead data: OFFLINE';
    const source=document.getElementById('sourceStatus');
    if(source)source.innerHTML='<strong>Lead service unavailable.</strong> '+esc(e.message||'Could not reach the server.');
  }
}

function leadFinderFilters(){
  return {
    city:document.getElementById('city')?.value||'CAPE CORAL',
    zip:document.getElementById('zip')?.value||'',
    minValue:+document.getElementById('minValue')?.value||0,
    minArea:+document.getElementById('minArea')?.value||0,
    yearFrom:+document.getElementById('yearFrom')?.value||0,
    yearTo:+document.getElementById('yearTo')?.value||0,
    saleMonths:+document.getElementById('saleMonths')?.value||0,
    pool:document.getElementById('pool')?.value||'',
    dock:document.getElementById('dock')?.value||'',
    seawall:document.getElementById('seawall')?.value||'',
    outOfState:!!document.getElementById('outOfState')?.checked,
    absentee:!!document.getElementById('absentee')?.checked
  };
}

searchParcels=async function(){
  const status=document.getElementById('searchStatus');
  status.textContent='Searching live Lee County property records through LaunchScape…';
  try{
    const data=await prospectPost({mode:'parcel-search',filters:leadFinderFilters()});
    results=Array.isArray(data.results)?data.results:[];
    status.textContent=results.length+' matching properties found from live Lee County public records.';
    renderResults();
  }catch(e){
    results=[];
    status.textContent='Property search failed: '+(e.message||'Lead service unavailable')+'.';
    renderResults();
  }
};

function sourceLabel(a){
  if(a._kind==='permit'||a._source==='Cape Coral Permit')return 'PERMIT SIGNAL';
  if(String(a._signal||'').includes('Recent property'))return 'RECENT BUYER';
  if(String(a._signal||'').includes('Waterfront'))return 'WATERFRONT';
  return 'PROPERTY';
}

function resultSecondary(a){
  if(a._kind==='permit'||a._source==='Cape Coral Permit'){
    const pieces=[
      a.O_NAME||'Owner identified in public permit record',
      a._permitNumber?'Permit '+a._permitNumber:'',
      a._permitValue?money(a._permitValue):'',
      a._contractor?a._contractor:''
    ].filter(Boolean);
    return pieces.join(' · ');
  }
  return (a.O_NAME||'Owner not listed')+' · '+money(a.JUST)+' · Built '+(a.MAXBUILTY||a.MINBUILTY||'—')+' · '+(a.HEATEDAREA?Math.round(a.HEATEDAREA).toLocaleString():'—')+' sf';
}

function resultTertiary(a){
  if(a._kind==='permit'||a._source==='Cape Coral Permit'){
    return [
      a._signal||'Active permit',
      a._permitStatus?'Status: '+a._permitStatus:'',
      a._permitDate?'Applied/issued: '+a._permitDate:''
    ].filter(Boolean).join(' · ');
  }
  return 'Pool: '+(yes(a.POOL)?'Yes':'No')+' · Dock: '+(yes(a.BOATDOCK)?'Yes':'No')+' · Seawall: '+(yes(a.SEAWALL)?'Yes':'No')+
    '<br>Mail: '+esc([a.O_CITY,a.O_STATE].filter(Boolean).join(', ')||'—')+' · Last sale: '+(a.S_1DATE?new Date(a.S_1DATE).toLocaleDateString():'—');
}

renderResults=function(){
  const el=document.getElementById('results');
  if(!results.length){el.innerHTML='<div class="card empty">Run Today\'s Lead Hunt or a property search to find prospects.</div>';return;}
  el.innerHTML=results.map((a,i)=>`<div class="lead-card">
    <div class="score">${a.score||0}</div>
    <div>
      <div class="muted" style="font-weight:800;letter-spacing:.05em">${esc(sourceLabel(a))}</div>
      <div class="lead-title">${esc(a.SITEADDR||'Address unavailable')}${a.SITECITY?', '+esc(a.SITECITY):''} ${esc(a.SITEZIP||'')}</div>
      <div class="muted">${esc(resultSecondary(a))}</div>
      <div class="chips">${(a.reasons||[]).slice(0,6).map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div>
    </div>
    <div class="muted">${resultTertiary(a)}</div>
    <div class="actions"><button class="mini" onclick="openResult(${i})">Details</button><button class="mini primary" onclick="saveProspect(${i})">Save Lead</button></div>
  </div>`).join('');
};

resultToLead=function(a){
  const l=launchscapeOriginalResultToLead(a);
  l.source=a._source||l.source||'Lee County Property';
  l.services=Array.isArray(a._services)?[...a._services]:l.services;
  l.status=a._kind==='permit'?'Research Needed':l.status;
  const signal=[
    a._signal?'Lead signal: '+a._signal:'',
    a._permitNumber?'Permit: '+a._permitNumber:'',
    a._permitStatus?'Permit status: '+a._permitStatus:'',
    a._permitDate?'Permit date: '+a._permitDate:'',
    a._contractor?'Contractor: '+a._contractor:''
  ].filter(Boolean).join('\n');
  if(signal)l.notes=[l.notes,signal].filter(Boolean).join('\n');
  l.activities.unshift({at:new Date().toISOString(),outcome:'Saved from '+(a._source||'Lead Finder')});
  return l;
};

saveProspect=function(i){
  const a=results[i];
  if(!a)return;
  const existing=leads.find(l=>l.strap===a.STRAP);
  if(existing){
    existing.score=Math.max(+existing.score||0,+a.score||0);
    existing.reasons=[...new Set([...(existing.reasons||[]),...(a.reasons||[])])];
    existing.services=[...new Set([...(existing.services||[]),...(a._services||[])])];
    const note=[
      a._signal?'New signal: '+a._signal:'',
      a._permitNumber?'Permit '+a._permitNumber:'',
      a._permitDate?a._permitDate:''
    ].filter(Boolean).join(' · ');
    if(note&&!String(existing.notes||'').includes(note))existing.notes=[existing.notes,note].filter(Boolean).join('\n');
    existing.activities.unshift({at:new Date().toISOString(),outcome:'New public lead signal merged into existing prospect'});
    save();
    alert('That property was already in the pipeline. I updated it with the new lead signal.');
    return;
  }
  leads.push(resultToLead(a));
  save();
  alert('Saved to the pipeline and assigned to Michael.');
};

openResult=function(i){
  const a=results[i];
  if(!a)return;
  if(a._kind!=='permit')return launchscapeOriginalOpenResult(i);
  const d=document.getElementById('leadDialog'),b=document.getElementById('leadDialogBody');
  b.innerHTML=`<h2>${esc(a.SITEADDR||'Cape Coral permit')}</h2>
    <p class="muted">${esc(a.O_NAME||'Owner not listed')} · Score ${a.score||0}</p>
    <p><strong>${esc(a._signal||'Permit opportunity')}</strong></p>
    <p>Permit: ${esc(a._permitNumber||'—')} · Value: ${money(a._permitValue)} · Date: ${esc(a._permitDate||'—')}</p>
    <p>Status: ${esc(a._permitStatus||'—')} · Contractor: ${esc(a._contractor||'—')}</p>
    <p><strong>Why it scored:</strong> ${(a.reasons||[]).map(esc).join(', ')}</p>
    <p><strong>Likely services:</strong> ${(a._services||[]).map(esc).join(', ')||'Research needed'}</p>`;
  d.showModal();
};

function updateRadarSummary(data){
  const el=document.getElementById('radarSummary');
  if(!el)return;
  const list=Array.isArray(data.results)?data.results:[];
  const permits=list.filter(x=>x._kind==='permit').length;
  const recent=list.filter(x=>String(x._signal||'').includes('Recent property')).length;
  const waterfront=list.filter(x=>String(x._signal||'').includes('Waterfront')).length;
  const hot=list.filter(x=>(+x.score||0)>=70).length;
  const live=Object.entries(data.sourceStatus||{}).filter(([,v])=>v==='live').map(([k])=>k);
  el.innerHTML='<strong>'+list.length+' prospects found</strong> · '+hot+' hot 70+ · '+permits+' permit signals · '+recent+' recent-buyer signals · '+waterfront+' waterfront signals<div class="muted" style="margin-top:5px">Live sources: '+esc(live.join(', ')||'none')+' · Updated '+new Date(data.generatedAt||Date.now()).toLocaleString()+'</div>';
}

async function runLeadHunt(days=30,{auto=false}={}){
  const status=document.getElementById('searchStatus');
  const button=document.getElementById('runRadarButton');
  if(button)button.disabled=true;
  if(status)status.textContent=auto?'Refreshing today\'s prospect radar…':'Hunting live public records for the strongest prospects…';
  try{
    const data=await prospectPost({mode:'radar',days});
    results=Array.isArray(data.results)?data.results:[];
    updateRadarSummary(data);
    if(status)status.textContent=results.length+' ranked prospects found. Highest-scoring opportunities are first.';
    renderResults();
    localStorage.setItem('launchscape_radar_date',new Date().toISOString().slice(0,10));
    localStorage.setItem('launchscape_radar_cache',JSON.stringify({results,sourceStatus:data.sourceStatus,generatedAt:data.generatedAt}));
  }catch(e){
    if(status)status.textContent='Lead hunt failed: '+(e.message||'Lead service unavailable')+'.';
    const cached=localStorage.getItem('launchscape_radar_cache');
    if(cached){
      try{
        const data=JSON.parse(cached);
        results=Array.isArray(data.results)?data.results:[];
        updateRadarSummary(data);
        renderResults();
        if(status)status.textContent+=' Showing the last saved radar results.';
      }catch{}
    }
  }finally{
    if(button)button.disabled=false;
  }
}

function installProspectRadar(){
  const finder=document.getElementById('finder');
  const profiles=finder?.querySelector('.profiles');
  if(!finder||!profiles||document.getElementById('prospectRadarCard'))return;
  const card=document.createElement('div');
  card.id='prospectRadarCard';
  card.className='card';
  card.style.marginBottom='16px';
  card.innerHTML=`
    <div class="section-head" style="margin-bottom:10px">
      <div>
        <div class="eyebrow">LIVE PROSPECT RADAR</div>
        <h3 style="margin:2px 0">Find people with a reason to buy now</h3>
        <div class="muted">Recent property activity + waterfront opportunities + Cape Coral permit signals.</div>
      </div>
      <div class="actions">
        <select id="radarDays" aria-label="Permit lookback">
          <option value="14">Last 14 days</option>
          <option value="30" selected>Last 30 days</option>
          <option value="60">Last 60 days</option>
        </select>
        <button type="button" class="primary" id="runRadarButton">Run Today's Lead Hunt</button>
      </div>
    </div>
    <div id="radarSummary" class="statusline">Ready to hunt live public records.</div>`;
  profiles.parentNode.insertBefore(card,profiles);
  document.getElementById('runRadarButton').addEventListener('click',()=>runLeadHunt(+document.getElementById('radarDays').value||30));
}

function loadCachedRadar(){
  const cached=localStorage.getItem('launchscape_radar_cache');
  if(!cached)return false;
  try{
    const data=JSON.parse(cached);
    if(!Array.isArray(data.results)||!data.results.length)return false;
    results=data.results;
    updateRadarSummary(data);
    return true;
  }catch{return false;}
}

installProspectRadar();
loadCachedRadar();
pingProspectSources();

setTimeout(()=>{
  const today=new Date().toISOString().slice(0,10);
  if(localStorage.getItem('launchscape_radar_date')!==today)runLeadHunt(30,{auto:true});
},500);

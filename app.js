const DATA_URL='https://gismapserver.leegov.com/gisserver910/rest/services/Layers/ParcelAddress/MapServer/0';
const STATUSES=['New Prospect','Research Needed','Ready to Contact','Contacted','Consultation Set','Estimate in Progress','Estimate Sent','Follow-Up','Won','Lost','Nurture'];
const SERVICE_TAGS=['Landscape design/install','Irrigation','Drainage','Outdoor lighting','Hardscape','Smart-home/lighting control','Outdoor audio/security','Marine/dock electrical','Paradise Care'];
let results=[];
let leads=JSON.parse(localStorage.getItem('launchscape_leads')||'[]');
let campaigns=JSON.parse(localStorage.getItem('launchscape_campaigns')||'[]');

document.querySelectorAll('#tabs button').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
function showTab(id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
  document.getElementById(id).classList.add('active');
  renderAll();
}
function save(){localStorage.setItem('launchscape_leads',JSON.stringify(leads));localStorage.setItem('launchscape_campaigns',JSON.stringify(campaigns));renderAll();}
function money(n){return n?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n):'—'}
function dateOnly(v){if(!v)return'';const d=new Date(v);return isNaN(d)?'':d.toISOString().slice(0,10)}
function yes(v){return String(v||'').toUpperCase()==='Y'}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random()}

async function pingSource(){
  try{
    const u=DATA_URL+'/query?where=1%3D0&returnCountOnly=true&f=json';
    const r=await fetch(u);
    if(!r.ok)throw new Error();
    const j=await r.json();
    document.getElementById('sourcePill').textContent='Lee County data: LIVE';
    document.getElementById('sourceStatus').innerHTML='<strong>Live / reachable.</strong> Public parcel queries are available.';
  }catch(e){
    document.getElementById('sourcePill').textContent='Lee County data: OFFLINE';
    document.getElementById('sourceStatus').innerHTML='<strong>Offline / unavailable.</strong> LaunchScape will not invent parcel results.';
  }
}

function scoreLead(a){
  let s=0, reasons=[];
  const add=(pts,why)=>{s+=pts;reasons.push(why)};
  if((a.JUST||0)>=900000)add(18,'$900k+ property value');
  else if((a.JUST||0)>=600000)add(12,'$600k+ property value');
  else if((a.JUST||0)>=450000)add(7,'$450k+ property value');
  if(yes(a.BOATDOCK)){add(16,'boat dock');}
  if(yes(a.SEAWALL)){add(14,'seawall');}
  if(yes(a.POOL)){add(10,'pool');}
  if((a.HEATEDAREA||0)>=2800)add(10,'large home');
  else if((a.HEATEDAREA||0)>=2000)add(6,'2,000+ heated sq ft');
  const yr=a.MAXBUILTY||a.MINBUILTY||0;
  if(yr && yr<2000)add(10,'older home with refresh potential');
  else if(yr && yr<2010)add(6,'mature home with upgrade potential');
  if(a.O_STATE && a.O_STATE!=='FL')add(12,'out-of-state owner');
  if(a.O_CITY && a.SITECITY && a.O_CITY.toUpperCase()!==a.SITECITY.toUpperCase())add(4,'mailing city differs from property');
  if(a.S_1DATE){
    const months=(Date.now()-a.S_1DATE)/(1000*60*60*24*30.44);
    if(months<=12)add(12,'purchased within the last year');
    else if(months<=24)add(7,'recent owner');
  }
  return {score:Math.min(100,s),reasons:[...new Set(reasons)]};
}

function buildWhere(){
  const q=["SITEADDR IS NOT NULL"];
  const city=document.getElementById('city').value.trim().replaceAll("'","''");
  const zip=document.getElementById('zip').value.trim().replaceAll("'","''");
  const minVal=+document.getElementById('minValue').value||0;
  const minArea=+document.getElementById('minArea').value||0;
  const y1=+document.getElementById('yearFrom').value||0;
  const y2=+document.getElementById('yearTo').value||0;
  const pool=document.getElementById('pool').value,dock=document.getElementById('dock').value,seawall=document.getElementById('seawall').value;
  if(city)q.push(`SITECITY='${city.toUpperCase()}'`);
  if(zip)q.push(`SITEZIP='${zip}'`);
  if(minVal)q.push(`JUST>=${minVal}`);
  if(minArea)q.push(`HEATEDAREA>=${minArea}`);
  if(y1)q.push(`MAXBUILTY>=${y1}`);
  if(y2)q.push(`MINBUILTY<=${y2}`);
  if(pool)q.push(`POOL='${pool}'`);
  if(dock)q.push(`BOATDOCK='${dock}'`);
  if(seawall)q.push(`SEAWALL='${seawall}'`);
  if(document.getElementById('outOfState').checked)q.push(`O_STATE<>'FL'`);
  const months=+document.getElementById('saleMonths').value||0;
  if(months){
    const d=new Date();d.setMonth(d.getMonth()-months);
    q.push(`S_1DATE>=DATE '${d.toISOString().slice(0,10)}'`);
  }
  return q.join(' AND ');
}

async function searchParcels(){
  const status=document.getElementById('searchStatus');
  status.textContent='Searching live Lee County parcel records…';
  try{
    const params=new URLSearchParams({
      where:buildWhere(),
      outFields:'STRAP,SITEADDR,SITECITY,SITEZIP,JUST,MINBUILTY,MAXBUILTY,HEATEDAREA,POOL,BOATDOCK,SEAWALL,O_NAME,O_ADDR1,O_ADDR2,O_CITY,O_STATE,O_ZIP,S_1DATE,S_1AMOUNT',
      returnGeometry:'false',f:'json',resultRecordCount:'250',orderByFields:'JUST DESC'
    });
    const r=await fetch(DATA_URL+'/query?'+params.toString());
    if(!r.ok)throw new Error('Parcel service returned '+r.status);
    const j=await r.json();
    if(j.error)throw new Error(j.error.message||'ArcGIS query error');
    results=(j.features||[]).map(x=>x.attributes);
    if(document.getElementById('absentee').checked){
      results=results.filter(a=>(a.O_STATE&&a.O_STATE!=='FL')||(a.O_CITY&&a.SITECITY&&a.O_CITY.toUpperCase()!==a.SITECITY.toUpperCase()));
    }
    results=results.map(a=>({...a,...scoreLead(a)})).sort((a,b)=>b.score-a.score);
    status.textContent=`${results.length} matching properties found. Showing live public parcel data.`;
    renderResults();
  }catch(e){
    results=[];
    status.textContent='Search could not reach Lee County data: '+e.message+'. No demo properties were substituted.';
    renderResults();
  }
}

function renderResults(){
  const el=document.getElementById('results');
  if(!results.length){el.innerHTML='<div class="card empty">Run a search to find prospects.</div>';return}
  el.innerHTML=results.map((a,i)=>`<div class="lead-card">
    <div class="score">${a.score}</div>
    <div><div class="lead-title">${esc(a.SITEADDR)}, ${esc(a.SITECITY)} ${esc(a.SITEZIP)}</div>
      <div class="muted">${esc(a.O_NAME||'Owner not listed')} · ${money(a.JUST)} · Built ${a.MAXBUILTY||a.MINBUILTY||'—'} · ${a.HEATEDAREA?Math.round(a.HEATEDAREA).toLocaleString():'—'} sf</div>
      <div class="chips">${a.reasons.slice(0,5).map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div></div>
    <div class="muted">Pool: ${yes(a.POOL)?'Yes':'No'} · Dock: ${yes(a.BOATDOCK)?'Yes':'No'} · Seawall: ${yes(a.SEAWALL)?'Yes':'No'}<br>Mail: ${esc([a.O_CITY,a.O_STATE].filter(Boolean).join(', ')||'—')} · Last sale: ${a.S_1DATE?new Date(a.S_1DATE).toLocaleDateString():'—'}</div>
    <div class="actions"><button class="mini" onclick="openResult(${i})">Details</button><button class="mini primary" onclick="saveProspect(${i})">Save Lead</button></div>
  </div>`).join('');
}
function resultToLead(a){
  return {id:uid(),strap:a.STRAP,siteAddress:a.SITEADDR,siteCity:a.SITECITY,siteZip:a.SITEZIP,ownerName:a.O_NAME,ownerAddress:[a.O_ADDR1,a.O_ADDR2].filter(Boolean).join(' '),ownerCity:a.O_CITY,ownerState:a.O_STATE,ownerZip:a.O_ZIP,justValue:a.JUST,yearBuilt:a.MAXBUILTY||a.MINBUILTY,heatedArea:a.HEATEDAREA,pool:yes(a.POOL),dock:yes(a.BOATDOCK),seawall:yes(a.SEAWALL),lastSaleDate:a.S_1DATE?dateOnly(a.S_1DATE):'',lastSaleAmount:a.S_1AMOUNT,score:a.score,reasons:a.reasons,status:'New Prospect',assignedTo:'Michael Schwartz',nextAction:'',estimatedValue:0,services:[],campaign:'',notes:'',phone:'',email:'',contactSource:'',contactConfidence:'',bestContactMethod:'Phone',doNotContact:false,lastVerified:'',activities:[{at:new Date().toISOString(),outcome:'Saved from Lead Finder'}],createdAt:new Date().toISOString()};
}
function saveProspect(i){
  const a=results[i];
  if(leads.some(l=>l.strap===a.STRAP)){alert('That property is already in the pipeline.');return}
  leads.push(resultToLead(a));save();alert('Saved to pipeline and assigned to Michael.');
}
function openResult(i){
  const a=results[i], d=document.getElementById('leadDialog'),b=document.getElementById('leadDialogBody');
  b.innerHTML=`<h2>${esc(a.SITEADDR)}</h2><p>${esc(a.O_NAME||'')}</p><p><strong>Score ${a.score}</strong> — ${a.reasons.map(esc).join(', ')}</p><p>Value: ${money(a.JUST)} · Heated area: ${a.HEATEDAREA||'—'} · Year: ${a.MAXBUILTY||a.MINBUILTY||'—'}</p><p>Mailing: ${esc([a.O_ADDR1,a.O_ADDR2,a.O_CITY,a.O_STATE,a.O_ZIP].filter(Boolean).join(', '))}</p>`;
  d.showModal();
}

function renderMetrics(){
  const won=leads.filter(l=>l.status==='Won'), now=new Date().toISOString().slice(0,10);
  const overdue=leads.filter(l=>l.nextAction&&l.nextAction<now&&!['Won','Lost'].includes(l.status));
  const vals=[
    ['Prospects',leads.length],['Hot 70+',leads.filter(l=>l.score>=70).length],['Ready to Contact',leads.filter(l=>l.status==='Ready to Contact').length],['Consultations',leads.filter(l=>l.status==='Consultation Set').length],['Pipeline',money(leads.filter(l=>!['Won','Lost'].includes(l.status)).reduce((s,l)=>s+(+l.estimatedValue||0),0))],['Overdue',overdue.length]
  ];
  document.getElementById('metrics').innerHTML=vals.map(([a,b])=>`<div class="metric"><div class="num">${b}</div><div class="lab">${a}</div></div>`).join('');
}
function renderDashboardLists(){
  const hot=[...leads].filter(l=>!['Won','Lost'].includes(l.status)).sort((a,b)=>b.score-a.score).slice(0,7);
  document.getElementById('hotLeads').innerHTML=hot.length?hot.map(l=>`<div class="card"><span class="hot">${l.score}</span> · ${esc(l.siteAddress)}<div class="muted">${esc(l.reasons.slice(0,3).join(' · '))}</div></div>`).join(''):'<div class="empty">No saved leads yet.</div>';
  const now=new Date().toISOString().slice(0,10),od=leads.filter(l=>l.nextAction&&l.nextAction<now&&!['Won','Lost'].includes(l.status)).sort((a,b)=>a.nextAction.localeCompare(b.nextAction));
  document.getElementById('overdue').innerHTML=od.length?od.map(l=>`<div class="card"><span class="overdue">${esc(l.nextAction)}</span> · ${esc(l.siteAddress)}<div class="muted">${esc(l.status)}</div></div>`).join(''):'<div class="empty">Nothing overdue.</div>';
}
function renderPipeline(){
  const el=document.getElementById('pipelineTable');
  if(!leads.length){el.innerHTML='<div class="card empty">Save a prospect from Lead Finder to start the pipeline.</div>';return}
  el.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Score</th><th>Property</th><th>Owner</th><th>Status</th><th>Next Action</th><th>Est. Value</th><th>Campaign</th><th></th></tr></thead><tbody>${leads.sort((a,b)=>b.score-a.score).map(l=>`<tr><td><strong>${l.score}</strong></td><td>${esc(l.siteAddress)}<div class="muted">${money(l.justValue)}</div></td><td>${esc(l.ownerName||'—')}</td><td><select onchange="patchLead('${l.id}','status',this.value)">${STATUSES.map(s=>`<option ${l.status===s?'selected':''}>${s}</option>`).join('')}</select></td><td><input type="date" value="${esc(l.nextAction||'')}" onchange="patchLead('${l.id}','nextAction',this.value)"></td><td><input class="inline-input" style="width:110px" type="number" value="${l.estimatedValue||''}" onchange="patchLead('${l.id}','estimatedValue',+this.value)"></td><td>${esc(l.campaign||'—')}</td><td><button class="mini" onclick="editLead('${l.id}')">Open</button></td></tr>`).join('')}</tbody></table></div>`;
}
function patchLead(id,k,v){const l=leads.find(x=>x.id===id);if(!l)return;l[k]=v;l.activities.unshift({at:new Date().toISOString(),outcome:`${k} updated`});save();}
function renderCallQueue(){
  const relevant=leads.filter(l=>['Ready to Contact','Contacted','Follow-Up','New Prospect'].includes(l.status)&&!l.doNotContact).sort((a,b)=>(a.nextAction||'9999').localeCompare(b.nextAction||'9999')||b.score-a.score);
  const el=document.getElementById('callQueue');
  if(!relevant.length){el.innerHTML='<div class="card empty">No leads in Michael’s call queue.</div>';return}
  el.innerHTML=relevant.map(l=>`<div class="queue-card"><div class="queue-head"><div><strong>${l.score} · ${esc(l.siteAddress)}</strong><div class="muted">${esc(l.ownerName||'Owner')} · ${esc(l.status)} · Next: ${esc(l.nextAction||'not set')}</div></div><button class="mini" onclick="editLead('${l.id}')">Contact Info</button></div><div class="queue-actions">${['No answer','Left voicemail','Spoke with owner','Not interested','Follow up later','Consultation set'].map(o=>`<button class="mini" onclick="callOutcome('${l.id}','${o}')">${o}</button>`).join('')}</div></div>`).join('');
}
function callOutcome(id,outcome){
  const l=leads.find(x=>x.id===id);if(!l)return;
  l.activities.unshift({at:new Date().toISOString(),outcome});
  if(outcome==='Consultation set')l.status='Consultation Set';
  else if(outcome==='Not interested')l.status='Nurture';
  else if(outcome==='Spoke with owner')l.status='Contacted';
  else if(outcome==='Follow up later')l.status='Follow-Up';
  else if(l.status==='New Prospect')l.status='Contacted';
  save();
}
function editLead(id){
  const l=leads.find(x=>x.id===id); if(!l)return;
  const d=document.getElementById('leadDialog'),b=document.getElementById('leadDialogBody');
  b.innerHTML=`<h2>${esc(l.siteAddress)}</h2><p class="muted">${esc(l.ownerName||'')} · Score ${l.score}</p>
  <div class="form-grid">
   <label>Phone<input class="inline-input" id="dlgPhone" value="${esc(l.phone)}"></label>
   <label>Email<input class="inline-input" id="dlgEmail" value="${esc(l.email)}"></label>
   <label>Contact Source<input class="inline-input" id="dlgSource" value="${esc(l.contactSource)}" placeholder="manual / vendor / owner"></label>
   <label>Confidence<select class="inline-input" id="dlgConfidence"><option></option>${['Verified','High','Medium','Low'].map(x=>`<option ${l.contactConfidence===x?'selected':''}>${x}</option>`).join('')}</select></label>
   <label>Best Method<select class="inline-input" id="dlgMethod">${['Phone','Email','Text'].map(x=>`<option ${l.bestContactMethod===x?'selected':''}>${x}</option>`).join('')}</select></label>
   <label>Last Verified<input class="inline-input" type="date" id="dlgVerified" value="${esc(l.lastVerified)}"></label>
   <label>Next Action<input class="inline-input" type="date" id="dlgNext" value="${esc(l.nextAction)}"></label>
   <label>Est. Opportunity<input class="inline-input" type="number" id="dlgValue" value="${l.estimatedValue||''}"></label>
  </div>
  <label>Notes<textarea class="inline-input" id="dlgNotes" rows="4">${esc(l.notes)}</textarea></label>
  <label style="display:block;margin:10px 0"><input type="checkbox" id="dlgDNC" ${l.doNotContact?'checked':''}> Do not contact</label>
  <div class="actions"><button type="button" class="primary" onclick="saveLeadDialog('${l.id}')">Save Lead</button></div>`;
  d.showModal();
}
function saveLeadDialog(id){
  const l=leads.find(x=>x.id===id);if(!l)return;
  Object.assign(l,{phone:dlgPhone.value,email:dlgEmail.value,contactSource:dlgSource.value,contactConfidence:dlgConfidence.value,bestContactMethod:dlgMethod.value,lastVerified:dlgVerified.value,nextAction:dlgNext.value,estimatedValue:+dlgValue.value||0,notes:dlgNotes.value,doNotContact:dlgDNC.checked});
  l.activities.unshift({at:new Date().toISOString(),outcome:'Lead details updated'});save();leadDialog.close();
}
function createCampaign(){
  const name=campaignName.value.trim();if(!name)return alert('Give the campaign a name.');
  if(campaigns.some(c=>c.name===name))return alert('That campaign already exists.');
  campaigns.push({id:uid(),name,notes:campaignNotes.value.trim(),createdAt:new Date().toISOString()});
  campaignName.value='';campaignNotes.value='';save();
}
function assignCampaign(id){
  const c=campaigns.find(x=>x.id===id);if(!c)return;
  const ids=prompt('Paste saved lead IDs separated by commas, or leave blank to assign all unassigned leads to this campaign.');
  let list=leads.filter(l=>!l.campaign);
  if(ids&&ids.trim()){const set=new Set(ids.split(',').map(x=>x.trim()));list=leads.filter(l=>set.has(l.id));}
  list.forEach(l=>{l.campaign=c.name;l.assignedTo='Michael Schwartz'});save();
}
function renderCampaigns(){
  const el=document.getElementById('campaignList');
  if(!campaigns.length){el.innerHTML='<div class="card empty">No campaigns yet.</div>';return}
  el.innerHTML=campaigns.map(c=>{const ls=leads.filter(l=>l.campaign===c.name),pv=ls.reduce((s,l)=>s+(+l.estimatedValue||0),0);return `<div class="card campaign-row"><div><strong>${esc(c.name)}</strong><div class="muted">${esc(c.notes||'')} · ${ls.length} leads · ${ls.filter(l=>l.status==='Consultation Set').length} consultations · ${ls.filter(l=>l.status==='Won').length} won · ${money(pv)} pipeline</div></div><button onclick="assignCampaign('${c.id}')">Assign Leads</button></div>`}).join('');
}
function exportCSV(){
  const cols=['score','siteAddress','siteCity','siteZip','ownerName','ownerCity','ownerState','justValue','yearBuilt','heatedArea','status','assignedTo','nextAction','estimatedValue','campaign','phone','email','contactSource','contactConfidence','doNotContact'];
  const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const csv=[cols.join(','),...leads.map(l=>cols.map(c=>q(l[c])).join(','))].join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='launchscape-leads.csv';a.click();URL.revokeObjectURL(a.href);
}
function applyProfile(p){
  resetFilters(false);
  if(p==='waterfront'){minValue.value=650000;dock.value='Y';seawall.value='Y';minArea.value=1800;saleMonths.value=36}
  if(p==='pool'){minValue.value=500000;pool.value='Y';minArea.value=1800;saleMonths.value=36}
  if(p==='newowner'){minValue.value=450000;saleMonths.value=12}
  if(p==='premium'){minValue.value=900000;minArea.value=2500;saleMonths.value=36}
  if(p==='older'){minValue.value=450000;yearTo.value=2005;saleMonths.value=0}
  if(p==='snowbird'){minValue.value=450000;outOfState.checked=true;saleMonths.value=0}
}
function resetFilters(clearCity=true){
  if(clearCity)city.value='CAPE CORAL';
  zip.value='';minValue.value=450000;minArea.value=1800;yearFrom.value='';yearTo.value='';saleMonths.value=24;pool.value='';dock.value='';seawall.value='';outOfState.checked=false;absentee.checked=false;
}
function renderAll(){renderMetrics();renderDashboardLists();renderPipeline();renderCallQueue();renderCampaigns();}
pingSource();renderResults();renderAll();

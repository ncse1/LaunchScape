// LaunchScape core workflow enhancements.
// Keeps the current GitHub Pages version useful while the shared-server build is completed.

let launchscapeCampaignLeadIds = [];

function normalizeLeadAddress(value){
  return String(value || '').toUpperCase().replace(/\b(STREET|ST)\b/g,'ST').replace(/\b(AVENUE|AVE)\b/g,'AVE').replace(/\b(ROAD|RD)\b/g,'RD').replace(/\b(DRIVE|DR)\b/g,'DR').replace(/\b(LANE|LN)\b/g,'LN').replace(/[^A-Z0-9]/g,'');
}

function saveResultBatch(limit){
  const list = results.slice(0, limit || results.length);
  let added = 0;
  for (const a of list){
    if (!a?.STRAP || leads.some(l => l.strap === a.STRAP)) continue;
    leads.push(resultToLead(a));
    added++;
  }
  save();
  const status = document.getElementById('searchStatus');
  if (status) status.textContent = added ? `${added} new prospects saved to the pipeline.` : 'Those prospects are already in the pipeline.';
}

function installBulkLeadActions(){
  const actions = document.querySelector('#finder .filter-actions');
  if (!actions || document.getElementById('saveTop25')) return;
  const top = document.createElement('button');
  top.id = 'saveTop25';
  top.type = 'button';
  top.textContent = 'Save Top 25';
  top.onclick = () => saveResultBatch(25);
  const all = document.createElement('button');
  all.id = 'saveAllResults';
  all.type = 'button';
  all.textContent = 'Save All Results';
  all.onclick = () => saveResultBatch();
  actions.append(top, all);
}

function parseCSV(text){
  const rows=[]; let row=[], cell='', quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i], next=text[i+1];
    if(ch==='"' && quoted && next==='"'){cell+='"';i++;continue;}
    if(ch==='"'){quoted=!quoted;continue;}
    if(ch===',' && !quoted){row.push(cell);cell='';continue;}
    if((ch==='\n'||ch==='\r') && !quoted){
      if(ch==='\r'&&next==='\n')i++;
      row.push(cell); if(row.some(x=>x.trim()!=='')) rows.push(row); row=[]; cell=''; continue;
    }
    cell+=ch;
  }
  row.push(cell); if(row.some(x=>x.trim()!=='')) rows.push(row);
  return rows;
}

function headerIndex(headers, names){
  const normalized=headers.map(h=>String(h).trim().toLowerCase().replace(/[^a-z0-9]/g,''));
  for(const name of names){
    const i=normalized.indexOf(name.replace(/[^a-z0-9]/g,''));
    if(i>=0)return i;
  }
  return -1;
}

async function importContactCSV(input){
  const file=input.files?.[0]; if(!file)return;
  const status=document.getElementById('contactImportStatus');
  try{
    const rows=parseCSV(await file.text());
    if(rows.length<2) throw new Error('The CSV has no data rows.');
    const h=rows[0];
    const ix={
      strap:headerIndex(h,['strap','parcel','parcelid']),
      address:headerIndex(h,['siteaddress','propertyaddress','address']),
      phone:headerIndex(h,['phone','phonenumber','mobile']),
      email:headerIndex(h,['email','emailaddress']),
      source:headerIndex(h,['contactsource','source']),
      confidence:headerIndex(h,['contactconfidence','confidence']),
      verified:headerIndex(h,['lastverified','verifieddate'])
    };
    if(ix.strap<0 && ix.address<0) throw new Error('Include a STRAP/parcel column or property address column.');
    let matched=0, updated=0, skipped=0;
    for(const r of rows.slice(1)){
      const strap=ix.strap>=0?String(r[ix.strap]||'').trim():'';
      const addr=ix.address>=0?normalizeLeadAddress(r[ix.address]):'';
      const lead=leads.find(l => (strap && l.strap===strap) || (addr && normalizeLeadAddress(l.siteAddress)===addr));
      if(!lead){skipped++;continue;}
      matched++;
      const phone=ix.phone>=0?String(r[ix.phone]||'').trim():'';
      const email=ix.email>=0?String(r[ix.email]||'').trim():'';
      if(phone)lead.phone=phone;
      if(email)lead.email=email;
      if(ix.source>=0 && r[ix.source])lead.contactSource=String(r[ix.source]).trim();
      if(ix.confidence>=0 && r[ix.confidence])lead.contactConfidence=String(r[ix.confidence]).trim();
      if(ix.verified>=0 && r[ix.verified])lead.lastVerified=dateOnly(r[ix.verified])||String(r[ix.verified]).trim();
      if(phone||email){
        if(lead.status==='New Prospect'||lead.status==='Research Needed')lead.status='Ready to Contact';
        lead.activities.unshift({at:new Date().toISOString(),outcome:'Verified contact information imported'});
        updated++;
      }
    }
    save();
    status.textContent=`${updated} leads updated with contact information. ${matched} matched; ${skipped} rows did not match a saved property.`;
  }catch(e){
    status.textContent=e.message||'The contact CSV could not be imported.';
  }finally{
    input.value='';
  }
}

function installContactImport(){
  const card=document.querySelector('#callqueue .contact-import');
  if(!card || document.getElementById('contactCsv'))return;
  card.insertAdjacentHTML('beforeend', `
    <div style="margin-top:12px">
      <label><strong>Import verified contacts (CSV)</strong>
        <input id="contactCsv" type="file" accept=".csv,text/csv" style="display:block;margin-top:8px">
      </label>
      <div class="muted" style="margin-top:6px">Match by STRAP/parcel or property address. Phone and email are imported only from your file; LaunchScape does not invent them.</div>
      <div id="contactImportStatus" class="statusline"></div>
    </div>`);
  document.getElementById('contactCsv').addEventListener('change',e=>importContactCSV(e.target));
}

function campaignSegmentLeads(value){
  const active=leads.filter(l=>!['Won','Lost'].includes(l.status)&&!l.doNotContact);
  if(value==='hot')return active.filter(l=>l.score>=70);
  if(value==='ready')return active.filter(l=>l.status==='Ready to Contact');
  if(value==='waterfront')return active.filter(l=>l.dock||l.seawall);
  if(value==='followup')return active.filter(l=>['Contacted','Follow-Up'].includes(l.status));
  return active;
}

function segmentSummary(list){
  if(!list.length)return 'No saved leads currently match this segment.';
  const cityCounts={}; const reasonCounts={};
  list.forEach(l=>{
    if(l.siteCity)cityCounts[l.siteCity]=(cityCounts[l.siteCity]||0)+1;
    (l.reasons||[]).forEach(r=>reasonCounts[r]=(reasonCounts[r]||0)+1);
  });
  const cities=Object.entries(cityCounts).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>`${k}: ${v}`).join(', ');
  const reasons=Object.entries(reasonCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`${k} (${v})`).join(', ');
  const avg=Math.round(list.reduce((s,l)=>s+(+l.score||0),0)/list.length);
  return `Use this real saved-lead segment as campaign context. Segment size: ${list.length}. Average lead score: ${avg}. Main cities: ${cities||'not available'}. Strongest lead reasons: ${reasons||'not available'}. Do not invent property conditions or contact information.`;
}

function installCampaignSegment(){
  const button=document.getElementById('aiBuildButton');
  if(!button || document.getElementById('aiLeadSegment'))return;
  const wrap=document.createElement('label');
  wrap.innerHTML='Saved lead segment<select id="aiLeadSegment"><option value="all">All active saved leads</option><option value="hot">Hot leads (70+)</option><option value="ready">Ready to Contact</option><option value="waterfront">Waterfront / dock / seawall</option><option value="followup">Contacted / follow-up</option></select>';
  button.parentNode.insertBefore(wrap,button);
}

const launchscapeOriginalGenerateAICampaign=generateAICampaign;
generateAICampaign=async function(){
  const select=document.getElementById('aiLeadSegment');
  const chosen=campaignSegmentLeads(select?.value||'all');
  launchscapeCampaignLeadIds=chosen.map(l=>l.id);
  const notes=document.getElementById('aiNotes');
  const original=notes.value;
  notes.value=[original,segmentSummary(chosen)].filter(Boolean).join('\n\n');
  try{return await launchscapeOriginalGenerateAICampaign();}
  finally{notes.value=original;}
};

const launchscapeOriginalSaveAIDraft=saveAIDraft;
saveAIDraft=function(){
  const campaignName=currentAICampaign?.name;
  launchscapeOriginalSaveAIDraft();
  if(campaignName && launchscapeCampaignLeadIds.length){
    const ids=new Set(launchscapeCampaignLeadIds);
    leads.forEach(l=>{if(ids.has(l.id))l.campaign=campaignName;});
    save();
    const status=document.getElementById('aiStatus');
    if(status)status.textContent+=` Assigned ${launchscapeCampaignLeadIds.length} saved leads to this campaign.`;
  }
};

function installWorkflowBanner(){
  const dashboard=document.getElementById('dashboard');
  if(!dashboard || document.getElementById('workflowMode'))return;
  const banner=document.createElement('div');
  banner.id='workflowMode';
  banner.className='card';
  banner.style.marginBottom='16px';
  banner.innerHTML='<strong>Core workflow:</strong> Find prospects → save to pipeline → import verified contacts → work the call queue → build a campaign from the saved lead segment. <span class="muted">This GitHub Pages copy still stores data in this browser; use Export CSV as a backup until the shared-server version is active.</span>';
  dashboard.insertBefore(banner,dashboard.children[1]||null);
}

installBulkLeadActions();
installContactImport();
installCampaignSegment();
installWorkflowBanner();
renderAll();

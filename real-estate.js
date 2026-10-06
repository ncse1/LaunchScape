// Jack Schwartz / RE/MAX Sunshine real-estate prospecting radar.
// Keeps real-estate leads separate from Outside Company leads.

let reResults=[];
let reLeads=JSON.parse(localStorage.getItem('launchscape_real_estate_leads')||'[]');

function reSave(){
  localStorage.setItem('launchscape_real_estate_leads',JSON.stringify(reLeads));
  renderRealEstatePipeline();
}

function reUid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random();}

function reMoney(n){
  return n?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n):'—';
}

function reDate(v){
  if(!v)return'';
  const d=new Date(v);
  return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);
}

function reNormalizeAddress(v){
  return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
}

async function runRealEstateRadar(profile){
  const status=document.getElementById('reStatus');
  const button=document.getElementById('reHuntButton');
  if(button)button.disabled=true;
  status.textContent='Hunting Lee County public records for listing opportunities…';
  try{
    const data=await prospectPost({
      mode:'real-estate-radar',
      filters:{
        city:document.getElementById('reCity').value||'CAPE CORAL',
        zip:document.getElementById('reZip').value||'',
        minValue:+document.getElementById('reMinValue').value||350000,
        minYears:+document.getElementById('reMinYears').value||7,
        profile:profile||document.getElementById('reProfile').value||'seller'
      }
    });
    reResults=Array.isArray(data.results)?data.results:[];
    renderRealEstateResults();
    const hot=reResults.filter(x=>(+x.score||0)>=70).length;
    document.getElementById('reSummary').innerHTML='<strong>'+reResults.length+' seller prospects found</strong> · '+hot+' high-priority 70+<div class="muted">Public-record signals only. No MLS status, mortgage balance, household makeup, age, race, religion, disability, or other protected traits are inferred.</div>';
    status.textContent='Seller radar complete. Highest-scoring opportunities are first.';
  }catch(e){
    reResults=[];
    renderRealEstateResults();
    status.textContent='Real-estate radar failed: '+(e.message||'lead service unavailable')+'.';
  }finally{
    if(button)button.disabled=false;
  }
}

function renderRealEstateResults(){
  const el=document.getElementById('reResults');
  if(!el)return;
  if(!reResults.length){
    el.innerHTML='<div class="card empty">Run the seller radar to find listing opportunities.</div>';
    return;
  }
  el.innerHTML=reResults.map((a,i)=>`<div class="lead-card">
    <div class="score">${a.score||0}</div>
    <div>
      <div class="muted" style="font-weight:800;letter-spacing:.05em">SELLER PROSPECT</div>
      <div class="lead-title">${esc(a.SITEADDR||'Address unavailable')}, ${esc(a.SITECITY||'')} ${esc(a.SITEZIP||'')}</div>
      <div class="muted">${esc(a.O_NAME||'Owner not listed')} · ${reMoney(a.JUST)} · Last public sale ${a.S_1DATE?new Date(a.S_1DATE).toLocaleDateString():'—'}</div>
      <div class="chips">${(a.reasons||[]).slice(0,6).map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div>
    </div>
    <div class="muted">
      ${esc(a._signal||'Seller prospect')}<br>
      Held: ${a._yearsHeld?Number(a._yearsHeld).toFixed(1)+' yrs':'—'} · Waterfront: ${yes(a.BOATDOCK)||yes(a.SEAWALL)?'Yes':'No'}<br>
      Mail: ${esc([a.O_CITY,a.O_STATE].filter(Boolean).join(', ')||'—')}
    </div>
    <div class="actions"><button class="mini" onclick="openRealEstateResult(${i})">Details</button><button class="mini primary" onclick="saveRealEstateLead(${i})">Save to Jack's Pipeline</button></div>
  </div>`).join('');
}

function openRealEstateResult(i){
  const a=reResults[i];
  if(!a)return;
  const d=document.getElementById('leadDialog'),b=document.getElementById('leadDialogBody');
  b.innerHTML=`<h2>${esc(a.SITEADDR||'Property')}</h2>
    <p class="muted">${esc(a.O_NAME||'Owner not listed')} · Seller score ${a.score||0}</p>
    <p><strong>Public-record signal:</strong> ${esc(a._signal||'Seller prospect')}</p>
    <p>Estimated county value: ${reMoney(a.JUST)} · Held: ${a._yearsHeld?Number(a._yearsHeld).toFixed(1)+' years':'—'} · Last public sale: ${a.S_1DATE?new Date(a.S_1DATE).toLocaleDateString():'—'}</p>
    <p>Mailing: ${esc([a.O_ADDR1,a.O_ADDR2,a.O_CITY,a.O_STATE,a.O_ZIP].filter(Boolean).join(', ')||'—')}</p>
    <p><strong>Why it scored:</strong> ${(a.reasons||[]).map(esc).join(', ')}</p>
    <p class="muted">This is a prospecting signal, not a claim that the owner intends to sell.</p>`;
  d.showModal();
}

function saveRealEstateLead(i){
  const a=reResults[i];
  if(!a)return;
  const key=a.STRAP||reNormalizeAddress(a.SITEADDR);
  if(reLeads.some(l=>l.key===key)){
    alert('That property is already in Jack\'s real-estate pipeline.');
    return;
  }
  reLeads.push({
    id:reUid(),
    key,
    strap:a.STRAP||'',
    siteAddress:a.SITEADDR||'',
    siteCity:a.SITECITY||'',
    siteZip:a.SITEZIP||'',
    ownerName:a.O_NAME||'',
    ownerCity:a.O_CITY||'',
    ownerState:a.O_STATE||'',
    ownerZip:a.O_ZIP||'',
    mailingAddress:[a.O_ADDR1,a.O_ADDR2].filter(Boolean).join(' '),
    countyValue:+a.JUST||0,
    lastSaleDate:reDate(a.S_1DATE),
    yearsHeld:+a._yearsHeld||0,
    score:+a.score||0,
    reasons:a.reasons||[],
    signal:a._signal||'Seller prospect',
    status:'New Seller Prospect',
    nextAction:'',
    phone:'',
    email:'',
    notes:'',
    source:'Lee County Property',
    createdAt:new Date().toISOString()
  });
  reSave();
  alert('Saved to Jack\'s real-estate pipeline.');
}

function rePatch(id,key,value){
  const lead=reLeads.find(x=>x.id===id);
  if(!lead)return;
  lead[key]=value;
  reSave();
}

function renderRealEstatePipeline(){
  const el=document.getElementById('rePipeline');
  if(!el)return;
  if(!reLeads.length){
    el.innerHTML='<div class="card empty">No real-estate leads saved yet.</div>';
    return;
  }
  const statuses=['New Seller Prospect','Research Needed','Ready to Contact','Contacted','Listing Appointment','Listing Agreement','Nurture','Won','Lost'];
  el.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Score</th><th>Property</th><th>Owner</th><th>Signal</th><th>Status</th><th>Next Action</th><th>Contact</th></tr></thead><tbody>${
    [...reLeads].sort((a,b)=>b.score-a.score).map(l=>`<tr>
      <td><strong>${l.score}</strong></td>
      <td>${esc(l.siteAddress)}<div class="muted">${reMoney(l.countyValue)}</div></td>
      <td>${esc(l.ownerName||'—')}<div class="muted">${esc([l.ownerCity,l.ownerState].filter(Boolean).join(', '))}</div></td>
      <td>${esc(l.signal||'—')}</td>
      <td><select onchange="rePatch('${l.id}','status',this.value)">${statuses.map(s=>`<option ${l.status===s?'selected':''}>${s}</option>`).join('')}</select></td>
      <td><input type="date" value="${esc(l.nextAction||'')}" onchange="rePatch('${l.id}','nextAction',this.value)"></td>
      <td><button class="mini" onclick="editRealEstateLead('${l.id}')">${l.phone||l.email?'Open':'Add contact'}</button></td>
    </tr>`).join('')
  }</tbody></table></div>`;
}

function editRealEstateLead(id){
  const l=reLeads.find(x=>x.id===id);
  if(!l)return;
  const d=document.getElementById('leadDialog'),b=document.getElementById('leadDialogBody');
  b.innerHTML=`<h2>${esc(l.siteAddress)}</h2><p class="muted">${esc(l.ownerName||'')} · Score ${l.score}</p>
    <div class="form-grid">
      <label>Phone<input id="reDlgPhone" value="${esc(l.phone||'')}"></label>
      <label>Email<input id="reDlgEmail" value="${esc(l.email||'')}"></label>
      <label>Next Action<input id="reDlgNext" type="date" value="${esc(l.nextAction||'')}"></label>
      <label>Status<input value="${esc(l.status)}" disabled></label>
    </div>
    <label>Notes<textarea id="reDlgNotes" rows="4">${esc(l.notes||'')}</textarea></label>
    <div class="actions"><button type="button" class="primary" onclick="saveRealEstateLeadDialog('${l.id}')">Save</button></div>`;
  d.showModal();
}

function saveRealEstateLeadDialog(id){
  const l=reLeads.find(x=>x.id===id);
  if(!l)return;
  l.phone=document.getElementById('reDlgPhone').value.trim();
  l.email=document.getElementById('reDlgEmail').value.trim();
  l.nextAction=document.getElementById('reDlgNext').value;
  l.notes=document.getElementById('reDlgNotes').value.trim();
  reSave();
  document.getElementById('leadDialog').close();
}

function reParseCSV(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i],n=text[i+1];
    if(ch==='"'&&quoted&&n==='"'){cell+='"';i++;continue;}
    if(ch==='"'){quoted=!quoted;continue;}
    if(ch===','&&!quoted){row.push(cell);cell='';continue;}
    if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&n==='\n')i++;
      row.push(cell);if(row.some(x=>x.trim()!==''))rows.push(row);row=[];cell='';continue;
    }
    cell+=ch;
  }
  row.push(cell);if(row.some(x=>x.trim()!==''))rows.push(row);
  return rows;
}

function reHeader(headers,names){
  const norm=headers.map(h=>String(h).toLowerCase().replace(/[^a-z0-9]/g,''));
  for(const name of names){
    const i=norm.indexOf(name.replace(/[^a-z0-9]/g,''));
    if(i>=0)return i;
  }
  return -1;
}

async function importListingCSV(input){
  const file=input.files?.[0];if(!file)return;
  const status=document.getElementById('reImportStatus');
  try{
    const rows=reParseCSV(await file.text());
    if(rows.length<2)throw new Error('The CSV has no listing rows.');
    const h=rows[0];
    const ix={
      address:reHeader(h,['address','propertyaddress','siteaddress']),
      city:reHeader(h,['city']),
      zip:reHeader(h,['zip','zipcode']),
      status:reHeader(h,['status','listingstatus']),
      dom:reHeader(h,['dom','daysonmarket','cdom']),
      price:reHeader(h,['listprice','price','currentprice']),
      owner:reHeader(h,['owner','ownername','name']),
      phone:reHeader(h,['phone','phonenumber']),
      email:reHeader(h,['email','emailaddress'])
    };
    if(ix.address<0)throw new Error('Include a property address column.');
    let added=0;
    for(const r of rows.slice(1)){
      const address=String(r[ix.address]||'').trim();
      if(!address)continue;
      const listingStatus=ix.status>=0?String(r[ix.status]||'').trim():'';
      const dom=ix.dom>=0?Number(String(r[ix.dom]||'').replace(/[^0-9.]/g,''))||0:0;
      const price=ix.price>=0?Number(String(r[ix.price]||'').replace(/[^0-9.]/g,''))||0:0;
      let score=40;const reasons=[];
      if(/expired|withdrawn|canceled|cancelled/i.test(listingStatus)){score+=30;reasons.push(listingStatus+' listing');}
      if(dom>=120){score+=22;reasons.push('120+ days on market');}
      else if(dom>=90){score+=16;reasons.push('90+ days on market');}
      else if(dom>=60){score+=8;reasons.push('60+ days on market');}
      if(price>=900000){score+=10;reasons.push('$900k+ list price');}
      else if(price>=600000){score+=6;reasons.push('$600k+ list price');}
      const key='MLS-'+reNormalizeAddress(address);
      if(reLeads.some(l=>l.key===key))continue;
      reLeads.push({
        id:reUid(),key,strap:'',siteAddress:address,siteCity:ix.city>=0?String(r[ix.city]||'').trim():'',siteZip:ix.zip>=0?String(r[ix.zip]||'').trim():'',
        ownerName:ix.owner>=0?String(r[ix.owner]||'').trim():'',ownerCity:'',ownerState:'',ownerZip:'',mailingAddress:'',
        countyValue:price,lastSaleDate:'',yearsHeld:0,score:Math.min(100,score),reasons,signal:[listingStatus,dom?dom+' DOM':''].filter(Boolean).join(' · ')||'MLS/listing export',
        status:'New Seller Prospect',nextAction:'',phone:ix.phone>=0?String(r[ix.phone]||'').trim():'',email:ix.email>=0?String(r[ix.email]||'').trim():'',
        notes:'Imported from listing activity CSV.',source:'Listing/MLS CSV',createdAt:new Date().toISOString()
      });
      added++;
    }
    reSave();
    status.textContent=added+' listing opportunities imported into Jack\'s pipeline.';
  }catch(e){
    status.textContent=e.message||'The listing CSV could not be imported.';
  }finally{
    input.value='';
  }
}

function installRealEstateHandlers(){
  const hunt=document.getElementById('reHuntButton');
  if(hunt)hunt.addEventListener('click',()=>runRealEstateRadar(document.getElementById('reProfile').value));
  const input=document.getElementById('reListingCsv');
  if(input)input.addEventListener('change',e=>importListingCSV(e.target));
  document.querySelectorAll('[data-re-profile]').forEach(btn=>btn.addEventListener('click',()=>{
    document.getElementById('reProfile').value=btn.dataset.reProfile;
    runRealEstateRadar(btn.dataset.reProfile);
  }));
}

installRealEstateHandlers();
renderRealEstatePipeline();
renderRealEstateResults();

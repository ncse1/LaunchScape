const PARCEL_URL='https://gismapserver.leegov.com/gisserver910/rest/services/Layers/ParcelAddress/MapServer/0';
const CAPE_PERMIT_URL='https://capeims.capecoral.gov/arcgis/rest/services/AGOL/Building_Permits_Map/MapServer/1';

const ALLOWED_ORIGINS=[
  'https://ncse1.github.io',
  'https://launchscape-liart.vercel.app',
  'https://launchscape-jack-1968.vercel.app',
  'https://launchscape-git-main-jack-1968.vercel.app',
  'https://launchscape-campaign-builder-jack.jackschwa.chatgpt.site'
];

const clean=(v,n=200)=>String(v??'').trim().slice(0,n);
const num=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>{
  const n=Number(v);
  return Number.isFinite(n)?Math.min(max,Math.max(min,n)):0;
};
const yes=v=>String(v??'').trim().toUpperCase()==='Y';
const asDate=v=>{
  if(!v)return '';
  const d=new Date(v);
  return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);
};
const dateLiteral=d=>d.toISOString().slice(0,10);
const monthsAgo=m=>{const d=new Date();d.setMonth(d.getMonth()-m);return d;};
const daysAgo=d=>new Date(Date.now()-d*86400000);

function allowOrigin(origin){
  if(!origin)return true;
  if(ALLOWED_ORIGINS.includes(origin))return true;
  try{
    const u=new URL(origin);
    return u.protocol==='https:' && u.hostname.endsWith('.vercel.app') && u.hostname.includes('launchscape');
  }catch{return false;}
}

function cors(req,res){
  const origin=req.headers?.origin;
  if(origin&&!allowOrigin(origin))return false;
  if(origin){
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
  }
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  return true;
}

async function fetchArcgis(base,params,{countOnly=false}={}){
  const url=new URL(base+'/query');
  for(const [k,v] of Object.entries(params)){
    if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,String(v));
  }
  url.searchParams.set('f','json');
  const r=await fetch(url,{signal:AbortSignal.timeout(22000),headers:{'Accept':'application/json'}});
  if(!r.ok)throw new Error('Public data source returned '+r.status);
  const j=await r.json();
  if(j?.error)throw new Error(j.error.message||'Public data source query failed');
  if(countOnly)return Number(j.count||0);
  return (j.features||[]).map(x=>x.attributes||{});
}

function scoreParcel(a){
  let score=0; const reasons=[];
  const add=(pts,reason)=>{score+=pts;reasons.push(reason);};
  const value=Number(a.JUST||0);
  if(value>=900000)add(18,'$900k+ property value');
  else if(value>=600000)add(12,'$600k+ property value');
  else if(value>=450000)add(7,'$450k+ property value');
  if(yes(a.BOATDOCK))add(16,'boat dock');
  if(yes(a.SEAWALL))add(14,'seawall');
  if(yes(a.POOL))add(10,'pool');
  const area=Number(a.HEATEDAREA||0);
  if(area>=2800)add(10,'large home');
  else if(area>=2000)add(6,'2,000+ heated sq ft');
  const yr=Number(a.MAXBUILTY||a.MINBUILTY||0);
  if(yr&&yr<2000)add(10,'older home with refresh potential');
  else if(yr&&yr<2010)add(6,'mature home with upgrade potential');
  if(a.O_STATE&&String(a.O_STATE).toUpperCase()!=='FL')add(12,'out-of-state owner');
  if(a.O_CITY&&a.SITECITY&&String(a.O_CITY).toUpperCase()!==String(a.SITECITY).toUpperCase())add(4,'mailing city differs from property');
  if(a.S_1DATE){
    const months=(Date.now()-new Date(a.S_1DATE).getTime())/(1000*60*60*24*30.44);
    if(months<=12)add(12,'purchased within the last year');
    else if(months<=24)add(7,'recent owner');
  }
  return {score:Math.min(100,score),reasons:[...new Set(reasons)]};
}

function parcelResult(a,signal,bonus=0){
  const base=scoreParcel(a);
  const reasons=[...base.reasons];
  if(signal&&!reasons.includes(signal))reasons.unshift(signal);
  return {
    ...a,
    score:Math.min(100,base.score+bonus),
    reasons:[...new Set(reasons)],
    _source:'Lee County Property',
    _signal:signal||'Property match',
    _services:[],
    _kind:'parcel'
  };
}

function permitAddress(a){
  return clean(
    a.Site_Address ||
    [a.MAIN_SITE_ADDR1,a.MAIN_SITE_ADDR2,a.MAIN_SITE_ADDR3,a.MAIN_SITE_UNITSUITE].filter(Boolean).join(' ') ||
    a.SITE_ADDRESS ||
    '',250
  );
}

function permitSignal(a){
  const text=[
    a.DESCRIPTION,a.TypeOfWork,a.FRIENDLYNAME,a.Friendly_Name,a.Permit_Type,a.Work_Class
  ].filter(Boolean).join(' ').toUpperCase();
  const hits=[]; const services=[];
  const add=(rx,label,service,points)=>{if(rx.test(text)){hits.push({label,points});if(service)services.push(service);}};
  add(/BOAT\s*LIFT|BOATLIFT|DOCK|SEAWALL|MARINE/,'marine / dock project','Marine/dock electrical',26);
  add(/POOL|SPA/,'pool project','Outdoor lighting',22);
  add(/PAVER|HARDSCAPE|DRIVEWAY|PATIO|WALKWAY/,'paver / hardscape project','Hardscape',24);
  add(/IRRIGATION|SPRINKLER/,'irrigation project','Irrigation',24);
  add(/DRAIN|SWALE|STORMWATER/,'drainage project','Drainage',24);
  add(/LANDSCAP|TREE|PALM/,'landscape project','Landscape design/install',24);
  add(/OUTDOOR\s*KITCHEN|PERGOLA|GAZEBO|DECK/,'outdoor living project','Landscape design/install',20);
  add(/SCREEN|LANAI|CAGE/,'screen / lanai project','Outdoor lighting',14);
  add(/NEW\s*(SINGLE|RESIDENTIAL)|SINGLE\s*FAMILY|NEW\s*HOME|NEW\s*CONSTRUCTION/,'new-home project','Landscape design/install',18);
  add(/ADDITION|REMODEL|RENOVAT/,'remodel / addition','Outdoor lighting',14);
  return {text,hits,services:[...new Set(services)]};
}

function permitResult(a){
  const sig=permitSignal(a);
  if(!sig.hits.length)return null;
  let score=34;
  const reasons=sig.hits.sort((x,y)=>y.points-x.points).map(x=>x.label);
  score+=Math.min(36,sig.hits.reduce((s,x)=>s+x.points,0));
  const permitValue=Number(a.Permit_Value??a.permitvalue??0);
  if(permitValue>=100000){score+=10;reasons.push('$100k+ permit value');}
  else if(permitValue>=25000){score+=6;reasons.push('$25k+ permit value');}
  const owner=clean(a.OWNER_NAME||a.Owner_Name||'',180);
  if(owner){score+=4;reasons.push('owner identified');}
  const permitNumber=clean(a.PERMITNUMBER||a.Permit_Number||a.PMPERMITID||'',80);
  const address=permitAddress(a);
  return {
    STRAP:clean(a.Strap||a.STRAP||a.Parcel||('PERMIT-'+permitNumber),80),
    SITEADDR:address||'Cape Coral permit',
    SITECITY:clean(a.MAIN_SITE_City||a.City||'CAPE CORAL',80),
    SITEZIP:clean(a.MAIN_SITE_Zip||a.Zip||'',20),
    O_NAME:owner,
    O_CITY:'',
    O_STATE:'',
    O_ZIP:'',
    JUST:0,
    MINBUILTY:0,
    MAXBUILTY:0,
    HEATEDAREA:0,
    POOL:'',
    BOATDOCK:'',
    SEAWALL:'',
    S_1DATE:'',
    S_1AMOUNT:0,
    score:Math.min(98,score),
    reasons:[...new Set(reasons)],
    _source:'Cape Coral Permit',
    _signal:clean(a.FRIENDLYNAME||a.Friendly_Name||a.DESCRIPTION||a.TypeOfWork||a.Permit_Type||'Active permit',220),
    _permitNumber:permitNumber,
    _permitStatus:clean(a.STATUS||a.permit_status||'',80),
    _permitDate:asDate(a.APPLYDATE||a.applydate||a.ISSUEDATE||a.issuedate),
    _permitValue:permitValue,
    _contractor:clean(a.contractor||a.Contractor||a.company_name||a.Company_Name||'',180),
    _services:sig.services,
    _kind:'permit'
  };
}

function parcelWhere(filters={}){
  const q=['SITEADDR IS NOT NULL'];
  const city=clean(filters.city||'CAPE CORAL',80).replaceAll("'","''").toUpperCase();
  const zip=clean(filters.zip,12).replaceAll("'","''");
  const minValue=num(filters.minValue,0,100000000);
  const minArea=num(filters.minArea,0,100000);
  const yearFrom=num(filters.yearFrom,0,2200);
  const yearTo=num(filters.yearTo,0,2200);
  const saleMonths=num(filters.saleMonths,0,120);
  if(city)q.push(`SITECITY='${city}'`);
  if(zip)q.push(`SITEZIP='${zip}'`);
  if(minValue)q.push(`JUST>=${Math.round(minValue)}`);
  if(minArea)q.push(`HEATEDAREA>=${Math.round(minArea)}`);
  if(yearFrom)q.push(`MAXBUILTY>=${Math.round(yearFrom)}`);
  if(yearTo)q.push(`MINBUILTY<=${Math.round(yearTo)}`);
  for(const [field,key] of [['POOL','pool'],['BOATDOCK','dock'],['SEAWALL','seawall']]){
    const v=clean(filters[key],1).toUpperCase();
    if(v==='Y'||v==='N')q.push(`${field}='${v}'`);
  }
  if(filters.outOfState)q.push(`O_STATE<>'FL'`);
  if(saleMonths)q.push(`S_1DATE>=DATE '${dateLiteral(monthsAgo(saleMonths))}'`);
  return q.join(' AND ');
}

const PARCEL_FIELDS='STRAP,SITEADDR,SITECITY,SITEZIP,JUST,MINBUILTY,MAXBUILTY,HEATEDAREA,POOL,BOATDOCK,SEAWALL,O_NAME,O_ADDR1,O_ADDR2,O_CITY,O_STATE,O_ZIP,S_1DATE,S_1AMOUNT';

async function parcelSearch(filters={}){
  const attrs=await fetchArcgis(PARCEL_URL,{
    where:parcelWhere(filters),
    outFields:PARCEL_FIELDS,
    returnGeometry:'false',
    resultRecordCount:250,
    orderByFields:'JUST DESC'
  });
  let list=attrs.map(a=>parcelResult(a,'Manual property search',0));
  if(filters.absentee){
    list=list.filter(a=>(a.O_STATE&&String(a.O_STATE).toUpperCase()!=='FL')||(a.O_CITY&&a.SITECITY&&String(a.O_CITY).toUpperCase()!==String(a.SITECITY).toUpperCase()));
  }
  return list.sort((a,b)=>b.score-a.score);
}

async function radar(days=30){
  const permitDays=Math.max(7,Math.min(90,Number(days)||30));
  const recentWhere=`SITEADDR IS NOT NULL AND SITECITY='CAPE CORAL' AND JUST>=450000 AND S_1DATE>=DATE '${dateLiteral(monthsAgo(18))}'`;
  const waterfrontWhere=`SITEADDR IS NOT NULL AND SITECITY='CAPE CORAL' AND JUST>=650000 AND (BOATDOCK='Y' OR SEAWALL='Y')`;
  const permitWhere=`APPLYDATE>=DATE '${dateLiteral(daysAgo(permitDays))}'`;

  const jobs=[
    fetchArcgis(PARCEL_URL,{where:recentWhere,outFields:PARCEL_FIELDS,returnGeometry:'false',resultRecordCount:175,orderByFields:'S_1DATE DESC'}),
    fetchArcgis(PARCEL_URL,{where:waterfrontWhere,outFields:PARCEL_FIELDS,returnGeometry:'false',resultRecordCount:175,orderByFields:'JUST DESC'}),
    fetchArcgis(CAPE_PERMIT_URL,{where:permitWhere,outFields:'*',returnGeometry:'false',resultRecordCount:500,orderByFields:'APPLYDATE DESC'})
  ];
  const settled=await Promise.allSettled(jobs);
  const sourceStatus={
    recentSales:settled[0].status==='fulfilled'?'live':settled[0].reason?.message||'unavailable',
    waterfront:settled[1].status==='fulfilled'?'live':settled[1].reason?.message||'unavailable',
    permits:settled[2].status==='fulfilled'?'live':settled[2].reason?.message||'unavailable'
  };

  const merged=new Map();
  const upsertParcel=(item)=>{
    const key='parcel:'+clean(item.STRAP||item.SITEADDR,120).toUpperCase();
    const prior=merged.get(key);
    if(!prior){merged.set(key,item);return;}
    prior.score=Math.min(100,Math.max(prior.score,item.score)+6);
    prior.reasons=[...new Set([...(prior.reasons||[]),...(item.reasons||[]),'multiple lead signals'])];
    prior._signal=[prior._signal,item._signal].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' + ');
  };

  if(settled[0].status==='fulfilled'){
    settled[0].value.forEach(a=>upsertParcel(parcelResult(a,'Recent property purchase',12)));
  }
  if(settled[1].status==='fulfilled'){
    settled[1].value.forEach(a=>upsertParcel(parcelResult(a,'Waterfront upgrade opportunity',10)));
  }
  if(settled[2].status==='fulfilled'){
    for(const a of settled[2].value){
      const item=permitResult(a);
      if(!item)continue;
      const key='permit:'+clean(item.STRAP||item.SITEADDR||item._permitNumber,140).toUpperCase();
      if(!merged.has(key))merged.set(key,item);
    }
  }

  return {
    results:[...merged.values()].sort((a,b)=>b.score-a.score).slice(0,150),
    sourceStatus,
    generatedAt:new Date().toISOString(),
    permitDays
  };
}

async function health(){
  const settled=await Promise.allSettled([
    fetchArcgis(PARCEL_URL,{where:'1=0',returnCountOnly:'true'},{countOnly:true}),
    fetchArcgis(CAPE_PERMIT_URL,{where:'1=0',returnCountOnly:'true'},{countOnly:true})
  ]);
  return {
    parcel: settled[0].status==='fulfilled'?'live':settled[0].reason?.message||'unavailable',
    permits: settled[1].status==='fulfilled'?'live':settled[1].reason?.message||'unavailable'
  };
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!cors(req,res))return res.status(403).json({error:'This website is not allowed.'});
  if(req.method==='OPTIONS')return res.status(204).end();

  if(req.method==='GET'){
    const mode=clean(req.query?.mode||'health',30);
    if(mode!=='health')return res.status(405).json({error:'Use POST for lead searches.'});
    try{return res.status(200).json({status:await health()});}
    catch(e){return res.status(502).json({error:e.message||'Could not check public data sources.'});}
  }

  if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
  let body=req.body;
  try{if(typeof body==='string')body=JSON.parse(body);}catch{return res.status(400).json({error:'Invalid request.'});}
  if(!body||typeof body!=='object'||Array.isArray(body))body={};

  const mode=clean(body.mode||'radar',40);
  try{
    if(mode==='parcel-search'){
      const results=await parcelSearch(body.filters||{});
      return res.status(200).json({results,sourceStatus:{parcels:'live'},generatedAt:new Date().toISOString()});
    }
    if(mode==='radar'){
      return res.status(200).json(await radar(body.days));
    }
    return res.status(400).json({error:'Unknown lead-search mode.'});
  }catch(e){
    return res.status(502).json({error:e.message||'Public lead data could not be loaded.'});
  }
}

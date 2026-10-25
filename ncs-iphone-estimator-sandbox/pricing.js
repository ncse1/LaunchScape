/* Shared deterministic engine: no AI estimates or external requests. */
(function(root){
'use strict';
const valid=x=>x!==''&&x!==null&&x!==undefined&&Number.isFinite(Number(x))&&Number(x)>=0;
const cents=x=>Math.round((x+Number.EPSILON)*100)/100;
function linePrice(row,rates){return cents(Number(row.qty)*cents(Number(row.material)*(1+Number(rates.markup)/100)+Number(row.hours)*Number(rates.crewSell)))}
function calculate(rows,rates){
 const ratesOK=rates&&['crewSell','crewCost','markup','overhead'].every(k=>valid(rates[k]))&&Number(rates.overhead)<=100&&Number(rates.crewSell)>0;
 const complete=Boolean(ratesOK&&rows.length&&rows.every(r=>String(r.label||'').trim()&&valid(r.qty)&&Number(r.qty)>0&&valid(r.material)&&valid(r.hours)));
 if(!complete)return {complete:false,sum:0,cost:0,profit:0,margin:0,overhead:0,afterOverhead:0};
 const sum=cents(rows.reduce((v,r)=>v+linePrice(r,rates),0));
 const cost=cents(rows.reduce((v,r)=>v+Number(r.qty)*(Number(r.material)+Number(r.hours)*Number(rates.crewCost)),0));
 const profit=cents(sum-cost),overhead=cents(sum*Number(rates.overhead)/100);
 return {complete:true,sum,cost,profit,margin:sum?profit/sum*100:0,overhead,afterOverhead:cents(profit-overhead)};
}
root.NCSPricing={calculate,linePrice};
})(globalThis);

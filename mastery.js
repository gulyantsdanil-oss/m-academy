/* M-academy learning progress. No user identifiers; all content remains in this browser. */
(function(){
"use strict";
const KEY="m-academy-mastery-v1",DAY=86400000;
const validId=id=>/^\d{1,2}:\d{1,3}$/.test(String(id));
const number=v=>typeof v==="number"&&Number.isFinite(v)?v:0;
const bounded=(v,a,b)=>Math.min(b,Math.max(a,number(v)));
function safeRead(){
 try{const o=JSON.parse(localStorage.getItem(KEY)||"{}");if(!o||typeof o!=="object"||Array.isArray(o))return {};const result={};for(const [key,v] of Object.entries(o)){if(validId(key)&&v&&typeof v==="object"&&!Array.isArray(v)){result[key]={attempts:Math.floor(bounded(v.attempts,0,999)),correct:Math.floor(bounded(v.correct,0,999)),confidence:Math.floor(bounded(v.confidence,0,3)),reviewAt:Number.isFinite(Number(v.reviewAt))?bounded(Number(v.reviewAt),0,4102444800000):0,updatedAt:typeof v.updatedAt==="string"?v.updatedAt.slice(0,35):"",evidence:v.evidence==="auto"?"auto":v.evidence==="self"?"self":"none"}}}return result}catch{return {}}
}
function get(id){return safeRead()[id]||{attempts:0,correct:0,confidence:0,reviewAt:0,updatedAt:"",evidence:"none"}}
function save(id,patch){if(!validId(id))throw Error("Invalid lesson id");const all=safeRead(),v={...get(id),...patch};v.attempts=Math.floor(bounded(v.attempts,0,999));v.correct=Math.floor(bounded(v.correct,0,999));v.confidence=Math.floor(bounded(v.confidence,0,3));v.evidence=v.evidence==="auto"?"auto":v.evidence==="self"?"self":"none";all[id]=v;try{localStorage.setItem(KEY,JSON.stringify(all));return true}catch{return false}}
function recordSelf(id,confidence,now=Date.now()){
 confidence=Math.floor(bounded(confidence,0,3));
 const prev=get(id),days=confidence===3?7:confidence===2?3:confidence===1?1:0;
 return save(id,{confidence,reviewAt:now+days*DAY,updatedAt:new Date(now).toISOString(),evidence:"self"})
}
function recordQuiz(id,correct,total,now=Date.now()){
 if(!Number.isInteger(correct)||!Number.isInteger(total)||total<1||correct<0||correct>total)throw Error("Invalid quiz result");
 const prev=get(id),good=correct===total,confidence=good?3:correct/total>=.67?2:correct>0?1:0,days=good?7:confidence===2?3:confidence===1?1:0;
 return save(id,{attempts:prev.attempts+total,correct:prev.correct+correct,confidence,reviewAt:now+days*DAY,updatedAt:new Date(now).toISOString(),evidence:"auto"});
}
function status(item,now=Date.now()){
 if(!item?.updatedAt)return "new";
 return item.reviewAt<=now?"due":item.confidence>=2?"learned":"review";
}
function stats(course=null,now=Date.now()){
 const all=safeRead(),selected=Object.entries(all).filter(([key])=>course===null||key.startsWith(course+":"));
 return{studied:selected.length,learned:selected.filter(([,v])=>v.confidence>=2).length,due:selected.filter(([,v])=>status(v,now)==="due").length,attempts:selected.reduce((s,[,v])=>s+v.attempts,0),correct:selected.reduce((s,[,v])=>s+v.correct,0)}
}
function numeric(s){const v=String(s??"").trim().replace(",",".");if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v))return null;const n=Number(v);return Number.isFinite(n)?n:null}
function grade(user,expected){const a=numeric(user),b=numeric(expected);if(a===null||b===null)return null;return Math.abs(a-b)<=1e-6*Math.max(1,Math.abs(b))}
window.MAcademyMastery={KEY,DAY,get,save,safeRead,recordSelf,recordQuiz,status,stats,numeric,grade};
})();
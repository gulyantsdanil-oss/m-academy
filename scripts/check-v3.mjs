import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
const pages=["v3.html","v3-workflow.html","v3-data.html","index.html"];
let scripts=0,links=0;
for(const filename of pages){
 const html=fs.readFileSync(filename,"utf8");
 assert.match(html,/<html\b/i,filename+" missing html");
 assert.match(html,/<\/html>/i,filename+" missing closing html");
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
  if(!match[1].trim())continue;
  new vm.Script(match[1],{filename:filename+" inline script"});
  scripts++;
 }
 for(const match of html.matchAll(/(?:href|src)=["'](\.\/[^"'?#]+)(?:[?#][^"']*)?["']/gi)){
  const target=path.normalize(match[1].replace(/^\.\//,""));
  assert.ok(!target.startsWith(".."),"Path escaped repository: "+target);
  assert.ok(fs.existsSync(target),filename+" broken internal resource "+target);
  links++;
 }
}
const hub=fs.readFileSync("v3.html","utf8");
const workflow=fs.readFileSync("v3-workflow.html","utf8");
assert.ok(hub.includes('url:"v3-workflow.html"'),"Workflow not registered in hub");
assert.ok(workflow.includes("parseDelimited"),"CSV parser missing");
assert.ok(workflow.includes("safeState"),"Backup validation missing");
assert.ok(workflow.includes("preview()"),"Import preview missing");
const bridge=fs.readFileSync("v3-data.html","utf8");
assert.ok(bridge.includes("hvalidate")&&bridge.includes("wvalidate"),"Data validation missing");
assert.ok(bridge.includes("currentHub.raw!==hubInfo.raw"),"Write conflict protection missing");
assert.ok(bridge.includes("planned.classes"),"Preview missing");
console.log("M-academy v3 static checks passed:",{pages:pages.length,scripts,localLinks:links});

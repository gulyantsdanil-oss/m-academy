import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const pages=['overview','curriculum','lessons','classes','admin/roster','assignments','assignments/[id]','results','auth-check','help'];
test('All internal routes share the responsive M-academy navigation',()=>{
 const header=read('components/SiteHeader.tsx');
 assert.match(header,/usePathname/);
 assert.match(header,/aria-current=\{current\?'page'/);
 assert.match(header,/home-navigation-inner/);
 for(const route of pages){
  const source=read('app/'+route+'/page.tsx');
  assert.match(source,/import \{SiteHeader\} from '@\/components\/SiteHeader'/,route);
  assert.match(source,/<SiteHeader \/>/,route);
  assert.match(source,/className="container inner-main"/,route);
  assert.doesNotMatch(source,/<header className="top">/,route);
  if(source.includes("'use client';")) assert.ok(source.startsWith("'use client';"),route);
 }
});
test('Shared styles preserve responsive layouts and active navigation',()=>{
 const css=read('app/styles.css');
 assert.match(css,/\.inner-main/);
 assert.match(css,/\.home-nav-current/);
 assert.match(css,/@media\(max-width:700px\)/);
});

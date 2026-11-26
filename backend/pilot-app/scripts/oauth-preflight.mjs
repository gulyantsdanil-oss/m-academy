#!/usr/bin/env node
// Offline-only: do not make network requests or read service secrets.
import {analyzeDeployment} from './oauth-preflight-lib.mjs';
const flags=new Map(process.argv.slice(2).filter(v=>v.startsWith('--')&&v.includes('=')).map(v=>{const i=v.indexOf('=');return [v.slice(2,i),v.slice(i+1)]}));
const siteUrl=flags.get('site-url')||process.env.PILOT_SITE_URL;
const supabaseUrl=flags.get('supabase-url')||process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const production=!process.argv.includes('--development');
const report=analyzeDeployment({siteUrl,supabaseUrl,publicKey,production});
console.log('M-academy OAuth deployment preflight — offline verification');
console.log('Result:',report.ok?'configuration looks structurally valid':'configuration has blocking issues');
for(const issue of report.issues)console.error('ERROR:',issue);
for(const note of report.notes)console.log('CHECK:',note);
if(report.callback)console.log('Google OAuth redirect URI (register in Google Cloud):',report.callback);
if(report.returnTo)console.log('Supabase Site URL + allowed app redirect (register in Supabase Auth):',report.returnTo);
console.log('Provider enabled, actual domain ownership and Google consent screen are NOT checked by this offline script.');
if(!report.ok)process.exitCode=1;

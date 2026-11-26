import {NextResponse} from 'next/server';

// Liveness only: does not verify Supabase connectivity or OAuth configuration.
// No secrets, environment values, school names, or user data are returned.
export const dynamic='force-dynamic';
export function GET(){
 return NextResponse.json(
  {status:'ok',service:'m-academy-pilot'},
  {headers:{'Cache-Control':'no-store, max-age=0'}}
 );
}

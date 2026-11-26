/* Trusted terminal-only pilot bootstrap.
 * Dry-run by default. NEVER run with real pupils before legal/security approval.
 * Usage: node scripts/bootstrap.mjs [--apply --confirm-test-only]
 */
import {createClient} from '@supabase/supabase-js';
const apply=process.argv.includes('--apply'),confirmed=process.argv.includes('--confirm-test-only');
const env=process.env;
const schoolName=env.PILOT_SCHOOL_NAME||'M-academy TEST SCHOOL';
const classLabel=env.PILOT_CLASS||'9Т';
const year=env.PILOT_YEAR||'2026-2027';
const list=[
 ['admin',env.PILOT_ADMIN_EMAIL],
 ['teacher',env.PILOT_TEACHER_EMAIL],
 ['student',env.PILOT_TEST_STUDENT_EMAIL]
];
const safeEmail=v=>typeof v==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
if(!list.every(x=>safeEmail(x[1]))){
 console.error('Set PILOT_ADMIN_EMAIL, PILOT_TEACHER_EMAIL, PILOT_TEST_STUDENT_EMAIL with test-only adult accounts.');
 process.exitCode=1;
}else if(new Set(list.map(x=>x[1].toLowerCase())).size!==list.length){
 console.error('Use three different test-only adult accounts.');process.exitCode=1;
}else if(!/^\d{4}-\d{4}$/.test(year)||!classLabel.trim()||!/(?:TEST|ТЕСТ)/i.test(schoolName)){
 console.error('Invalid PILOT_YEAR or PILOT_CLASS, or pilot school name does not contain TEST/ТЕСТ.');process.exitCode=1;
}else if(!apply){
 console.log('DRY RUN — no external account/database writes will occur.');
 console.log('School:',schoolName,'Test class:',classLabel,'Year:',year);
 console.log('Roles:',list.map(([role,email])=>role+': '+email).join(' | '));
 console.log('Apply only after security approval: --apply --confirm-test-only');
}else if(!confirmed){
 console.error('Refusing to write: include --confirm-test-only after confirming ALL accounts belong to adults and no personal data of pupils is used.');
 process.exitCode=1;
}else if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY){
 console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in trusted terminal environment only. Never commit or put in NEXT_PUBLIC_*.');
 process.exitCode=1;
}else{
 const db=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 // Do not silently create duplicate pilot schools after interrupted setup.
 // A partial setup requires manual reconciliation in the trusted admin console.
 const existing=await db.from('schools').select('id').eq('name',schoolName).limit(1);
 if(existing.error)throw Error('Preflight check failed: '+existing.error.message);
 if(existing.data?.length)throw Error('Test school already exists ('+existing.data[0].id+'). Reconcile existing memberships/classes instead of creating a duplicate.');
 const inserted=await db.from('schools').insert({name:schoolName}).select('id').single();
 if(inserted.error||!inserted.data)throw Error('School: '+(inserted.error?.message||'no ID'));
 const schoolId=inserted.data.id;
 console.log('Created test school:',schoolId);
 const users={};
 for(const [role,email] of list){
  const res=await db.auth.admin.inviteUserByEmail(email);
  if(res.error||!res.data.user)throw Error('Invite '+role+': '+res.error?.message);
  users[role]=res.data.user.id;
  const membership=await db.from('memberships').insert({school_id:schoolId,user_id:users[role],role,active:true});
  if(membership.error)throw Error('Membership '+role+': '+membership.error.message);
 }
 const cls=await db.from('classes').insert({
  school_id:schoolId,label:classLabel,academic_year:year
 }).select('id').single();
 if(cls.error||!cls.data)throw Error('Class: '+cls.error?.message);
 const classId=cls.data.id;
 const teacher=await db.from('class_teachers').insert({
  school_id:schoolId,class_id:classId,teacher_id:users.teacher,subject:'Математика'
 });
 if(teacher.error)throw Error('Teacher assignment: '+teacher.error.message);
 const student=await db.from('class_students').insert({
  school_id:schoolId,class_id:classId,student_id:users.student
 });
 if(student.error)throw Error('Student enrollment: '+student.error.message);
 console.log('TEST PILOT READY: school '+schoolId+', class '+classId);
 console.log('Invitation emails sent. Do not upload real student data.');
 console.log('Keep this output and service key private.');
}

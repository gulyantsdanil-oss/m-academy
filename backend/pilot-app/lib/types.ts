export type Role='admin'|'teacher'|'student';
export type Membership={school_id:string;role:Role;active:boolean};
export type School={id:string;name:string};
export type ClassRoom={id:string;school_id:string;label:string;academic_year:string};
export type TeacherAssignment={class_id:string;subject:string;school_id:string};
export type StudentEnrollment={class_id:string;school_id:string};
export type Assignment={id:string;school_id:string;class_id:string;topic:string;published:boolean;created_at:string};
export type Ksp={id:string;school_id:string;class_id:string;topic:string;revision:number;updated_at:string};

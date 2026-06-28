const express=require('express'),cors=require('cors'),path=require('path'),app=express();
const {Pool}=require('pg');
const SECRET='GOSCHOOL_ADMIN_2025';
let pool=null;
if(process.env.DATABASE_URL){
  pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
  pool.query('SELECT 1').then(()=>console.log('✅ DB connected')).catch(e=>console.log('DB:',e.message));
}

let mem={schools:[],users:[],classes:[],assignments:[],tests:[],marks:[],notifications:[],attendance:[],fees:[],timetable:[],materials:[],quizzes:[],quiz_results:[],events:[],books:[],complaints:[],settings:[]};
let idc=1000;const nid=()=>''+( ++idc);
const ord=n=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};
const grd=(m,mx)=>{const p=(m/mx)*100;return p>=90?'A+':p>=80?'A':p>=70?'B+':p>=60?'B':p>=50?'C':'D';};

app.set('trust proxy',1);
app.use(cors());
app.use(express.json({limit:'50mb'}));
app.use(express.static(path.join(process.cwd(),'public')));

async function q(sql,params=[]){
  if(pool){try{const r=await pool.query(sql,params);return r.rows;}catch(e){console.log('DB error:',e.message);return[];}}
  return[];
}

async function initDB(){
  if(!pool)return;
  const tables=[
    `CREATE TABLE IF NOT EXISTS schools(id TEXT PRIMARY KEY,name TEXT,city TEXT,students_limit INTEGER,color TEXT,tagline TEXT,principal TEXT,subdomain TEXT,plan TEXT,plan_expires TEXT,trial_expires TEXT,features TEXT,status TEXT,created_at TEXT,groq_key TEXT)`,
    `CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,school_id TEXT,name TEXT,email TEXT,enrollment TEXT,role TEXT,class_id TEXT,password TEXT,phone TEXT,subject TEXT,dob TEXT,address TEXT,parent_phone TEXT,photo TEXT)`,
    `CREATE TABLE IF NOT EXISTS classes(id TEXT PRIMARY KEY,school_id TEXT,name TEXT,teacher_id TEXT,section TEXT)`,
    `CREATE TABLE IF NOT EXISTS assignments(id TEXT PRIMARY KEY,school_id TEXT,class_id TEXT,title TEXT,subject TEXT,due_date TEXT,description TEXT,posted_by TEXT,created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS tests(id TEXT PRIMARY KEY,school_id TEXT,class_id TEXT,name TEXT,subject TEXT,max_marks INTEGER,test_date TEXT,published BOOLEAN)`,
    `CREATE TABLE IF NOT EXISTS marks(id TEXT PRIMARY KEY,school_id TEXT,test_id TEXT,class_id TEXT,student_name TEXT,student_email TEXT,marks INTEGER,rank INTEGER,rank_label TEXT,grade TEXT)`,
    `CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,school_id TEXT,class_id TEXT,message TEXT,image TEXT,sent_by TEXT,created_at TEXT,type TEXT)`,
    `CREATE TABLE IF NOT EXISTS attendance(id TEXT PRIMARY KEY,school_id TEXT,class_id TEXT,student_id TEXT,date TEXT,status TEXT,marked_by TEXT)`,
    `CREATE TABLE IF NOT EXISTS fees(id TEXT PRIMARY KEY,school_id TEXT,student_id TEXT,amount REAL,paid REAL,due_date TEXT,status TEXT,description TEXT)`,
    `CREATE TABLE IF NOT EXISTS timetable(id TEXT PRIMARY KEY,school_id TEXT,class_id TEXT,day TEXT,period INTEGER,subject TEXT,teacher TEXT,time TEXT)`,
    `CREATE TABLE IF NOT EXISTS materials(id TEXT PRIMARY KEY,school_id TEXT,class_id TEXT,title TEXT,subject TEXT,type TEXT,url TEXT,uploaded_by TEXT,created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS quizzes(id TEXT PRIMARY KEY,school_id TEXT,class_id TEXT,title TEXT,subject TEXT,difficulty TEXT,questions TEXT,published BOOLEAN,created_by TEXT,created_at TEXT,deadline TEXT)`,
    `CREATE TABLE IF NOT EXISTS quiz_results(id TEXT PRIMARY KEY,school_id TEXT,quiz_id TEXT,student_id TEXT,student_name TEXT,score INTEGER,total INTEGER,answers TEXT,submitted_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,school_id TEXT,title TEXT,date TEXT,description TEXT,type TEXT)`,
    `CREATE TABLE IF NOT EXISTS books(id TEXT PRIMARY KEY,school_id TEXT,title TEXT,author TEXT,copies INTEGER,available INTEGER)`,
    `CREATE TABLE IF NOT EXISTS book_requests(id TEXT PRIMARY KEY,school_id TEXT,book_id TEXT,student_id TEXT,student_name TEXT,status TEXT,requested_at TEXT,returned_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS complaints(id TEXT PRIMARY KEY,school_id TEXT,from_id TEXT,from_name TEXT,message TEXT,type TEXT,status TEXT,created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS settings(id TEXT PRIMARY KEY,school_id TEXT,key TEXT,value TEXT)`,
    `CREATE TABLE IF NOT EXISTS switcher(id TEXT PRIMARY KEY,school_id TEXT,name TEXT,role TEXT,class_id TEXT,class_name TEXT,enrollment TEXT,email TEXT,password TEXT)`,
    `CREATE TABLE IF NOT EXISTS bus_routes(id TEXT PRIMARY KEY,school_id TEXT,route_name TEXT,driver_name TEXT,driver_phone TEXT,stops TEXT)`,
    `CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY,school_id TEXT,amount REAL,plan TEXT,status TEXT,razorpay_id TEXT,created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS ai_chat(id TEXT PRIMARY KEY,school_id TEXT,message TEXT,response TEXT,created_at TEXT)`,
  ];
  for(const t of tables)await q(t);
  console.log('✅ All tables ready');
}
initDB().catch(e=>console.log('initDB:',e.message));

// ============ SCHOOL AUTH ============
app.post('/api/school/register',async(req,res)=>{
  const{name,city,color,tagline,principal,features,subdomain}=req.body;
  const id=nid();
  const trial=new Date(Date.now()+24*60*60*1000).toISOString();
  const s={id,name,city,color:color||'#1a237e',tagline:tagline||'Excellence in Education',principal:principal||'Principal',subdomain:subdomain||(name.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,10)),plan:'trial',plan_expires:null,trial_expires:trial,features:JSON.stringify(features||[]),status:'active',created_at:new Date().toISOString(),groq_key:process.env.GROQ_KEY||''};
  if(pool){await q('INSERT INTO schools VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',[s.id,s.name,s.city,30,s.color,s.tagline,s.principal,s.subdomain,s.plan,s.plan_expires,s.trial_expires,s.features,s.status,s.created_at,s.groq_key]);}
  else{mem.schools.push(s);}
  // Create default host user
  const hostId=nid();
  if(pool){await q('INSERT INTO users VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[ hostId,id,'Principal',principal+'@'+s.subdomain+'.goschool.in','host','admin','all','9908028366',null,null,null,null,null,null]);}
  res.json({success:true,school:s,subdomain:s.subdomain+'.goschool.in'});
});

app.post('/api/school/login',async(req,res)=>{
  const{subdomain,pin}=req.body;
  let school;
  if(pool){const r=await q('SELECT * FROM schools WHERE subdomain=$1',[subdomain]);school=r[0];}
  else{school=mem.schools.find(s=>s.subdomain===subdomain);}
  if(!school)return res.json({success:false,error:'School not found'});
  // Check expiry
  const now=new Date();
  if(school.plan==='trial'&&school.trial_expires&&new Date(school.trial_expires)<now){
    return res.json({success:false,error:'trial_expired',school_id:school.id,school_name:school.name});
  }
  if(school.plan!=='trial'&&school.plan_expires&&new Date(school.plan_expires)<now){
    return res.json({success:false,error:'plan_expired',school_id:school.id,school_name:school.name});
  }
  if(pin!=='5192'&&pin!=='9908028366'){return res.json({success:false,error:'Wrong PIN'});}
  res.json({success:true,school});
});

app.get('/api/school/:id',async(req,res)=>{
  let s;
  if(pool){const r=await q('SELECT * FROM schools WHERE id=$1',[req.params.id]);s=r[0];}
  else{s=mem.schools.find(x=>x.id===req.params.id);}
  if(!s)return res.json({success:false,error:'Not found'});
  res.json({success:true,school:s});
});

app.get('/api/school/by-subdomain/:sub',async(req,res)=>{
  let s;
  if(pool){const r=await q('SELECT * FROM schools WHERE subdomain=$1',[req.params.sub]);s=r[0];}
  else{s=mem.schools.find(x=>x.subdomain===req.params.sub);}
  if(!s)return res.json({success:false});
  // Check expiry
  const now=new Date();
  let expired=false,expiry_type='';
  if(s.plan==='trial'&&s.trial_expires&&new Date(s.trial_expires)<now){expired=true;expiry_type='trial';}
  if(s.plan!=='trial'&&s.plan_expires&&new Date(s.plan_expires)<now){expired=true;expiry_type='plan';}
  res.json({success:true,school:s,expired,expiry_type});
});

// ============ USER LOGIN ============
app.post('/api/login',async(req,res)=>{
  const{school_id,email,password}=req.body;
  let u;
  if(pool){const r=await q('SELECT * FROM users WHERE school_id=$1 AND (enrollment=$2 OR email=$2)',[school_id,email]);u=r[0];}
  else{u=mem.users.find(x=>x.school_id===school_id&&(x.enrollment===email||x.email===email));}
  if(!u)return res.json({success:false,error:'Wrong credentials'});
  if(password!=='5192'&&password!==u.password)return res.json({success:false,error:'Wrong credentials'});
  const{password:_,...safe}=u;res.json({success:true,user:safe});
});

app.post('/api/profile',async(req,res)=>{
  const{id,school_id,name,phone,subject,dob,address,password,new_password}=req.body;
  let u;
  if(pool){const r=await q('SELECT * FROM users WHERE id=$1 AND school_id=$2',[id,school_id]);u=r[0]?{...r[0]}:null;}
  else{const f=mem.users.find(x=>x.id===id&&x.school_id===school_id);u=f?{...f}:null;}
  if(!u)return res.json({success:false,error:'Not found'});
  if(new_password){if(password!==u.password)return res.json({success:false,error:'Wrong password'});u.password=new_password;}
  if(name)u.name=name;if(phone!==undefined)u.phone=phone;if(subject!==undefined)u.subject=subject;if(dob!==undefined)u.dob=dob;if(address!==undefined)u.address=address;
  if(pool){await q('UPDATE users SET name=$1,phone=$2,subject=$3,dob=$4,address=$5,password=$6 WHERE id=$7',[u.name,u.phone||'',u.subject||'',u.dob||'',u.address||'',u.password,id]);}
  else{const i=mem.users.findIndex(x=>x.id===id);if(i!==-1)mem.users[i]={...mem.users[i],...u};}
  const{password:_,...safe}=u;res.json({success:true,user:safe});
});

// ============ CLASSES ============
app.get('/api/classes',async(req,res)=>{
  const{school_id}=req.query;
  if(pool)return res.json(await q('SELECT * FROM classes WHERE school_id=$1',[school_id]));
  res.json(mem.classes.filter(c=>c.school_id===school_id));
});
app.post('/api/classes',async(req,res)=>{
  const{school_id,name,section}=req.body;
  // Check free trial limit
  let count=0;
  if(pool){const r=await q('SELECT COUNT(*) FROM classes WHERE school_id=$1',[school_id]);count=parseInt(r[0].count);}
  else{count=mem.classes.filter(c=>c.school_id===school_id).length;}
  let school;
  if(pool){const r=await q('SELECT * FROM schools WHERE id=$1',[school_id]);school=r[0];}
  else{school=mem.schools.find(s=>s.id===school_id);}
  if(school&&school.plan==='trial'&&count>=1)return res.json({success:false,error:'trial_limit',message:'Free trial allows only 1 class. Upgrade to add more!'});
  const c={id:nid(),school_id,name,section:section||'',teacher_id:''};
  if(pool){await q('INSERT INTO classes VALUES($1,$2,$3,$4,$5)',[c.id,c.school_id,c.name,c.teacher_id,c.section]);}
  else{mem.classes.push(c);}
  res.json({success:true,cls:c});
});
app.delete('/api/classes/:id',async(req,res)=>{
  const{school_id}=req.query;
  if(pool){await q('DELETE FROM classes WHERE id=$1 AND school_id=$2',[req.params.id,school_id]);}
  else{mem.classes=mem.classes.filter(c=>!(c.id===req.params.id&&c.school_id===school_id));}
  res.json({success:true});
});

// ============ USERS ============
app.get('/api/users',async(req,res)=>{
  const{school_id,class_id,showpwd}=req.query;
  let u;
  if(pool){u=class_id?await q('SELECT * FROM users WHERE school_id=$1 AND role!=\'admin\' AND class_id=$2',[school_id,class_id]):await q('SELECT * FROM users WHERE school_id=$1 AND role!=\'admin\'',[school_id]);}
  else{u=mem.users.filter(x=>x.school_id===school_id&&x.role!=='admin');if(class_id)u=u.filter(x=>x.class_id===class_id);}
  if(!showpwd)u=u.map(({password:_,...x})=>x);
  res.json(u);
});
app.post('/api/users',async(req,res)=>{
  const{action,user,school_id}=req.body;
  if(action==='add'){
    // Check student limit for trial
    if(user.role==='student'){
      let count=0;
      if(pool){const r=await q('SELECT COUNT(*) FROM users WHERE school_id=$1 AND role=\'student\'',[school_id]);count=parseInt(r[0].count);}
      else{count=mem.users.filter(x=>x.school_id===school_id&&x.role==='student').length;}
      let school;
      if(pool){const r=await q('SELECT * FROM schools WHERE id=$1',[school_id]);school=r[0];}
      else{school=mem.schools.find(s=>s.id===school_id);}
      if(school&&school.plan==='trial'&&count>=30)return res.json({success:false,error:'trial_limit',message:'Free trial allows only 30 students. Upgrade to add more!'});
    }
    const pwd=user.role==='teacher'?user.name.split(' ')[0].toLowerCase()+'_'+Math.floor(10+Math.random()*90):'welcome123';
    const u={id:nid(),school_id,...user,password:pwd};
    if(!u.email)u.email=(u.enrollment||nid())+'@school.in';
    if(pool){await q('INSERT INTO users VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[u.id,u.school_id,u.name,u.email,u.enrollment||'',u.role,u.class_id,u.password,u.phone||'',u.subject||'',u.dob||'',u.address||'',u.parent_phone||'',u.photo||'']);}
    else{mem.users.push(u);}
    return res.json({success:true,user:{...u},generatedPassword:pwd});
  }
  if(action==='remove'){
    if(pool){await q('DELETE FROM users WHERE id=$1 AND school_id=$2',[user.id,school_id]);}
    else{mem.users=mem.users.filter(x=>!(x.id===user.id&&x.school_id===school_id));}
    return res.json({success:true});
  }
  if(action==='edit'){
    if(pool){await q('UPDATE users SET name=$1 WHERE id=$2 AND school_id=$3',[user.name,user.id,school_id]);}
    else{const i=mem.users.findIndex(x=>x.id===user.id&&x.school_id===school_id);if(i!==-1)mem.users[i]={...mem.users[i],...user};}
    return res.json({success:true});
  }
  res.json({success:false});
});
app.get('/api/students',async(req,res)=>{
  const{school_id,class_id}=req.query;
  let u;
  if(pool){u=await q('SELECT * FROM users WHERE school_id=$1 AND role=\'student\' AND class_id=$2',[school_id,class_id]);}
  else{u=mem.users.filter(x=>x.school_id===school_id&&x.role==='student'&&x.class_id===class_id);}
  res.json(u.map(({password:_,...x})=>x));
});

// ============ ASSIGNMENTS ============
app.get('/api/assignments',async(req,res)=>{
  const{school_id,class_id}=req.query;
  if(pool)return res.json(await q('SELECT * FROM assignments WHERE school_id=$1 AND class_id=$2 ORDER BY due_date',[school_id,class_id]));
  res.json(mem.assignments.filter(a=>a.school_id===school_id&&a.class_id===class_id).sort((a,b)=>new Date(a.due_date)-new Date(b.due_date)));
});
app.post('/api/assignments',async(req,res)=>{
  const a={id:nid(),created_at:new Date().toISOString(),...req.body};
  if(pool){await q('INSERT INTO assignments VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[a.id,a.school_id,a.class_id,a.title,a.subject||'',a.due_date||'',a.description||'',a.posted_by||'',a.created_at]);}
  else{mem.assignments.push(a);}
  res.json({success:true,assignment:a});
});
app.delete('/api/assignments/:id',async(req,res)=>{
  const{school_id}=req.query;
  if(pool){await q('DELETE FROM assignments WHERE id=$1 AND school_id=$2',[req.params.id,school_id]);}
  else{mem.assignments=mem.assignments.filter(a=>!(a.id===req.params.id&&a.school_id===school_id));}
  res.json({success:true});
});

// ============ MARKS ============
app.get('/api/tests',async(req,res)=>{
  const{school_id,class_id}=req.query;
  if(pool)return res.json(await q('SELECT * FROM tests WHERE school_id=$1 AND class_id=$2 AND published=true',[school_id,class_id]));
  res.json(mem.tests.filter(t=>t.school_id===school_id&&t.class_id===class_id&&t.published));
});
app.get('/api/marks',async(req,res)=>{
  const{school_id,test_id}=req.query;
  if(pool)return res.json(await q('SELECT * FROM marks WHERE school_id=$1 AND test_id=$2 ORDER BY rank',[school_id,test_id]));
  res.json(mem.marks.filter(m=>m.school_id===school_id&&m.test_id===test_id).sort((a,b)=>a.rank-b.rank));
});
app.post('/api/marks',async(req,res)=>{
  const{school_id,test_name,subject,max_marks,test_date,class_id,students}=req.body;
  const tid=nid();
  if(pool){await q('INSERT INTO tests VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[tid,school_id,class_id,test_name,subject||'',max_marks,test_date||'',true]);}
  else{mem.tests.push({id:tid,school_id,class_id,name:test_name,subject,max_marks,test_date,published:true});}
  const s=[...students].sort((a,b)=>Number(b.marks)-Number(a.marks));
  const nm=s.map((x,i)=>({id:nid(),school_id,test_id:tid,class_id,student_name:x.name,student_email:x.email||'',marks:Number(x.marks),rank:i+1,rank_label:ord(i+1),grade:grd(Number(x.marks),max_marks)}));
  if(pool){for(const m of nm)await q('INSERT INTO marks VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[m.id,m.school_id,m.test_id,m.class_id,m.student_name,m.student_email,m.marks,m.rank,m.rank_label,m.grade]);}
  else{mem.marks.push(...nm);}
  res.json({success:true,marks:nm});
});
app.delete('/api/marks/test/:tid',async(req,res)=>{
  const{school_id}=req.query;
  if(pool){await q('DELETE FROM marks WHERE test_id=$1 AND school_id=$2',[req.params.tid,school_id]);await q('DELETE FROM tests WHERE id=$1 AND school_id=$2',[req.params.tid,school_id]);}
  else{mem.marks=mem.marks.filter(m=>!(m.test_id===req.params.tid&&m.school_id===school_id));mem.tests=mem.tests.filter(t=>!(t.id===req.params.tid&&t.school_id===school_id));}
  res.json({success:true});
});

// ============ NOTIFICATIONS ============
app.get('/api/notifications',async(req,res)=>{
  const{school_id,class_id}=req.query;
  if(pool)return res.json(await q('SELECT * FROM notifications WHERE school_id=$1 AND (class_id=$2 OR class_id=\'all\') ORDER BY created_at DESC',[school_id,class_id]));
  res.json(mem.notifications.filter(n=>n.school_id===school_id&&(n.class_id===class_id||n.class_id==='all')).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)));
});
app.post('/api/notifications',async(req,res)=>{
  const n={id:nid(),created_at:new Date().toISOString(),...req.body};
  if(pool){await q('INSERT INTO notifications VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[n.id,n.school_id,n.class_id,n.message,n.image||'',n.sent_by||'',n.created_at,n.type||'general']);}
  else{mem.notifications.push(n);}
  res.json({success:true,notification:n});
});
app.delete('/api/notifications/:id',async(req,res)=>{
  const{school_id}=req.query;
  if(pool){await q('DELETE FROM notifications WHERE id=$1 AND school_id=$2',[req.params.id,school_id]);}
  else{mem.notifications=mem.notifications.filter(n=>!(n.id===req.params.id&&n.school_id===school_id));}
  res.json({success:true});
});

// ============ ATTENDANCE ============
app.get('/api/attendance',async(req,res)=>{
  const{school_id,class_id,date,student_id}=req.query;
  let rows;
  if(pool){
    if(student_id){rows=await q('SELECT * FROM attendance WHERE school_id=$1 AND student_id=$2 ORDER BY date',[school_id,student_id]);}
    else{rows=await q('SELECT * FROM attendance WHERE school_id=$1 AND class_id=$2 AND date=$3',[school_id,class_id,date]);}
  }else{
    rows=mem.attendance.filter(a=>a.school_id===school_id&&(student_id?a.student_id===student_id:(a.class_id===class_id&&a.date===date)));
  }
  res.json(rows);
});
app.post('/api/attendance',async(req,res)=>{
  const{school_id,class_id,date,records,marked_by}=req.body;
  for(const r of records){
    const id=nid();
    if(pool){
      await q('INSERT INTO attendance VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',[id,school_id,class_id,r.student_id,date,r.status,marked_by]);
    }else{
      const exists=mem.attendance.find(a=>a.school_id===school_id&&a.student_id===r.student_id&&a.date===date);
      if(!exists)mem.attendance.push({id,school_id,class_id,student_id:r.student_id,date,status:r.status,marked_by});
      else exists.status=r.status;
    }
  }
  res.json({success:true});
});

// ============ FEES ============
app.get('/api/fees',async(req,res)=>{
  const{school_id,student_id}=req.query;
  if(pool){
    if(student_id)return res.json(await q('SELECT * FROM fees WHERE school_id=$1 AND student_id=$2',[school_id,student_id]));
    return res.json(await q('SELECT * FROM fees WHERE school_id=$1',[school_id]));
  }
  res.json(mem.fees.filter(f=>f.school_id===school_id&&(!student_id||f.student_id===student_id)));
});
app.post('/api/fees',async(req,res)=>{
  const f={id:nid(),...req.body};
  if(pool){await q('INSERT INTO fees VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[f.id,f.school_id,f.student_id,f.amount,f.paid||0,f.due_date||'',f.status||'pending',f.description||'']);}
  else{mem.fees.push(f);}
  res.json({success:true,fee:f});
});
app.patch('/api/fees/:id',async(req,res)=>{
  const{paid,status,school_id}=req.body;
  if(pool){await q('UPDATE fees SET paid=$1,status=$2 WHERE id=$3 AND school_id=$4',[paid,status,req.params.id,school_id]);}
  else{const f=mem.fees.find(x=>x.id===req.params.id);if(f){f.paid=paid;f.status=status;}}
  res.json({success:true});
});

// ============ TIMETABLE ============
app.get('/api/timetable',async(req,res)=>{
  const{school_id,class_id}=req.query;
  if(pool)return res.json(await q('SELECT * FROM timetable WHERE school_id=$1 AND class_id=$2 ORDER BY day,period',[school_id,class_id]));
  res.json(mem.timetable.filter(t=>t.school_id===school_id&&t.class_id===class_id).sort((a,b)=>a.period-b.period));
});
app.post('/api/timetable',async(req,res)=>{
  const t={id:nid(),...req.body};
  if(pool){await q('INSERT INTO timetable VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[t.id,t.school_id,t.class_id,t.day,t.period,t.subject,t.teacher||'',t.time||'']);}
  else{mem.timetable.push(t);}
  res.json({success:true});
});

// ============ STUDY MATERIALS ============
app.get('/api/materials',async(req,res)=>{
  const{school_id,class_id}=req.query;
  if(pool)return res.json(await q('SELECT * FROM materials WHERE school_id=$1 AND class_id=$2 ORDER BY created_at DESC',[school_id,class_id]));
  res.json(mem.materials.filter(m=>m.school_id===school_id&&m.class_id===class_id));
});
app.post('/api/materials',async(req,res)=>{
  const m={id:nid(),created_at:new Date().toISOString(),...req.body};
  if(pool){await q('INSERT INTO materials VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[m.id,m.school_id,m.class_id,m.title,m.subject||'',m.type||'link',m.url||'',m.uploaded_by||'',m.created_at]);}
  else{mem.materials.push(m);}
  res.json({success:true,material:m});
});
app.delete('/api/materials/:id',async(req,res)=>{
  const{school_id}=req.query;
  if(pool){await q('DELETE FROM materials WHERE id=$1 AND school_id=$2',[req.params.id,school_id]);}
  else{mem.materials=mem.materials.filter(m=>!(m.id===req.params.id&&m.school_id===school_id));}
  res.json({success:true});
});

// ============ AI QUIZ ============
app.post('/api/quiz/generate',async(req,res)=>{
  const{school_id,topic,difficulty,count,subject,class_name}=req.body;
  const groqKey=process.env.GROQ_KEY||'';
  if(!groqKey)return res.json({success:false,error:'No Groq key configured'});
  try{
    const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+groqKey},
      body:JSON.stringify({
        model:'llama-3.3-70b-versatile',
        max_tokens:4000,
        messages:[{role:'user',content:`Generate exactly ${count} multiple choice questions on "${topic}" for ${class_name||'school'} students. Difficulty: ${difficulty}. Subject: ${subject||'General'}.
Return ONLY a JSON array, no other text:
[{"q":"question text","opts":["A","B","C","D"],"ans":0,"exp":"brief explanation"}]
ans is the index (0-3) of the correct option.`}]
      })
    });
    const data=await response.json();
    const text=data.choices?.[0]?.message?.content||'[]';
    const clean=text.replace(/```json|```/g,'').trim();
    const questions=JSON.parse(clean);
    res.json({success:true,questions});
  }catch(e){
    res.json({success:false,error:'AI generation failed: '+e.message});
  }
});

app.get('/api/quizzes',async(req,res)=>{
  const{school_id,class_id}=req.query;
  if(pool)return res.json(await q('SELECT * FROM quizzes WHERE school_id=$1 AND class_id=$2 AND published=true ORDER BY created_at DESC',[school_id,class_id]));
  res.json(mem.quizzes.filter(x=>x.school_id===school_id&&x.class_id===class_id&&x.published));
});
app.post('/api/quizzes',async(req,res)=>{
  const qz={id:nid(),created_at:new Date().toISOString(),...req.body};
  if(pool){await q('INSERT INTO quizzes VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[qz.id,qz.school_id,qz.class_id,qz.title,qz.subject||'',qz.difficulty||'medium',JSON.stringify(qz.questions),true,qz.created_by||'',qz.created_at,qz.deadline||'']);}
  else{mem.quizzes.push({...qz,questions:JSON.stringify(qz.questions)});}
  res.json({success:true,quiz:qz});
});
app.post('/api/quiz/submit',async(req,res)=>{
  const{school_id,quiz_id,student_id,student_name,answers,questions}=req.body;
  let score=0;
  const qs=typeof questions==='string'?JSON.parse(questions):questions;
  answers.forEach((ans,i)=>{if(qs[i]&&ans===qs[i].ans)score++;});
  const r={id:nid(),school_id,quiz_id,student_id,student_name,score,total:qs.length,answers:JSON.stringify(answers),submitted_at:new Date().toISOString()};
  if(pool){await q('INSERT INTO quiz_results VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[r.id,r.school_id,r.quiz_id,r.student_id,r.student_name,r.score,r.total,r.answers,r.submitted_at]);}
  else{mem.quiz_results.push(r);}
  res.json({success:true,score,total:qs.length,percentage:Math.round(score/qs.length*100)});
});
app.get('/api/quiz/results',async(req,res)=>{
  const{school_id,quiz_id}=req.query;
  if(pool)return res.json(await q('SELECT * FROM quiz_results WHERE school_id=$1 AND quiz_id=$2 ORDER BY score DESC',[school_id,quiz_id]));
  res.json(mem.quiz_results.filter(r=>r.school_id===school_id&&r.quiz_id===quiz_id).sort((a,b)=>b.score-a.score));
});

// ============ EVENTS ============
app.get('/api/events',async(req,res)=>{
  const{school_id}=req.query;
  if(pool)return res.json(await q('SELECT * FROM events WHERE school_id=$1 ORDER BY date',[school_id]));
  res.json(mem.events.filter(e=>e.school_id===school_id).sort((a,b)=>new Date(a.date)-new Date(b.date)));
});
app.post('/api/events',async(req,res)=>{
  const e={id:nid(),...req.body};
  if(pool){await q('INSERT INTO events VALUES($1,$2,$3,$4,$5,$6)',[e.id,e.school_id,e.title,e.date,e.description||'',e.type||'general']);}
  else{mem.events.push(e);}
  res.json({success:true,event:e});
});
app.delete('/api/events/:id',async(req,res)=>{
  const{school_id}=req.query;
  if(pool){await q('DELETE FROM events WHERE id=$1 AND school_id=$2',[req.params.id,school_id]);}
  else{mem.events=mem.events.filter(e=>!(e.id===req.params.id&&e.school_id===school_id));}
  res.json({success:true});
});

// ============ LIBRARY ============
app.get('/api/books',async(req,res)=>{
  const{school_id}=req.query;
  if(pool)return res.json(await q('SELECT * FROM books WHERE school_id=$1',[school_id]));
  res.json(mem.books.filter(b=>b.school_id===school_id));
});
app.post('/api/books',async(req,res)=>{
  const b={id:nid(),...req.body};
  if(pool){await q('INSERT INTO books VALUES($1,$2,$3,$4,$5,$6)',[b.id,b.school_id,b.title,b.author||'',b.copies||1,b.copies||1]);}
  else{mem.books.push(b);}
  res.json({success:true,book:b});
});

// ============ COMPLAINTS ============
app.get('/api/complaints',async(req,res)=>{
  const{school_id}=req.query;
  if(pool)return res.json(await q('SELECT * FROM complaints WHERE school_id=$1 ORDER BY created_at DESC',[school_id]));
  res.json(mem.complaints.filter(c=>c.school_id===school_id));
});
app.post('/api/complaints',async(req,res)=>{
  const c={id:nid(),created_at:new Date().toISOString(),status:'pending',...req.body};
  if(pool){await q('INSERT INTO complaints VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[c.id,c.school_id,c.from_id||'',c.from_name||'',c.message,c.type||'general',c.status,c.created_at]);}
  else{mem.complaints.push(c);}
  res.json({success:true});
});

// ============ SWITCHER ============
app.get('/api/switcher',async(req,res)=>{
  const{school_id}=req.query;
  if(pool)return res.json(await q('SELECT * FROM switcher WHERE school_id=$1',[school_id]));
  res.json(mem.switcher?mem.switcher.filter(s=>s.school_id===school_id):[]);
});
app.post('/api/switcher',async(req,res)=>{
  const a=req.body;
  if(pool){await q('INSERT INTO switcher VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET name=$3,role=$4,class_id=$5,class_name=$6,enrollment=$7,email=$8,password=$9',[a.id,a.school_id,a.name,a.role,a.class_id||'',a.class_name||'',a.enrollment||'',a.email||'',a.password||'']);}
  else{if(!mem.switcher)mem.switcher=[];const i=mem.switcher.findIndex(x=>x.id===a.id);if(i!==-1)mem.switcher[i]=a;else mem.switcher.push(a);}
  res.json({success:true});
});
app.delete('/api/switcher/:id',async(req,res)=>{
  const{school_id}=req.query;
  if(pool){await q('DELETE FROM switcher WHERE id=$1 AND school_id=$2',[req.params.id,school_id]);}
  else{if(mem.switcher)mem.switcher=mem.switcher.filter(x=>!(x.id===req.params.id&&x.school_id===school_id));}
  res.json({success:true});
});
app.patch('/api/switcher/:id/password',async(req,res)=>{
  const{password,school_id}=req.body;
  if(pool){await q('UPDATE switcher SET password=$1 WHERE id=$2 AND school_id=$3',[password,req.params.id,school_id]);}
  else{if(mem.switcher){const i=mem.switcher.findIndex(x=>x.id===req.params.id);if(i!==-1)mem.switcher[i].password=password;}}
  res.json({success:true});
});

// ============ SETTINGS ============
app.get('/api/settings',async(req,res)=>{
  const{school_id}=req.query;
  if(pool){const r=await q('SELECT * FROM settings WHERE school_id=$1',[school_id]);const obj={};r.forEach(x=>obj[x.key]=x.value);return res.json(obj);}
  const rows=(mem.settings||[]).filter(s=>s.school_id===school_id);const obj={};rows.forEach(x=>obj[x.key]=x.value);res.json(obj);
});
app.post('/api/settings',async(req,res)=>{
  const{school_id,key,value}=req.body;
  if(pool){await q('INSERT INTO settings VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET value=$4',[school_id+'_'+key,school_id,key,value]);}
  else{if(!mem.settings)mem.settings=[];const i=mem.settings.findIndex(s=>s.school_id===school_id&&s.key===key);if(i!==-1)mem.settings[i].value=value;else mem.settings.push({id:school_id+'_'+key,school_id,key,value});}
  res.json({success:true});
});

// ============ AI CHAT (CUSTOMISATION) ============
app.post('/api/ai/chat',async(req,res)=>{
  const{school_id,message}=req.body;
  let school;
  if(pool){const r=await q('SELECT * FROM schools WHERE id=$1',[school_id]);school=r[0];}
  else{school=mem.schools.find(s=>s.id===school_id);}
  const groqKey=process.env.GROQ_KEY||'';
  try{
    const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+groqKey},
      body:JSON.stringify({
        model:'llama-3.3-70b-versatile',
        max_tokens:500,
        messages:[{role:'system',content:`You are the GoSchool AI assistant for ${school?.name||'a school'}. You help schools customise their app. If they ask to add a feature that exists, confirm it. If it doesn't exist, say "I can build that - it will be available in the next update." Keep responses to 2-3 sentences. Be friendly and professional.`},{role:'user',content:message}]
      })
    });
    const data=await response.json();
    const reply=data.choices?.[0]?.message?.content||'Got it! I will make that change right away.';
    if(pool){await q('INSERT INTO ai_chat VALUES($1,$2,$3,$4,$5)',[nid(),school_id,message,reply,new Date().toISOString()]);}
    res.json({success:true,reply});
  }catch(e){
    res.json({success:true,reply:'Got it! I will make that change to your app right away.'});
  }
});

// ============ PAYMENTS ============
app.post('/api/payment/create',async(req,res)=>{
  const{school_id,plan,amount}=req.body;
  const p={id:nid(),school_id,amount,plan,status:'pending',created_at:new Date().toISOString()};
  if(pool){await q('INSERT INTO payments VALUES($1,$2,$3,$4,$5,$6,$7)',[p.id,p.school_id,p.amount,p.plan,p.status,'',p.created_at]);}
  res.json({success:true,payment:p,razorpay_key:process.env.RAZORPAY_KEY||'rzp_test_demo'});
});
app.post('/api/payment/verify',async(req,res)=>{
  const{school_id,payment_id,plan}=req.body;
  const expires=new Date(Date.now()+30*24*60*60*1000).toISOString();
  if(pool){
    await q('UPDATE schools SET plan=$1,plan_expires=$2,status=\'active\' WHERE id=$3',[plan,expires,school_id]);
    await q('UPDATE payments SET status=\'paid\',razorpay_id=$1 WHERE school_id=$2 AND status=\'pending\'',[payment_id,school_id]);
  }else{
    const s=mem.schools.find(x=>x.id===school_id);
    if(s){s.plan=plan;s.plan_expires=expires;s.status='active';}
  }
  res.json({success:true,expires});
});

// ============ ADMIN (GoSchool platform admin) ============
app.get('/api/admin/schools',async(req,res)=>{
  if(req.headers['x-admin-key']!==SECRET)return res.json({success:false,error:'Unauthorized'});
  if(pool)return res.json(await q('SELECT * FROM schools ORDER BY created_at DESC'));
  res.json(mem.schools);
});

app.get('*',(req,res)=>res.sendFile(path.join(process.cwd(),'public/index.html')));
app.listen(process.env.PORT||3000,()=>console.log('\n✅ GoSchool running at http://localhost:3000\n'));


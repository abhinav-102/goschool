var S=null,AC=null,AAC=null,MS=[],SCHOOL=null,QUIZ_Q=[],QUIZ_ANS=[],CUR_QUIZ=null;
window._cls=[];window._vcls=[];window._acls=[];

function $(id){return document.getElementById(id);}
function cap(s){return s?s.charAt(0).toUpperCase()+s.slice(1):'';}
function get(u){return fetch(u).then(r=>r.json());}
function post(u,d){return fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(r=>r.json());}
function del(u){return fetch(u,{method:'DELETE'}).then(r=>r.json());}
function patch(u,d){return fetch(u,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(r=>r.json());}
function showToast(m,type){
  var t=$('toast');if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 22px;border-radius:999px;font-size:13px;z-index:9999;opacity:0;transition:opacity .3s;font-weight:500';document.body.appendChild(t);}
  t.style.background=type==='error'?'#dc2626':type==='success'?'#16a34a':'#222';
  t.style.color='#fff';t.textContent=m;t.style.opacity='1';
  setTimeout(()=>{t.style.opacity='0';},3000);
}
function openModal(id){$('overlay').classList.remove('hidden');$(id).classList.remove('hidden');}
function closeAll(){$('overlay').classList.add('hidden');document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden'));}

// ===== SCHOOL DETECTION =====
async function detectSchool(){
  const host=window.location.hostname;
  const sub=host.split('.')[0];
  // If on main domain show landing
  if(sub==='goschool'||sub==='www'||sub==='localhost'||host==='localhost'){
    // Check if there's a school_id in localStorage
    const saved=localStorage.getItem('gs_school_id');
    if(saved){
      const r=await get('/api/school/'+saved);
      if(r.success){SCHOOL=r.school;initApp();}
      else{showLanding();}
    }else{showLanding();}
    return;
  }
  // Load school by subdomain
  const r=await get('/api/school/by-subdomain/'+sub);
  if(!r.success){showLanding();return;}
  if(r.expired){showExpired(r.school,r.expiry_type);return;}
  SCHOOL=r.school;
  initApp();
}

function showLanding(){$('pg-landing').classList.remove('hidden');$('pg-app').classList.add('hidden');$('pg-expired').classList.add('hidden');}

function showExpired(school,type){
  $('pg-expired').classList.remove('hidden');
  $('pg-app').classList.add('hidden');
  $('pg-landing').classList.add('hidden');
  $('exp-school-name').textContent=school.name;
  $('exp-message').textContent=type==='trial'?'Your free trial has ended.':'Your subscription has expired.';
}

function initApp(){
  if(!SCHOOL)return;
  document.title=SCHOOL.name+' — GoSchool';
  // Apply school branding
  document.documentElement.style.setProperty('--school-color',SCHOOL.color||'#1a237e');
  var accs=getAccounts();
  if(accs.length>0)showSwitcher();
  else{hideAll();$('pg-login').classList.remove('hidden');}
}

// ===== ACCOUNT SWITCHER =====
async function getAccounts(){
  if(!SCHOOL)return[];
  try{const r=await get('/api/switcher?school_id='+SCHOOL.id);return r||[];}catch(e){return[];}
}
async function addAccount(user,password){
  if(!SCHOOL)return;
  var entry={id:user.id,school_id:SCHOOL.id,name:user.name,role:user.role,class_id:user.class_id||'',class_name:'',enrollment:user.enrollment||'',email:user.email||'',password:password||''};
  try{await post('/api/switcher',entry);}catch(e){}
}
async function updateAccountPassword(id,password){
  try{await patch('/api/switcher/'+id+'/password',{password,school_id:SCHOOL.id});}catch(e){}
}
async function removeAccountById(id){
  try{await del('/api/switcher/'+id+'?school_id='+SCHOOL.id);}catch(e){}
}

function hideAll(){
  ['pg-landing','pg-app','pg-login','pg-switcher','pg-expired'].forEach(id=>{var el=$(id);if(el)el.classList.add('hidden');});
}

async function showSwitcher(){
  var accs=await getAccounts();
  hideAll();
  if(!accs||!accs.length){$('pg-login').classList.remove('hidden');return;}
  $('pg-switcher').classList.remove('hidden');
  var el=$('sw-accounts');
  // Set school branding on switcher
  $('sw-school-name').textContent=SCHOOL.name;
  $('sw-school-name').style.background=SCHOOL.color||'#1a237e';
  el.innerHTML=accs.map((a,i)=>{
    var ini=a.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    var bg=a.role==='admin'?'background:'+SCHOOL.color+';color:#fff':a.role==='teacher'?'background:#fdf3d0;color:#5a0a0a':'background:#dbeafe;color:#1d4ed8';
    var roleLabel=a.role==='admin'?'Principal':cap(a.role)+(a.class_name?' · '+a.class_name:'');
    return "<div class='sw-card' onclick='swLogin("+i+")'><div class='sw-avatar' style='"+bg+"'>"+ini+"</div><div style='flex:1'><div class='sw-name'>"+a.name+"</div><div class='sw-role'>"+roleLabel+"</div></div><button class='sw-edit' onclick='event.stopPropagation();swEditOpen("+i+")'>Edit</button></div>";
  }).join('');
}

async function swLogin(i){
  var accs=await getAccounts();
  var a=accs[i];if(!a)return;
  if(a.role==='admin'){
    hideAll();$('pg-pin').classList.remove('hidden');
    $('pin-avatar').textContent=a.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    $('pin-name').textContent=a.name;
    $('pp-pin').value='';$('pp-err').classList.add('hidden');
    $('pp-pin')._acc=a;setTimeout(()=>$('pp-pin').focus(),100);
  }else if(a.password){
    var d=await post('/api/login',{school_id:SCHOOL.id,email:a.enrollment||a.email,password:a.password});
    if(d.success){S=d.user;startApp();}
    else{
      hideAll();$('pg-login').classList.remove('hidden');
      setRole(a.role==='teacher'?'teacher':'student');
      $('lemail').value=a.enrollment||a.email;$('lpass').value='';
      $('back-sw-wrap').classList.remove('hidden');
      showToast('Enter your new password','');
      setTimeout(()=>$('lpass').focus(),150);
    }
  }else{
    hideAll();$('pg-login').classList.remove('hidden');
    setRole(a.role==='teacher'?'teacher':'student');
    $('lemail').value=a.enrollment||a.email;$('lpass').value='';
    $('back-sw-wrap').classList.remove('hidden');
  }
}

async function doPinLogin(){
  var pin=$('pp-pin').value.trim(),err=$('pp-err'),a=$('pp-pin')._acc;
  err.classList.add('hidden');
  if(!pin){err.textContent='Enter PIN.';err.classList.remove('hidden');return;}
  var d=await post('/api/school/login',{subdomain:SCHOOL.subdomain,pin});
  if(!d.success){err.textContent='Wrong PIN.';err.classList.remove('hidden');return;}
  S={id:a.id,name:a.name,email:a.email||'host@'+SCHOOL.subdomain+'.goschool.in',enrollment:'host',role:'admin',class_id:'all'};
  startApp();
}

var _swEditIdx=-1;
async function swEditOpen(i){
  _swEditIdx=i;
  var accs=await getAccounts();var a=accs[i];if(!a)return;
  $('sw-edit-info').textContent=a.name+' · '+cap(a.role);
  openModal('modal-sw-edit');
}
async function swEditAccount(){
  closeAll();
  var accs=await getAccounts();var a=accs[_swEditIdx];if(!a)return;
  hideAll();$('pg-login').classList.remove('hidden');
  if(a.role==='admin'){$('hpin').value='';}
  else{setRole(a.role==='teacher'?'teacher':'student');$('lemail').value=a.enrollment||a.email;$('lpass').value='';}
  $('back-sw-wrap').classList.remove('hidden');
}
async function swDeleteAccount(){
  closeAll();if(_swEditIdx<0)return;
  var accs=await getAccounts();var a=accs[_swEditIdx];
  if(a)await removeAccountById(a.id);
  showSwitcher();
}

// Pull to refresh
(function(){
  var startY=0,pulling=false;
  var sp=document.createElement('div');sp.id='ptr-spinner';document.body.appendChild(sp);
  document.addEventListener('touchstart',e=>{if(window.scrollY===0)startY=e.touches[0].clientY;},{passive:true});
  document.addEventListener('touchmove',e=>{if(!startY)return;if(e.touches[0].clientY-startY>60&&!pulling){pulling=true;sp.classList.add('visible');}},{passive:true});
  document.addEventListener('touchend',()=>{
    if(pulling){sp.classList.add('spinning');setTimeout(()=>{sp.classList.remove('visible','spinning');startY=0;pulling=false;
      var inApp=!$('pg-app').classList.contains('hidden');
      if(inApp){var cur=document.querySelector('.tab.active');if(cur)goTab(cur.dataset.tab,cur);}
      else showSwitcher();
    },800);}else startY=0;
  });
})();

window.addEventListener('load',async()=>{await detectSchool();});

// ===== LOGIN =====
function setRole(r){
  var si=$('btn-student'),ti=$('btn-teacher'),sc=SCHOOL?.color||'#1a237e';
  if(r==='student'){si.style.background=sc;si.style.color='#fff';si.style.borderColor=sc;ti.style.background='#fff';ti.style.color='#555';ti.style.borderColor='#ddd';$('login-id-label').textContent='Enrollment Number';$('lemail').placeholder='Enter enrollment number';$('lemail').type='text';}
  else{ti.style.background=sc;ti.style.color='#fff';ti.style.borderColor=sc;si.style.background='#fff';si.style.color='#555';si.style.borderColor='#ddd';$('login-id-label').textContent='Email';$('lemail').placeholder='Enter your email';$('lemail').type='email';}
}

async function hostLogin(){
  var pin=$('hpin').value.trim(),err=$('herr');err.classList.add('hidden');
  if(!pin){err.textContent='Enter PIN.';err.classList.remove('hidden');return;}
  var d=await post('/api/school/login',{subdomain:SCHOOL.subdomain,pin});
  if(!d.success){err.textContent='Wrong PIN.';err.classList.remove('hidden');$('hpin').value='';return;}
  S={id:'host',name:SCHOOL.principal||'Principal',email:'host@'+SCHOOL.subdomain+'.goschool.in',enrollment:'host',role:'admin',class_id:'all'};
  await addAccount(S,pin);startApp();
}

async function doLogin(){
  var email=$('lemail').value.trim(),pw=$('lpass').value,err=$('lerr');err.classList.add('hidden');
  if(!email||!pw){err.textContent='Enter credentials.';err.classList.remove('hidden');return;}
  var btn=document.querySelector('.btn-login');btn.textContent='Signing in...';btn.disabled=true;
  try{
    var d=await post('/api/login',{school_id:SCHOOL.id,email,password:pw});
    if(!d.success){err.textContent=d.error;err.classList.remove('hidden');btn.textContent='Sign in';btn.disabled=false;return;}
    S=d.user;await addAccount(S,pw);startApp();
  }catch(e){err.textContent='Cannot reach server.';err.classList.remove('hidden');btn.textContent='Sign in';btn.disabled=false;}
}

function doLogout(){S=null;AC=null;showSwitcher();}

// ===== CHANGE PASSWORD =====
function openChangePW(){$('cpw-cur').value='';$('cpw-new').value='';$('cpw-err').classList.add('hidden');openModal('modal-changepw');}
async function saveChangePW(){
  var cur=$('cpw-cur').value.trim(),np=$('cpw-new').value.trim(),err=$('cpw-err');err.classList.add('hidden');
  if(!cur||!np){err.textContent='Fill both.';err.classList.remove('hidden');return;}
  if(np.length<4){err.textContent='Min 4 chars.';err.classList.remove('hidden');return;}
  var d=await post('/api/profile',{id:S.id,school_id:SCHOOL.id,password:cur,new_password:np});
  if(!d.success){err.textContent=d.error||'Wrong password.';err.classList.remove('hidden');return;}
  S=Object.assign({},S,d.user);
  await updateAccountPassword(S.id,np);
  closeAll();showToast('Password changed!','success');
}

// ===== CHANGE PIN =====
function openChangePIN(){$('cpin-cur').value='';$('cpin-new').value='';$('cpin-err').classList.add('hidden');openModal('modal-changepin');}
async function saveChangePIN(){
  var cur=$('cpin-cur').value.trim(),np=$('cpin-new').value.trim(),err=$('cpin-err');err.classList.add('hidden');
  if(!cur||!np){err.textContent='Fill both.';err.classList.remove('hidden');return;}
  if(np.length<4){err.textContent='Min 4 digits.';err.classList.remove('hidden');return;}
  var d=await post('/api/settings',{school_id:SCHOOL.id,key:'prinpin',value:np});
  if(!d.success){err.textContent='Failed.';err.classList.remove('hidden');return;}
  closeAll();showToast('PIN changed!','success');
}

// ===== START APP =====
async function startApp(){
  hideAll();$('pg-app').classList.remove('hidden');
  // Apply school color
  var col=SCHOOL?.color||'#1a237e';
  document.documentElement.style.setProperty('--school-color',col);
  $('sbrole').textContent=cap(S.role);$('sbname').textContent=S.name;
  $('tbemail').textContent=S.enrollment||S.email;
  $('sb-school-name').textContent=SCHOOL?.name||'GoSchool';
  var isA=S.role==='admin',isT=S.role==='teacher'||isA;
  if(isA)document.querySelector('.tab-admin').classList.remove('hidden');
  if(isT){$('btn-aa').classList.remove('hidden');$('btn-at').classList.remove('hidden');$('btn-an').classList.remove('hidden');}
  await buildSB();
  if(AC&&S.role!=='admin'){
    try{await post('/api/switcher',{id:S.id,school_id:SCHOOL.id,name:S.name,role:S.role,class_id:S.class_id,class_name:AC.name,enrollment:S.enrollment||'',email:S.email||''});}catch(e){}
  }
  goTab('home',document.querySelector('.tab[data-tab=home]'));
}

async function buildSB(){
  var cls=await get('/api/classes?school_id='+SCHOOL.id);
  window._cls=cls;
  var sb=$('sbclasses');
  if(!cls.length){sb.innerHTML='<div class="sb-empty">No classes yet</div>';$('tbcls').textContent='--';return;}
  var visible=S.role==='admin'?cls:cls.filter(c=>c.id===S.class_id);
  window._vcls=visible;
  if(!AC&&visible.length)AC=visible[0];
  sb.innerHTML=visible.map((c,i)=>"<button class='sbcls"+(AC&&AC.id===c.id?' active':'')+"' onclick='switchClsByIdx("+i+",this)'>"+c.name+(c.section?' '+c.section:'')+"</button>").join('');
  $('tbcls').textContent=AC?AC.name+(AC.section?' '+AC.section:''):'--';
}

function switchClsByIdx(i,el){
  var cls=window._vcls[i];if(!cls)return;
  AC=cls;document.querySelectorAll('.sbcls').forEach(e=>e.classList.remove('active'));
  el.classList.add('active');$('tbcls').textContent=cls.name+(cls.section?' '+cls.section:'');
  var cur=document.querySelector('.tab.active');if(cur)goTab(cur.dataset.tab,cur);
}

function toggleSB(){$('sidebar').classList.toggle('open');}
document.addEventListener('click',e=>{if(!e.target.closest('.sidebar')&&!e.target.closest('.mbtn'))$('sidebar').classList.remove('open');});

function goTab(name,el){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>{p.classList.remove('active');p.classList.add('hidden');p.style.display='';});
  el.classList.add('active');var p=$('panel-'+name);if(!p)return;
  p.classList.remove('hidden');p.classList.add('active');p.style.display='flex';
  if(name==='home')loadHome();
  if(name==='notif'){$('notif-send-area').classList.toggle('hidden',S.role==='student');loadNotifications();}
  if(name==='assign')loadAssign();
  if(name==='marks')loadMarks();
  if(name==='quiz')loadQuiz();
  if(name==='attend')loadAttendance();
  if(name==='more')loadMore();
  if(name==='admin')loadAdmin();
}

// ===== HOME =====
async function loadHome(){
  var ini=S.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  $('pav').textContent=ini;
  var col=SCHOOL?.color||'#1a237e';
  $('pav').style.background=col;$('pstrip').style.background=col;
  $('pname').textContent=S.name;
  $('prole').textContent=S.role==='admin'?'Principal · '+SCHOOL.name:S.role==='teacher'?'Teacher - '+(AC?AC.name:'--'):'Student - '+(AC?AC.name:'--');
  $('pgrid').innerHTML=[['Name',S.name],['Role',cap(S.role)],['School',SCHOOL?.name||''],['Enrollment',S.enrollment||S.email||'']].map(p=>"<div class='ppill'><div class='ppill-l'>"+p[0]+"</div><div class='ppill-v'>"+p[1]+"</div></div>").join('');
  if(S.role!=='admin')$('changepwbtnwrap').classList.remove('hidden');
  else{$('changepwbtnwrap').classList.add('hidden');$('changepinbtnwrap').classList.remove('hidden');}
  if(S.role==='admin'){
    try{
      var u=await get('/api/users?school_id='+SCHOOL.id);
      var cl=await get('/api/classes?school_id='+SCHOOL.id);
      $('statrow').innerHTML=[[cl.length,'Classes'],[u.filter(x=>x.role==='teacher').length,'Teachers'],[u.filter(x=>x.role==='student').length,'Students']].map(s=>"<div class='sbox'><div class='sbox-n'>"+s[0]+"</div><div class='sbox-l'>"+s[1]+"</div></div>").join('');
    }catch(e){}
  }
  // Show trial warning
  if(SCHOOL?.plan==='trial'){
    var exp=new Date(SCHOOL.trial_expires);var now=new Date();var hrs=Math.round((exp-now)/3600000);
    $('trial-banner').classList.remove('hidden');
    $('trial-msg').textContent=hrs>0?'Free trial: '+hrs+' hours remaining':'Trial expired';
  }
}

// ===== NOTIFICATIONS =====
async function loadNotifications(){
  var el=$('notif-feed');if(!el)return;
  var n=await get('/api/notifications?school_id='+SCHOOL.id+'&class_id='+(AC?AC.id:'all'));
  if(!n.length){el.innerHTML='<div class="empty">No notifications yet.</div>';return;}
  var isT=S.role!=='student';
  el.innerHTML=n.map(x=>"<div class='notif-card'>"+(isT?"<button onclick=\"deleteNotif('"+x.id+"')\" class='notif-del'>✕</button>":"")+(x.image?"<img src='"+x.image+"' class='notif-img'>":"")+"<div class='notif-msg'>"+x.message+"</div><div class='notif-meta'>"+( x.sent_by||'School')+" · "+new Date(x.created_at).toLocaleString()+"</div></div>").join('');
}
async function deleteNotif(id){if(!confirm('Delete?'))return;await del('/api/notifications/'+id+'?school_id='+SCHOOL.id);loadNotifications();}
async function sendNotification(){
  var msg=$('notif-msg').value.trim(),fi=$('notif-img');if(!msg){alert('Enter message.');return;}
  var img=null;if(fi.files[0]){img=await new Promise(r=>{var rd=new FileReader();rd.onload=e=>r(e.target.result);rd.readAsDataURL(fi.files[0]);});}
  await post('/api/notifications',{school_id:SCHOOL.id,class_id:$('notif-target').value||AC?.id||'all',message:msg,image:img,sent_by:S.name});
  $('notif-msg').value='';fi.value='';loadNotifications();showToast('Sent!','success');
}

// ===== ASSIGNMENTS =====
async function loadAssign(){
  var list=$('alist');if(!AC){list.innerHTML='<div class="empty">No class selected.</div>';return;}
  $('atitle').textContent='Assignments — '+AC.name;
  var items=await get('/api/assignments?school_id='+SCHOOL.id+'&class_id='+AC.id);
  if(!items.length){list.innerHTML='<div class="empty">No assignments yet.</div>';return;}
  var today=new Date().toISOString().split('T')[0],isT=S.role!=='student';
  list.innerHTML=items.map(a=>{
    var bc=a.due_date<today?'ab-past':a.due_date===today?'ab-today':'ab-up';
    var bt=a.due_date<today?'Done':a.due_date===today?'Due today':'Due '+a.due_date;
    return "<div class='acard'><div class='acard-top'><div class='acard-title'>"+a.title+"</div><div style='display:flex;align-items:center;gap:6px'><span class='abadge "+bc+"'>"+bt+"</span>"+(isT?"<button class='delbtn' onclick=\"delAssign('"+a.id+"')\">✕</button>":"")+"</div></div>"+(a.subject?"<div class='acard-meta'>"+a.subject+(a.posted_by?' · by '+a.posted_by:'')+"</div>":"")+(a.description?"<div class='acard-desc'>"+a.description+"</div>":"")+"</div>";
  }).join('');
}
function openAM(){$('amtitle').value='';$('amsubj').value='';$('amdue').value='';$('amdesc').value='';openModal('modal-assign');}
async function submitAssign(){var t=$('amtitle').value.trim();if(!t){alert('Enter title.');return;}await post('/api/assignments',{school_id:SCHOOL.id,class_id:AC.id,title:t,subject:$('amsubj').value.trim(),due_date:$('amdue').value,description:$('amdesc').value.trim(),posted_by:S.name});closeAll();loadAssign();showToast('Assignment posted!','success');}
async function delAssign(id){if(!confirm('Delete?'))return;await del('/api/assignments/'+id+'?school_id='+SCHOOL.id);loadAssign();}

// ===== MARKS =====
async function loadMarks(){
  MS=[];renderSL();mView('results',document.querySelector('.mtab'));
  if(!AC){$('mresults').innerHTML='<div class="empty">No class selected.</div>';return;}
  var tests=await get('/api/tests?school_id='+SCHOOL.id+'&class_id='+AC.id);
  if(!tests.length){$('mresults').innerHTML='<div class="empty">No results yet.</div>';return;}
  var isT=S.role!=='student',h='';
  for(var i=0;i<tests.length;i++){
    var t=tests[i],marks=await get('/api/marks?school_id='+SCHOOL.id+'&test_id='+t.id);
    var filtered=S.role==='student'?marks.filter(m=>m.student_email===S.email):marks;
    h+="<div class='tcard'><div class='tcard-hdr'><div><div class='tcard-name'>"+t.name+(t.subject?' — '+t.subject:'')+"</div><div class='tcard-meta'>"+(t.test_date||'')+' Max: '+t.max_marks+"</div></div>"+(isT?"<div style='display:flex;gap:6px'><button onclick=\"openEditMarks('"+t.id+"','"+t.name+"','"+(t.subject||'')+"',"+t.max_marks+")\" class='btn-edit-sm'>✏️</button><button onclick=\"deleteTest('"+t.id+"')\" class='btn-del-sm'>🗑</button></div>":"")+"</div><table class='mtbl'><thead><tr><th>Rank</th><th>Student</th><th>Marks</th><th>Grade</th></tr></thead><tbody>"+filtered.map(m=>"<tr class='"+(m.rank<=3?'r'+m.rank:'')+"'><td><span class='rlbl'>"+m.rank_label+"</span></td><td>"+m.student_name+"</td><td>"+m.marks+'/'+t.max_marks+"</td><td>"+m.grade+"</td></tr>").join('')+"</tbody></table></div>";
  }
  $('mresults').innerHTML=h;
}
function mView(v,el){document.querySelectorAll('.mtab').forEach(t=>t.classList.remove('active'));el.classList.add('active');$('mresults').classList.toggle('hidden',v!=='results');$('madd').classList.toggle('hidden',v!=='add');if(v==='add')loadSL();}
async function loadSL(){if(!AC)return;try{window._sts=await get('/api/students?school_id='+SCHOOL.id+'&class_id='+AC.id);}catch(e){window._sts=[];}}
function searchByEnroll(){var q=$('st-enroll').value.trim(),dd=$('stdrop');if(!q){dd.classList.add('hidden');$('stsearch').value='';return;}var f=(window._sts||[]).filter(s=>(s.enrollment||'').startsWith(q)&&!MS.find(m=>m.email===s.email));if(!f.length){dd.classList.add('hidden');return;}dd.innerHTML=f.slice(0,8).map(s=>"<div class='acitem' data-name='"+s.name+"' data-email='"+s.email+"' data-enroll='"+(s.enrollment||'')+"' onclick='pickEnroll(this)'>"+s.enrollment+' — '+s.name+"</div>").join('');dd.classList.remove('hidden');}
function pickEnroll(el){$('stsearch').value=el.dataset.name;$('st-enroll').value=el.dataset.enroll;$('stdrop').classList.add('hidden');}
function addFromEnroll(){var name=$('stsearch').value.trim(),enroll=$('st-enroll').value.trim();if(!name){alert('Select a student.');return;}var found=(window._sts||[]).find(s=>s.enrollment===enroll||s.name===name);if(!found){alert('Student not found.');return;}if(MS.find(m=>m.email===found.email)){alert('Already added.');return;}MS.push({name:found.name,email:found.email,marks:''});$('st-enroll').value='';$('stsearch').value='';$('stdrop').classList.add('hidden');renderSL();}
function renderSL(){$('stlist').innerHTML=MS.map((s,i)=>"<div class='strow'><div class='stname'>"+s.name+"</div><input type='number' min='0' placeholder='Marks' value='"+s.marks+"' oninput='MS["+i+"].marks=this.value'><button class='stdel' onclick='MS.splice("+i+",1);renderSL()'>✕</button></div>").join('');}
async function submitMarks(){var name=$('tname').value.trim(),max=Number($('tmax').value),filled=MS.filter(s=>s.marks!=='');if(!name){alert('Enter test name.');return;}if(!max){alert('Enter max marks.');return;}if(!filled.length){alert('Add students.');return;}var d=await post('/api/marks',{school_id:SCHOOL.id,test_name:name,subject:$('tsubj').value.trim(),max_marks:max,test_date:$('tdate').value,class_id:AC.id,students:filled});if(d.success){showToast('Published!','success');MS=[];renderSL();$('tname').value='';loadMarks();}}
async function deleteTest(tid){if(!confirm('Delete?'))return;await del('/api/marks/test/'+tid+'?school_id='+SCHOOL.id);loadMarks();}
async function openEditMarks(tid,name,subj,max){$('em-test-id').value=tid;$('em-name').value=name;$('em-subj').value=subj;$('em-max').value=max;var marks=await get('/api/marks?school_id='+SCHOOL.id+'&test_id='+tid);$('em-students-list').innerHTML=marks.map((m,i)=>"<div class='strow'><div class='stname'>"+m.student_name+"</div><input type='number' min='0' value='"+m.marks+"' id='em-mark-"+i+"' data-email='"+m.student_email+"' data-name='"+m.student_name+"'></div>").join('');openModal('modal-editmarks');}
async function submitEditMarks(){var tid=$('em-test-id').value,max=Number($('em-max').value),name=$('em-name').value,subj=$('em-subj').value;var rows=document.querySelectorAll('[id^=em-mark-]');var students=Array.from(rows).map(inp=>({name:inp.dataset.name,email:inp.dataset.email,marks:inp.value}));await del('/api/marks/test/'+tid+'?school_id='+SCHOOL.id);var d=await post('/api/marks',{school_id:SCHOOL.id,test_name:name,subject:subj,max_marks:max,test_date:'',class_id:AC.id,students});if(d.success){closeAll();loadMarks();showToast('Updated!','success');}}
async function importExcel(){
  var fi=$('xl-file'),tname=$('tname').value.trim(),tmax=$('tmax').value,tsubj=$('tsubj').value.trim(),tdate=$('tdate').value;
  if(!fi.files[0]){alert('Select file.');return;}if(!tname){alert('Enter test name.');return;}if(!tmax){alert('Enter max marks.');return;}if(!AC){alert('Select class.');return;}
  var st=$('xl-status'),sc=$('xl-caption'),pr=$('xl-progress'),sp=$('xl-spinner');
  function ss(msg,pct,state){st.style.display='block';sc.textContent=msg;pr.style.width=pct+'%';if(state==='ok'){sp.style.animation='none';sp.style.borderTopColor='#16a34a';}if(state==='err'){sp.style.animation='none';sp.style.borderTopColor='#dc2626';}}
  sp.style.animation='spin 0.8s linear infinite';sp.style.borderTopColor='#1d4ed8';ss('Reading...',10);
  try{
    var file=fi.files[0],rows=[];
    if(file.name.endsWith('.csv')){var txt=await file.text();rows=txt.trim().split('\n').map(r=>r.split(',').map(c=>c.trim().replace(/"/g,'')));}
    else{if(!window.XLSX){await new Promise((res,rej)=>{var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});}var ab=await file.arrayBuffer();var wb=window.XLSX.read(ab,{type:'array'});rows=window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});}
    ss('Parsing...',40);
    var h=rows[0].map(x=>String(x).toLowerCase().trim());
    var ni=h.findIndex(x=>x.includes('name')),ei=h.findIndex(x=>x.includes('enroll')||x.includes('roll')),mi=h.findIndex(x=>x.includes('mark')||x.includes('score'));
    if(ni===-1)throw new Error('No Name column');if(mi===-1)throw new Error('No Marks column');
    var students=[];
    for(var i=1;i<rows.length;i++){var row=rows[i],name=String(row[ni]||'').trim(),marks=String(row[mi]||'').trim(),enroll=ei>=0?String(row[ei]||'').trim():'';if(!name||!marks||isNaN(Number(marks)))continue;var found=(window._sts||[]).find(s=>s.enrollment===enroll||s.name===name);students.push({name,email:found?found.email:enroll+'@school.in',marks});}
    if(!students.length)throw new Error('No valid data');
    ss('Publishing '+students.length+' students...',80);
    var d=await post('/api/marks',{school_id:SCHOOL.id,test_name:tname,subject:tsubj||'',max_marks:Number(tmax),test_date:tdate,class_id:AC.id,students});
    if(!d.success)throw new Error(d.error||'Server error');
    ss('Done! '+students.length+' uploaded!',100,'ok');
    setTimeout(()=>{st.style.display='none';sp.style.animation='spin 0.8s linear infinite';$('xl-file').value='';$('tname').value='';MS=[];renderSL();loadMarks();showToast('Imported!','success');},2000);
  }catch(e){ss('Error: '+e.message,0,'err');}
}

// ===== AI QUIZ =====
async function loadQuiz(){
  var isT=S.role!=='student';
  $('quiz-teacher-section').classList.toggle('hidden',!isT);
  $('quiz-student-section').classList.toggle('hidden',isT&&S.role!=='admin');
  if(!AC)return;
  loadQuizList();
}
async function loadQuizList(){
  if(!AC)return;
  var quizzes=await get('/api/quizzes?school_id='+SCHOOL.id+'&class_id='+AC.id);
  var isT=S.role!=='student';
  $('quiz-list').innerHTML=quizzes.length?quizzes.map(qz=>"<div class='qcard'><div class='qcard-title'>"+qz.title+"</div><div class='qcard-meta'>"+qz.subject+' · '+qz.difficulty+' · '+(typeof qz.questions==='string'?JSON.parse(qz.questions):qz.questions).length+" questions</div><button class='btn-gold' onclick='startQuiz(\""+qz.id+"\")'>Take quiz</button></div>").join(''):'<div class="empty">No quizzes yet.</div>';
}
async function generateQuiz(){
  var topic=$('quiz-topic').value.trim(),diff=$('quiz-diff').value,cnt=$('quiz-count').value;
  if(!topic){alert('Enter topic.');return;}if(!AC){alert('Select class.');return;}
  $('gen-btn').textContent='Generating...';$('gen-btn').disabled=true;
  var d=await post('/api/quiz/generate',{school_id:SCHOOL.id,topic,difficulty:diff,count:parseInt(cnt),subject:$('quiz-subj').value,class_name:AC?.name});
  $('gen-btn').textContent='Generate with AI';$('gen-btn').disabled=false;
  if(!d.success){alert('Failed: '+d.error);return;}
  QUIZ_Q=d.questions;
  $('quiz-questions-list').innerHTML=d.questions.map((q,i)=>"<div class='qq-item'><label><input type='checkbox' checked data-qi='"+i+"'> Q"+(i+1)+". "+q.q+"</label></div>").join('');
  $('quiz-preview').classList.remove('hidden');
}
async function publishQuiz(){
  var selected=Array.from(document.querySelectorAll('#quiz-questions-list input:checked')).map(cb=>QUIZ_Q[parseInt(cb.dataset.qi)]);
  if(!selected.length){alert('Select at least one question.');return;}
  var d=await post('/api/quizzes',{school_id:SCHOOL.id,class_id:AC.id,title:$('quiz-topic').value+' Quiz',subject:$('quiz-subj').value,difficulty:$('quiz-diff').value,questions:selected,created_by:S.name});
  if(d.success){$('quiz-preview').classList.add('hidden');$('quiz-topic').value='';QUIZ_Q=[];showToast('Quiz published!','success');loadQuizList();}
}
async function startQuiz(qid){
  var quizzes=await get('/api/quizzes?school_id='+SCHOOL.id+'&class_id='+AC.id);
  var qz=quizzes.find(q=>q.id===qid);if(!qz)return;
  CUR_QUIZ=qz;
  var qs=typeof qz.questions==='string'?JSON.parse(qz.questions):qz.questions;
  QUIZ_ANS=new Array(qs.length).fill(-1);
  $('quiz-take-title').textContent=qz.title;
  $('quiz-take-body').innerHTML=qs.map((q,i)=>"<div class='qt-item'><div class='qt-q'><b>Q"+(i+1)+".</b> "+q.q+"</div><div class='qt-opts'>"+q.opts.map((o,j)=>"<div class='qt-opt' onclick='pickAns("+i+","+j+",this)'>"+o+"</div>").join('')+"</div></div>").join('');
  openModal('modal-take-quiz');
}
function pickAns(qi,ai,el){
  QUIZ_ANS[qi]=ai;
  var item=el.closest('.qt-item');
  item.querySelectorAll('.qt-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
}
async function submitQuiz(){
  var qs=typeof CUR_QUIZ.questions==='string'?JSON.parse(CUR_QUIZ.questions):CUR_QUIZ.questions;
  if(QUIZ_ANS.includes(-1)){if(!confirm('You have unanswered questions. Submit anyway?'))return;}
  var d=await post('/api/quiz/submit',{school_id:SCHOOL.id,quiz_id:CUR_QUIZ.id,student_id:S.id,student_name:S.name,answers:QUIZ_ANS,questions:qs});
  closeAll();
  if(d.success){
    showToast('Score: '+d.score+'/'+d.total+' ('+d.percentage+'%)','success');
    loadQuizList();
  }
}

// ===== ATTENDANCE =====
async function loadAttendance(){
  var isT=S.role!=='student';
  $('attend-teacher').classList.toggle('hidden',!isT);
  $('attend-student').classList.toggle('hidden',isT);
  if(isT)loadAttendanceTeacher();
  else loadAttendanceStudent();
}
async function loadAttendanceTeacher(){
  if(!AC)return;
  var date=new Date().toISOString().split('T')[0];
  $('attend-date').value=date;
  var students=await get('/api/students?school_id='+SCHOOL.id+'&class_id='+AC.id);
  var existing=await get('/api/attendance?school_id='+SCHOOL.id+'&class_id='+AC.id+'&date='+date);
  var existMap={};existing.forEach(a=>existMap[a.student_id]=a.status);
  $('attend-list').innerHTML=students.map(s=>"<div class='attend-row'><div class='attend-name'>"+s.name+"</div><div class='attend-btns'><button class='abtn"+(existMap[s.id]==='P'?' present':'')+"' onclick='setAttend(\""+s.id+"\",\"P\",this)'>P</button><button class='abtn"+(existMap[s.id]==='A'?' absent':'')+"' onclick='setAttend(\""+s.id+"\",\"A\",this)'>A</button><button class='abtn"+(existMap[s.id]==='L'?' late':'')+"' onclick='setAttend(\""+s.id+"\",\"L\",this)'>L</button></div></div>").join('');
  window._attendRecords={};existing.forEach(a=>window._attendRecords[a.student_id]=a.status);
}
function setAttend(sid,status,btn){
  var row=btn.closest('.attend-row');
  row.querySelectorAll('.abtn').forEach(b=>{b.classList.remove('present','absent','late');});
  if(status==='P')btn.classList.add('present');
  if(status==='A')btn.classList.add('absent');
  if(status==='L')btn.classList.add('late');
  if(!window._attendRecords)window._attendRecords={};
  window._attendRecords[sid]=status;
}
function markAllPresent(){
  document.querySelectorAll('.attend-row').forEach(row=>{
    var pbtn=row.querySelectorAll('.abtn')[0];
    var sid=row.querySelector('.abtn').getAttribute('onclick').match(/"([^"]+)"/)[1];
    row.querySelectorAll('.abtn').forEach(b=>{b.classList.remove('present','absent','late');});
    pbtn.classList.add('present');
    if(!window._attendRecords)window._attendRecords={};
    window._attendRecords[sid]='P';
  });
}
async function saveAttendance(){
  var date=$('attend-date').value;
  var records=Object.entries(window._attendRecords||{}).map(([student_id,status])=>({student_id,status}));
  if(!records.length){alert('Mark attendance first.');return;}
  await post('/api/attendance',{school_id:SCHOOL.id,class_id:AC.id,date,records,marked_by:S.name});
  showToast('Attendance saved!','success');
}
async function loadAttendanceStudent(){
  var records=await get('/api/attendance?school_id='+SCHOOL.id+'&student_id='+S.id);
  var present=records.filter(r=>r.status==='P').length;
  var total=records.length;
  var pct=total?Math.round(present/total*100):0;
  $('attend-pct').textContent=pct+'%';
  $('attend-pct').style.color=pct>=75?'#16a34a':'#dc2626';
  // Build calendar
  var byDate={};records.forEach(r=>byDate[r.date]=r.status);
  var months={};records.forEach(r=>{var m=r.date.slice(0,7);if(!months[m])months[m]=[];months[m].push(r.date);});
  $('attend-calendar').innerHTML=Object.entries(months).map(([month,dates])=>{
    var days=[];for(var d=1;d<=31;d++){var dt=month+'-'+(d<10?'0'+d:d);if(byDate[dt])days.push("<div class='cal-day "+(byDate[dt]==='P'?'cal-p':byDate[dt]==='A'?'cal-a':'cal-l')+"'>"+d+"</div>");}
    return "<div class='cal-month'><div class='cal-month-title'>"+new Date(month+'-01').toLocaleDateString('en',{month:'long',year:'numeric'})+"</div><div class='cal-days'>"+days.join('')+"</div></div>";
  }).join('')||'<div class="empty">No attendance records yet.</div>';
}

// ===== MORE TAB =====
async function loadMore(){
  $('more-fees').classList.toggle('hidden',S.role==='student'&&!true);
  loadEvents();loadMaterials();loadComplaints();
  if(S.role!=='student')loadFees();
}
async function loadEvents(){
  var events=await get('/api/events?school_id='+SCHOOL.id);
  $('events-list').innerHTML=events.length?events.map(e=>"<div class='event-card'><div class='event-date'>"+e.date+"</div><div class='event-title'>"+e.title+"</div><div class='event-desc'>"+e.description+"</div></div>").join(''):'<div class="empty">No events.</div>';
}
function openEventModal(){$('ev-title').value='';$('ev-date').value='';$('ev-desc').value='';openModal('modal-event');}
async function submitEvent(){var t=$('ev-title').value.trim();if(!t)return;await post('/api/events',{school_id:SCHOOL.id,title:t,date:$('ev-date').value,description:$('ev-desc').value});closeAll();loadEvents();showToast('Event added!','success');}
async function loadMaterials(){
  if(!AC)return;
  var mats=await get('/api/materials?school_id='+SCHOOL.id+'&class_id='+AC.id);
  $('materials-list').innerHTML=mats.length?mats.map(m=>"<div class='mat-card'><div class='mat-title'>"+m.title+"</div><div class='mat-meta'>"+m.subject+' · '+m.type+"</div>"+(m.url?"<a href='"+m.url+"' target='_blank' class='mat-link'>Open →</a>":"")+"</div>").join(''):'<div class="empty">No materials yet.</div>';
}
function openMatModal(){$('mat-title').value='';$('mat-subj').value='';$('mat-url').value='';openModal('modal-material');}
async function submitMaterial(){var t=$('mat-title').value.trim();if(!t)return;await post('/api/materials',{school_id:SCHOOL.id,class_id:AC?.id,title:t,subject:$('mat-subj').value,type:'link',url:$('mat-url').value,uploaded_by:S.name});closeAll();loadMaterials();showToast('Material added!','success');}
async function loadFees(){
  var fees=await get('/api/fees?school_id='+SCHOOL.id+(S.role==='student'?'&student_id='+S.id:''));
  $('fees-list').innerHTML=fees.length?fees.map(f=>"<div class='fee-card'><div class='fee-row'><span class='fee-desc'>"+f.description+"</span><span class='fee-amt'>₹"+f.amount+"</span></div><div class='fee-row'><span class='fee-paid'>Paid: ₹"+f.paid+"</span><span class='fee-status badge-"+(f.status==='paid'?'green':'red')+"'>"+f.status+"</span></div></div>").join(''):'<div class="empty">No fees.</div>';
}
async function loadComplaints(){
  var c=await get('/api/complaints?school_id='+SCHOOL.id);
  $('complaints-list').innerHTML=c.length?c.map(x=>"<div class='complaint-card'><div class='complaint-msg'>"+x.message+"</div><div class='complaint-meta'>"+x.from_name+' · '+x.type+" · <span class='badge-"+(x.status==='resolved'?'green':'amber')+"'>"+x.status+"</span></div></div>").join(''):'<div class="empty">No complaints.</div>';
}
function openComplaintModal(){$('comp-msg').value='';$('comp-type').value='general';openModal('modal-complaint');}
async function submitComplaint(){var m=$('comp-msg').value.trim();if(!m)return;await post('/api/complaints',{school_id:SCHOOL.id,from_id:S.id,from_name:S.name,message:m,type:$('comp-type').value});closeAll();loadComplaints();showToast('Complaint submitted!','success');}

// ===== AI CHAT =====
async function sendAIChat(){
  var msg=$('ai-msg').value.trim();if(!msg)return;
  var feed=$('ai-feed');
  var ub=document.createElement('div');ub.className='chat-bubble chat-user';ub.textContent=msg;feed.appendChild(ub);
  $('ai-msg').value='';feed.scrollTop=feed.scrollHeight;
  var ab=document.createElement('div');ab.className='chat-bubble chat-ai';ab.textContent='Thinking...';feed.appendChild(ab);
  try{
    var d=await post('/api/ai/chat',{school_id:SCHOOL.id,message:msg});
    ab.textContent=d.reply||'Got it! Making that change.';
  }catch(e){ab.textContent='Got it! I will update your app shortly.';}
  feed.scrollTop=feed.scrollHeight;
}

// ===== ADMIN =====
async function loadAdmin(){buildAStats();buildCGrid();}
async function buildAStats(){
  try{
    var u=await get('/api/users?school_id='+SCHOOL.id);
    var cl=await get('/api/classes?school_id='+SCHOOL.id);
    $('adstats').innerHTML=[[cl.length,'Classes'],[u.filter(x=>x.role==='teacher').length,'Teachers'],[u.filter(x=>x.role==='student').length,'Students']].map(s=>"<div class='astat'><div class='astat-n'>"+s[0]+"</div><div class='astat-l'>"+s[1]+"</div></div>").join('');
  }catch(e){}
}
async function buildCGrid(){
  var cls=await get('/api/classes?school_id='+SCHOOL.id);window._acls=cls;
  if(!cls.length){$('clsgrid').innerHTML='<div class="empty">No classes yet.</div>';return;}
  if(!AAC)AAC=cls[0];
  $('clsgrid').innerHTML='<div class="clsgrid">'+cls.map((c,i)=>"<div class='clsblock"+(AAC&&AAC.id===c.id?' sel':'')+"' onclick='selClsByIdx("+i+",this)'><div><div class='clsname'>"+c.name+(c.section?' '+c.section:'')+"</div><div class='clsmeta' id='cm-"+c.id+"'>...</div></div><button class='clsdel' onclick='event.stopPropagation();delCls(\""+c.id+"\")'>🗑</button></div>").join('')+'</div>';
  cls.forEach(async c=>{try{var u=await get('/api/users?school_id='+SCHOOL.id+'&class_id='+c.id);var el=$('cm-'+c.id);if(el){var s=u.filter(x=>x.role==='student').length,t=u.find(x=>x.role==='teacher');el.textContent=s+' students'+(t?' · '+t.name.split(' ')[0]:'');}}catch(e){}});
  loadUTable();
}
function selClsByIdx(i,el){var cls=window._acls[i];if(!cls)return;AAC=cls;document.querySelectorAll('.clsblock').forEach(b=>b.classList.remove('sel'));el.classList.add('sel');$('usectitle').textContent='Users — '+cls.name;loadUTable();}
async function delCls(id){if(!confirm('Delete class?'))return;await del('/api/classes/'+id+'?school_id='+SCHOOL.id);if(AAC&&AAC.id===id)AAC=null;loadAdmin();buildSB();}
async function loadUTable(){
  if(!AAC){$('usertbl').innerHTML='<div class="empty">Select a class.</div>';return;}
  $('usectitle').textContent='Users — '+AAC.name;
  var u=await get('/api/users?school_id='+SCHOOL.id+'&class_id='+AAC.id+'&showpwd=1');
  if(!u.length){$('usertbl').innerHTML='<div class="empty">No users yet.</div>';return;}
  $('usertbl').innerHTML='<table class="utbl"><thead><tr><th>Name</th><th>ID</th><th>Password</th><th>Role</th><th></th></tr></thead><tbody>'+u.map(u=>"<tr><td style='font-weight:600'>"+u.name+"</td><td style='font-size:12px;color:#888;font-family:monospace'>"+(u.enrollment||u.email)+"</td><td style='font-size:12px;color:#555;font-family:monospace'>"+(u.password||'--')+"</td><td><span class='rpill "+(u.role==='teacher'?'rpt':'rps')+"'>"+u.role+"</span></td><td><button class='tbtn' onclick=\"editU('"+u.id+"','"+u.name+"')\">✏️</button><button class='tbtn danger' onclick=\"delU('"+u.id+"')\">🗑</button></td></tr>").join('')+'</tbody></table>';
}
function openCM(){$('cmname').value='';$('cmsection').value='';$('cmerr').classList.add('hidden');openModal('modal-class');}
async function submitClass(){
  var name=$('cmname').value.trim(),err=$('cmerr');err.classList.add('hidden');
  if(!name){err.textContent='Enter name.';err.classList.remove('hidden');return;}
  var d=await post('/api/classes',{school_id:SCHOOL.id,name,section:$('cmsection').value.trim()});
  if(!d.success){
    if(d.error==='trial_limit'){err.innerHTML='Free trial: 1 class only. <a href="/pricing" style="color:var(--accent)">Upgrade now</a>';err.classList.remove('hidden');return;}
    err.textContent=d.error;err.classList.remove('hidden');return;
  }
  closeAll();loadAdmin();buildSB();showToast('Class added!','success');
}
async function openUM(){
  $('umname').value='';$('umemail').value='';$('umerr').classList.add('hidden');
  var cl=await get('/api/classes?school_id='+SCHOOL.id);
  $('umclass').innerHTML=cl.length?cl.map(c=>"<option value='"+c.id+"'>"+c.name+(c.section?' '+c.section:'')+"</option>").join(''):'<option value="">No classes</option>';
  updateUserModal($('umrole').value);openModal('modal-user');
}
function updateUserModal(role){var lbl=$('um-id-label'),inp=$('umemail');if(!lbl||!inp)return;if(role==='teacher'){lbl.textContent='Email';inp.placeholder='Enter email';inp.type='email';}else{lbl.textContent='Enrollment Number';inp.placeholder='Enter enrollment number';inp.type='text';}}
async function submitUser(){
  var name=$('umname').value.trim(),email=$('umemail').value.trim(),role=$('umrole').value,class_id=$('umclass').value,err=$('umerr');err.classList.add('hidden');
  if(!name||!email){err.textContent='Fill all fields.';err.classList.remove('hidden');return;}
  var userObj=role==='teacher'?{name,email,role,class_id}:{name,enrollment:email,role,class_id};
  var d=await post('/api/users',{action:'add',school_id:SCHOOL.id,user:userObj});
  if(!d.success){
    if(d.error==='trial_limit'){err.innerHTML='Free trial: 30 students only. <a href="/pricing" style="color:var(--accent)">Upgrade now</a>';err.classList.remove('hidden');return;}
    err.textContent=d.error;err.classList.remove('hidden');return;
  }
  closeAll();loadAdmin();buildSB();
  showAchievement(name,role,d.generatedPassword||'welcome123');
}
async function delU(id){if(!confirm('Remove?'))return;await post('/api/users',{action:'remove',school_id:SCHOOL.id,user:{id}});loadUTable();buildAStats();}
async function editU(id,name){var n=prompt('Edit name:',name);if(!n)return;await post('/api/users',{action:'edit',school_id:SCHOOL.id,user:{id,name:n}});loadUTable();}

function showAchievement(name,role,pwd){
  var col=SCHOOL?.color||'#1a237e';
  var o=document.createElement('div');o.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center';
  o.innerHTML="<div style='background:linear-gradient(135deg,"+col+"cc,"+col+");border-radius:16px;padding:40px;max-width:400px;width:90%;text-align:center;border:2px solid rgba(255,255,255,.2)'><div style='font-size:48px;margin-bottom:10px'>"+(role==='teacher'?'👩‍🏫':'🎓')+"</div><div style='font-size:12px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px'>Welcome to "+SCHOOL.name+"</div><div style='font-size:26px;font-weight:700;color:#fff;margin-bottom:6px'>"+name+"</div><div style='font-size:13px;color:rgba(255,255,255,.6);margin-bottom:20px'>"+cap(role)+" Account</div><div style='background:rgba(0,0,0,.3);border-radius:10px;padding:16px;margin-bottom:20px'><div style='font-size:11px;color:rgba(255,255,255,.5);margin-bottom:6px'>PASSWORD</div><div style='font-size:32px;font-weight:700;color:#fff;letter-spacing:.1em'>"+pwd+"</div></div><button onclick='this.parentElement.parentElement.remove()' style='background:rgba(255,255,255,.2);color:#fff;border:2px solid rgba(255,255,255,.3);border-radius:999px;padding:10px 32px;font-size:14px;font-weight:700;cursor:pointer'>Got it ✓</button></div>";
  document.body.appendChild(o);
}

// ===== LANDING PAGE (for goschool.in) =====
function showOnboard(){document.getElementById('onboard-overlay').classList.remove('hidden');document.body.style.overflow='hidden';}
function hideOnboard(){document.getElementById('onboard-overlay').classList.add('hidden');document.body.style.overflow='';}

var _onboardStep=1;
var _schoolData={name:'',city:'',color:'#1a237e',features:[],principal:'',tagline:''};

function obNext(n){
  if(n===2){
    _schoolData.name=document.getElementById('s-name')?.value||'';
    _schoolData.city=document.getElementById('s-city')?.value||'';
    _schoolData.principal=document.getElementById('s-principal')?.value||'Principal';
    _schoolData.tagline=document.getElementById('s-tagline')?.value||'Excellence in Education';
  }
  _onboardStep=n;
  document.querySelectorAll('.ob-screen').forEach(s=>s.classList.remove('active'));
  var sc=document.getElementById('obs'+n);if(sc)sc.classList.add('active');
  document.querySelectorAll('.ob-step').forEach(s=>{
    var sn=parseInt(s.dataset.s);s.classList.remove('active','done');
    var dot=s.querySelector('.ob-dot');
    if(sn<n){s.classList.add('done');dot.innerHTML='✓';}
    else if(sn===n){s.classList.add('active');dot.textContent=sn;}
    else dot.textContent=sn;
  });
  if(n===3){
    var simName=document.getElementById('sim-name');
    if(simName)simName.textContent=_schoolData.name||'Your School';
    var simBar=document.getElementById('sim-topbar');
    if(simBar)simBar.style.background=_schoolData.color;
    var url=((_schoolData.name||'school').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,10))+'.goschool.in';
    var su=document.getElementById('success-url');if(su)su.textContent=url;
  }
}

function pickC(el,col){
  _schoolData.color=col;
  document.querySelectorAll('.color-row .cswatch').forEach(s=>s.classList.remove('sel'));
  el.classList.add('sel');
}
function simColor(el,col){
  _schoolData.color=col;
  document.querySelectorAll('#obs3 .cswatch').forEach(s=>s.classList.remove('sel'));
  el.classList.add('sel');
  var b=document.getElementById('sim-topbar');if(b)b.style.background=col;
}

var _aiReplies={
  'colour':['Done! Primary colour updated. Your app header and buttons now use the new colour.'],
  'green':['Dark green applied! Your app now uses forest green as the primary colour.'],
  'library':['Library module added! Students can browse books, teachers can manage the catalogue.'],
  'fee':['Fee management removed from your app.'],
  'telugu':['Telugu language support added! Users can switch between English and Telugu.'],
  'whatsapp':['WhatsApp notifications enabled! Parents get alerts for attendance, marks, and fees.'],
  'rename':['Tab renamed across the entire app.'],
  'bus':['Bus tracking added! Parents can see live bus location.'],
};
function qsend(msg){var inp=document.getElementById('ai-inp');if(inp){inp.value=msg;sendAILanding();}}
async function sendAILanding(){
  var inp=document.getElementById('ai-inp');
  var msg=inp?.value.trim();if(!msg)return;
  var feed=document.getElementById('ai-chat-body');if(!feed)return;
  var ub=document.createElement('div');ub.className='chat-bubble chat-user';ub.textContent=msg;feed.appendChild(ub);
  inp.value='';
  var ab=document.createElement('div');ab.className='chat-bubble chat-ai';ab.textContent='Thinking...';feed.appendChild(ab);
  feed.scrollTop=feed.scrollHeight;
  try{
    var res=await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({school_id:'onboard',message:msg})});
    var data=await res.json();ab.textContent=data.reply||'Got it!';
  }catch(e){
    var key=Object.keys(_aiReplies).find(k=>msg.toLowerCase().includes(k));
    ab.textContent=key?_aiReplies[key][0]:'Got it! Making that change to your app now.';
  }
  feed.scrollTop=feed.scrollHeight;
}

var _curPlan='School',_curPrice='2499';
function selPlan(el,name,price){
  _curPlan=name;_curPrice=price;
  document.querySelectorAll('.price-card').forEach(c=>c.classList.remove('featured'));
  el.classList.add('featured');
  var btn=document.getElementById('deploy-plan-btn');
  if(btn)btn.textContent='Deploy — '+name+' plan'+(price!=='custom'?' · ₹'+price+'/mo':'')+' →';
}

async function deployApp(){
  var features=[];
  document.querySelectorAll('#feature-grid .ft-item.enabled').forEach(item=>features.push(item.dataset.f));
  _schoolData.features=features;
  _schoolData.subdomain=(_schoolData.name||'school').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,10);
  var d=await post('/api/school/register',_schoolData);
  if(d.success){
    localStorage.setItem('gs_school_id',d.school.id);
    obNext(6);
    var url=document.getElementById('success-url');if(url)url.textContent=d.subdomain;
  }else{alert('Registration failed. Try again.');}
}

function toggleFeat(toggle){
  toggle.classList.toggle('on');
  toggle.closest('.ft-item').classList.toggle('enabled',toggle.classList.contains('on'));
}

async function submitContact(e){
  e.preventDefault();
  try{await fetch('/api/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({school_name:document.getElementById('c-school')?.value,email:document.getElementById('c-email')?.value,phone:document.getElementById('c-phone')?.value,message:document.getElementById('c-msg')?.value})});}catch(err){}
  var s=document.getElementById('contact-success');if(s)s.classList.remove('hidden');
}

function simRole(role,btn){
  document.querySelectorAll('#obs3 button[onclick^="simRole"]').forEach(b=>{b.style.borderColor='var(--border)';b.style.background='#fff';b.style.color='var(--muted)';});
  btn.style.borderColor='var(--accent)';btn.style.background='#E6F1FB';btn.style.color='#0C447C';
  var previewData={
    student:{n1:'89%',l1:'Attend',n2:'3rd',l2:'Rank',n3:'2',l3:'Pending',notif:'Unit test Monday — Maths ch.4'},
    teacher:{n1:'42',l1:'Students',n2:'3',l2:'Classes',n3:'87%',l3:'Avg',notif:'Mark attendance by 9 AM'},
    principal:{n1:'487',l1:'Students',n2:'28',l2:'Teachers',n3:'91%',l3:'Attend',notif:'Fee collection: 73% done'},
  };
  var d=previewData[role];
  var b=document.getElementById('sim-body');
  if(b){b.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px"><div class="pstat"><div class="pstat-n">'+d.n1+'</div><div class="pstat-l">'+d.l1+'</div></div><div class="pstat"><div class="pstat-n">'+d.n2+'</div><div class="pstat-l">'+d.l2+'</div></div><div class="pstat"><div class="pstat-n">'+d.n3+'</div><div class="pstat-l">'+d.l3+'</div></div></div><div class="pcard"><div style="font-size:10px;font-weight:600;margin-bottom:4px">Notification</div><div style="font-size:9px;color:#888">'+d.notif+'</div></div>';}
}


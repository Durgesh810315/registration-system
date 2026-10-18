let csrfToken = '';
let currentPage = 1, totalPages = 1, editingId = null, modal;
const $ = id => document.getElementById(id);
const message = $('message');
function show(text,type='danger'){message.textContent=text;message.className=`alert alert-${type}`;}
function escapeHtml(value){return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function api(path, options={}) {
  const headers = {...(options.headers||{})};
  if(options.method && options.method!=='GET') headers['X-CSRF-Token']=csrfToken;
  const res=await fetch(`${API_BASE}${path}`,{...options,headers,credentials:'include'});
  const data = res.status===204 ? {} : await res.json().catch(()=>({}));
  if(res.status===401){location.href='admin-login.html';throw new Error('Please sign in again.');}
  if(!res.ok) throw new Error(data.error||'Request failed.');
  return data;
}
async function init(){
  try{
    const [token,session]=await Promise.all([
      fetch(`${API_BASE}/api/csrf-token`,{credentials:'include'}).then(r=>r.json()),
      fetch(`${API_BASE}/api/auth/session`,{credentials:'include'}).then(r=>r.json())
    ]);
    csrfToken=token.csrfToken;
    if(!session.authenticated){location.href='admin-login.html';return;}
    $('adminName').textContent=`${session.admin.username} (${session.admin.role})`;
    modal=new bootstrap.Modal($('userModal'));
    await Promise.all([loadStats(),loadUsers()]);
  }catch(e){show(e.message==='Failed to fetch'?'Cannot connect to the backend. Check API_BASE and server status.':e.message);}
}
async function loadStats(){
 const d=await api('/api/admin/stats');
 $('totalUsers').textContent=d.total; $('todayUsers').textContent=d.today;
 $('recentList').replaceChildren();
 if(!d.recent.length){$('recentList').textContent='No registrations yet.';return;}
 d.recent.forEach(u=>{const p=document.createElement('p');p.className='mb-2';p.textContent=`${u.fullName} · ${u.email} · ${new Date(u.createdAt).toLocaleString()}`;$('recentList').appendChild(p);});
}
function queryString(){
 const p=new URLSearchParams({page:currentPage,limit:10});
 if($('search').value.trim())p.set('search',$('search').value.trim());
 if($('education').value.trim())p.set('education',$('education').value.trim());
 if($('status').value)p.set('status',$('status').value);
 if($('from').value)p.set('from',$('from').value);
 if($('to').value)p.set('to',$('to').value);
 return p.toString();
}
async function loadUsers(){
 $('usersBody').innerHTML='<tr><td colspan="8">Loading…</td></tr>';
 const d=await api(`/api/admin/users?${queryString()}`); totalPages=Math.max(1,d.pagination.pages);
 $('usersBody').replaceChildren();
 if(!d.users.length){$('usersBody').innerHTML='<tr><td colspan="8">No registrations match these filters.</td></tr>';}
 d.users.forEach(u=>{
  const tr=document.createElement('tr');
  tr.innerHTML=`<td>${u.id}</td><td>${escapeHtml(u.fullName)}</td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.mobile)}</td><td>${escapeHtml(u.education)}</td><td><span class="badge text-bg-${u.accountStatus==='active'?'success':u.accountStatus==='blocked'?'danger':'secondary'}">${escapeHtml(u.accountStatus)}</span></td><td>${new Date(u.createdAt).toLocaleDateString()}</td><td class="text-nowrap"><button class="btn btn-outline-primary action-btn view-btn">View / Edit</button> <button class="btn btn-outline-danger action-btn delete-btn">Delete</button></td>`;
  tr.querySelector('.view-btn').addEventListener('click',()=>openUser(u.id));
  tr.querySelector('.delete-btn').addEventListener('click',()=>deleteUser(u.id,u.fullName));
  $('usersBody').appendChild(tr);
 });
 $('pageInfo').textContent=`Page ${d.pagination.page} of ${totalPages} · ${d.pagination.total} records`;
 $('prevBtn').disabled=currentPage<=1; $('nextBtn').disabled=currentPage>=totalPages;
}
const editableFields=[
 ['fullName','Full name','text'],['fatherName',"Father's name",'text'],['motherName',"Mother's name",'text'],
 ['dateOfBirth','Date of birth','readonly'],['gender','Gender','readonly'],['email','Email','readonly'],['mobile','Mobile','readonly'],
 ['alternateMobile','Alternate mobile','readonly'],['address','Address','textarea'],['city','City','text'],['state','State','text'],
 ['country','Country','text'],['pinCode','PIN code','text'],['education','Education','text'],['occupation','Occupation','text'],
 ['username','Username','readonly'],['accountStatus','Account status','select']
];
async function openUser(id){
 try{
  const d=await api(`/api/admin/users/${id}`);editingId=id;const u=d.user;
  $('modalBody').replaceChildren();
  const grid=document.createElement('div');grid.className='detail-grid';
  editableFields.forEach(([key,label,type])=>{
   const wrap=document.createElement('div');wrap.className='detail-field';
   const lab=document.createElement('label');lab.textContent=label;lab.htmlFor=`edit-${key}`;wrap.appendChild(lab);
   let input;
   if(type==='textarea'){input=document.createElement('textarea');input.rows=3;}
   else if(type==='select'){input=document.createElement('select');[['active','Active'],['inactive','Inactive'],['blocked','Blocked']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;input.appendChild(o);});}
   else{input=document.createElement('input');input.type=type==='readonly'?'text':type;if(key==='dateOfBirth')input.type='date';}
   input.id=`edit-${key}`;input.dataset.key=key;input.className='form-control';input.value=String(u[key]??'');
   if(type==='readonly')input.readOnly=true;
   if(key==='dateOfBirth')input.readOnly=true;
   wrap.appendChild(input);grid.appendChild(wrap);
  });
  const meta=document.createElement('p');meta.className='small text-secondary mt-3';meta.textContent=`Registration ID ${u.id} · Created ${new Date(u.createdAt).toLocaleString()} · Updated ${new Date(u.updatedAt).toLocaleString()}`;
  $('modalBody').append(grid,meta);modal.show();
 }catch(e){show(e.message);}
}
async function saveUser(){
 if(!editingId)return;
 const body={};$('modalBody').querySelectorAll('[data-key]').forEach(el=>{if(!el.readOnly)body[el.dataset.key]=el.value;});
 try{await api(`/api/admin/users/${editingId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});modal.hide();show('User details updated.','success');await Promise.all([loadUsers(),loadStats()]);}
 catch(e){show(e.message);}
}
async function deleteUser(id,name){
 if(!confirm(`Delete registration for "${name}" (ID ${id})? This cannot be undone.`))return;
 try{await api(`/api/admin/users/${id}`,{method:'DELETE'});show('Registration deleted.','success');await Promise.all([loadUsers(),loadStats()]);}
 catch(e){show(e.message);}
}
$('filterBtn').addEventListener('click',()=>{currentPage=1;loadUsers().catch(e=>show(e.message));});
$('resetBtn').addEventListener('click',()=>{$('search').value='';$('education').value='';$('status').value='';$('from').value='';$('to').value='';currentPage=1;loadUsers().catch(e=>show(e.message));});
$('prevBtn').addEventListener('click',()=>{if(currentPage>1){currentPage--;loadUsers().catch(e=>show(e.message));}});
$('nextBtn').addEventListener('click',()=>{if(currentPage<totalPages){currentPage++;loadUsers().catch(e=>show(e.message));}});
$('saveUserBtn').addEventListener('click',saveUser);
$('exportBtn').addEventListener('click',async()=>{
 try{const res=await fetch(`${API_BASE}/api/admin/users/export.csv?search=${encodeURIComponent($('search').value.trim())}`,{credentials:'include'});
 if(!res.ok){if(res.status===401)location.href='admin-login.html';throw new Error('CSV export failed.');}
 const blob=await res.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='registrations.csv';a.click();URL.revokeObjectURL(url);
 }catch(e){show(e.message);}
});
$('logoutBtn').addEventListener('click',async()=>{
 try{await api('/api/auth/admin-logout',{method:'POST'});location.href='admin-login.html';}
 catch(e){show(e.message);}
});
init();

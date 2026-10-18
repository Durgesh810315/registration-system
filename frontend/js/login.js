const form = document.getElementById('loginForm');
const message = document.getElementById('message');
function show(text,type){message.textContent=text;message.className=`alert alert-${type}`;}
form.addEventListener('submit', async e => {
  e.preventDefault(); if (!form.reportValidity()) return;
  const btn=document.getElementById('submitBtn'); btn.disabled=true; btn.textContent='Signing in…';
  try {
    const tokenRes=await fetch(`${API_BASE}/api/csrf-token`,{credentials:'include'});
    const tokenData=await tokenRes.json();
    const res=await fetch(`${API_BASE}/api/auth/admin-login`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':tokenData.csrfToken},body:JSON.stringify({username:form.username.value.trim(),password:form.password.value})});
    const data=await res.json(); if(!res.ok) throw new Error(data.error||'Sign in failed.');
    location.href='admin-dashboard.html';
  } catch(err){show(err.message==='Failed to fetch'?'Cannot reach backend. Check server and API_BASE.':err.message,'danger');}
  finally{btn.disabled=false;btn.textContent='Sign in';}
});

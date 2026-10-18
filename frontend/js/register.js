const form = document.getElementById('registerForm');
const message = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');
const spinner = document.getElementById('spinner');
function showMessage(text, type) { message.textContent = text; message.className = `alert alert-${type}`; message.scrollIntoView({behavior:'smooth',block:'center'}); }
document.querySelectorAll('.toggle-password').forEach(btn => btn.addEventListener('click', () => {
  const input = document.getElementById(btn.dataset.target);
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? 'Show' : 'Hide';
}));
form.addEventListener('submit', async e => {
  e.preventDefault();
  message.className = 'alert d-none';
  if (!form.reportValidity()) return;
  if (form.password.value !== form.confirmPassword.value) return showMessage('Passwords do not match.', 'danger');
  const photo = form.profilePhoto.files[0];
  if (photo && photo.size > 3 * 1024 * 1024) return showMessage('Profile photo must be 3 MB or smaller.', 'danger');
  submitBtn.disabled = true; spinner.classList.remove('d-none');
  try {
    const tokenResponse = await fetch(`${API_BASE}/api/csrf-token`, { credentials:'include' });
    const tokenData = await tokenResponse.json();
    const response = await fetch(`${API_BASE}/api/auth/register`, { method:'POST', body:new FormData(form), credentials:'include', headers:{'X-CSRF-Token':tokenData.csrfToken} });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Registration failed.');
    form.reset(); document.getElementById('country').value = 'India';
    showMessage(data.message, 'success');
  } catch (err) {
    showMessage(err.message === 'Failed to fetch' ? 'Could not connect to the server. Check that the backend is running.' : err.message, 'danger');
  } finally { submitBtn.disabled = false; spinner.classList.add('d-none'); }
});

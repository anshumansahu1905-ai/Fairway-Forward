const modal = document.querySelector('#modal');
const authForm = document.querySelector('#auth-form');
const email = document.querySelector('#email');
const password = document.querySelector('#password');
const message = document.querySelector('#auth-message');
const title = document.querySelector('#modal-title');
const API_BASE = window.FF_API_BASE || (location.port === '5000' ? '' : 'http://localhost:5000');
const signupOptions = document.querySelector('#signup-options');
const signupName = document.querySelector('#signup-name');
const plan = document.querySelector('#plan');
const signupCharity = document.querySelector('#signup-charity');
let mode = 'login';

async function loadCharities() {
  const response = await fetch(`${API_BASE}/api/charities`);
  const charities = await response.json();
  signupCharity.innerHTML = charities.map(charity => `<option value="${charity._id}">${charity.name}</option>`).join('');
}
loadCharities().catch(() => { signupCharity.innerHTML = '<option value="">Select later</option>'; });
signupOptions.hidden = true;

document.querySelectorAll('[data-open="auth"]').forEach(button => button.addEventListener('click', () => {
  modal.classList.add('show'); modal.setAttribute('aria-hidden', 'false'); email.focus();
}));
document.querySelector('#close-modal').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
function closeModal(){ modal.classList.remove('show'); modal.setAttribute('aria-hidden', 'true'); message.textContent = ''; }

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  mode = tab.dataset.tab;
  signupOptions.hidden = mode !== 'signup';
  document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === tab));
  title.textContent = mode === 'login' ? 'Welcome back' : 'A round with purpose.';
  authForm.querySelector('button').innerHTML = mode === 'login' ? 'Enter your dashboard <span>→</span>' : 'Create my membership <span>→</span>';
  password.value = mode === 'login' ? 'playforward' : '';
  message.textContent = '';
}));

authForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = authForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  message.textContent = '';
  try {
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name: signupName.value || email.value.split('@')[0], email: email.value, password: password.value, plan: plan.value, charityId: signupCharity.value || undefined})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to complete authentication.');
    localStorage.setItem('ff_token', data.token);
    localStorage.setItem('ff_member', JSON.stringify(data.user));
    if (data.user.role === 'admin') localStorage.setItem('ff_admin', 'true');
    if (mode === 'signup' && data.user.role !== 'admin') {
      const checkout = await fetch(`${API_BASE}/api/billing/checkout`, { method: 'POST', headers: { Authorization: `Bearer ${data.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({plan: plan.value}) });
      const checkoutData = await checkout.json();
      if (!checkout.ok) throw new Error(checkoutData.message || 'Unable to start payment.');
      window.location.href = checkoutData.url;
      return;
    }
    window.location.href = data.user.role === 'admin' ? './admin.html' : './dashboard.html';
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

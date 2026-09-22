const API_BASE = 'https://fairway-forward-1.onrender.com';
const token = localStorage.getItem('ff_token');
let scores = [];
let member = JSON.parse(localStorage.getItem('ff_member') || 'null');
let charities = [];
if (!token) window.location.href = './index.html';

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  if (response.status === 401) { localStorage.removeItem('ff_token'); localStorage.removeItem('ff_member'); window.location.href = './index.html'; }
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.message || 'Request failed.');
  return data;
}

function setMemberDetails() {
  document.querySelector('#member-name').textContent = member.name;
  document.querySelector('#welcome-name').textContent = `${member.name}.`;
  document.querySelector('.avatar').textContent = member.name[0].toUpperCase();
}

function renderCharity() {
  const selected = charities.find(charity => charity._id === member.selectedCharity);
  const select = document.querySelector('#charity-select');
  select.innerHTML = charities.map(charity => `<option value="${charity._id}">${charity.name}</option>`).join('');
  select.value = member.selectedCharity || charities[0]?._id || '';
  if (selected) {
    document.querySelector('#cause-logo').textContent = selected.name.split(' ').map(word => word[0]).join('').slice(0, 2);
    document.querySelector('#cause-name').textContent = selected.name;
    document.querySelector('#cause-description').textContent = selected.description;
  }
}

function renderWinners(winners) {
  const list = document.querySelector('#winner-list');
  if (!winners?.length) { list.textContent = 'No winnings yet.'; return; }
  list.innerHTML = winners.map(winner => `<div class="winner-row"><strong>${winner.tier}/5 match</strong><span>£${winner.prizeAmount.toFixed(2)} · ${winner.payoutStatus}</span>${winner.payoutStatus === 'pending' ? `<form data-proof="${winner._id}"><input type="file" accept="image/png,image/jpeg,image/webp" required><button class="button" type="submit">Upload proof</button></form>` : ''}</div>`).join('');
}

document.querySelectorAll('.side-nav button, [data-goto]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.page || button.dataset.goto)));
function showPage(page){document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === page));document.querySelectorAll('.side-nav button').forEach(b => b.classList.toggle('active', b.dataset.page === page));window.scrollTo({top:0,behavior:'smooth'});}
function displayDate(date){return new Date(date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
function renderScores(){scores.sort((a,b)=>new Date(b.date)-new Date(a.date));const list=document.querySelector('#score-list');list.innerHTML=scores.map((item,index)=>`<div class="score-row"><span class="score-dot">${item.score}</span><div><strong>${displayDate(item.date)}</strong><span>Stableford score</span></div><button class="delete-score" data-delete="${index}">Remove</button></div>`).join('');document.querySelector('#scores-count').textContent=`${scores.length} of 5 ROUNDS`;const avg=scores.length?(scores.reduce((sum,item)=>sum+item.score,0)/scores.length).toFixed(1):'0.0';document.querySelector('#score-average').textContent=avg;document.querySelector('#draw-numbers').innerHTML=scores.map(item=>`<b>${item.score}</b>`).join('');document.querySelectorAll('[data-delete]').forEach(button=>button.addEventListener('click',async()=>{try{await api(`/api/scores/${scores[Number(button.dataset.delete)].id}`,{method:'DELETE'});await loadDashboard();}catch(error){document.querySelector('#score-message').textContent=error.message;}}));}
async function addScore(score,date,target){target.textContent='';try{await api('/api/scores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({score:Number(score),playedOn:date})});await loadDashboard();target.textContent='Round saved. Your draw entry has been refreshed.';return true;}catch(error){target.textContent=error.message;return false;}}
document.querySelector('#score-form').addEventListener('submit',async e=>{e.preventDefault();const success=await addScore(e.target.querySelector('#score-value').value,e.target.querySelector('#score-date').value,document.querySelector('#score-message'));if(success)e.target.reset();});
document.querySelector('#quick-score-form').addEventListener('submit',async e=>{e.preventDefault();const inputs=e.target.querySelectorAll('input');const success=await addScore(inputs[0].value,inputs[1].value,document.querySelector('#quick-message'));if(success)e.target.reset();});
document.querySelector('#contribution').addEventListener('input',e=>{const percentage=e.target.value;document.querySelector('#percent-output').textContent=`${percentage}%`;document.querySelector('.contribution-note').textContent=`£${(10*percentage/100).toFixed(2)} from your £10.00 monthly plan goes directly to this cause.`;});
async function saveImpact() { try { member=await api('/api/me/charity',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({charityId:document.querySelector('#charity-select').value,contributionPercent:Number(document.querySelector('#contribution').value)})}); localStorage.setItem('ff_member',JSON.stringify(member)); renderCharity(); document.querySelector('#impact-message').textContent='Impact preferences saved.'; } catch(error) { document.querySelector('#impact-message').textContent=error.message; } }
document.querySelector('#contribution').addEventListener('change',saveImpact);
document.querySelector('#charity-select').addEventListener('change',saveImpact);
document.querySelector('#simulate').addEventListener('click',()=>{const winning=Array.from({length:5},()=>Math.floor(Math.random()*45)+1);const matches=scores.filter(item=>winning.includes(item.score)).length;document.querySelector('#simulation-title').textContent=`${matches} / 5 numbers matched.`;document.querySelector('#simulation-text').textContent=`Practice numbers: ${winning.join(', ')}. ${matches>=3?'That would place you in a prize tier.':'Keep logging your rounds - the live draw remains independent and transparent.'}`;});
document.querySelector('#winner-list').addEventListener('submit',async event=>{if(!event.target.matches('[data-proof]'))return;event.preventDefault();const file=event.target.querySelector('input').files[0];const body=new FormData();body.append('proof',file);try{await api(`/api/winners/${event.target.dataset.proof}/proof`,{method:'POST',body});event.target.innerHTML='<span>Proof uploaded for review.</span>';}catch(error){event.target.insertAdjacentHTML('beforeend',`<p class="inline-message">${error.message}</p>`);}});
document.querySelector('#logout').addEventListener('click',()=>{localStorage.removeItem('ff_member');localStorage.removeItem('ff_token');window.location.href='./index.html';});
async function loadDashboard(){const [data, charityData]=await Promise.all([api('/api/dashboard'),fetch(`${API_BASE}/api/charities`).then(response=>response.json())]);member=data.user;charities=charityData;scores=data.scores.map(item=>({id:item._id,score:item.score,date:item.playedOn}));localStorage.setItem('ff_member',JSON.stringify(member));setMemberDetails();renderCharity();const contribution=member.contributionPercent || 10;document.querySelector('#contribution').value=contribution;document.querySelector('#contribution').dispatchEvent(new Event('input'));document.querySelector('#draw-pool').textContent=`£${(data.nextDraw?.poolAmount || 0).toLocaleString()}`;renderScores();renderWinners(data.winners);}
loadDashboard().catch(error=>{document.querySelector('#score-message').textContent=error.message;});

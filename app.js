const views = ['overview', 'incidents', 'policy', 'activity'];
const incidentData = {
  threat: {
    title: 'Possible direct threat', eyebrow: 'INC-024 · 14 MIN AGO', riskTitle: 'Critical safety signal', riskCopy: 'Immediate human review recommended. No automatic action taken.', message: '“I know where you live. You will regret this.”', recTitle: 'Preserve evidence and review immediately', recCopy: 'This matches your saved boundary for possible threats. Do not reply automatically. Your approval is required for any account action.', risk: 'critical'
  },
  harassment: {
    title: 'Repeated targeted harassment', eyebrow: 'INC-023 · 2 HRS AGO', riskTitle: 'High pattern signal', riskCopy: 'A repeated pattern was connected across three messages.', message: '“You are a fraud. Everyone should know what you really are.”', recTitle: 'Keep monitoring and prepare an escalation', recCopy: 'Your Mind connected three messages from this account over 48 hours. Your policy says repeated targeting should be escalated.', risk: 'high'
  },
  scam: {
    title: 'Possible impersonation scam', eyebrow: 'INC-022 · YESTERDAY', riskTitle: 'Medium safety signal', riskCopy: 'A suspicious account is using the creator’s identity.', message: '“Official Alex giveaway — claim here before it expires.”', recTitle: 'Review the draft warning before posting', recCopy: 'Featherless found impersonation language with 91% confidence. CreaGuard drafted a calm warning and kept it unpublished.', risk: 'medium'
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function showView(view) {
  views.forEach((name) => {
    $(`#view-${name}`)?.classList.toggle('hidden', name !== view);
  });
  $$('.nav-item[data-view]').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  const current = $(`#view-${view}`);
  if (current) current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const crumb = $('.breadcrumb strong');
  if (crumb) crumb.textContent = view === 'overview' ? 'Overview' : view.charAt(0).toUpperCase() + view.slice(1);
}

function openDrawer(key = 'threat') {
  const data = incidentData[key] || incidentData.threat;
  $('#drawer-title').textContent = data.title;
  $('.drawer-header .eyebrow').textContent = data.eyebrow;
  $('#drawer-risk-title').textContent = data.riskTitle;
  $('#drawer-risk-copy').textContent = data.riskCopy;
  $('#drawer-message').textContent = data.message;
  $('#recommendation-title').textContent = data.recTitle;
  $('#recommendation-copy').textContent = data.recCopy;
  const mark = $('.drawer-risk .risk-mark');
  mark.className = `risk-mark ${data.risk}`;
  mark.textContent = data.risk === 'critical' ? '!' : data.risk === 'high' ? '↗' : '$';
  $('#drawer-overlay').classList.remove('hidden');
  $('#incident-drawer').classList.remove('hidden');
}

function closeDrawer() {
  $('#drawer-overlay').classList.add('hidden');
  $('#incident-drawer').classList.add('hidden');
}

let toastTimeout;
function showToast(title, copy) {
  $('#toast-title').textContent = title;
  $('#toast-copy').textContent = copy;
  $('#toast').classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('#toast').classList.add('hidden'), 3600);
}

$$('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
$$('.incident-row').forEach((row) => row.addEventListener('click', () => openDrawer(row.dataset.incident)));
$$('.table-row').forEach((row) => row.addEventListener('click', () => openDrawer(row.dataset.open)));
$('#close-drawer').addEventListener('click', closeDrawer);
$('#drawer-overlay').addEventListener('click', closeDrawer);

function simulateEvent() {
  const list = $('#incident-list');
  const event = document.createElement('button');
  event.className = 'incident-row';
  event.dataset.incident = 'harassment';
  event.innerHTML = '<div class="risk-mark high">↗</div><div class="incident-main"><div class="incident-title"><strong>New creator-safety signal</strong><span class="risk-label high-label">High</span></div><p>New message connected to an existing pattern</p><div class="incident-meta"><span>◷ Just now</span><span>◉ @pixelpunch</span><span class="memory-tag">✦ Mind matched context</span></div></div><span class="row-arrow">›</span>';
  list.prepend(event);
  event.addEventListener('click', () => openDrawer('harassment'));
  showToast('Mind matched new context', 'A new event was linked to INC-023.');
}
$('#new-event-btn').addEventListener('click', simulateEvent);
$('#new-event-btn-2').addEventListener('click', () => { showView('overview'); setTimeout(simulateEvent, 250); });

$('#save-policy').addEventListener('click', () => {
  const label = $('#saved-label');
  label.textContent = 'Saved just now';
  showToast('Policy saved to Mind memory', 'Future recommendations will use your updated boundaries.');
  setTimeout(() => { label.textContent = 'Saved to Mind memory'; }, 3600);
});

$('#approve-btn').addEventListener('click', () => {
  $('#case-status').value = 'Monitoring';
  closeDrawer();
  showToast('Incident acknowledged', 'Evidence preserved. Case moved to monitoring.');
});
$('#dismiss-btn').addEventListener('click', () => {
  $('#case-status').value = 'Monitoring';
  closeDrawer();
  showToast('Case kept in monitoring', 'CreaGuard will follow up if the pattern continues.');
});
$('#case-status').addEventListener('change', (event) => showToast('Case status updated', `Incident is now marked “${event.target.value}”.`));

showView('overview');

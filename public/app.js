'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
let currentPersona = null;
let chatHistory = [];
let sendDebounceTimer = null;
let isSending = false;
let currentLang = 'en';
let currentUser = null;

// ─── Firebase Bridge (loaded as ES module) ────────────────────────────────────
// firebase.js sets these on window so the non-module app.js can access them
function fbSaveMessage(...args) { return window.fb?.saveMessage(...args); }
function fbLoadHistory(...args) { return window.fb?.loadChatHistory(...args); }
function fbTrack(...args) { return window.fb?.trackEvent(...args); }

// ─── Auth ─────────────────────────────────────────────────────────────────────
window.onFirebaseAuthChange = function(user) {
  currentUser = user;
  if (user) {
    document.getElementById('auth-signed-out').style.display = 'none';
    document.getElementById('auth-signed-in').style.display = 'flex';
    document.getElementById('auth-name').textContent = user.displayName || user.email;
    const avatar = document.getElementById('auth-avatar');
    if (user.photoURL) { avatar.src = user.photoURL; avatar.style.display = 'block'; }
  } else {
    document.getElementById('auth-signed-out').style.display = 'flex';
    document.getElementById('auth-signed-in').style.display = 'none';
  }
};

async function handleSignIn() {
  const user = await window.fb?.signInWithGoogle();
  if (user) announce(`Signed in as ${user.displayName}`);
}

async function handleSignOut() {
  await window.fb?.signOutUser();
  currentUser = null;
  announce('Signed out');
}

// ─── Language Setup ───────────────────────────────────────────────────────────
async function loadLanguages() {
  try {
    const res = await fetch('/api/languages');
    const data = await res.json();
    const select = document.getElementById('lang-select');
    select.innerHTML = Object.entries(data.languages)
      .map(([code, name]) => `<option value="${code}">${name}</option>`)
      .join('');
  } catch {
    // fallback — keep the English-only option
  }
}

function changeLanguage(lang) {
  currentLang = lang;
  const label = document.getElementById('lang-select').selectedOptions[0]?.text || lang;
  announce(`Language changed to ${label}`);
}

loadLanguages();

// ─── Persona Data ─────────────────────────────────────────────────────────────
const PERSONAS = {
  voter: {
    label: '🧑‍💼 Voter',
    color: '#4f46e5',
    welcome: `Hi! I'm VoteIQ, your personal voting guide.\n\nI can help you with:\n• Voter registration (Form 6)\n• Finding your polling booth\n• Valid ID documents for voting\n• What to expect on polling day\n• NOTA and EVMs explained\n\nWhat would you like to know?`,
    suggestions: [
      'How do I register as a voter?',
      'What ID do I need to vote?',
      'How do I find my polling booth?',
      'What is NOTA?',
      'Can I vote if I moved cities?',
    ],
    checklist: [
      { text: 'Check if your name is on the Electoral Roll', link: 'https://electoralsearch.eci.gov.in' },
      { text: 'Register using Form 6 if not enrolled', link: null },
      { text: 'Download/collect your Voter ID (EPIC card)', link: null },
      { text: 'Note your Booth Number and Polling Station', link: null },
      { text: 'Carry a valid photo ID on polling day', link: null },
      { text: 'Check election date in your constituency', link: null },
      { text: 'Know your candidates using Voter Helpline App', link: null },
      { text: 'Cast your vote on election day', link: null },
    ],
  },
  candidate: {
    label: '🏛️ Candidate',
    color: '#059669',
    welcome: `Welcome! I'm VoteIQ, your election campaign advisor.\n\nI can guide you through:\n• Nomination filing process\n• Election expenditure limits\n• Model Code of Conduct rules\n• Affidavit requirements\n• Campaign dos and don'ts\n\nWhat do you need help with?`,
    suggestions: [
      'How do I file my nomination?',
      'What is the election expenditure limit?',
      'What does the Model Code of Conduct say?',
      'What documents do I need to file?',
      'When is the last date to withdraw nomination?',
    ],
    checklist: [
      { text: 'Verify eligibility (age, citizenship, no criminal disqualification)', link: null },
      { text: 'Obtain nomination forms from Returning Officer', link: null },
      { text: 'Prepare affidavit disclosing assets, liabilities, criminal cases (Form 26)', link: null },
      { text: 'File nomination with required documents and security deposit', link: null },
      { text: 'Attend scrutiny of nomination', link: null },
      { text: 'Decide by withdrawal deadline (within 2 days of scrutiny)', link: null },
      { text: 'Open separate bank account for election expenses', link: null },
      { text: 'Appoint Election Agent and Counting Agent', link: null },
      { text: 'Follow Model Code of Conduct in all campaign activities', link: null },
      { text: 'Submit election expense account within 30 days of results', link: null },
    ],
  },
  official: {
    label: '⚖️ Election Official',
    color: '#dc2626',
    welcome: `Hello! I'm VoteIQ, your election administration assistant.\n\nI can assist you with:\n• Polling officer duties and training\n• EVM and VVPAT handling procedures\n• Model Code of Conduct enforcement\n• Polling day protocols\n• Counting day procedures\n\nWhat would you like to know?`,
    suggestions: [
      'What are the duties of a Presiding Officer?',
      'How do I handle an EVM malfunction?',
      'What is the mock poll procedure?',
      'How is VVPAT verified during counting?',
      'What if a voter is challenged at the booth?',
    ],
    checklist: [
      { text: 'Complete mandatory EVM/VVPAT training', link: null },
      { text: 'Collect EVM, VVPAT, polling materials from RO', link: null },
      { text: 'Conduct mock poll (minimum 50 votes) before 7:00 AM', link: null },
      { text: 'Clear mock poll votes and set EVM to zero', link: null },
      { text: 'Display Form 17A register at polling station', link: null },
      { text: 'Verify voter identity strictly as per ECI guidelines', link: null },
      { text: 'Maintain Form 17C (votes recorded every 2 hours)', link: null },
      { text: 'Seal EVM at close of poll with agent signatures', link: null },
      { text: 'Submit all materials and forms to Returning Officer', link: null },
      { text: 'Maintain strong room security until counting day', link: null },
    ],
  },
};

// ─── Timeline Data ────────────────────────────────────────────────────────────
const TIMELINE = [
  { phase: 'Announcement', icon: '📢', desc: 'Election Commission announces election dates. Model Code of Conduct comes into effect immediately.', status: 'done' },
  { phase: 'Nomination Filing', icon: '📝', desc: 'Candidates file nomination papers with the Returning Officer. Last date is typically 7 days after announcement.', status: 'done' },
  { phase: 'Scrutiny of Nominations', icon: '🔍', desc: 'Returning Officer examines all nomination papers for validity. Usually 1 day after last date of filing.', status: 'done' },
  { phase: 'Withdrawal of Candidature', icon: '↩️', desc: 'Candidates may withdraw within 2 days of scrutiny. Final list of candidates published after this.', status: 'active' },
  { phase: 'Campaign Period', icon: '📣', desc: 'Candidates and parties campaign across constituencies. Ends 48 hours before polling (silent period).', status: 'upcoming' },
  { phase: 'Polling Day', icon: '🗳️', desc: 'Voters cast their ballots at designated polling stations from 7 AM to 6 PM.', status: 'upcoming' },
  { phase: 'Counting of Votes', icon: '🔢', desc: 'Votes counted at designated counting centres under strict supervision. Results declared.', status: 'upcoming' },
  { phase: 'Declaration of Results', icon: '🏆', desc: 'Winning candidates declared. Elected representatives take oath of office.', status: 'upcoming' },
];

// ─── Navigation ───────────────────────────────────────────────────────────────
function selectPersona(persona) {
  currentPersona = persona;
  chatHistory = [];

  const p = PERSONAS[persona];

  document.getElementById('screen-landing').classList.remove('active');
  document.getElementById('screen-landing').setAttribute('aria-hidden', 'true');

  const appScreen = document.getElementById('screen-app');
  appScreen.classList.add('active');
  appScreen.removeAttribute('aria-hidden');

  document.getElementById('persona-badge').textContent = p.label;
  document.getElementById('persona-badge').style.background = p.color;
  document.getElementById('chat-title').textContent = `Ask me anything — ${p.label}`;

  const msgContainer = document.getElementById('chat-messages');
  msgContainer.innerHTML = '<div class="message bot-message" id="welcome-message"></div>';
  document.getElementById('welcome-message').innerHTML = formatMessage(p.welcome);

  renderSuggestions(p.suggestions);
  renderChecklist(p.checklist);
  renderTimeline();
  showTab('chat');

  // Track persona selection
  fbTrack('select_persona', { persona });

  // Load Firestore history if signed in
  if (currentUser) {
    fbLoadHistory(currentUser.uid, persona).then(history => {
      if (history.length > 0) {
        chatHistory = history.slice(-20);
        history.slice(-6).forEach(h => {
          if (h.role === 'user') addUserMessage(h.text);
          else addBotMessage(h.text);
        });
        announce('Previous conversation loaded');
      }
    });
  }

  // Move focus to the textarea
  setTimeout(() => document.getElementById('user-input').focus(), 100);
}

function goHome() {
  const landing = document.getElementById('screen-landing');
  landing.classList.add('active');
  landing.removeAttribute('aria-hidden');

  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('screen-app').setAttribute('aria-hidden', 'true');

  chatHistory = [];
  currentPersona = null;

  // Return focus to first persona card
  setTimeout(() => document.querySelector('.persona-card').focus(), 100);
}

function showTab(tab) {
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-hidden', 'true');
  });
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });

  const tabEl = document.getElementById(`tab-${tab}`);
  tabEl.classList.add('active');
  tabEl.removeAttribute('aria-hidden');

  const navBtn = document.getElementById(`nav-${tab}`);
  navBtn.classList.add('active');
  navBtn.setAttribute('aria-selected', 'true');

  if (tab === 'stats') loadCharts();
  fbTrack('tab_view', { tab });
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    debouncedSend();
  }
  updateCharCount();
}

function updateCharCount() {
  const input = document.getElementById('user-input');
  const count = input.value.length;
  const el = document.getElementById('char-count');
  el.textContent = count > 900 ? `${count}/1000 characters` : '';
}

function debouncedSend() {
  clearTimeout(sendDebounceTimer);
  sendDebounceTimer = setTimeout(sendMessage, 300);
}

async function sendMessage() {
  if (isSending) return;
  const input = document.getElementById('user-input');
  const text = input.value.trim();
  if (!text) return;

  isSending = true;
  input.value = '';
  updateCharCount();
  addUserMessage(text);
  hideSuggestions();

  const loadingId = addLoadingMessage();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona: currentPersona,
        message: text,
        history: chatHistory,
        lang: currentLang,
      }),
    });

    const data = await res.json();
    removeMessage(loadingId);

    if (!res.ok) {
      const errText = data.error || `Server error (${res.status})`;
      addBotMessage(`Sorry, I ran into an issue: ${errText}`);
      announce(errText, true);
      return;
    }

    const reply = data.reply || 'No response received.';
    const englishReply = data.englishReply || reply; // always English for history
    addBotMessage(reply, data.translated ? currentLang : null);
    announce('New response received');

    chatHistory.push({ role: 'user', text });
    chatHistory.push({ role: 'model', text: englishReply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

    // Persist to Firestore if signed in
    if (currentUser) {
      fbSaveMessage(currentUser.uid, currentPersona, 'user', text);
      fbSaveMessage(currentUser.uid, currentPersona, 'model', englishReply);
    }

    // Track question asked
    fbTrack('question_asked', { persona: currentPersona, lang: currentLang });

  } catch (err) {
    removeMessage(loadingId);
    addBotMessage(`Connection error: ${err.message}. Please check your connection and try again.`);
    announce('Error sending message', true);
  } finally {
    isSending = false;
    input.focus();
  }
}

// ─── Message Rendering ────────────────────────────────────────────────────────
function addUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'message user-message';
  div.setAttribute('role', 'article');
  div.setAttribute('aria-label', `You said: ${text}`);
  div.textContent = text;
  document.getElementById('chat-messages').appendChild(div);
  scrollChat();
}

function addBotMessage(text, translatedLang) {
  const div = document.createElement('div');
  div.className = 'message bot-message';
  div.setAttribute('role', 'article');
  div.setAttribute('aria-label', 'VoteIQ response');
  div.innerHTML = formatMessage(text);
  if (translatedLang) {
    const badge = document.createElement('div');
    badge.className = 'translate-badge';
    badge.setAttribute('aria-label', `Translated using Google Translate`);
    badge.innerHTML = `<span aria-hidden="true">🌐</span> Translated via Google Translate`;
    div.appendChild(badge);
  }
  document.getElementById('chat-messages').appendChild(div);
  scrollChat();
}

function addLoadingMessage() {
  const id = `loading-${Date.now()}`;
  const div = document.createElement('div');
  div.className = 'message bot-message loading-message';
  div.id = id;
  div.setAttribute('role', 'status');
  div.setAttribute('aria-label', 'VoteIQ is thinking');
  div.innerHTML = '<span class="dot" aria-hidden="true"></span><span class="dot" aria-hidden="true"></span><span class="dot" aria-hidden="true"></span>';
  document.getElementById('chat-messages').appendChild(div);
  scrollChat();
  return id;
}

function removeMessage(id) {
  document.getElementById(id)?.remove();
}

function scrollChat() {
  const c = document.getElementById('chat-messages');
  c.scrollTop = c.scrollHeight;
}

function announce(msg, assertive = false) {
  const el = document.getElementById(assertive ? 'status-live' : 'chat-live');
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = msg; });
}

function formatMessage(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/•\s(.+)/g, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, match => `<ul>${match}</ul>`)
    .replace(/\n/g, '<br/>');
}

function renderSuggestions(suggestions) {
  const container = document.getElementById('chat-suggestions');
  container.innerHTML = suggestions.map(s =>
    `<button class="suggestion-chip" onclick="useSuggestion(this)" aria-label="Ask: ${s}">${s}</button>`
  ).join('');
  container.style.display = 'flex';
}

function hideSuggestions() {
  const el = document.getElementById('chat-suggestions');
  el.style.display = 'none';
}

function useSuggestion(btn) {
  const text = btn.textContent;
  document.getElementById('user-input').value = text;
  sendMessage();
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
function renderTimeline() {
  const container = document.getElementById('timeline-container');
  container.innerHTML = TIMELINE.map((item, i) => `
    <div class="timeline-item ${item.status}" role="listitem">
      <div class="timeline-connector" aria-hidden="true">
        <div class="timeline-dot">${item.icon}</div>
        ${i < TIMELINE.length - 1 ? '<div class="timeline-line"></div>' : ''}
      </div>
      <div class="timeline-card">
        <div class="timeline-phase">${item.phase}</div>
        <div class="timeline-desc">${item.desc}</div>
        <div class="timeline-status-badge ${item.status}" aria-label="Status: ${
          item.status === 'done' ? 'Completed' : item.status === 'active' ? 'In Progress' : 'Upcoming'
        }">${
          item.status === 'done' ? '✓ Completed' :
          item.status === 'active' ? '⚡ In Progress' : '⏳ Upcoming'
        }</div>
      </div>
    </div>
  `).join('');
  container.setAttribute('role', 'list');
}

// ─── Checklist ────────────────────────────────────────────────────────────────
function renderChecklist(items) {
  const container = document.getElementById('checklist-container');
  container.innerHTML = items.map((item, i) => `
    <div class="checklist-item" id="check-${i}">
      <label class="check-label">
        <input type="checkbox" id="checkbox-${i}" onchange="toggleCheck(${i})" aria-describedby="check-text-${i}" />
        <span class="checkmark" aria-hidden="true"></span>
        <span class="check-text" id="check-text-${i}">${item.text}</span>
      </label>
      ${item.link ? `<a href="${item.link}" target="_blank" rel="noopener noreferrer" class="check-link" aria-label="Open: ${item.text}">↗ Check</a>` : ''}
    </div>
  `).join('');
}

function toggleCheck(i) {
  const item = document.getElementById(`check-${i}`);
  const checked = document.getElementById(`checkbox-${i}`).checked;
  item.classList.toggle('checked', checked);
  const label = item.querySelector('.check-text').textContent;
  announce(checked ? `Marked complete: ${label}` : `Unmarked: ${label}`);
}

// ─── Google Maps ──────────────────────────────────────────────────────────────
function searchMap() {
  const query = document.getElementById('map-search-input').value.trim();
  if (!query) return;
  const encoded = encodeURIComponent(`election commission polling booth ${query} india`);
  document.getElementById('map-iframe').src =
    `https://maps.google.com/maps?q=${encoded}&output=embed`;
  announce(`Searching map for polling booths in ${query}`);
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('map-search-input');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') searchMap();
    });
  }
});

// ─── Google Charts ────────────────────────────────────────────────────────────
let chartsLoaded = false;

function loadCharts() {
  if (chartsLoaded) return;
  chartsLoaded = true;
  google.charts.load('current', { packages: ['corechart', 'bar'] });
  google.charts.setOnLoadCallback(drawAllCharts);
}

function drawAllCharts() {
  drawSeatsChart();
  drawTurnoutChart();
  drawVotersChart();
  drawWomenChart();
}

const CHART_OPTIONS_BASE = {
  backgroundColor: '#1a1a2e',
  legendTextStyle: { color: '#94a3b8' },
  titleTextStyle: { color: '#e2e8f0', fontSize: 13 },
  hAxis: { textStyle: { color: '#94a3b8' }, gridlines: { color: '#ffffff12' } },
  vAxis: { textStyle: { color: '#94a3b8' }, gridlines: { color: '#ffffff12' } },
};

function drawSeatsChart() {
  const data = google.visualization.arrayToDataTable([
    ['Alliance', 'Seats'],
    ['NDA (BJP-led)', 293],
    ['INDIA (Congress-led)', 234],
    ['Others', 16],
  ]);
  const chart = new google.visualization.PieChart(document.getElementById('chart-seats'));
  chart.draw(data, {
    ...CHART_OPTIONS_BASE,
    colors: ['#4f46e5', '#059669', '#f59e0b'],
    pieHole: 0.4,
    legend: { textStyle: { color: '#94a3b8' } },
  });
}

function drawTurnoutChart() {
  const data = google.visualization.arrayToDataTable([
    ['Election', 'Turnout %'],
    ['2004', 57.7],
    ['2009', 58.2],
    ['2014', 66.4],
    ['2019', 67.4],
    ['2024', 65.8],
  ]);
  const chart = new google.visualization.ColumnChart(document.getElementById('chart-turnout'));
  chart.draw(data, {
    ...CHART_OPTIONS_BASE,
    colors: ['#818cf8'],
    legend: { position: 'none' },
  });
}

function drawVotersChart() {
  const data = google.visualization.arrayToDataTable([
    ['Year', 'Registered Voters (Crores)'],
    ['2004', 67.1],
    ['2009', 71.4],
    ['2014', 83.4],
    ['2019', 91.2],
    ['2024', 96.8],
  ]);
  const chart = new google.visualization.LineChart(document.getElementById('chart-voters'));
  chart.draw(data, {
    ...CHART_OPTIONS_BASE,
    colors: ['#34d399'],
    legend: { position: 'none' },
    curveType: 'function',
  });
}

function drawWomenChart() {
  const data = google.visualization.arrayToDataTable([
    ['Category', 'Count', { role: 'style' }],
    ['Contested', 797, '#818cf8'],
    ['Elected', 74, '#34d399'],
  ]);
  const chart = new google.visualization.ColumnChart(document.getElementById('chart-women'));
  chart.draw(data, {
    ...CHART_OPTIONS_BASE,
    legend: { position: 'none' },
  });
}

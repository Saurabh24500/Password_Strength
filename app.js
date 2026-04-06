// app.js - password analysis logic (uses zxcvbn which must be loaded before this file)

// small helper to format seconds
function humanTime(seconds){
  if (!isFinite(seconds) || seconds < 0) return '∞';
  if (seconds < 1) return (seconds*1000).toFixed(1) + ' ms';
  if (seconds < 60) return Math.round(seconds) + ' s';
  if (seconds < 3600) return Math.round(seconds/60) + ' m';
  if (seconds < 86400) return Math.round(seconds/3600) + ' h';
  if (seconds < 31536000) return Math.round(seconds/86400) + ' d';
  return Math.round(seconds/31536000) + ' years';
}

// attacker speeds
const ATTACKERS = [
  {label:'Online (throttled)', rate:10/60},
  {label:'Online (fast)', rate:100},
  {label:'GPU (1B/s)', rate:1e9},
  {label:'Cluster (100B/s)', rate:1e11},
  {label:'Nation-state (100T/s)', rate:1e14}
];

// DOM
const pwd = document.getElementById('pwd');
const meterbar = document.getElementById('meterbar');
const scoretext = document.getElementById('scoretext');
const entropyEl = document.getElementById('entropy');
const guessesEl = document.getElementById('guesses');
const suggestionsEl = document.getElementById('suggestions');
const timesList = document.getElementById('timesList');
const breachHint = document.getElementById('breachHint');

const toggle = document.getElementById('toggle');
const copyBtn = document.getElementById('copy');
const clearBtn = document.getElementById('clear');

toggle.addEventListener('click', () => {
  if (pwd.type === 'password'){ pwd.type='text'; toggle.textContent='Hide'; }
  else { pwd.type='password'; toggle.textContent='Show'; }
});
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(pwd.value || '').then(()=> {
    copyBtn.textContent='Copied!';
    setTimeout(()=>copyBtn.textContent='Copy',900);
  }).catch(()=>{ /* ignore */});
});
clearBtn.addEventListener('click', ()=> { pwd.value=''; analyze(''); });

// render times rows
function renderTimes(guesses){
  timesList.innerHTML = '';
  ATTACKERS.forEach(a=>{
    const seconds = guesses / a.rate;
    const row = document.createElement('div');
    row.className = 'time-line';
    row.innerHTML = `<div><strong>${a.label}</strong><div class="small">${a.rate.toLocaleString()} guesses/s</div></div>
                     <div style="text-align:right"><strong>${humanTime(seconds)}</strong><div class="small">${seconds >= 1 ? Math.round(seconds).toLocaleString() + ' s' : ''}</div></div>`;
    timesList.appendChild(row);
  });
}

// main analyze function
function analyze(value){
  if (!value){
    meterbar.style.width='0%';
    meterbar.style.background='linear-gradient(90deg,#ff5a5a,#ffcc00,#59f09c)';
    scoretext.textContent='—';
    entropyEl.textContent='—';
    guessesEl.textContent='—';
    suggestionsEl.innerHTML='';
    renderTimes(1);
    breachHint.textContent='';
    return;
  }

  // ensure zxcvbn loaded
  if (typeof window.zxcvbn !== 'function'){
    // fallback message
    meterbar.style.width='20%';
    scoretext.textContent='Unknown';
    suggestionsEl.innerHTML = '<div class="small">zxcvbn not loaded. Check script order or network.</div>';
    renderTimes(1);
    return;
  }

  const res = zxcvbn(value);
  const score = res.score || 0;
  const guesses = res.guesses || Math.pow(2, (res.entropy||0));
  const entropy = Math.round(res.entropy || (Math.log2(guesses)||0));

  // set meter
  const pct = Math.round((score/4) * 100);
  meterbar.style.width = pct + '%';
  const colors = ['#ff6b6b','#ff8f3c','#ffd64d','#7ee787','#38d28b'];
  meterbar.style.background = colors[score] || colors[0];

  // texts
  const texts = ['Very weak','Weak','Fair','Strong','Very strong'];
  scoretext.textContent = texts[score] || '—';
  entropyEl.textContent = entropy;
  guessesEl.textContent = Math.round(guesses).toLocaleString();

  // feedback
  let html = '';
  if (res.feedback && res.feedback.warning) html += `<div style="color:#ffb86b"><strong>Warning:</strong> ${res.feedback.warning}</div>`;
  if (res.feedback && res.feedback.suggestions && res.feedback.suggestions.length){
    html += '<ul style="margin:8px 0 0 18px">';
    res.feedback.suggestions.forEach(s => html += `<li>${s}</li>`);
    html += '</ul>';
  }
  suggestionsEl.innerHTML = html;

  // breached hint (limited)
  const breached = (res.crack_times_display && res.crack_times_display.online_no_throttling_10_per_second === 'less than a second') ||
                  (res.feedback && /common|top 10|password/i.test(res.feedback.warning || ''));
  breachHint.textContent = breached ? 'Possible common/breached password' : '';

  // times
  renderTimes(guesses);
}

// live binding
pwd.addEventListener('input', e => analyze(e.target.value));
analyze('');

// prevent form submit on Enter
document.addEventListener('keydown', function(e){
  if (e.key === 'Enter' && document.activeElement === pwd) e.preventDefault();
});

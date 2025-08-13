
// Connections — Infinite (seeded or random) + Name & Leaderboard
// Daily mode: everyone gets the same puzzle per UTC date
// Random mode: new seed each click

// Connections — Infinite (seeded/random) + Name & Live Leaderboard
// Player gate blocks the app until a player is chosen; includes "Add new player…"

// ===== Import category bank ===============================================
import { CATS } from './cats.js';

// ===== Config (leave blank for local-only leaderboard) =====================
export const SUPABASE_URL = 'https://tralparxinmltofaiclh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyYWxwYXJ4aW5tbHRvZmFpY2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MTcxOTAsImV4cCI6MjA3MDQ5MzE5MH0.Y0wV1-nHtFihiRw5xokkNYa9dxCRfMYhlMQpTm_p4Gw';

// Connections Arcade — single-session scoring with manual Submit
// Replaces auto-submit "daily" mode with continuous puzzles until strikes run out.
// Paste your Supabase URL/ANON KEY below, or keep your existing values.

let supabase = null;
async function initSupabase(){
  if(!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  try{
    const mod = await import('https://esm.sh/@supabase/supabase-js@2');
    supabase = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabase = supabase; // for DevTools diagnostics
  }catch(err){
    console.warn('Supabase SDK failed to load:', err);
  }
}

// ===== Utils =====
function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^(t>>>15), t|1); t^=t+Math.imul(t^(t>>>7), t|61); return ((t^(t>>>14))>>>0)/4294967296; } }
function hashString(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function rngFromSeed(seed){ return mulberry32(seed>>>0); }
function shuffleSeeded(arr, rnd){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function sampleNSeeded(arr, n, rnd){ return shuffleSeeded(arr, rnd).slice(0,n); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
const storage = {
  get(k,d=null){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} },
  del(k){ try{ localStorage.removeItem(k); }catch{} }
};
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ===== DOM =====
const elGame       = document.getElementById('game');
const elStatus     = document.getElementById('status-text');
const elToast      = document.getElementById('toast');
const elLbToday    = document.getElementById('lb-today');
const elLbAll      = document.getElementById('lb-alltime');
const elLbTodayEmpty = document.getElementById('lb-today-empty');
const elLbAllEmpty   = document.getElementById('lb-all-empty');
const elLbRefresh  = document.getElementById('lb-refresh');
const elTodayNote  = document.getElementById('today-note');

document.getElementById('btn-new')?.addEventListener('click', ()=>{ startArcadeSession(); loadFirstPuzzle(); });
document.getElementById('daily-toggle')?.addEventListener('change', ()=>{ /* no-op in arcade */ });
elLbRefresh?.addEventListener('click', ()=>{ loadLeaderboards(); });

// Player gate
const elGate     = document.getElementById('player-gate');
const elSelect   = document.getElementById('player-select');
const elNewField = document.getElementById('new-name-field');
const elNewInput = document.getElementById('new-player-name');
const elGateGo   = document.getElementById('gate-continue');
document.getElementById('btn-change-player')?.addEventListener('click', ()=> openGate());

// ===== Scoring constants (tweak to taste) =====
const POINTS_PER_PUZZLE = 100;
const STRIKE_PENALTY    = 0;   // set to 25 if you want point loss for strikes
const MAX_STRIKES       = 4;

// ===== State =====
const tiersOrder = ['y','g','b','p'];
const tierClass = t => ({y:'tier-y',g:'tier-g',b:'tier-b',p:'tier-p'})[t] || 'tier-y';

let state = {
  player: null,
  current: null,        // current puzzle: {sets, words, wordToTitle, tiers}
  pool: [],
  solved: [],
  selected: new Set(),
  strikes: 0,
  startedAt: 0,
  session: null         // { id, startedAt, startedWall, endedAt, totalScore, puzzlesSolved, strikesUsed, isOver, submitted }
};

// ===== Players (cloud + local) =====
async function fetchPlayers(){
  if(!supabase) return storage.get('players', []);
  try{
    const { data, error } = await supabase.from('players').select('id,name').order('name');
    if(error) throw error;
    return data;
  }catch(err){
    console.warn('fetchPlayers error:', err);
    return storage.get('players', []);
  }
}
function getSavedPlayer(){ return storage.get('player', null); }
function getPlayerById(id){ return (window.__playersCache||[]).find(p=>p.id===id) || null; }
async function upsertPlayer(name){
  name = (name||'').trim().slice(0,24);
  if(!name) return null;

  if(!supabase){
    let players = storage.get('players', []);
    if(!players.find(p=>p.name.toLowerCase()===name.toLowerCase())){
      const id = 'local_' + Math.random().toString(36).slice(2);
      players.push({ id, name });
      storage.set('players', players);
    }
    return players.find(p=>p.name.toLowerCase()===name.toLowerCase()) || null;
  }

  const { data, error } = await supabase.from('players').upsert({ name }, { onConflict:'name' }).select().single();
  if(error){ console.warn('upsertPlayer error:', error); return null; }
  return data;
}

async function refreshPlayers(){
  const players = await fetchPlayers();
  window.__playersCache = players;
  populatePlayerSelect(players);
}

function populatePlayerSelect(players){
  elSelect.innerHTML = '';
  const saved = getSavedPlayer();
  for(const p of players){
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    if(saved && saved.id === p.id) opt.selected = true;
    elSelect.appendChild(opt);
  }
  const add = document.createElement('option');
  add.value = '__add__';
  add.textContent = '➕ Add new player…';
  elSelect.appendChild(add);
  elNewField.style.display = 'none';
}

function openGate(){
  elGate.style.display = 'block';
  refreshPlayers();
}
function closeGate(){
  elGate.style.display = 'none';
}

elSelect?.addEventListener('change', (e)=>{
  elNewField.style.display = (e.target.value==='__add__') ? 'block' : 'none';
});

elGateGo?.addEventListener('click', async ()=>{
  if(elGateGo.disabled) return;
  elGateGo.disabled = true;
  let player = null;
  const val = elSelect.value;
  if(val === '__add__'){
    const name = elNewInput.value.trim();
    player = await upsertPlayer(name);
    await refreshPlayers();
  }else{
    player = getPlayerById(val);
  }
  if(!player){ elGateGo.disabled=false; return; }
  state.player = player;
  storage.set('player', player);
  closeGate();
  await loadLeaderboards();
  toast(`Hello, ${player.name}!`);
  startArcadeSession();
  loadFirstPuzzle();
  elGateGo.disabled = false;
});

// ===== Session lifecycle =====
function newSessionId(){ return (crypto?.randomUUID?.() || `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`); }
function startArcadeSession(){
  state.session = {
    id: newSessionId(),
    startedAt: performance.now(),
    startedWall: Date.now(),
    endedAt: null,
    totalScore: 0,
    puzzlesSolved: 0,
    strikesUsed: 0,
    isOver: false,
    submitted: false
  };
  renderHUD();
}
function awardPuzzleSolved(){
  if(!state.session || state.session.isOver) return;
  state.session.puzzlesSolved += 1;
  state.session.totalScore += POINTS_PER_PUZZLE;
  renderHUD();
}
function registerStrike(){
  if(!state.session || state.session.isOver) return;
  state.session.strikesUsed += 1;
  if(STRIKE_PENALTY) state.session.totalScore = Math.max(0, state.session.totalScore - STRIKE_PENALTY);
  renderHUD();
  if(state.session.strikesUsed >= MAX_STRIKES){
    endArcadeSession('out-of-strikes');
  }
}
function endArcadeSession(reason='ended'){
  if(!state.session || state.session.isOver) return;
  state.session.isOver = true;
  state.session.endedAt = performance.now();
  showGameOver();
  renderHUD();
}
function sessionDurationMs(){
  if(!state.session) return 0;
  const end = state.session.isOver ? state.session.endedAt : performance.now();
  return Math.round(end - state.session.startedAt);
}
function renderHUD(){
  const elScore   = document.getElementById('hudScore');
  const elSolved  = document.getElementById('hudSolved');
  const elStrikes = document.getElementById('hudStrikes');
  if(elScore)   elScore.textContent  = String(state.session?.totalScore ?? 0);
  if(elSolved)  elSolved.textContent = String(state.session?.puzzlesSolved ?? 0);
  if(elStrikes) elStrikes.textContent = `${state.session?.strikesUsed ?? 0}/${MAX_STRIKES}`;
  const submitBtn = document.getElementById('submitScoreBtn');
  if(submitBtn) submitBtn.style.display = state.session?.isOver ? 'inline-flex' : 'none';
}

// ===== Puzzle generation =====
function makeRng(){
  // simple per-puzzle randomness
  return rngFromSeed(Math.floor(Math.random()*1e9));
}
function generatePuzzle(){
  const rnd = makeRng();
  const tiers = shuffleSeeded(tiersOrder, rnd);
  for(let attempt=0; attempt<40; attempt++){
    const pickedCats = sampleNSeeded(CATS, 4, rnd);
    const sets = [];
    const used = new Set();
    let ok = true;
    for(let i=0;i<4;i++){
      const c = pickedCats[i];
      const words = sampleNSeeded(c.words, 4, rnd);
      for(const w of words){
        if(used.has(w)){ ok=false; break; }
        used.add(w);
      }
      if(!ok) break;
      sets.push({ title: c.title, words, tier: tiers[i] });
    }
    if(ok){
      const words = [];
      const wordToTitle = new Map();
      sets.forEach(s => s.words.forEach(w => { words.push(w); wordToTitle.set(w, s.title); }));
      return { tiers, sets, words, wordToTitle };
    }
  }
  // fallback
  const pickedCats = sampleNSeeded(CATS, 4, rnd);
  const sets = pickedCats.map((c,i)=>({ title:c.title, words: c.words.slice(0,4), tier: tiers[i%4] }));
  const words = [];
  const wordToTitle = new Map();
  sets.forEach(s => s.words.forEach(w => { words.push(w); wordToTitle.set(w, s.title); }));
  return { tiers, sets, words, wordToTitle };
}

// ===== Game rendering & logic =====
function updateStatus(){
  elStatus.textContent = `Solved ${state.solved.length}/4 · Strikes ${state.strikes}/${MAX_STRIKES}`;
}
function clearSel(){ state.selected.clear(); }
function toggle(word){
  if(state.solved.length===4) return;
  if(state.selected.has(word)) state.selected.delete(word);
  else{
    if(state.selected.size>=4) return;
    state.selected.add(word);
  }
  updateStatus();
  render();
}

function render(){
  elGame.innerHTML = '';
  // solved blocks
  for(const g of state.solved){
    const block = document.createElement('div');
    block.className = 'group ' + tierClass(g.tier);
    const title = document.createElement('div');
    title.className = 'group-title';
    title.textContent = `${g.title} (${g.tier.toUpperCase()})`;
    block.appendChild(title);
    const row = document.createElement('div');
    row.className = 'group-words';
    g.words.forEach(w=>{
      const c = document.createElement('div');
      c.className = 'chip';
      c.textContent = w;
      row.appendChild(c);
    });
    block.appendChild(row);
    elGame.appendChild(block);
  }

  if(state.solved.length===4){
    elStatus.textContent = 'Perfect! You solved them all.';
    return;
  }

  // grid of current words
  const grid = document.createElement('div');
  grid.className = 'grid';
  for(const w of state.pool){
    const btn = document.createElement('button');
    btn.className = 'tile' + (state.selected.has(w) ? ' sel':'');
    btn.textContent = w;
    btn.addEventListener('click', ()=> toggle(w));
    grid.appendChild(btn);
  }
  elGame.appendChild(grid);
}

function liRow(idx, name, score, timeMs){
  const li = document.createElement('li');
  li.innerHTML = `<span class="pos">${idx}</span> <span class="name">${escapeHtml(name)}</span> <span class="score">${score}</span> <span class="time">${Math.round(timeMs/1000)}s</span>`;
  return li;
}

async function check(){
  if(state.selected.size!==4) return;
  const chosen = [...state.selected];
  const title  = state.current.wordToTitle.get(chosen[0]);
  const allSame = chosen.every(w => state.current.wordToTitle.get(w) === title);
  if(allSame){
    // success: add solved set with its tier
    const set = state.current.sets.find(s => s.title === title);
    state.solved.push({ title, words: set.words.slice(), tier: set.tier });
    // remove from pool
    state.pool = state.pool.filter(w => !set.words.includes(w));
    clearSel();
    updateStatus();
    render();
    // if puzzle finished, score and load next
    if(state.solved.length === 4){
      toast('Perfect! Puzzle cleared.');
      awardPuzzleSolved();
      loadNextPuzzle();
    }
  }else{
    // wrong guess
    state.strikes += 1;
    registerStrike();
    // small shake feedback via class, if you have CSS
    elGame.classList.add('shake'); setTimeout(()=> elGame.classList.remove('shake'), 300);
    clearSel();
    updateStatus();
    render();
    if(state.strikes >= MAX_STRIKES){
      revealAll();
      endArcadeSession('out-of-strikes');
    }
  }
}

function revealAll(){
  const found = new Set(state.solved.map(s=>s.title));
  for(const s of state.current.sets){ if(!found.has(s.title)) state.solved.push({ title:s.title, words:s.words.slice(), tier:s.tier }); }
  render();
  elStatus.textContent = 'Out of strikes — puzzle revealed.';
}

function loadFirstPuzzle(){
  state.strikes = 0;
  state.selected.clear();
  state.solved = [];
  state.current = generatePuzzle();
  state.pool = shuffleSeeded(state.current.words.slice(), rngFromSeed(Math.random() * 1e9));
  state.startedAt = performance.now();
  updateStatus();
  render();
  toast('Good luck!');
}

function loadNextPuzzle(){
  // carry over strikes in arcade
  state.selected.clear();
  state.solved = [];
  state.current = generatePuzzle();
  state.pool = shuffleSeeded(state.current.words.slice(), rngFromSeed(Math.random() * 1e9));
  state.startedAt = performance.now();
  updateStatus();
  render();
  toast('Next puzzle!');
}

// ===== Leaderboards =====
async function loadLeaderboards(){
  try{
    if(supabase){
      // Prefer a view if present; otherwise join client-side
      let { data, error } = await supabase
        .from('scores_with_names')
        .select('*')
        .eq('mode','arcade')
        .order('score',{ascending:false})
        .order('duration_ms',{ascending:true})
        .limit(50);
      if(error){
        // fallback to scores + fetch names
        const res = await supabase
          .from('scores')
          .select('player_id,score,duration_ms,created_at,mode')
          .eq('mode','arcade')
          .order('score',{ascending:false})
          .order('duration_ms',{ascending:true})
          .limit(50);
        if(res.error) throw res.error;
        const rows = res.data;
        // fetch players map
        const { data: players } = await supabase.from('players').select('id,name');
        const map = new Map((players||[]).map(p=>[p.id,p.name]));
        data = rows.map(r=>({ ...r, name: map.get(r.player_id)||('Player ' + String(r.player_id).slice(0,4)) }));
      }
      renderLeaderboard(data||[], data||[]);
      return;
    }
  }catch(err){
    console.warn('loadLeaderboards cloud error → local fallback:', err);
  }

  const scores = storage.get('scores', []).filter(s=>s.mode==='arcade');
  const sorted = scores.slice().sort((a,b)=>
    (b.score - a.score) || (a.duration_ms - b.duration_ms) || (new Date(a.created_at) - new Date(b.created_at))
  );
  renderLeaderboard(sorted.slice(0,10), sorted.slice(0,20));
  toast('Showing local leaderboard (cloud unavailable).');
}

function renderLeaderboard(todayList, allList){
  if(elLbToday){
    elLbToday.innerHTML = '';
    (todayList||[]).forEach((r,i)=> elLbToday.appendChild(liRow(i+1, r.name||'Player', r.score, r.duration_ms||0)));
    if(elLbTodayEmpty) elLbTodayEmpty.hidden = (todayList||[]).length>0;
  }
  if(elLbAll){
    elLbAll.innerHTML = '';
    (allList||[]).forEach((r,i)=> elLbAll.appendChild(liRow(i+1, r.name||'Player', r.score, r.duration_ms||0)));
    if(elLbAllEmpty) elLbAllEmpty.hidden = (allList||[]).length>0;
  }
}

// ===== Submit (manual) =====
async function submitArcadeScore(){
  if(!state?.player){ toast('Pick a player first'); return; }
  if(!state?.session?.isOver){ toast('Finish the game first'); return; }
  if(state.session.submitted){ toast('Already submitted'); return; }

  const payload = {
    date: todayISO(),
    mode: 'arcade',
    score: state.session.totalScore,
    strikes: state.session.strikesUsed,
    duration_ms: sessionDurationMs(),
    created_at: new Date().toISOString(),
  };

  const saveLocal = () => {
    const list = storage.get('scores', []);
    list.push({ ...payload, player_id: state.player.id, name: state.player.name });
    storage.set('scores', list);
    localStorage.setItem('__scores_ping__', String(Date.now()));
    state.session.submitted = true;
    toast(`Saved locally: ${payload.score} pts`);
  };

  if(!supabase){ saveLocal(); return; }

  try{
    const up = await supabase.from('players').upsert({ name: state.player.name }, { onConflict:'name' }).select().single();
    if(up.error) throw up.error;
    state.player = up.data;
    storage.set('player', up.data);

    const res = await supabase.from('scores').insert({ ...payload, player_id: up.data.id }).select().single();
    if(res.error) throw res.error;

    state.session.submitted = true;
    toast(`Submitted (cloud): ${payload.score} pts`);
    await loadLeaderboards();
  }catch(e){
    console.error('Score insert failed → local fallback', e);
    saveLocal();
  }
}

// ===== Game Over bar (created dynamically) =====
(function ensureGameOverBar(){
  if(document.getElementById('gameOverBar')) return;
  const bar = document.createElement('div');
  bar.id = 'gameOverBar';
  bar.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:12px;';
  bar.innerHTML = `
    <button id="submitScoreBtn" style="display:none;">Submit score</button>
    <button id="newGameBtn">New game</button>
    <span id="gameOverNote" style="opacity:.7;"></span>
    <div id="hud" style="margin-left:auto;opacity:.9;">Score: <strong id="hudScore">0</strong> · Solved: <strong id="hudSolved">0</strong> · Strikes: <strong id="hudStrikes">0/${MAX_STRIKES}</strong></div>
  `;
  (document.getElementById('game')?.parentElement || document.body).appendChild(bar);
})();
function showGameOver(){
  const note = document.getElementById('gameOverNote');
  if(note && state.session){
    note.textContent = `Game over — ${state.session.puzzlesSolved} solved · ${state.session.strikesUsed} strikes · ${Math.round(sessionDurationMs()/1000)}s`;
  }
  const submitBtn = document.getElementById('submitScoreBtn');
  if(submitBtn) submitBtn.style.display = 'inline-flex';
}
document.addEventListener('click', (e)=>{
  if(e.target?.id==='newGameBtn'){
    startArcadeSession();
    loadFirstPuzzle();
  }else if(e.target?.id==='submitScoreBtn'){
    submitArcadeScore();
  }
});

// ===== Toast =====
let toastTimer=null;
function toast(msg){
  if(!elToast) return;
  elToast.textContent = msg;
  elToast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> elToast.classList.remove('show'), 1800);
}

// ===== Start =====
async function start(){
  await initSupabase();
  await loadLeaderboards();
  if(elTodayNote) elTodayNote.textContent = '(UTC · arcade)';
  openGate();
}

// Wire non-module globals your HTML may call
window.check = check;
window.start = start;

// Auto-start if desired
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', start);
}else{
  start();
}



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


let supabase = null;
async function initSupabase(){
  if(!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  try{
    const mod = await import('https://esm.sh/@supabase/supabase-js@2');
    supabase = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }catch(err){ console.warn('Supabase SDK failed to load:', err); }
}

// ===== Utilities ===========================================================
function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^(t>>>15), t|1); t^=t+Math.imul(t^(t>>>7), t|61); return ((t^(t>>>14))>>>0)/4294967296; } }
function hashString(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function rngFromSeed(seed){ return mulberry32(seed>>>0); }
function shuffleSeeded(arr, rnd){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function sampleNSeeded(arr, n, rnd){ return shuffleSeeded(arr, rnd).slice(0,n); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
const storage = { get(k, d=null){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } }, set(k, v){ localStorage.setItem(k, JSON.stringify(v)); } };

// ===== DOM refs ============================================================
const elGame = document.getElementById('game');
const elStatus = document.getElementById('status-text');
const elToast = document.getElementById('toast');
const elShuffle = document.getElementById('btn-shuffle');
const elClear = document.getElementById('btn-deselect');
const elNew = document.getElementById('btn-new');
const elDaily = document.getElementById('daily-toggle');
const elChangePlayer = document.getElementById('btn-change-player');

// Gate elements
const elGate = document.getElementById('player-gate');
const elSelect = document.getElementById('player-select');
const elNewField = document.getElementById('new-name-field');
const elNewInput = document.getElementById('new-player-name');
const elGateGo = document.getElementById('gate-continue');

// Leaderboard refs
const elLbToday = document.getElementById('lb-today');
const elLbAll = document.getElementById('lb-alltime');
const elLbTodayEmpty = document.getElementById('lb-today-empty');
const elLbAllEmpty = document.getElementById('lb-all-empty');
const elLbRefresh = document.getElementById('lb-refresh');
const elTodayNote = document.getElementById('today-note');

// ===== Game state ==========================================================
const tiersOrder = ['y','g','b','p'];
const tierClass = t => ({y:'tier-y',g:'tier-g',b:'tier-b',p:'tier-p'})[t] || 'tier-y';
let state = { current:null, pool:[], solved:[], selected:new Set(), strikes:0, daily:false, player:null, startedAt:0 };
let playersCache = [];

// ===== Players =============================================================
async function fetchPlayers(){
  if(!supabase) return storage.get('players', []);
  try{
    const { data, error } = await supabase.from('players').select('id,name').order('name');
    if(error) throw error; return data;
  }catch(err){ console.warn('fetchPlayers error:', err); return []; }
}
function getSavedPlayer(){ return storage.get('player', null); }
function getPlayerById(id){ return playersCache.find(p=>p.id===id) || null; }
async function upsertPlayer(name){
  name = (name||'').trim().slice(0,24);
  if(!name) return null;
  if(!supabase){
    let players = storage.get('players', []);
    let p = players.find(x=>x.name.toLowerCase()===name.toLowerCase());
    if(!p){ p = { id: crypto.randomUUID(), name }; players.push(p); storage.set('players', players); }
    storage.set('player', p); return p;
  }
  try{
    const { data, error } = await supabase.from('players').upsert({ name }, { onConflict:'name' }).select().single();
    if(error) throw error; storage.set('player', data); return data;
  }catch(err){ console.warn('upsertPlayer error:', err); return null; }
}

async function refreshPlayers(){ playersCache = await fetchPlayers(); }

async function populatePlayerSelect(){
  await refreshPlayers();
  const saved = getSavedPlayer();
  const opts = playersCache.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`);
  opts.push(`<option value="__add__">➕ Add new player…</option>`);
  elSelect.innerHTML = opts.join('');

  if(saved){
    const match = playersCache.find(p=>p.id===saved.id) || playersCache.find(p=>p.name.toLowerCase()===saved.name?.toLowerCase());
    if(match) elSelect.value = match.id;
  }

  if(playersCache.length===0){ elSelect.value='__add__'; elNewField.hidden=false; elNewInput.focus(); }
  else { elNewField.hidden = (elSelect.value !== '__add__'); }
}

function openGate(){ elGate.hidden=false; populatePlayerSelect(); }
function closeGate(){ elGate.hidden=true; }

elSelect.addEventListener('change', ()=>{
  const add = elSelect.value==='__add__';
  elNewField.hidden = !add; if(add) elNewInput.focus();
});

elGateGo.addEventListener('click', async ()=>{
  const val = elSelect.value;
  let player = null;
  if(val==='__add__'){
    const name = elNewInput.value.trim();
    if(!name){ elNewInput.focus(); return; }
    player = await upsertPlayer(name);
    await refreshPlayers();
  } else {
    player = getPlayerById(val);
    if(player) storage.set('player', player);
  }
  if(!player) return;
  state.player = player;
  closeGate();
  await loadLeaderboards();
  toast(`Hello, ${player.name}!`);
  newGame();
});

elChangePlayer.addEventListener('click', ()=>{ openGate(); });

// ===== Leaderboard =========================================================
function computeScore(strikes){ return 100 - (20 * clamp(strikes,0,4)); }
async function submitScore({ score, strikes, durationMs, mode }){
  const player = state.player; if(!player) return;
  if(!supabase){
    const list = storage.get('scores', []);
    list.push({ player_id: player.id, name: player.name, date: todayISO(), score, mode, strikes, duration_ms: durationMs, created_at: new Date().toISOString() });
    storage.set('scores', list);
    try{ localStorage.setItem('__scores_ping__', String(Date.now())); }catch{}
    return;
  }
  try{
    const { error } = await supabase.from('scores').insert({
      player_id: player.id,
      date: todayISO(),
      score, mode, strikes, duration_ms: durationMs
    });
    if(error) throw error;
  }catch(err){ console.warn('submitScore error:', err); }
}
async function loadLeaderboards(){
  if(!supabase){
    const scores = storage.get('scores', []);
    const today = todayISO();
    const todayList = scores.filter(s=>s.date===today).sort((a,b)=> b.score-a.score || a.duration_ms-b.duration_ms).slice(0,10);
    const allList = scores.slice().sort((a,b)=> b.score-a.score || a.duration_ms-b.duration_ms).slice(0,20);
    renderLeaderboard(todayList, allList); return;
  }
  try{
    const { data:todayData, error:err1 } = await supabase
      .from('scores_with_names')
      .select('*')
      .eq('date', todayISO())
      .order('score', { ascending:false })
      .order('duration_ms', { ascending:true })
      .limit(10);
    if(err1) throw err1;
    const { data:allData, error:err2 } = await supabase
      .from('scores_with_names')
      .select('*')
      .order('score', { ascending:false })
      .order('duration_ms', { ascending:true })
      .limit(20);
    if(err2) throw err2;
    renderLeaderboard(todayData||[], allData||[]);
  }catch(err){ console.warn('loadLeaderboards error:', err); renderLeaderboard([], []); }
}
function renderLeaderboard(todayList, allList){
  elLbToday.innerHTML = todayList.map(liRow).join('');
  elLbAll.innerHTML = allList.map(liRow).join('');
  elLbTodayEmpty.hidden = todayList.length>0;
  elLbAllEmpty.hidden = allList.length>0;
}
function liRow(row){
  const name = row.name || (row.player?.name) || '—';
  const secs = row.duration_ms != null ? Math.round(row.duration_ms/1000) : null;
  const meta = [ `${row.score} pts`, secs!=null? `${secs}s` : null, row.mode? String(row.mode).toUpperCase():null ].filter(Boolean).join(' · ');
  return `<li><span class="lb-name">${escapeHtml(name)}</span><span class="lb-meta">${meta}</span></li>`;
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

function startLiveUpdates(){
  if(supabase){
    try{
      supabase.channel('scores-live')
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'scores' }, ()=>{ loadLeaderboards(); })
        .subscribe();
    }catch(err){ console.warn('Realtime subscribe error:', err); }
  } else {
    window.addEventListener('storage', (e)=>{ if(e.key==='scores' || e.key==='__scores_ping__') loadLeaderboards(); });
  }
}

// ===== Puzzle generation (unique 16 words) ================================
function todaysSeed(){ return hashString('connections:'+todayISO()); }
function makeRng(){ const seed = state.daily ? todaysSeed() : Math.floor(Math.random()*2**32); return rngFromSeed(seed); }
function pickUniqueWords(bank, used, rnd, n=4){ const pool = bank.filter(w => !used.has(w)); if(pool.length < n) return null; return sampleNSeeded(pool, n, rnd); }
function generatePuzzle(){
  const rnd = makeRng();
  const tiers = shuffleSeeded(tiersOrder, rnd);
  for(let attempt=0; attempt<40; attempt++){
    const pickedCats = sampleNSeeded(CATS, 4, rnd);
    const sets = []; const used = new Set(); let ok = true;
    for(let i=0;i<4;i++){
      const c = pickedCats[i];
      const words = pickUniqueWords(c.bank, used, rnd, 4);
      if(!words){ ok=false; break; }
      words.forEach(w=>used.add(w));
      sets.push({ title:c.title, words, tier: tiers[i] });
    }
    if(ok){
      const words = []; const wordToTitle = new Map();
      sets.forEach(s=> s.words.forEach(w=>{ words.push(w); wordToTitle.set(w, s.title); }));
      return { tiers, sets, words, wordToTitle };
    }
  }
  const pickedCats = sampleNSeeded(CATS, 4, rnd);
  const sets = pickedCats.map((c, idx)=>({ title:c.title, words:sampleNSeeded(c.bank, 4, rnd), tier:tiers[idx] }));
  const words = []; const wordToTitle = new Map();
  sets.forEach(s=> s.words.forEach(w=>{ words.push(w); wordToTitle.set(w, s.title); }));
  return { tiers, sets, words, wordToTitle };
}

// ===== Render & Gameplay ===================================================
function toast(msg){ elToast.textContent = msg; elToast.classList.add('show'); setTimeout(()=>elToast.classList.remove('show'), 1200); }
function updateStatus(){ const s=state.selected.size; elStatus.textContent = s===0? 'Find four groups of four.' : `Selected ${s}/4`; for(let i=1;i<=4;i++){ document.getElementById('s'+i).classList.toggle('fill', i<=state.strikes); } }
function render(){
  elGame.innerHTML='';
  for(const g of state.solved){
    const block=document.createElement('div'); block.className='group';
    const title=document.createElement('div'); title.className='title '+tierClass(g.tier); title.textContent=g.title; block.appendChild(title);
    g.words.forEach(w=>{ const c=document.createElement('div'); c.className='card locked'; c.textContent=w; block.appendChild(c); });
    elGame.appendChild(block);
  }
  if(state.solved.length===4){ elStatus.textContent='Perfect! You solved them all.'; return; }
  const grid=document.createElement('div'); grid.className='grid';
  state.pool.forEach(word=>{ const btn=document.createElement('button'); btn.className='card'; btn.type='button'; btn.setAttribute('aria-pressed', state.selected.has(word)?'true':'false'); btn.textContent=word; btn.addEventListener('click', ()=>toggle(word)); grid.appendChild(btn); });
  elGame.appendChild(grid);
}
function toggle(word){ const sel=state.selected; sel.has(word)?sel.delete(word):sel.add(word); if(sel.size>4){ sel.delete(sel.values().next().value); } if(sel.size===4){ setTimeout(check, 80);} else { updateStatus(); render(); } }
async function check(){
  if(state.selected.size!==4) return;
  const chosen=[...state.selected]; const title=state.current.wordToTitle.get(chosen[0]);
  const ok=chosen.every(w=>state.current.wordToTitle.get(w)===title);
  if(ok){
    state.pool = state.pool.filter(w=>!state.selected.has(w));
    const tierIdx = state.solved.length; const tier = state.current.tiers[tierIdx] || 'y';
    state.solved.push({title, words:chosen.slice(), tier});
    state.selected.clear(); toast('Correct!');
  } else {
    state.strikes++; toast('Nope — try another combo.'); if(state.strikes>=4){ revealAll(); return; } state.selected.clear();
  }
  updateStatus(); render();
  if(state.solved.length===4){ await finishGame(); }
}
function revealAll(){ const found=new Set(state.solved.map(s=>s.title)); for(const s of state.current.sets){ if(!found.has(s.title)){ state.solved.push({title:s.title, words:s.words.slice(), tier:s.tier}); }} state.pool=[]; state.selected.clear(); render(); elStatus.textContent='Out of strikes — puzzle revealed.'; }
function shufflePool(){ const rnd=rngFromSeed(Math.floor(Math.random()*2**32)); state.pool=shuffleSeeded(state.pool, rnd); render(); }
function clearSel(){ state.selected.clear(); updateStatus(); render(); }

async function finishGame(){
  const durationMs = performance.now() - state.startedAt;
  const score = computeScore(state.strikes);
  await submitScore({ score, strikes: state.strikes, durationMs, mode: state.daily? 'daily':'random' });
  await loadLeaderboards();
  toast(`Submitted: ${score} pts`);
}

// ===== Init / Events =======================================================
function newGame(){ state.strikes=0; state.selected.clear(); state.solved=[]; state.current=generatePuzzle(); state.pool=shuffleSeeded(state.current.words.slice(), rngFromSeed(Math.random()*1e9)); state.startedAt=performance.now(); updateStatus(); render(); toast('New puzzle'); }

document.getElementById('btn-shuffle').addEventListener('click', ()=>{ shufflePool(); toast('Shuffled'); });
document.getElementById('btn-deselect').addEventListener('click', ()=>{ clearSel(); });
document.getElementById('btn-new').addEventListener('click', ()=>{ newGame(); });

document.getElementById('daily-toggle').addEventListener('change', (e)=>{ state.daily=!!e.target.checked; elTodayNote.textContent='(UTC)'; newGame(); });
elLbRefresh.addEventListener('click', ()=>{ loadLeaderboards(); });

(async function start(){
  await initSupabase();
  await loadLeaderboards();
  startLiveUpdates();
  state.daily = false; // default off; toggle available
  openGate();
})();



// Connections — Infinite (seeded or random) + Name & Leaderboard
// Daily mode: everyone gets the same puzzle per UTC date
// Random mode: new seed each click

// Connections — Infinite (seeded/random) + Name & Live Leaderboard
// Fixes: no top-level await, no exports, robust load/render, live updates

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
function todayISO(){ return new Date().toISOString().slice(0,10); } // UTC to match daily seed
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
const storage = { get(k, d=null){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } }, set(k, v){ localStorage.setItem(k, JSON.stringify(v)); } };

// ===== Category bank (100+)  — same as previous version ===================
// (Trimmed for brevity in this snippet; keep the full CATS array you already have.)

// ===== Category bank (100+). Keep banks >=6 words where possible. =========
// NOTE: Some banks naturally share words (e.g., ALPHA in NATO/GREEK). The
// generator below enforces **unique words** per puzzle across all 16 cards.
const CATS = [
  // General knowledge
  {title:'PASTA SHAPES', bank:['PENNE','ROTINI','FARFALLE','RIGATONI','FUSILLI','ORECCHIETTE','LINGUINE','CAVATAPPI','GEMELLI','SPAGHETTI']},
  {title:'KINDS OF TREE', bank:['OAK','MAPLE','BIRCH','PINE','CEDAR','ELM','ASH','SPRUCE','WALNUT','WILLOW']},
  {title:'FOLLOWS “BOOK”', bank:['WORM','MARK','CLUB','STORE','SHELF','CASE','BAG','ENDS','BINDER']},
  {title:'HURRY / SPEED', bank:['RUSH','HASTE','DASH','SPRINT','HUSTLE','SCURRY','ZIP','ZOOM']},
  {title:'PLANETS', bank:['MERCURY','VENUS','EARTH','MARS','JUPITER','SATURN','URANUS','NEPTUNE']},
  {title:'CHESS PIECES', bank:['KING','QUEEN','ROOK','BISHOP','KNIGHT','PAWN']},
  {title:'HOT DRINKS', bank:['TEA','COFFEE','COCOA','LATTE','ESPRESSO','MOCHA','MATCHA','CHAI']},
  {title:'PRECEDE “LIGHT”', bank:['DAY','MOON','GAS','HEAD','SPOT','STAR','STOP','TRAFFIC']},
  {title:'PROGRAMMING LANGUAGES', bank:['PYTHON','RUBY','JAVA','GO','SWIFT','KOTLIN','RUST','PHP','SCALA','TYPESCRIPT']},
  {title:'FLOWER PARTS', bank:['PETAL','STEM','SEPAL','STAMEN','PISTIL','ANTHER','FILAMENT']},
  {title:'TEMPO MARKINGS', bank:['LARGO','ANDANTE','ALLEGRO','PRESTO','ADAGIO','VIVACE','MODERATO']},
  {title:'___ BOARD', bank:['WHITE','CHALK','KEY','SURF','CUTTING','LEADER','SCORE','DASH']},
  {title:'ISLAND NATIONS', bank:['ICELAND','JAPAN','MADAGASCAR','CYPRUS','MALTA','SINGAPORE','JAMAICA','FIJI','TAIWAN']},
  {title:'STONE FRUIT', bank:['PEACH','PLUM','CHERRY','APRICOT','NECTARINE','MANGO','OLIVE','DATE']},
  {title:'FOLLOWS “RAIN”', bank:['BOW','COAT','DROP','FALL','STORM','WATER','CHECK','FOREST']},
  {title:'SPORTS WITH NETS', bank:['TENNIS','BADMINTON','VOLLEYBALL','BASKETBALL','SQUASH','HANDBALL']},
  {title:'DOG BREEDS', bank:['BEAGLE','POODLE','CORGI','BOXER','LABRADOR','HUSKY','PUG','DALMATIAN','DOBERMAN']},
  {title:'HAVE WHEELS', bank:['CAR','TROLLEY','SUITCASE','SKATEBOARD','STROLLER','BICYCLE','SCOOTER','ROLLERBLADES']},
  {title:'END WITH “-MENT”', bank:['PAYMENT','MOVEMENT','JUDGMENT','FRAGMENT','APARTMENT','ALIGNMENT','BASEMENT','MOMENT']},
  {title:'BOOK SECTIONS', bank:['INDEX','PREFACE','GLOSSARY','APPENDIX','EPILOGUE','FOREWORD','PROLOGUE','ACKNOWLEDGEMENTS']},
  {title:'METALS', bank:['IRON','SILVER','GOLD','TIN','COPPER','NICKEL','ZINC','LEAD','ALUMINIUM']},
  {title:'BEGIN / START', bank:['START','COMMENCE','LAUNCH','INITIATE','OPEN','BEGIN','KICKOFF','EMBARK']},
  {title:'OCEAN ZONES', bank:['ABYSS','BENTHIC','PELAGIC','NERITIC','LITTORAL','BATHYAL','ABYSSAL']},
  {title:'CARD SUITS', bank:['HEARTS','CLUBS','SPADES','DIAMONDS']},
  {title:'NATO ALPHABET', bank:['ALPHA','BRAVO','CHARLIE','DELTA','ECHO','FOXTROT','GOLF','HOTEL','INDIA','JULIETT','KILO','LIMA']},
  {title:'CURRENCIES', bank:['EURO','YEN','POUND','RUPEE','DOLLAR','WON','RUBLE','PESO','NAIRA']},
  {title:'KITCHEN VERBS', bank:['CHOP','BOIL','FRY','BAKE','SAUTÉ','SIMMER','WHISK','PEEL','GRILL']},
  {title:'WINTER WEAR', bank:['SCARF','MITTENS','BEANIE','EARMUFFS','PARKA','COAT','BOOTS','GLOVES']},
  {title:'CAN BE “CRACKED”', bank:['EGG','MIRROR','CODE','JOKE','SAFE','SCREEN','WALL']},
  {title:'BASIC SHAPES', bank:['CIRCLE','SQUARE','TRIANGLE','RECTANGLE','OVAL','DIAMOND','HEXAGON','PENTAGON']},
  {title:'NIGHT‑TIME', bank:['MOON','STARS','OWL','DREAM','MIDNIGHT','NIGHTFALL','TWILIGHT']},
  {title:'PAIR WITH “PAPER”', bank:['CLIP','TOWEL','CUT','BACK','WEIGHT','WORK','CHASE','PLANE']},

  // Pop culture
  {title:'ONE‑WORD FILMS', bank:['INCEPTION','GLADIATOR','AVATAR','ALIEN','JOKER','DUNE','FROZEN','SKYFALL','COCO','ROCKY']},
  {title:'PIXAR FILMS', bank:['COCO','UP','SOUL','INSIDE OUT','RATATOUILLE','BRAVE','CARS','ONWARD','WALL‑E']},
  {title:'MARVEL HEROES', bank:['IRON MAN','THOR','HULK','SPIDER‑MAN','CAPTAIN AMERICA','BLACK WIDOW','ANT‑MAN','HAWKEYE']},
  {title:'HARRY POTTER TERMS', bank:['WAND','QUIDDITCH','SNITCH','AUROR','HORCRUX','OWL','POTION','MUGGLE','DIAGON ALLEY']},
  {title:'DISNEY PRINCESSES', bank:['ARIEL','BELLE','TIANA','JASMINE','MULAN','AURORA','RAPUNZEL','MERIDA','SNOW WHITE']},
  {title:'90S CARTOONS', bank:['POKEMON','RUGRATS','HEY ARNOLD','DOUG','RECESS','DEXTER’S LAB','ANIMANIACS','X‑MEN']},
  {title:'VIDEO GAME ICONS', bank:['MARIO','LINK','SONIC','SAMUS','LARA CROFT','KRATOS','KIRBY','PIKACHU']},
  {title:'MUSIC GENRES', bank:['ROCK','POP','JAZZ','BLUES','RAP','COUNTRY','REGGAE','METAL','FOLK']},
  {title:'MUSICAL INSTRUMENTS', bank:['PIANO','GUITAR','VIOLIN','FLUTE','DRUMS','CELLO','TRUMPET','SAXOPHONE','TROMBONE']},
  {title:'GRAMMY WINNERS (SOLO)', bank:['ADELE','BEYONCE','TAYLOR SWIFT','ED SHEERAN','BILLIE EILISH','LIZZO','DUA LIPA','BRUNO MARS']},
  {title:'K‑POP TERMS', bank:['IDOL','FANDOM','DEBUT','COMEBACK','MAKNAE','LEADER','BIAS','LIGHTSTICK']},

  // Science & maths
  {title:'SI UNITS', bank:['METRE','SECOND','KILOGRAM','AMPERE','KELVIN','MOLE','CANDELA']},
  {title:'SI PREFIXES', bank:['KILO','MEGA','GIGA','TERA','MILLI','MICRO','NANO','PICO','CENTI']},
  {title:'GREEK LETTERS', bank:['ALPHA','BETA','GAMMA','DELTA','EPSILON','THETA','OMEGA','SIGMA','LAMBDA']},
  {title:'NOBLE GASES', bank:['HELIUM','NEON','ARGON','KRYPTON','XENON','RADON']},
  {title:'HUMAN ORGANS', bank:['HEART','LUNG','LIVER','BRAIN','KIDNEY','STOMACH','SPLEEN','PANCREAS']},
  {title:'BONES', bank:['FEMUR','TIBIA','RADIUS','ULNA','HUMERUS','PELVIS','RIB','SKULL','CLAVICLE']},
  {title:'CLOUD TYPES', bank:['CIRRUS','CUMULUS','STRATUS','NIMBUS','ALTOSTRATUS','CIRROCUMULUS','ALTOCUMULUS']},
  {title:'PARTS OF A CELL', bank:['NUCLEUS','MITOCHONDRIA','RIBOSOME','LYSOSOME','GOLGI','CHLOROPLAST','VACUOLE','CYTOPLASM']},
  {title:'SUBATOMIC PARTICLES', bank:['PROTON','NEUTRON','ELECTRON','QUARK','GLUON','PHOTON','NEUTRINO','HIGGS']},
  {title:'ENERGY TYPES', bank:['KINETIC','POTENTIAL','THERMAL','CHEMICAL','ELECTRICAL','NUCLEAR','SOLAR','WIND']},
  {title:'EARTH LAYERS', bank:['CRUST','MANTLE','CORE','LITHOSPHERE','ASTHENOSPHERE','OUTER CORE','INNER CORE']},
  {title:'METRIC MEASURES', bank:['LITRE','GRAM','METRE','NEWTON','JOULE','PASCAL','WATT']},
  {title:'MATHS OPERATIONS', bank:['ADD','SUBTRACT','MULTIPLY','DIVIDE','MODULO','EXPONENT','ROOT']},
  {title:'POLYGONS', bank:['TRIANGLE','SQUARE','PENTAGON','HEXAGON','HEPTAGON','OCTAGON','NONAGON','DECAGON']},
  {title:'PRIME NUMBERS (WORDS)', bank:['TWO','THREE','FIVE','SEVEN','ELEVEN','THIRTEEN','SEVENTEEN','NINETEEN']},
  {title:'CALCULUS TERMS', bank:['LIMIT','DERIVATIVE','INTEGRAL','SERIES','VECTOR','GRADIENT','DIVERGENCE','JACOBIAN']},
  {title:'SCIENTISTS', bank:['EINSTEIN','NEWTON','CURIE','TESLA','DARWIN','HAWKING','GALILEO','FARADAY']},
  {title:'SPACE AGENCIES', bank:['NASA','ESA','ISRO','JAXA','CNSA','ROSCOSMOS']},

  // Geography
  {title:'EU CAPITALS', bank:['PARIS','ROME','MADRID','BERLIN','VIENNA','PRAGUE','DUBLIN','LISBON','WARSAW']},
  {title:'US STATES (SHORT)', bank:['TEXAS','MAINE','UTAH','OHIO','IDAHO','OREGON','NEVADA','ALASKA','FLORIDA']},
  {title:'RIVERS', bank:['NILE','AMAZON','YANGTZE','MISSISSIPPI','DANUBE','GANGES','VOLGA','THAMES']},
  {title:'MOUNTAIN RANGES', bank:['ALPS','ANDES','HIMALAYAS','ROCKIES','URALS','ATLAS','APPALACHIANS','CARPATHIANS']},
  {title:'DESERTS', bank:['SAHARA','GOBI','KALAHARI','MOJAVE','THAR','ATACAMA','ARABIAN','NAMIB']},
  {title:'SEAS', bank:['RED SEA','BLACK SEA','ARAL SEA','BALTIC','CARIBBEAN','MEDITERRANEAN','SARGASSO']},
  {title:'CONSTELLATIONS', bank:['ORION','URSA MAJOR','SCORPIUS','LYRA','CYGNUS','AQUILA','CASSIOPEIA']},

  // Everyday things
  {title:'COLOURS', bank:['RED','BLUE','GREEN','YELLOW','PURPLE','ORANGE','PINK','BROWN','BLACK','WHITE']},
  {title:'FRUITS', bank:['APPLE','BANANA','ORANGE','PEACH','PEAR','MANGO','GRAPE','CHERRY','PLUM','KIWI']},
  {title:'VEGETABLES', bank:['CARROT','ONION','POTATO','TOMATO','PEAS','BROCCOLI','CUCUMBER','SPINACH','CAULIFLOWER']},
  {title:'ANIMALS', bank:['TIGER','LION','BEAR','WOLF','FOX','DEER','ZEBRA','HORSE','PANDA','ELEPHANT']},
  {title:'BIRDS', bank:['EAGLE','SPARROW','PIGEON','PARROT','OWL','SWAN','PEACOCK','CROW','FLAMINGO']},
  {title:'INSECTS', bank:['ANT','BEE','BEETLE','MOTH','WASP','MANTIS','DRAGONFLY','BUTTERFLY']},
  {title:'SEA CREATURES', bank:['SHARK','WHALE','DOLPHIN','OCTOPUS','SEAL','TURTLE','LOBSTER','SQUID','RAY']},
  {title:'KITCHEN TOOLS', bank:['SPOON','FORK','KNIFE','WHISK','TONGS','GRATER','PEELER','SPATULA','LADLE']},
  {title:'BAKED GOODS', bank:['BREAD','MUFFIN','BAGEL','BROWNIE','COOKIE','CROISSANT','PIE','CAKE','TART']},
  {title:'BREAKFAST FOODS', bank:['PANCAKE','WAFFLE','CEREAL','OMELETTE','TOAST','YOGHURT','GRANOLA','BAGEL','PORRIDGE']},
  {title:'SPORTS', bank:['FOOTBALL','CRICKET','RUGBY','HOCKEY','BASEBALL','BASKETBALL','TENNIS','GOLF','ATHLETICS']},
  {title:'CAR PARTS', bank:['ENGINE','TYRE','BRAKE','STEERING','MIRROR','SEAT','BATTERY','RADIATOR','GEARBOX']},
  {title:'JOBS', bank:['DOCTOR','LAWYER','TEACHER','ENGINEER','NURSE','CHEF','ARTIST','WRITER','SCIENTIST']},
  {title:'SCHOOL SUBJECTS', bank:['MATHS','SCIENCE','HISTORY','GEOGRAPHY','MUSIC','ART','PHYSICS','CHEMISTRY','BIOLOGY']},
  {title:'HOUSE ROOMS', bank:['KITCHEN','BEDROOM','BATHROOM','LIVING ROOM','DINING ROOM','GARAGE','ATTIC','BASEMENT','STUDY']},
  {title:'FURNITURE', bank:['SOFA','TABLE','CHAIR','BED','DESK','DRESSER','CABINET','STOOL','BOOKSHELF']},
  {title:'TOOLS', bank:['HAMMER','SAW','DRILL','WRENCH','PLIERS','CHISEL','LEVEL','SANDER','SCREWDRIVER']},
  {title:'BUILDING MATERIALS', bank:['BRICK','CEMENT','STEEL','WOOD','GLASS','STONE','ASPHALT','TILE','CONCRETE']},
  {title:'WEATHER', bank:['SUNNY','RAINY','CLOUDY','WINDY','STORMY','SNOWY','FOGGY','HUMID','MUGGY']},
  {title:'TIME WORDS', bank:['SECOND','MINUTE','HOUR','DAY','WEEK','MONTH','YEAR','DECADE','CENTURY']},
  {title:'EMOTIONS', bank:['HAPPY','SAD','ANGRY','AFRAID','SURPRISED','CALM','PROUD','CONFUSED','JOYFUL']},
  {title:'ACTIONS', bank:['RUN','JUMP','SWIM','FLY','CLIMB','CRAWL','WALK','DANCE','HIDE']},
  {title:'MUSCLE GROUPS', bank:['BICEPS','TRICEPS','DELTOID','QUADRICEPS','HAMSTRING','CALF','PECTORAL','LATS','GLUTES']},
  {title:'FABRICS', bank:['COTTON','WOOL','SILK','LINEN','DENIM','POLYESTER','VELVET','SATIN','LEATHER']},
  {title:'BEVERAGES', bank:['WATER','JUICE','SODA','TEA','COFFEE','LEMONADE','MILKSHAKE','SMOOTHIE','ICED TEA']},
  {title:'SNACKS', bank:['CHIPS','NUTS','POPCORN','COOKIES','CRACKERS','PRETZELS','CANDY','GRANOLA','FRUIT']},

  // Wordplay / grammar
  {title:'HOMOPHONES', bank:['FLOWER','FLOUR','SEA','SEE','KNIGHT','NIGHT','MADE','MAID','STAIR','STARE']},
  {title:'PREFIXES', bank:['PRE','RE','UN','DIS','MIS','ANTI','INTER','SUB','TRANS']},
  {title:'SUFFIXES', bank:['FUL','LESS','NESS','MENT','TION','ABLE','ER','EST','ISM']},

  // Tech
  {title:'WEB BROWSERS', bank:['CHROME','SAFARI','FIREFOX','EDGE','OPERA','BRAVE','VIVALDI']},
  {title:'DATABASES', bank:['MYSQL','POSTGRES','MONGODB','REDIS','SQLITE','COUCHDB','DYNAMODB']},
  {title:'CLOUD PROVIDERS', bank:['AWS','AZURE','GCP','DIGITALOCEAN','HEROKU','VERCEL','NETLIFY']},
  {title:'HTTP VERBS', bank:['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']},
  {title:'FRAMEWORKS', bank:['REACT','VUE','ANGULAR','SVELTE','NEXTJS','NUXT','DJANGO','FLASK']},
  {title:'OPERATING SYSTEMS', bank:['WINDOWS','MACOS','LINUX','ANDROID','IOS','CHROMEOS']},
  {title:'FILE TYPES', bank:['PDF','DOCX','XLSX','PPTX','PNG','JPG','GIF','SVG','TXT']},

  // Bonus pop culture / misc
  {title:'STAR WARS TERMS', bank:['JEDI','SITH','DROID','SABER','FORCE','X‑WING','TATOOINE','HOTH','ENDOR']},
  {title:'POKEMON STARTERS', bank:['BULBASAUR','CHARMANDER','SQUIRTLE','CHIKORITA','CYNDAQUIL','TOTODILE','TREECKO','TORCHIC']},
  {title:'GAME CONSOLES', bank:['NES','SNES','PLAYSTATION','XBOX','SWITCH','GAMECUBE','DREAMCAST','MEGADRIVE']},
  {title:'SOCIAL APPS', bank:['INSTAGRAM','TIKTOK','TWITTER','REDDIT','SNAPCHAT','WHATSAPP','YOUTUBE','DISCORD']},
  {title:'SHAKESPEARE PLAYS', bank:['HAMLET','OTHELLO','MACBETH','THE TEMPEST','ROMEO AND JULIET','KING LEAR','ANTONY AND CLEOPATRA','TWELFTH NIGHT']},
  {title:'FAMOUS AUTHORS', bank:['AUSTEN','ORWELL','TOLKIEN','ROWLING','MURAKAMI','HEMINGWAY','DICKENS','ATWOOD','GARCIA MARQUEZ']},
  {title:'POETRY TERMS', bank:['RHYME','METRE','STANZA','COUPLET','ENJAMBMENT','ODE','SONNET','LIMERICK']},

  // Transport & sport details
  {title:'AIRLINES', bank:['DELTA','UNITED','EMIRATES','QANTAS','RYANAIR','LUFTHANSA','AIR FRANCE','ETIHAD','KLM']},
  {title:'CAR MAKERS', bank:['TOYOTA','HONDA','FORD','BMW','AUDI','TESLA','VOLVO','KIA','MERCEDES']},
  {title:'TRAIN TERMS', bank:['LOCOMOTIVE','CARRIAGE','TRACK','DEPOT','STATION','SWITCH','SIGNAL','CABOOSE']},
  {title:'FOOTBALL POSITIONS', bank:['GOALKEEPER','DEFENDER','MIDFIELDER','STRIKER','WINGER','FULL‑BACK','SWEEPER']},
  {title:'TENNIS TERMS', bank:['ACE','DEUCE','VOLLEY','LOB','BACKHAND','FOREHAND','BREAK','TIE‑BREAK']},

  // Food specifics
  {title:'CHEESES', bank:['CHEDDAR','BRIE','GOUDA','FETA','MOZZARELLA','PARMESAN','SWISS','CAMEMBERT','PROVOLONE']},
  {title:'SPICES', bank:['CUMIN','CORIANDER','TURMERIC','PAPRIKA','CINNAMON','CLOVE','CARDAMOM','NUTMEG','PEPPER']},
  {title:'HERBS', bank:['BASIL','THYME','ROSEMARY','OREGANO','DILL','PARSLEY','MINT','CILANTRO','CHIVES']},
  {title:'PASTA SAUCES', bank:['MARINARA','ALFREDO','PESTO','BOLOGNESE','CARBONARA','ARRABBIATA','PUTTANESCA']},
  {title:'CHOCOLATE BARS', bank:['KITKAT','SNICKERS','TWIX','MARS','BOUNTY','TOBLERONE','CRUNCHIE','DAIRY MILK']},

  // Nature / outdoors
  {title:'TREE PARTS', bank:['ROOT','BARK','TRUNK','BRANCH','LEAF','SEED','SAP','BUD']},
  {title:'WEATHER EVENTS', bank:['TORNADO','HURRICANE','BLIZZARD','DROUGHT','FLOOD','HAIL','HEATWAVE','MONSOON']},
  {title:'GEMSTONES', bank:['DIAMOND','RUBY','SAPPHIRE','EMERALD','AMETHYST','OPAL','TOPAZ','GARNET','JADE']},

  // Business / health
  {title:'STOCK TERMS', bank:['BULL','BEAR','DIVIDEND','EARNINGS','IPO','SHORT','MARGIN','PORTFOLIO']},
  {title:'COMPANY ROLES', bank:['CEO','CTO','CFO','COO','CMO','VP','DIRECTOR','MANAGER']},
  {title:'VITAMINS', bank:['A','B','C','D','E','K','B12','B6']},
  {title:'YOGA POSES', bank:['COBRA','LOTUS','WARRIOR','TREE POSE','BRIDGE','BOAT','PLANK','CHAIR']}
];

// ===== DOM refs ============================================================
const elGame = document.getElementById('game');
const elStatus = document.getElementById('status-text');
const elToast = document.getElementById('toast');
const elShuffle = document.getElementById('btn-shuffle');
const elClear = document.getElementById('btn-deselect');
const elNew = document.getElementById('btn-new');
const elDaily = document.getElementById('daily-toggle');
const elChangePlayer = document.getElementById('btn-change-player');

const elModal = document.getElementById('player-modal');
const elName = document.getElementById('player-name');
const elNameList = document.getElementById('name-list');
const elPmSave = document.getElementById('pm-save');
const elPmCancel = document.getElementById('pm-cancel');

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

// ===== Player handling =====================================================
async function fetchPlayers(){
  if(!supabase) return storage.get('players', []);
  try{
    const { data, error } = await supabase.from('players').select('id,name').order('name');
    if(error) throw error; return data;
  }catch(err){ console.warn('fetchPlayers error:', err); return []; }
}
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
function getSavedPlayer(){ return storage.get('player', null); }
function openPlayerModal(preset=''){ elName.value=preset; elModal.hidden=false; elName.focus(); }
function closePlayerModal(){ elModal.hidden=true; }

// ===== Leaderboard =========================================================
function computeScore(strikes){ return 100 - (20 * clamp(strikes,0,4)); }
async function submitScore({ score, strikes, durationMs, mode }){
  const player = state.player; if(!player) return;
  if(!supabase){
    const list = storage.get('scores', []);
    list.push({ player_id: player.id, name: player.name, date: todayISO(), score, mode, strikes, duration_ms: durationMs, created_at: new Date().toISOString() });
    storage.set('scores', list);
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
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'scores' }, (payload)=>{
          loadLeaderboards();
        })
        .subscribe();
    }catch(err){ console.warn('Realtime subscribe error:', err); }
  } else {
    // Local mode: update if another tab modifies localStorage
    window.addEventListener('storage', (e)=>{ if(e.key==='scores') loadLeaderboards(); });
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

document.getElementById('daily-toggle').addEventListener('change', (e)=>{ state.daily=!!e.target.checked; elTodayNote.textContent = state.daily ? '(UTC)' : '(UTC)'; newGame(); });
elChangePlayer.addEventListener('click', async ()=>{ await populateNameList(); openPlayerModal(state.player?.name||''); });
elLbRefresh.addEventListener('click', ()=>{ loadLeaderboards(); });

elPmSave.addEventListener('click', async ()=>{
  const name = elName.value.trim(); if(!name) return;
  const player = await upsertPlayer(name); if(player){ state.player = player; closePlayerModal(); await loadLeaderboards(); toast(`Hello, ${player.name}!`); }
});
elPmCancel.addEventListener('click', ()=>{ closePlayerModal(); });

async function populateNameList(){ const players = await fetchPlayers(); elNameList.innerHTML = players.map(p=>`<option value="${escapeHtml(p.name)}"></option>`).join(''); }
async function ensurePlayer(){ const saved = getSavedPlayer(); if(saved){ state.player = saved; } else { await populateNameList(); openPlayerModal(''); } }

(async function start(){
  await initSupabase();
  await ensurePlayer();
  await loadLeaderboards();
  startLiveUpdates();
  state.daily = false; // default off; toggle available
  newGame();
})();

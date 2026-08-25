import { firebaseConfig } from './firebase-config.js';
import { DEFAULTS, mergeConfig } from './defaults.js';

const FIREBASE_VERSION = '12.18.0';
const $ = id => document.getElementById(id);
const selected = n => document.querySelector(`input[name="${n}"]:checked`)?.value || '';
const clamp = n => Math.max(1, Math.min(200, Math.round(Number(n) || 0)));

let CONFIG = mergeConfig();
let current = null;

async function connectRealtimeConfig() {
  try {
    const [
      { initializeApp },
      { getFirestore, doc, onSnapshot }
    ] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]);

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    onSnapshot(
      doc(db, 'config', 'site'),
      snap => {
        CONFIG = snap.exists() ? mergeConfig(snap.data()) : mergeConfig();
        populateBrands();
        console.info('Wessy live config updated');
      },
      err => {
        console.warn('Wessy is using local defaults:', err.message);
      }
    );
  } catch (err) {
    console.warn('Firebase unavailable; using local defaults:', err.message);
  }
}

function populateBrands() {
  const sel = $('brand');
  const previous = sel.value;
  sel.innerHTML = '<option value="" disabled>Select your brand</option>';

  const brands = [...new Set(CONFIG.phoneBrands || DEFAULTS.phoneBrands)];
  brands.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    sel.appendChild(opt);
  });

  sel.value = brands.includes(previous) ? previous : brands[0] || '';
}

function findPhoneModel(name, brand) {
  const query = name.trim().toLowerCase();
  if (!query) return null;
  return (CONFIG.phoneModels || []).find(m =>
    String(m.name || '').trim().toLowerCase() === query &&
    (!m.brand || !brand || m.brand === brand)
  ) || (CONFIG.phoneModels || []).find(m =>
    String(m.name || '').trim().toLowerCase() === query
  ) || null;
}

function generate() {
  const brand = $('brand').value;
  const ram = $('ram').value;
  const model = $('model').value.trim() || `${brand || 'Unknown'} device`;
  const pref = $('pref').value;
  const style = selected('style');
  const finger = selected('finger');

  const knownModel = findPhoneModel($('model').value, brand);
  const modelAdj = Number(knownModel?.adjustment || 0);

  const v = { ...CONFIG.baseValues };
  const ramA = Number(CONFIG.ramAdj?.[ram] || 0);
  const brandA = Number(CONFIG.brandAdj?.[brand] || 0);
  const styleA = CONFIG.styleAdj?.[style] || {};
  const prefA = CONFIG.prefAdj?.[pref] || {};
  const fingerA = CONFIG.fingerAdj?.[finger] || {};

  Object.keys(v).forEach(k => {
    v[k] = clamp(
      v[k] + ramA + brandA + modelAdj +
      Number(styleA[k] || 0) +
      Number(prefA[k] || 0) +
      Number(fingerA[k] || 0)
    );
  });

  const score = Math.min(
    98,
    Math.max(
      85,
      90 +
      ($('model').value.trim() ? 3 : 0) +
      (knownModel ? 2 : 0) +
      (parseInt(ram, 10) >= 8 ? 3 : 0) +
      parseInt(finger, 10) - 1
    )
  );

  return { v, ram, style, finger, pref, model, brand, score, knownModel };
}

function render(d) {
  const v = d.v;
  const pairs = [
    ['general', 'general'],
    ['reddot', 'reddot'],
    ['2x', 'x2'],
    ['4x', 'x4'],
    ['sniper', 'sniper'],
    ['freelook', 'freelook']
  ];

  pairs.forEach(([domKey, dataKey]) => {
    $(`val-${domKey}`).textContent = v[dataKey];
    $(`bar-${domKey}`).style.width = `${v[dataKey] / 2}%`;
  });

  $('score').textContent = `${d.score}% Wessy Match`;

  const focus = d.style === 'rusher'
    ? 'fast close-range fights and drag'
    : d.style === 'sniper'
      ? 'long-range scope control'
      : 'balanced all-round gameplay';

  const modelText = d.knownModel
    ? `${d.model} (saved model profile)`
    : d.model;

  $('analysis').textContent =
    `For ${modelText} with ${d.ram} GB RAM and ${d.finger}-finger controls, Wessy tuned this profile for ${focus}.`;

  $('tip').textContent = CONFIG.tips?.[d.style] || CONFIG.tips?.balanced || '';

  const outer = $('ring-outer');
  const inner = $('ring-inner');
  const avg = (v.general + v.reddot + v.sniper) / 3 / 2;
  outer.setAttribute('r', (70 - (avg / 100) * 22).toFixed(1));
  inner.setAttribute('r', (40 - (avg / 100) * 14).toFixed(1));
  $('reticle-label').textContent = `reticle calibrated · sens ${Math.round(avg)}`;

  $('results').classList.remove('hidden');
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function wessyReply(question) {
  const q = question.toLowerCase().trim();
  if (!q) return 'Ask Wessy about sensitivity, aim, drag, headshots, HUD or scopes. 🎮';

  const rule = (CONFIG.wessyReplies || []).find(r =>
    Array.isArray(r.keywords) && r.keywords.some(k => q.includes(String(k).toLowerCase()))
  );

  if (rule?.reply) return rule.reply;

  if (!/(sensitivity|sens|aim|drag|headshot|hud|scope|sniper|rusher|recoil|game|gaming|setup|control)/.test(q)) {
    return "😊 I'm Wessy, your gaming sensitivity assistant. Ask me about sensitivity, drag, headshots, HUD, aim or your gameplay setup.";
  }

  return current
    ? '😊 Your current Wessy profile is ready. Test it first, then make small adjustments one at a time.'
    : '😊 First analyze your setup, then I can help you tune it.';
}

function initUI() {
  populateBrands();

  $('gen-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!$('brand').value) {
      $('brand').reportValidity();
      return;
    }

    $('results').classList.add('hidden');
    $('loading').classList.remove('hidden');

    setTimeout(() => {
      current = generate();
      $('loading').classList.add('hidden');
      render(current);
    }, 700);
  });

  $('reset').addEventListener('click', () => {
    $('model').value = '';
    $('ram').value = '8';
    $('pref').value = 'headshot';
    $('style-rush').checked = true;
    $('f3').checked = true;
    $('results').classList.add('hidden');
    $('reply').classList.add('hidden');
    $('question').value = '';
  });

  $('ask').addEventListener('click', () => {
    $('reply').textContent = `😊 Wessy: ${wessyReply($('question').value)}`;
    $('reply').classList.remove('hidden');
    $('question').value = '';
  });

  $('question').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('ask').click();
    }
  });
}

initUI();
connectRealtimeConfig();

import { firebaseConfig, OWNER_EMAILS } from '../firebase-config.js';
import { DEFAULTS, mergeConfig } from '../defaults.js';
import { ADMIN_PASSWORD_SALT, ADMIN_PASSWORD_HASH } from './admin-auth-config.js';

const FIREBASE_VERSION = '12.18.0';
const $ = id => document.getElementById(id);
const passwordSet =
  ADMIN_PASSWORD_SALT !== 'PASTE_HERE' &&
  ADMIN_PASSWORD_HASH !== 'PASTE_HERE';

let db;
let auth;
let currentConfig = mergeConfig();
let currentUser = null;

if (!passwordSet) {
  $('state').textContent =
    'Owner password is not set yet. Open tools/set-password.html, generate a password hash, then replace the two values in admin/admin-auth-config.js.';
} else {
  initAuth();
}

async function initAuth() {
  try {
    const [
      { initializeApp },
      {
        getAuth,
        GoogleAuthProvider,
        signInWithPopup,
        onAuthStateChanged,
        signOut
      },
      { getFirestore, doc, getDoc, setDoc }
    ] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]);

    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    $('login').onclick = async () => {
      $('state').textContent = 'Opening Google sign-in…';
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(auth, provider);
        const email = String(result.user.email || '').toLowerCase();

        if (!OWNER_EMAILS.includes(email) || !result.user.emailVerified) {
          $('state').textContent = `${email || 'This account'} is not an allowed owner account.`;
          await signOut(auth);
          return;
        }

        currentUser = result.user;
        showPasswordGate(email);
      } catch (err) {
        $('state').textContent = `Sign-in failed: ${friendlyError(err)}`;
      }
    };

    $('logout').onclick = async () => {
      await signOut(auth);
      sessionStorage.removeItem('wessy_pw_ok');
      location.reload();
    };

    onAuthStateChanged(auth, user => {
      const email = String(user?.email || '').toLowerCase();
      if (user && user.emailVerified && OWNER_EMAILS.includes(email)) {
        currentUser = user;
        if (sessionStorage.getItem('wessy_pw_ok') === '1') {
          openDashboard();
        } else {
          showPasswordGate(email);
        }
      }
    });

    async function loadConfig() {
      const snap = await getDoc(doc(db, 'config', 'site'));
      currentConfig = snap.exists() ? mergeConfig(snap.data()) : mergeConfig(DEFAULTS);
    }

    async function saveConfig() {
      const updated = collectForm();
      await setDoc(
        doc(db, 'config', 'site'),
        { ...updated, updatedAt: Date.now(), updatedBy: currentUser.email },
        { merge: true }
      );
      currentConfig = mergeConfig(updated);
    }

    window.__wessyLoadConfig = loadConfig;
    window.__wessySaveConfig = saveConfig;
  } catch (err) {
    $('state').textContent = `Firebase failed to load: ${friendlyError(err)}`;
  }
}

function friendlyError(err) {
  const code = String(err?.code || '');
  if (code.includes('popup-blocked')) return 'Popup was blocked. Allow popups and try again.';
  if (code.includes('unauthorized-domain')) return 'This website domain is not added in Firebase Authentication → Settings → Authorized domains.';
  return err?.message || 'Unknown error';
}

async function hash(pw, salt) {
  const enc = new TextEncoder().encode(salt + pw);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

$('pw-submit').onclick = async () => {
  const pw = $('pw-input').value;
  const h = await hash(pw, ADMIN_PASSWORD_SALT);

  if (h === ADMIN_PASSWORD_HASH) {
    sessionStorage.setItem('wessy_pw_ok', '1');
    $('pw-error').classList.add('hidden');
    await openDashboard();
  } else {
    $('pw-error').classList.remove('hidden');
  }
};

$('pw-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('pw-submit').click();
});

function showPasswordGate(email) {
  $('gate').hidden = true;
  $('who').textContent = email;
  $('pw-gate').hidden = false;
}

async function openDashboard() {
  if (!$('panel').hidden === false) return;
  try {
    await window.__wessyLoadConfig();
    $('pw-gate').hidden = true;
    $('gate').hidden = true;
    $('panel').hidden = false;
    $('who').textContent = currentUser?.email || '';
    renderForm();
  } catch (err) {
    $('state').textContent = `Could not open dashboard: ${friendlyError(err)}`;
    $('gate').hidden = false;
  }
}

function renderForm() {
  renderBase();
  renderRam();
  renderBrands();
  renderModels();
  renderTips();
  renderReplies();
}

function renderBase() {
  const labels = {
    general: 'General',
    reddot: 'Red Dot',
    x2: '2x Scope',
    x4: '4x Scope',
    sniper: 'Sniper Scope',
    freelook: 'Free Look'
  };

  $('base-grid').innerHTML = Object.entries(labels).map(([key, label]) =>
    `<div><label>${label}</label><input type="number" id="bv-${key}" value="${num(currentConfig.baseValues[key])}" min="1" max="200"></div>`
  ).join('');
}

function renderRam() {
  $('ram-grid').innerHTML = ['4', '6', '8', '12'].map(ram =>
    `<div><label>${ram === '12' ? '12 GB+' : ram + ' GB'}</label><input type="number" id="ram-${ram}" value="${num(currentConfig.ramAdj[ram])}"></div>`
  ).join('');
}

function renderBrands() {
  const brands = currentConfig.phoneBrands || [];
  $('brands-list').innerHTML = brands.map((brand, i) =>
    `<div class="item-row editable">
      <span>${escapeHtml(brand)}</span>
      <input type="number" data-brand-adj="${i}" value="${num(currentConfig.brandAdj[brand])}">
      <button data-remove-brand="${i}" title="Delete brand">✕</button>
    </div>`
  ).join('');

  $('brands-list').querySelectorAll('[data-remove-brand]').forEach(btn => {
    btn.onclick = () => {
      const i = Number(btn.dataset.removeBrand);
      const brand = currentConfig.phoneBrands[i];
      currentConfig.phoneBrands.splice(i, 1);
      delete currentConfig.brandAdj[brand];
      currentConfig.phoneModels = currentConfig.phoneModels.filter(m => m.brand !== brand);
      renderBrands();
      renderModels();
      fillModelBrandSelect();
    };
  });

  $('brand-add').onclick = () => {
    const name = $('brand-new').value.trim();
    if (!name || currentConfig.phoneBrands.includes(name)) return;
    currentConfig.phoneBrands.push(name);
    currentConfig.brandAdj[name] = Number($('brand-adj').value || 0);
    $('brand-new').value = '';
    $('brand-adj').value = '0';
    renderBrands();
    fillModelBrandSelect();
  };

  fillModelBrandSelect();
}

function fillModelBrandSelect() {
  const sel = $('model-brand');
  const prev = sel.value;
  sel.innerHTML = '<option value="">Any / no brand</option>';
  (currentConfig.phoneBrands || []).forEach(brand => {
    const opt = document.createElement('option');
    opt.value = brand;
    opt.textContent = brand;
    sel.appendChild(opt);
  });
  sel.value = currentConfig.phoneBrands.includes(prev) ? prev : '';
}

function renderModels() {
  const models = currentConfig.phoneModels || [];
  $('models-list').innerHTML = models.map((m, i) =>
    `<div class="item-row model-row">
      <span><b>${escapeHtml(m.name || '')}</b><small>${escapeHtml(m.brand || 'Any brand')} · ${num(m.adjustment)}</small></span>
      <div class="item-actions">
        <button data-edit-model="${i}" title="Edit model">✎</button>
        <button data-remove-model="${i}" title="Delete model">✕</button>
      </div>
    </div>`
  ).join('');

  $('models-list').querySelectorAll('[data-edit-model]').forEach(btn => {
    btn.onclick = () => {
      const model = currentConfig.phoneModels[Number(btn.dataset.editModel)];
      const name = prompt('Phone model name', model.name || '');
      if (name === null || !name.trim()) return;
      const brand = prompt('Brand (leave blank for any)', model.brand || '');
      if (brand === null) return;
      const adjustment = prompt('Sensitivity adjustment', String(num(model.adjustment)));
      if (adjustment === null) return;
      model.name = name.trim();
      model.brand = brand.trim();
      model.adjustment = Number(adjustment || 0);
      renderModels();
    };
  });

  $('models-list').querySelectorAll('[data-remove-model]').forEach(btn => {
    btn.onclick = () => {
      currentConfig.phoneModels.splice(Number(btn.dataset.removeModel), 1);
      renderModels();
    };
  });

  $('model-add').onclick = () => {
    const name = $('model-name').value.trim();
    if (!name) return;
    currentConfig.phoneModels.push({
      name,
      brand: $('model-brand').value,
      adjustment: Number($('model-adj').value || 0)
    });
    $('model-name').value = '';
    $('model-brand').value = '';
    $('model-adj').value = '0';
    renderModels();
  };
}

function renderTips() {
  $('tip-rusher').value = currentConfig.tips.rusher || '';
  $('tip-sniper').value = currentConfig.tips.sniper || '';
  $('tip-balanced').value = currentConfig.tips.balanced || '';
}

function renderReplies() {
  const replies = currentConfig.wessyReplies || [];
  $('replies-list').innerHTML = replies.map((r, i) =>
    `<div class="item-row reply-row">
      <span><b>${escapeHtml((r.keywords || []).join(', '))}</b><small>${escapeHtml(r.reply || '')}</small></span>
      <div class="item-actions">
        <button data-edit-reply="${i}" title="Edit reply">✎</button>
        <button data-remove-reply="${i}" title="Delete reply">✕</button>
      </div>
    </div>`
  ).join('');

  $('replies-list').querySelectorAll('[data-edit-reply]').forEach(btn => {
    btn.onclick = () => {
      const reply = currentConfig.wessyReplies[Number(btn.dataset.editReply)];
      const keywords = prompt('Keywords, comma separated', (reply.keywords || []).join(', '));
      if (keywords === null) return;
      const text = prompt("Wessy's reply", reply.reply || '');
      if (text === null || !text.trim()) return;
      reply.keywords = keywords.split(',').map(s => s.trim()).filter(Boolean);
      reply.reply = text.trim();
      renderReplies();
    };
  });

  $('replies-list').querySelectorAll('[data-remove-reply]').forEach(btn => {
    btn.onclick = () => {
      currentConfig.wessyReplies.splice(Number(btn.dataset.removeReply), 1);
      renderReplies();
    };
  });

  $('reply-add').onclick = () => {
    const keywords = $('reply-keywords').value.split(',').map(s => s.trim()).filter(Boolean);
    const reply = $('reply-text').value.trim();
    if (!keywords.length || !reply) return;
    currentConfig.wessyReplies.push({ keywords, reply });
    $('reply-keywords').value = '';
    $('reply-text').value = '';
    renderReplies();
  };
}

function collectForm() {
  const baseValues = {};
  ['general', 'reddot', 'x2', 'x4', 'sniper', 'freelook'].forEach(k => {
    baseValues[k] = clamp($(`bv-${k}`).value, 1, 200);
  });

  const ramAdj = {};
  ['4', '6', '8', '12'].forEach(k => {
    ramAdj[k] = Number($(`ram-${k}`).value || 0);
  });

  const brandAdj = {};
  (currentConfig.phoneBrands || []).forEach((brand, i) => {
    const input = document.querySelector(`[data-brand-adj="${i}"]`);
    brandAdj[brand] = Number(input?.value || 0);
  });

  return mergeConfig({
    ...currentConfig,
    baseValues,
    ramAdj,
    brandAdj,
    phoneBrands: [...currentConfig.phoneBrands],
    phoneModels: currentConfig.phoneModels.map(m => ({
      name: String(m.name || '').trim(),
      brand: String(m.brand || '').trim(),
      adjustment: Number(m.adjustment || 0)
    })).filter(m => m.name),
    tips: {
      rusher: $('tip-rusher').value.trim(),
      sniper: $('tip-sniper').value.trim(),
      balanced: $('tip-balanced').value.trim()
    },
    wessyReplies: currentConfig.wessyReplies.map(r => ({
      keywords: (r.keywords || []).map(k => String(k).trim()).filter(Boolean),
      reply: String(r.reply || '').trim()
    })).filter(r => r.keywords.length && r.reply)
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function num(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[c]));
}

$('save').onclick = async () => {
  $('save').disabled = true;
  $('save-status').textContent = 'Saving to Firestore…';
  try {
    await window.__wessySaveConfig();
    $('save-status').textContent = '✅ Saved. The public Wessy site receives the update in real time.';
  } catch (err) {
    $('save-status').textContent = `❌ Save failed: ${friendlyError(err)}`;
  } finally {
    $('save').disabled = false;
  }
};
      

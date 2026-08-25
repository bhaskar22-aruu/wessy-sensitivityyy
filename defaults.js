export const DEFAULTS = {
  baseValues: { general: 180, reddot: 178, x2: 165, x4: 145, sniper: 115, freelook: 170 },

  ramAdj: { "4": -10, "6": -4, "8": 0, "12": 5 },

  brandAdj: {
    "Samsung": -1,
    "Xiaomi / Redmi / POCO": 2,
    "Vivo / iQOO": 1,
    "Realme": 0,
    "OnePlus": 4,
    "iPhone": 5,
    "Other": 0
  },

  // Optional exact phone-model tuning. Admin can add more entries.
  phoneModels: [
    { name: "Samsung Galaxy A15", brand: "Samsung", adjustment: 0 }
  ],

  styleAdj: {
    rusher:   { general: 8,  reddot: 9,  x2: 5,  x4: 0,  sniper: -8, freelook: 8 },
    balanced: { general: 0,  reddot: 0,  x2: 0,  x4: 0,  sniper: 0,  freelook: 0 },
    sniper:   { general: -9, reddot: -7, x2: 0,  x4: 10, sniper: 28, freelook: 0 }
  },

  prefAdj: {
    headshot: { general: 12, reddot: 12, x2: 8,  x4: 0,  sniper: 0, freelook: 0 },
    balanced: { general: 0,  reddot: 0,  x2: 0,  x4: 0,  sniper: 0, freelook: 0 },
    stable:   { general: -8, reddot: -7, x2: -5, x4: -4, sniper: 0, freelook: -2 }
  },

  fingerAdj: {
    "2": { general: -2, reddot: -2, x2: -1, x4: 0, sniper: 0, freelook: -2 },
    "3": { general: 4,  reddot: 4,  x2: 2,  x4: 0, sniper: 0, freelook: 4 },
    "4": { general: 8,  reddot: 8,  x2: 5,  x4: 0, sniper: 0, freelook: 8 }
  },

  phoneBrands: [
    "Samsung",
    "Xiaomi / Redmi / POCO",
    "Vivo / iQOO",
    "Realme",
    "OnePlus",
    "iPhone",
    "Other"
  ],

  tips: {
    rusher: "If your drag overshoots, lower General and Red Dot by 3–5 points and test again in training.",
    sniper: "Make small scope adjustments instead of changing everything at once — precision comes from patience.",
    balanced: "Test in training mode and change only one setting at a time so you know what actually helped."
  },

  wessyReplies: [
    { keywords: ["headshot", "drag"], reply: "🎯 Use short controlled drags and adjust General/Red Dot only 3–5 points after testing." },
    { keywords: ["hud"], reply: "🎮 Keep controls comfortable for your finger setup and avoid overlapping buttons." },
    { keywords: ["scope", "sniper"], reply: "🔭 For scope control, make small changes and test at long range before locking in a value." },
    { keywords: ["lag", "fps", "frame"], reply: "⚙️ Sensitivity can't fix lag directly — close background apps and lower graphics slightly for steadier aim." },
    { keywords: ["ram"], reply: "📱 Lower RAM devices do best with slightly reduced sensitivity so frame drops don't throw off your aim." }
  ],

  updatedAt: 0
};

export function mergeConfig(data = {}) {
  return {
    ...DEFAULTS,
    ...data,
    baseValues: { ...DEFAULTS.baseValues, ...(data.baseValues || {}) },
    ramAdj: { ...DEFAULTS.ramAdj, ...(data.ramAdj || {}) },
    brandAdj: { ...DEFAULTS.brandAdj, ...(data.brandAdj || {}) },
    styleAdj: { ...DEFAULTS.styleAdj, ...(data.styleAdj || {}) },
    prefAdj: { ...DEFAULTS.prefAdj, ...(data.prefAdj || {}) },
    fingerAdj: { ...DEFAULTS.fingerAdj, ...(data.fingerAdj || {}) },
    phoneBrands: Array.isArray(data.phoneBrands) && data.phoneBrands.length ? data.phoneBrands : [...DEFAULTS.phoneBrands],
    phoneModels: Array.isArray(data.phoneModels) ? data.phoneModels : [...DEFAULTS.phoneModels],
    tips: { ...DEFAULTS.tips, ...(data.tips || {}) },
    wessyReplies: Array.isArray(data.wessyReplies) && data.wessyReplies.length ? data.wessyReplies : [...DEFAULTS.wessyReplies]
  };
}

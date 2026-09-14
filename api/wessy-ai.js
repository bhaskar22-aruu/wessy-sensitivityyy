const FIRESTORE_PROJECT_ID = 'wessy-sensitivity-85b59';

function readFirestoreValue(value) {
  if (!value) return null;

  if (value.stringValue !== undefined) {
    return value.stringValue;
  }

  if (value.integerValue !== undefined) {
    return Number(value.integerValue);
  }

  if (value.doubleValue !== undefined) {
    return Number(value.doubleValue);
  }

  if (value.booleanValue !== undefined) {
    return value.booleanValue;
  }

  if (value.arrayValue) {
    return (value.arrayValue.values || [])
      .map(readFirestoreValue);
  }

  if (value.mapValue) {
    const fields = value.mapValue.fields || {};

    return Object.fromEntries(
      Object.entries(fields).map(([key, val]) => [
        key,
        readFirestoreValue(val)
      ])
    );
  }

  return null;
}

async function loadWessyKnowledge() {
  try {
    const url =
      `https://firestore.googleapis.com/v1/projects/` +
      `${FIRESTORE_PROJECT_ID}/databases/(default)/documents/config/site`;

    const response = await fetch(url);

    if (!response.ok) {
      console.warn(
        'Could not load Wessy knowledge:',
        response.status
      );

      return [];
    }

    const document = await response.json();

    const fields = document?.fields || {};

    const knowledge =
      readFirestoreValue(fields.knowledgeBase);

    if (!Array.isArray(knowledge)) {
      return [];
    }

    return knowledge
      .filter(item =>
        item &&
        typeof item.topic === 'string' &&
        typeof item.information === 'string' &&
        item.topic.trim() &&
        item.information.trim()
      )
      .slice(0, 50);

  } catch (error) {
    console.warn(
      'Wessy knowledge loading failed:',
      error.message
    );

    return [];
  }
}

function buildKnowledgeContext(knowledge) {
  if (!knowledge.length) {
    return '';
  }

  const entries = knowledge.map((item, index) =>
    `${index + 1}. Topic: ${item.topic}\n` +
    `Information: ${item.information}`
  );

  return `

OWNER-PROVIDED WESSY KNOWLEDGE

The following information is maintained by the Wessy owner
through the Wessy admin panel.

Use this information when the user's question is about Wessy,
Wessy Studio, Wessy Sensitivity, the website, its features,
creator, rules, or other Wessy-specific facts.

Treat this information as the source of truth for Wessy-specific
facts. Do not invent Wessy-specific official facts.

${entries.join('\n\n')}
`;
}

function buildDeviceContext(context) {
  if (!context) {
    return '';
  }

  const parts = [];

  if (context.brand) {
    parts.push(`Phone brand: ${context.brand}`);
  }

  if (context.model) {
    parts.push(`Phone model: ${context.model}`);
  }

  if (context.ram) {
    parts.push(`RAM: ${context.ram} GB`);
  }

  if (context.style) {
    parts.push(`Play style: ${context.style}`);
  }

  if (context.pref) {
    parts.push(
      `Sensitivity preference: ${context.pref}`
    );
  }

  if (context.finger) {
    parts.push(
      `Finger setup: ${context.finger} fingers`
    );
  }

  if (context.score !== undefined) {
    parts.push(
      `Wessy Match Score: ${context.score}%`
    );
  }

  if (context.knownModel) {
    parts.push(
      `Saved Wessy model profile: ${context.knownModel.name || 'Yes'}`
    );

    if (context.knownModel.brand) {
      parts.push(
        `Saved model brand: ${context.knownModel.brand}`
      );
    }

    if (context.knownModel.adjustment !== undefined) {
      parts.push(
        `Saved model adjustment: ${context.knownModel.adjustment}`
      );
    }
  }

  if (context.v) {
    parts.push(
      `Current sensitivity values (0-200): ` +
      `General ${context.v.general}, ` +
      `Red Dot ${context.v.reddot}, ` +
      `2x ${context.v.x2}, ` +
      `4x ${context.v.x4}, ` +
      `Sniper ${context.v.sniper}, ` +
      `Free Look ${context.v.freelook}`
    );
  }

  if (!parts.length) {
    return '';
  }

  return `

CURRENT USER WEBSITE CONTEXT

The user is currently using the Wessy Sensitivity website.

${parts.join('\n')}

When the user says "my phone", "my sensitivity",
"my setup", "this phone", or similar, use this exact
website context instead of guessing.
`;
}

function cleanHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(item =>
      item &&
      (item.role === 'user' || item.role === 'model') &&
      typeof item.text === 'string' &&
      item.text.trim()
    )
    .slice(-10)
    .map(item => ({
      role: item.role,
      text: item.text.trim()
    }));
}

function buildGeminiContents(history, message) {
  const previousMessages = cleanHistory(history);

  return [
    ...previousMessages.map(item => ({
      role: item.role,
      parts: [
        {
          text: item.text
        }
      ]
    })),

    {
      role: 'user',
      parts: [
        {
          text: message.trim()
        }
      ]
    }
  ];
}

function formatSensitivity(context) {
  if (!context?.v) {
    return null;
  }

  return (
    `General ${context.v.general}, ` +
    `Red Dot ${context.v.reddot}, ` +
    `2x ${context.v.x2}, ` +
    `4x ${context.v.x4}, ` +
    `Sniper ${context.v.sniper}, ` +
    `Free Look ${context.v.freelook}`
  );
}

function smartFallback(message, context, knowledge) {
  const q = message.toLowerCase().trim();

  const values = context?.v || null;

  const phone =
    context?.model ||
    context?.brand ||
    'your phone';

  const ram =
    context?.ram
      ? `${context.ram} GB RAM`
      : '';

  const hasSensitivityTopic =
    /(sensitivity|sens|general|red dot|reddot|2x|4x|sniper|free look|freelook)/.test(q);

  const asksCurrent =
    /(current|meri|mera|mere|my|mine|abhi|currently|kitna|kitni|kya hai).*(sensitivity|sens|general|red dot|reddot|2x|4x|sniper|free look|freelook)|(sensitivity|sens|general|red dot|reddot|2x|4x|sniper|free look|freelook).*(current|meri|mera|mere|my|mine|abhi|currently|kitna|kitni|kya hai)/.test(q);

  const feelsFast =
    /(fast|zyada|high|tez|jaldi|overshoot|control nahi|control nhi|bahut tez)/.test(q);

  const feelsSlow =
    /(slow|kam|low|dheere|heavy|late|response nahi|response nhi)/.test(q);

  const asksRedDot =
    /(red dot|reddot)/.test(q);

  const asksGeneral =
    /\bgeneral\b/.test(q);

  const asks2x =
    /\b2x\b/.test(q);

  const asks4x =
    /\b4x\b/.test(q);

  const asksSniper =
    /\bsniper\b/.test(q);

  const asksFreeLook =
    /(free look|freelook)/.test(q);

  /*
   * Greeting
   */
  if (
    /^(hi|hello|hey|hii|helo|namaste|yo|hyy)\b/.test(q)
  ) {
    return (
      'Hey! 😊 I’m Wessy. ' +
      'Batao, sensitivity, aim, drag, HUD ya tumhare current setup ke baare mein kya dekhna hai?'
    );
  }

  /*
   * Specific sensitivity problem:
   * "Red Dot fast lag raha hai"
   */
  if (
    asksRedDot &&
    (feelsFast || feelsSlow) &&
    values
  ) {
    const current = Number(values.reddot);

    if (feelsFast) {
      const suggested = Math.max(current - 5, 0);

      return (
        `Haan, agar Red Dot ${current} tumhe fast feel ho raha hai, ` +
        `to ${suggested} ke around try karo. ` +
        `Tumhare ${phone}${ram ? ` (${ram})` : ''} par pehle 5 points ka change test karna better rahega. ` +
        `Agar aim control improve ho, wahi value rakho. 🎯`
      );
    }

    const suggested = Math.min(current + 5, 200);

    return (
      `Agar Red Dot ${current} tumhe slow feel ho raha hai, ` +
      `${suggested} ke around try kar sakte ho. ` +
      `Pehle small adjustment karo, phir aim ko test karo. 🎯`
    );
  }

  /*
   * Specific General problem
   */
  if (
    asksGeneral &&
    (feelsFast || feelsSlow) &&
    values
  ) {
    const current = Number(values.general);

    if (feelsFast) {
      const suggested = Math.max(current - 5, 0);

      return (
        `General ${current} hai. Agar movement/aim fast feel ho raha hai, ` +
        `${suggested} ke around test karo. ` +
        `Ek saath bahut bada change mat karo. 🎯`
      );
    }

    const suggested = Math.min(current + 5, 200);

    return (
      `General ${current} hai. Agar response slow feel ho raha hai, ` +
      `${suggested} ke around try karo aur phir gameplay me test karo. 🎯`
    );
  }

  /*
   * Specific 2x problem
   */
  if (
    asks2x &&
    (feelsFast || feelsSlow) &&
    values
  ) {
    const current = Number(values.x2);

    if (feelsFast) {
      const suggested = Math.max(current - 5, 0);

      return (
        `2x sensitivity ${current} hai. Agar scope fast feel ho raha hai, ` +
        `${suggested} ke around test karo. 🎯`
      );
    }

    const suggested = Math.min(current + 5, 200);

    return (
      `2x sensitivity ${current} hai. Agar scope slow feel ho raha hai, ` +
        `${suggested} ke around test karo. 🎯`
    );
  }

  /*
   * Specific 4x problem
   */
  if (
    asks4x &&
    (feelsFast || feelsSlow) &&
    values
  ) {
    const current = Number(values.x4);

    if (feelsFast) {
      const suggested = Math.max(current - 5, 0);

      return (
        `4x sensitivity ${current} hai. Agar scope fast feel ho raha hai, ` +
        `${suggested} ke around test karo. 🎯`
      );
    }

    const suggested = Math.min(current + 5, 200);

    return (
      `4x sensitivity ${current} hai. Agar scope slow feel ho raha hai, ` +
      `${suggested} ke around test karo. 🎯`
    );
  }

  /*
   * Current specific value
   */
  if (asksCurrent && values) {
    if (asksRedDot) {
      return (
        `Tumhara current Red Dot ${values.reddot} hai. ` +
        `Ye tumhare current Wessy profile ka value hai. 🎯`
      );
    }

    if (asksGeneral) {
      return (
        `Tumhara current General ${values.general} hai. 🎯`
      );
    }

    if (asks2x) {
      return (
        `Tumhara current 2x ${values.x2} hai. 🎯`
      );
    }

    if (asks4x) {
      return (
        `Tumhara current 4x ${values.x4} hai. 🎯`
      );
    }

    if (asksSniper) {
      return (
        `Tumhara current Sniper ${values.sniper} hai. 🎯`
      );
    }

    if (asksFreeLook) {
      return (
        `Tumhara current Free Look ${values.freelook} hai. 🎯`
      );
    }

    return (
      `Tumhari current Wessy sensitivity hai: ` +
      `General ${values.general}, ` +
      `Red Dot ${values.reddot}, ` +
      `2x ${values.x2}, ` +
      `4x ${values.x4}, ` +
      `Sniper ${values.sniper}, ` +
      `Free Look ${values.freelook}. 🎯`
    );
  }

  /*
   * User asks about sensitivity but hasn't generated profile
   */
  if (
    hasSensitivityTopic &&
    !values
  ) {
    return (
      'Pehle Wessy sensitivity profile generate kar lo. ' +
      'Uske baad main tumhare actual values ke basis par advice de sakta hoon. 🎯'
    );
  }

  /*
   * Phone/device
   */
  if (
    /(phone|mobile|device|model)/.test(q)
  ) {
    if (context?.model) {
      return (
        `Tumhara current Wessy profile ${context.model}` +
        `${context.brand ? ` (${context.brand})` : ''}` +
        `${context.ram ? ` with ${context.ram} GB RAM` : ''} ke liye hai. 📱`
      );
    }

    return (
      'Pehle apna phone setup select karo, phir main uske context ke saath help karunga.'
    );
  }

  /*
   * Aim / drag / HUD / gameplay
   */
  if (
    /(aim|drag|headshot|hud|scope|gameplay|control|setup)/.test(q) &&
    context
  ) {
    return (
      `Main tumhara ${phone}${ram ? ` (${ram})` : ''} wala Wessy profile use kar raha hoon. ` +
      `Agar kisi specific cheez me problem hai, jaise drag fast hai, aim slow hai ` +
      `ya scope control nahi ho raha, woh batao. Main usi ke according suggest karunga. 🎮`
    );
  }

  /*
   * Wessy Knowledge Base
   */
  const relevantKnowledge = knowledge.find(item => {
    const topic = item.topic.toLowerCase();

    return (
      q.includes(topic) ||
      topic.split(/\s+/).some(word =>
        word.length > 3 && q.includes(word)
      )
    );
  });

  if (relevantKnowledge) {
    return relevantKnowledge.information;
  }

  /*
   * Context-aware fallback
   */
  if (context) {
    return (
      `Got it. Main tumhare current ${phone} Wessy profile ko context me rakh raha hoon. ` +
      `Jo problem aa rahi hai woh batao, main usi setup ke according help karunga. 🎮`
    );
  }

  return (
    'I’m Wessy, your gaming assistant. ' +
    'Sensitivity, aim, drag, headshots, HUD, scopes ya setup ke baare mein poochho. 🎮'
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const {
    message,
    context,
    history
  } = req.body || {};

  if (
    !message ||
    typeof message !== 'string'
  ) {
    return res.status(400).json({
      error: 'No message provided.'
    });
  }

  try {
    const knowledge =
      await loadWessyKnowledge();

    const apiKey =
      process.env.GEMINI_API_KEY;

    /*
     * If Gemini is unavailable or the API key
     * is not configured, Wessy still works.
     */
    if (!apiKey) {
      return res.status(200).json({
        reply: smartFallback(
          message,
          context,
          knowledge
        )
      });
    }

    const knowledgeContext =
      buildKnowledgeContext(knowledge);

    const deviceContext =
      buildDeviceContext(context);

    const systemPrompt = `
You are "Wessy AI", the intelligent gaming assistant
built by Wessy Studio.

You help Free Fire Max players with:

- sensitivity
- aim
- drag headshots
- scopes
- HUD
- controls
- gameplay
- device-specific sensitivity
- performance-related sensitivity advice
- Wessy website questions

SENSITIVITY RULES:

1. Free Fire Max sensitivity uses a 0-200 scale.
2. Never describe the scale as 0-100.
3. When current sensitivity values are supplied,
   use those exact values.
4. Never invent or randomly replace current values.
5. For adjustments, explain what to change and why.
6. Prefer practical, small adjustments and testing.

DEVICE CONTEXT:

The user may have entered their phone information
on the Wessy Sensitivity website.

Use the supplied phone brand, model, RAM,
play style, preference, finger setup, score and
generated sensitivity values.

When the user says "my phone", "my sensitivity",
"my setup", "this phone", or similar, use the
provided website context.

CONVERSATION:

Previous messages may be supplied.

Use them to understand follow-up questions naturally.

For example:

User: My sensitivity is good?
Wessy: gives an answer.

User: What about Red Dot?

Understand that "Red Dot" refers to the previous
sensitivity discussion.

If the current question contains both device words
and sensitivity words, answer the actual sensitivity
question using the device context rather than only
describing the phone.

WESSY KNOWLEDGE:

Owner-provided knowledge is supplied below.

Use it naturally for Wessy-specific facts.

Treat owner-provided Wessy knowledge as the source
of truth for official Wessy-specific information.

If an official Wessy fact is not present there,
do not invent one.

STYLE:

- Be natural and conversational.
- Understand meaning, not just keywords.
- Keep most answers concise.
- Give useful practical advice.
- Use simple language.
- Use at most 1-2 emojis.
- Never mention Gemini or Google.
- You are simply Wessy AI.

${knowledgeContext}
${deviceContext}
`;

    const model =
      'gemini-3.6-flash';

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${model}:generateContent?key=${apiKey}`;

    const geminiRes =
      await fetch(url, {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: systemPrompt
              }
            ]
          },

          contents:
            buildGeminiContents(
              history,
              message
            )
        })
      });

    const data =
      await geminiRes.json();

    /*
     * Gemini errors, including quota/rate-limit errors,
     * automatically use the local Wessy fallback.
     */
    if (!geminiRes.ok) {
      console.warn(
        'Gemini unavailable:',
        data?.error?.message ||
        geminiRes.status
      );

      return res.status(200).json({
        reply: smartFallback(
          message,
          context,
          knowledge
        )
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!reply) {
      return res.status(200).json({
        reply: smartFallback(
          message,
          context,
          knowledge
        )
      });
    }

    return res.status(200).json({
      reply
    });

  } catch (error) {
    console.warn(
      'Wessy AI request failed:',
      error.message
    );

    /*
     * Never expose backend/API errors to users.
     */
    try {
      const knowledge =
        await loadWessyKnowledge();

      return res.status(200).json({
        reply: smartFallback(
          message,
          context,
          knowledge
        )
      });

    } catch {
      return res.status(200).json({
        reply:
          'I’m Wessy. Try asking me about your sensitivity, aim, drag or current setup. 🎮'
      });
    }
  }
}

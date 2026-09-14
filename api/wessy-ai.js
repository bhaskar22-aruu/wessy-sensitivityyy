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

  const hasSensitivity =
    /(sensitivity|sens|general|red dot|reddot|2x|4x|sniper|free look|freelook)/.test(q);

  const asksCurrentSensitivity =
    /(current|meri|mera|mere|my|mine|abhi|currently).*(sensitivity|sens)|(sensitivity|sens).*(current|meri|mera|mere|my|mine|abhi|currently)/.test(q);

  const asksPhone =
    /(phone|mobile|device|model)/.test(q);

  const hasAimTopic =
    /(aim|drag|headshot|hud|scope|gameplay|control|setting|setup)/.test(q);

  /*
   * Greetings
   */
  if (
    /^(hi|hello|hey|hii|helo|namaste|yo)\b/.test(q)
  ) {
    return (
      'Hey! 😊 I’m Wessy. Ask me about your sensitivity, ' +
      'aim, drag, HUD, scopes or your current setup.'
    );
  }

  /*
   * IMPORTANT:
   * Sensitivity checks come BEFORE phone checks.
   *
   * This allows questions like:
   * "Red Dot kitna hai mere phone ke liye?"
   * to be handled as sensitivity questions instead
   * of returning only the phone profile.
   */

  if (asksCurrentSensitivity && context?.v) {
    return (
      `Your current Wessy sensitivity is: ` +
      `${formatSensitivity(context)}. 🎯`
    );
  }

  /*
   * Mixed sensitivity + phone questions
   */
  if (hasSensitivity && context?.v) {
    const phoneName =
      context.model ||
      context.brand ||
      'your phone';

    if (/red dot|reddot/.test(q)) {
      return (
        `Your current Red Dot is ${context.v.reddot}. ` +
        `For ${phoneName}, this is your current Wessy value. ` +
        `If your aim feels too fast or too slow, test small adjustments. 🎯`
      );
    }

    if (/\b2x\b/.test(q)) {
      return (
        `Your current 2x sensitivity is ${context.v.x2} ` +
        `for ${phoneName}. 🎯`
      );
    }

    if (/\b4x\b/.test(q)) {
      return (
        `Your current 4x sensitivity is ${context.v.x4} ` +
        `for ${phoneName}. 🎯`
      );
    }

    if (/sniper/.test(q)) {
      return (
        `Your current Sniper sensitivity is ${context.v.sniper} ` +
        `for ${phoneName}. 🎯`
      );
    }

    if (/free look|freelook/.test(q)) {
      return (
        `Your current Free Look sensitivity is ${context.v.freelook} ` +
        `for ${phoneName}. 🎯`
      );
    }

    if (/general/.test(q)) {
      return (
        `Your current General sensitivity is ${context.v.general} ` +
        `for ${phoneName}. 🎯`
      );
    }

    return (
      `I have your current Wessy sensitivity for ${phoneName}: ` +
      `${formatSensitivity(context)}. 🎯`
    );
  }

  /*
   * General sensitivity question without current values
   */
  if (hasSensitivity && !context?.v) {
    return (
      'Generate your Wessy profile first so I can give advice ' +
      'based on your actual sensitivity.'
    );
  }

  /*
   * Phone/device question
   */
  if (asksPhone) {
    if (context?.model) {
      return (
        `Your current Wessy profile is for ` +
        `${context.model}` +
        `${context.brand ? ` (${context.brand})` : ''}` +
        `${context.ram ? ` with ${context.ram} GB RAM` : ''}. 📱`
      );
    }

    return (
      'Analyze your phone setup first, and I’ll be able ' +
      'to use your device details.'
    );
  }

  /*
   * Wessy knowledge
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
   * Device-aware generic answer
   */
  if (context && hasAimTopic) {
    return (
      `I’m using your current Wessy profile for ` +
      `${context.model || context.brand || 'your device'}` +
      `${context.ram ? ` with ${context.ram} GB RAM` : ''}. ` +
      `Ask me about a specific sensitivity, aim, drag, ` +
      `HUD or scope setting and I’ll use your current profile. 🎮`
    );
  }

  if (context) {
    return (
      `I’m currently using your Wessy profile for ` +
      `${context.model || context.brand || 'your device'}. ` +
      `Try asking me specifically about your sensitivity, ` +
      `aim, drag or scopes. 🎮`
    );
  }

  return (
    'I’m Wessy, your gaming sensitivity assistant. ' +
    'Ask me about sensitivity, aim, drag, headshots, ' +
    'HUD, scopes or your setup. 🎮'
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
2.

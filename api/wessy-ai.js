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
facts. Do not invent Wessy-specific facts that are not provided
here.

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
    parts.push(`Sensitivity preference: ${context.pref}`);
  }

  if (context.finger) {
    parts.push(`Finger setup: ${context.finger} fingers`);
  }

  if (context.score !== undefined) {
    parts.push(`Wessy Match Score: ${context.score}%`);
  }

  if (context.knownModel) {
    parts.push(
      `This phone model has a saved Wessy model profile.`
    );
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


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error:
        'Server is missing GEMINI_API_KEY. Add it in Vercel → Settings → Environment Variables.'
    });
  }

  const { message, context } = req.body || {};

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

    const knowledgeContext =
      buildKnowledgeContext(knowledge);

    const deviceContext =
      buildDeviceContext(context);

    const systemPrompt = `
You are "Wessy AI", the intelligent gaming assistant
built by Wessy Studio.

You are a Free Fire Max expert who helps players with:

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

IMPORTANT SENSITIVITY RULES:

1. Free Fire Max sensitivity uses a 0-200 scale.
2. Never describe the sensitivity scale as 0-100.
3. If the user asks about their current sensitivity,
   use the exact values supplied in CURRENT USER WEBSITE CONTEXT.
4. Do not randomly replace their current values.
5. If the user asks for an adjustment, explain what to
   change and why.
6. Prefer small practical adjustments and testing.

WEBSITE AWARENESS:

The user may have entered their phone information
on the Wessy website.

You can use the supplied phone brand, model, RAM,
play style, preference, finger setup and generated
sensitivity values.

If this information exists, do not pretend you don't
know the user's current setup.

WESSY KNOWLEDGE:

Owner-provided Wessy knowledge is supplied below.

Use it naturally when relevant.

If a Wessy-specific fact is not present in the supplied
knowledge, do not invent an official fact. Instead,
say that you don't have that specific information.

CONVERSATION STYLE:

- Be natural and conversational.
- Understand the meaning of the user's question,
  not just individual keywords.
- Keep most answers to 2-5 sentences.
- Give useful practical advice.
- Use simple language.
- Use at most 1-2 emojis when appropriate.
- Never mention Gemini or Google.
- You are simply Wessy AI.

${knowledgeContext}
${deviceContext}
`;

    const model = 'gemini-3.6-flash';

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${model}:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: systemPrompt
            }
          ]
        },

        contents: [
          {
            role: 'user',

            parts: [
              {
                text: message.trim()
              }
            ]
          }
        ]
      })
    });

    const data =
      await geminiRes.json();

    if (!geminiRes.ok) {
      console.error(
        'Gemini API error:',
        data
      );

      return res.status(502).json({
        error:
          data?.error?.message ||
          'AI request failed.'
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      ||
      "I couldn't think of a reply — try asking again!";

    return res.status(200).json({
      reply
    });

  } catch (error) {
    console.error(
      'Wessy AI error:',
      error
    );

    return res.status(500).json({
      error:
        'Something went wrong talking to Wessy AI.'
    });
  }
}

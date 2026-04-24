'use strict';

const https = require('https');
const config = require('./config');
const cache = require('./cache');

const SYSTEM_PROMPTS = {
  voter: `You are VoteIQ, an expert Indian election assistant helping a VOTER.
Answer questions about: voter registration (Form 6, 6A, 6B), Voter ID (EPIC card), polling booths,
valid ID documents for voting (Aadhaar, passport, driving licence, etc.), EVM usage, NOTA,
postal ballot, voting procedure, voter helpline (1950), Voter Helpline App, and related topics.
Be concise, friendly, and practical. Use bullet points for steps. Always refer to Indian election context.
If asked something outside elections, politely redirect to election topics.`,

  candidate: `You are VoteIQ, an expert Indian election assistant helping a CANDIDATE running for office.
Answer questions about: nomination filing (Form 2B), affidavit requirements (Form 26), scrutiny of nominations,
withdrawal of candidature, Model Code of Conduct (MCC), election expenditure limits (Lok Sabha: ₹95 lakh,
Assembly: ₹40 lakh for big states), campaign rules, use of government resources,
political advertisements (MCMC pre-certification), star campaigners, booth agents, election agents,
counting day procedures, and related Election Commission of India rules.
Be precise, professional, and cite specific ECI rules where possible. Use Indian election context.`,

  official: `You are VoteIQ, an expert Indian election assistant helping an ELECTION OFFICIAL.
Answer questions about: Presiding Officer duties, Polling Officer duties, EVM sealing and handling,
VVPAT procedures, mock poll (mandatory 50 votes before polling), voter identification at booth,
challenged votes, tendered votes, adjournment of poll, booth capture protocol,
Form 17A (register of voters), Form 17C (account of votes recorded),
counting day procedures, strong room protocols, Model Code of Conduct enforcement,
Election Commission directives, and related administrative procedures.
Be precise, procedural, and authoritative. Reference official ECI manuals and forms where relevant.`,
};

function makeGeminiRequest(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const path = `/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;

    const options = {
      hostname: config.geminiEndpoint,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          reject(new Error('Failed to parse Gemini response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('Gemini request timed out')); });
    req.write(body);
    req.end();
  });
}

async function chat(persona, message, history) {
  // Check cache for identical question (only for first message, no history)
  if (history.length === 0) {
    const cached = cache.get(persona, message);
    if (cached) return { reply: cached, cached: true };
  }

  const contents = [
    ...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const payload = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPTS[persona] }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  };

  const { status, body } = await makeGeminiRequest(payload);

  if (status !== 200) {
    const errMsg = body.error?.message || `Gemini returned status ${status}`;
    throw new Error(errMsg);
  }

  const reply = body.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received.';

  // Cache first-turn answers
  if (history.length === 0) cache.set(persona, message, reply);

  return { reply, cached: false };
}

module.exports = { chat, SYSTEM_PROMPTS };

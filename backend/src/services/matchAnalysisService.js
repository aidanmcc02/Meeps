/**
 * Optional AI analysis for League of Legends match notifications (Diana webhooks).
 * When OPENAI_API_KEY is set, calls OpenAI to produce a short, constructive match insight.
 * Safe to call from Railway; runs only when key is configured.
 */

const axios = require("axios");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim();
const OPENAI_MODEL = process.env.OPENAI_MATCH_ANALYSIS_MODEL || "gpt-4o-mini";

function isConfigured() {
  return Boolean(OPENAI_API_KEY);
}

/**
 * Build a plain-text summary of the match from Diana webhook body (for the LLM).
 * @param {object} body - Diana MessagePayload (title, description, fields, url, etc.)
 * @returns {string}
 */
function buildMatchSummary(body) {
  if (!body || typeof body !== "object") return "";
  const parts = [];
  if (body.title) parts.push(`Title: ${body.title}`);
  if (body.description) parts.push(`Description: ${body.description}`);
  if (body.text) parts.push(body.text);
  if (Array.isArray(body.fields) && body.fields.length > 0) {
    body.fields.forEach((f) => {
      const name = (f.name || "").trim();
      const value = (f.value || "").trim();
      if (name && value) parts.push(`${name}: ${value}`);
    });
  }
  return parts.join("\n");
}

/**
 * Call OpenAI to generate a short, constructive analysis of the match.
 * @param {string} matchSummary - Plain-text match summary from buildMatchSummary
 * @returns {Promise<string|null>} Analysis text or null on skip/error
 */
async function analyzeMatch(matchSummary) {
  if (!isConfigured() || !matchSummary || !matchSummary.trim()) return null;

  const systemPrompt = `You are a friendly League of Legends coach. Given a match result summary (champion, KDA, result, etc.), write one short paragraph (2-4 sentences) that:
- Acknowledges the result and key stats
- Offers one or two specific, constructive tips (e.g. vision, objectives, itemization, positioning) without being preachy
- Stays positive and encouraging
Keep the tone casual and concise. No bullet lists; use plain prose.`;

  const userPrompt = `Match summary:\n${matchSummary.trim()}\n\nWrite a brief analysis.`;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 280,
        temperature: 0.6
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }
    return null;
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.error?.message || err.message;
    console.warn("[match-analysis] OpenAI request failed:", status || "", msg);
    return null;
  }
}

/**
 * Run full pipeline: build summary from Diana body, call LLM, return analysis or null.
 * @param {object} dianaBody - Raw Diana webhook req.body
 * @returns {Promise<string|null>}
 */
async function getAnalysisForDianaMatch(dianaBody) {
  if (!isConfigured()) return null;
  const summary = buildMatchSummary(dianaBody);
  if (!summary.trim()) return null;
  return analyzeMatch(summary);
}

module.exports = {
  isConfigured,
  buildMatchSummary,
  analyzeMatch,
  getAnalysisForDianaMatch
};

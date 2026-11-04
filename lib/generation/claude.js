// Calls Claude for one stage of a generation job.
// Streams the reply so that, if the stage runs out of time, the text written so far is kept
// and the next stage can carry on from it instead of starting again.
import { Anthropic } from "@anthropic-ai/sdk";

export const MODEL = "claude-sonnet-5-5";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export class WebSearchUnavailableError extends Error {
  constructor(message) {
    super(message || "WEB_SEARCH_UNAVAILABLE");
    this.code = "WEB_SEARCH_UNAVAILABLE";
  }
}

/**
 * Runs one Claude request and returns everything it wrote.
 * deadlineMs: a clock time (Date.now() based). The stream is stopped shortly before it,
 * and { timedOut: true } is returned with the text written up to that point.
 */
export async function runClaude({ systemPrompt, userPrompt, maxTokens, searchLimit, deadlineMs }) {
  const messages = [{ role: "user", content: userPrompt }];
  const tools =
    searchLimit > 0 ? [{ type: "web_search_20250305", name: "web_search", max_uses: searchLimit }] : undefined;

  const texts = [];
  const turns = [];
  let last = null;
  let timedOut = false;

  for (let turn = 0; turn < 8; turn++) {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
      ...(tools ? { tools } : {}),
    });

    let turnText = "";
    stream.on("text", (delta) => {
      turnText += delta;
    });

    const msLeft = deadlineMs - Date.now();
    const timer = setTimeout(() => {
      timedOut = true;
      stream.abort();
    }, Math.max(1000, msLeft));

    let response = null;
    try {
      response = await stream.finalMessage();
    } catch (err) {
      if (!timedOut) {
        const mentionsSearch = /web.?search|tool/i.test(String(err?.message || ""));
        if (tools && mentionsSearch && [400, 403].includes(err?.status)) {
          throw new WebSearchUnavailableError(err.message);
        }
        throw err;
      }
    } finally {
      clearTimeout(timer);
    }

    if (timedOut || !response) {
      texts.push(turnText);
      turns.push({ stop_reason: "timed_out", chars: turnText.length });
      break;
    }

    last = response;
    turns.push({
      stop_reason: response.stop_reason,
      blocks: (response.content || []).map((block) => block.type),
      output_tokens: response.usage?.output_tokens,
    });
    for (const block of response.content || []) {
      if (block.type === "text") texts.push(block.text);
    }

    // Long research turns can pause; send the work so far back to carry on.
    if (response.stop_reason !== "pause_turn") break;
    if ((response.usage?.input_tokens || 0) > 150000) break;
    if (deadlineMs - Date.now() < 20000) {
      timedOut = true;
      break;
    }
    messages.push({
      role: "assistant",
      content: (response.content || []).filter((block) => block.type !== "text" || String(block.text || "").trim()),
    });
  }

  return {
    text: texts.join("\n"),
    timedOut,
    stopReason: timedOut ? "timed_out" : last?.stop_reason,
    usage: last?.usage,
    turns,
  };
}

// Returns the text inside the first matching tag. If the closing tag is missing (the reply was
// cut off), returns everything after the opening tag. Returns null when no tag is present.
export function extractTag(text, tag) {
  const value = String(text || "");
  const open = value.indexOf(`<${tag}>`);
  if (open === -1) return null;
  const start = open + tag.length + 2;
  const close = value.indexOf(`</${tag}>`, start);
  return (close === -1 ? value.slice(start) : value.slice(start, close)).trim();
}

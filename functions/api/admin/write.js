// AI writing assistant — generates article drafts from a prompt

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function checkAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  return token === (env.ADMIN_PASSWORD || 'hotpolitics');
}

export async function onRequestPost({ request, env }) {
  if (!checkAuth(request, env)) return unauthorized();

  try {
    const { message, history = [] } = await request.json();
    if (!message) return json({ error: 'message required' }, 400);

    const systemPrompt = `You are the editorial AI for HotPolitics.com — an independent political commentary site founded in 2000 with a fearless, no-party-line voice. Think of yourself as a sharp political journalist who calls out power regardless of which party holds it.

Your job is to help the editor write and develop articles. You can:
- Draft full articles from a brief description
- Suggest headlines, kickers, and deck copy
- Research angles and talking points
- Rewrite or tighten existing drafts
- Suggest related stories and follow-up angles

When drafting articles:
- Use clear, punchy, outspoken prose — no corporate-speak, no both-sidesing when the facts don't support it
- Lead with the most important/provocative fact
- Use short paragraphs
- Be specific — names, dates, dollar amounts

When you produce a draft article, format it as JSON in a markdown code block like this:
\`\`\`json
{
  "title": "...",
  "kicker": "...",
  "deck": "...",
  "body": "...",
  "category": "foreign-policy|civil-liberties|florida|commentary|economy|empire-watch"
}
\`\`\`

For casual conversation or questions, just respond normally.`;

    const messages = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) return json({ error: data.error?.message || 'AI error' }, 500);

    const reply = data.content?.[0]?.text || '';

    // Try to extract article JSON if present
    let article = null;
    const jsonMatch = reply.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try { article = JSON.parse(jsonMatch[1]); } catch {}
    }

    return json({ reply, article });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
  });
}

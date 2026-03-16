// GET /api/articles — list published articles
// GET /api/articles?slug=xxx — single article
// GET /api/articles?category=xxx — by category

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const category = url.searchParams.get('category');
  const limit = parseInt(url.searchParams.get('limit') || '20');

  try {
    let result;
    if (slug) {
      result = await env.DB.prepare(
        'SELECT id,slug,title,kicker,deck,body,category,author,published_at,source_url,source_label FROM articles WHERE slug = ? AND published = 1'
      ).bind(slug).first();
      if (!result) return json({ error: 'Not found' }, 404);
      return json(result);
    } else if (category) {
      result = await env.DB.prepare(
        'SELECT id,slug,title,kicker,deck,category,author,published_at,source_url,source_label FROM articles WHERE published = 1 AND category = ? ORDER BY published_at DESC LIMIT ?'
      ).bind(category, limit).all();
    } else {
      result = await env.DB.prepare(
        'SELECT id,slug,title,kicker,deck,category,author,published_at,source_url,source_label FROM articles WHERE published = 1 ORDER BY published_at DESC LIMIT ?'
      ).bind(limit).all();
    }
    return json(result.results || []);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

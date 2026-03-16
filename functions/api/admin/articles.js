// Admin CRUD for articles — password protected

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

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

// GET — list all articles (including drafts)
export async function onRequestGet({ request, env }) {
  if (!checkAuth(request, env)) return unauthorized();
  try {
    const result = await env.DB.prepare(
      'SELECT id,slug,title,kicker,category,published,created_at,published_at FROM articles ORDER BY created_at DESC LIMIT 100'
    ).all();
    return json(result.results || []);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// POST — create or update article
export async function onRequestPost({ request, env }) {
  if (!checkAuth(request, env)) return unauthorized();
  try {
    const body = await request.json();
    const { id, title, kicker, deck, body: articleBody, category, author, published } = body;

    if (!title || !articleBody) return json({ error: 'title and body required' }, 400);

    const slug = body.slug || slugify(title) + '-' + Date.now().toString(36);
    const publishedAt = published ? new Date().toISOString() : null;

    if (id) {
      // Update existing
      await env.DB.prepare(
        `UPDATE articles SET title=?, kicker=?, deck=?, body=?, category=?, author=?, published=?, published_at=COALESCE(published_at, ?) WHERE id=?`
      ).bind(title, kicker || null, deck || null, articleBody, category || 'commentary', author || 'HotPolitics Staff', published ? 1 : 0, publishedAt, id).run();
      return json({ ok: true, id, slug });
    } else {
      // Insert new
      const result = await env.DB.prepare(
        `INSERT INTO articles (slug,title,kicker,deck,body,category,author,published,published_at) VALUES (?,?,?,?,?,?,?,?,?)`
      ).bind(slug, title, kicker || null, deck || null, articleBody, category || 'commentary', author || 'HotPolitics Staff', published ? 1 : 0, publishedAt).run();
      return json({ ok: true, id: result.meta.last_row_id, slug });
    }
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// DELETE — delete article
export async function onRequestDelete({ request, env }) {
  if (!checkAuth(request, env)) return unauthorized();
  try {
    const { id } = await request.json();
    await env.DB.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });

    try {

      // ── GET /api/vocab/:level  ──────────────────────────────
      // Returns all vocab for a level from D1 (used by frontend)
      if (path.match(/^\/api\/vocab\/[^/]+$/) && request.method === 'GET') {
        const level = path.split('/')[3];
        const valid = ['elementary','junior','high','university'];
        if (!valid.includes(level)) return json({ error: 'Invalid level' }, 400);
        const rows = await env.DB.prepare(
          'SELECT word, pos, phonetic, zh, ex FROM vocabulary WHERE level = ? ORDER BY RANDOM() LIMIT 500'
        ).bind(level).all();
        return json({ level, words: rows.results, total: rows.results.length });
      }

      // ── GET /api/vocab/:level/count  ────────────────────────
      if (path.match(/^\/api\/vocab\/[^/]+\/count$/) && request.method === 'GET') {
        const level = path.split('/')[3];
        const row = await env.DB.prepare(
          'SELECT COUNT(*) as total FROM vocabulary WHERE level = ?'
        ).bind(level).first();
        return json({ level, total: row.total });
      }

      // ── POST /api/user/login  ───────────────────────────────
      if (path === '/api/user/login' && request.method === 'POST') {
        const { name } = await request.json();
        if (!name?.trim()) return json({ error: 'Name required' }, 400);
        const clean = name.trim().slice(0, 30);
        const id = clean.toLowerCase().replace(/[^a-z0-9]/g, '_');
        let user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
        if (!user) {
          await env.DB.prepare('INSERT INTO users (id, name) VALUES (?, ?)').bind(id, clean).run();
          user = { id, name: clean, level: 'elementary', total_score: 0 };
        } else {
          await env.DB.prepare('UPDATE users SET last_seen = datetime("now") WHERE id = ?').bind(id).run();
        }
        return json({ user });
      }

      // ── GET /api/progress/:userId/:level  ──────────────────
      if (path.match(/^\/api\/progress\/[^/]+\/[^/]+$/) && request.method === 'GET') {
        const parts = path.split('/');
        const userId = parts[3], level = parts[4];
        const rows = await env.DB.prepare(
          'SELECT word, status, freq, seen FROM word_progress WHERE user_id = ? AND level = ?'
        ).bind(userId, level).all();
        return json({ progress: rows.results });
      }

      // ── POST /api/progress/:userId/:level  ─────────────────
      if (path.match(/^\/api\/progress\/[^/]+\/[^/]+$/) && request.method === 'POST') {
        const parts = path.split('/');
        const userId = parts[3], level = parts[4];
        const { wordStates } = await request.json();
        const entries = Object.entries(wordStates || {});
        if (entries.length > 0) {
          const stmt = env.DB.prepare(
            `INSERT INTO word_progress (user_id, level, word, status, freq, seen, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
             ON CONFLICT(user_id, level, word) DO UPDATE SET
               status=excluded.status, freq=excluded.freq,
               seen=excluded.seen, updated_at=excluded.updated_at`
          );
          await env.DB.batch(entries.map(([word, ws]) =>
            stmt.bind(userId, level, word, ws.status || 'new', ws.freq || 1, ws.seen || 0)
          ));
        }
        return json({ saved: entries.length });
      }

      // ── POST /api/quiz/:userId  ────────────────────────────
      if (path.match(/^\/api\/quiz\/[^/]+$/) && request.method === 'POST') {
        const userId = path.split('/')[3];
        const { level, score, correct, total, max_streak } = await request.json();
        const accuracy = total > 0 ? correct / total : 0;
        await env.DB.prepare(
          `INSERT INTO quiz_scores (user_id, level, score, correct, total, accuracy, max_streak)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(userId, level, score, correct, total, accuracy, max_streak).run();
        await env.DB.prepare('UPDATE users SET total_score = total_score + ? WHERE id = ?')
          .bind(score, userId).run();
        return json({ saved: true });
      }

      // ── GET /api/leaderboard/:level  ───────────────────────
      if (path.match(/^\/api\/leaderboard\/[^/]+$/) && request.method === 'GET') {
        const level = path.split('/')[3];
        const rows = await env.DB.prepare(
          `SELECT u.name, MAX(q.score) as best_score, COUNT(*) as attempts,
                  ROUND(AVG(q.accuracy)*100) as avg_accuracy
           FROM quiz_scores q JOIN users u ON q.user_id = u.id
           WHERE q.level = ?
           GROUP BY q.user_id ORDER BY best_score DESC LIMIT 20`
        ).bind(level).all();
        return json({ leaderboard: rows.results });
      }

      // ── GET /api/stats/:userId  ────────────────────────────
      if (path.match(/^\/api\/stats\/[^/]+$/) && request.method === 'GET') {
        const userId = path.split('/')[3];
        const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
        const quizzes = await env.DB.prepare(
          `SELECT level, MAX(score) as best, COUNT(*) as count, ROUND(AVG(accuracy)*100) as avg_acc
           FROM quiz_scores WHERE user_id = ? GROUP BY level`
        ).bind(userId).all();
        return json({ user, quizzes: quizzes.results });
      }

      return json({ error: 'Not found' }, 404);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }
};

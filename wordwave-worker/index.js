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

      // ── GET /api/vocab/:lang/:level  (new multi-lang endpoint)
      if (path.match(/^\/api\/vocab\/[^/]+\/[^/]+$/) && request.method === 'GET') {
        const parts = path.split('/');
        const lang = parts[3];   // 'en' | 'ja'
        const level = parts[4];  // 'elementary' etc or 'N5' etc
        const rows = await env.DB.prepare(
          'SELECT word, pos, phonetic, zh, ex FROM vocabulary WHERE lang = ? AND level = ? ORDER BY RANDOM() LIMIT 500'
        ).bind(lang, level).all();
        return json({ lang, level, words: rows.results, total: rows.results.length });
      }

      // ── GET /api/vocab/:level  (backward compat — English only)
      if (path.match(/^\/api\/vocab\/[^/]+$/) && request.method === 'GET') {
        const level = path.split('/')[3];
        const valid = ['elementary','junior','high','university'];
        if (!valid.includes(level)) return json({ error: 'Invalid level' }, 400);
        const rows = await env.DB.prepare(
          'SELECT word, pos, phonetic, zh, ex FROM vocabulary WHERE lang = ? AND level = ? ORDER BY RANDOM() LIMIT 500'
        ).bind('en', level).all();
        return json({ level, words: rows.results, total: rows.results.length });
      }

      // ── POST /api/user/login
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

      // ── GET /api/progress/:userId/:lang/:level
      if (path.match(/^\/api\/progress\/[^/]+\/[^/]+\/[^/]+$/) && request.method === 'GET') {
        const parts = path.split('/');
        const userId = parts[3], lang = parts[4], level = parts[5];
        const rows = await env.DB.prepare(
          'SELECT word, status, freq, seen FROM word_progress WHERE user_id = ? AND lang = ? AND level = ?'
        ).bind(userId, lang, level).all();
        return json({ progress: rows.results });
      }

      // ── GET /api/progress/:userId/:level  (backward compat)
      if (path.match(/^\/api\/progress\/[^/]+\/[^/]+$/) && request.method === 'GET') {
        const parts = path.split('/');
        const userId = parts[3], level = parts[4];
        const rows = await env.DB.prepare(
          'SELECT word, status, freq, seen FROM word_progress WHERE user_id = ? AND lang = ? AND level = ?'
        ).bind(userId, 'en', level).all();
        return json({ progress: rows.results });
      }

      // ── POST /api/progress/:userId/:lang/:level
      if (path.match(/^\/api\/progress\/[^/]+\/[^/]+\/[^/]+$/) && request.method === 'POST') {
        const parts = path.split('/');
        const userId = parts[3], lang = parts[4], level = parts[5];
        const { wordStates } = await request.json();
        const entries = Object.entries(wordStates || {});
        if (entries.length > 0) {
          const stmt = env.DB.prepare(
            `INSERT INTO word_progress (user_id, lang, level, word, status, freq, seen, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
             ON CONFLICT(user_id, level, word) DO UPDATE SET
               status=excluded.status, freq=excluded.freq,
               seen=excluded.seen, updated_at=excluded.updated_at`
          );
          await env.DB.batch(entries.map(([word, ws]) =>
            stmt.bind(userId, lang, level, word, ws.status || 'new', ws.freq || 1, ws.seen || 0)
          ));
        }
        return json({ saved: entries.length });
      }

      // ── POST /api/progress/:userId/:level  (backward compat)
      if (path.match(/^\/api\/progress\/[^/]+\/[^/]+$/) && request.method === 'POST') {
        const parts = path.split('/');
        const userId = parts[3], level = parts[4];
        const { wordStates } = await request.json();
        const entries = Object.entries(wordStates || {});
        if (entries.length > 0) {
          const stmt = env.DB.prepare(
            `INSERT INTO word_progress (user_id, lang, level, word, status, freq, seen, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
             ON CONFLICT(user_id, level, word) DO UPDATE SET
               status=excluded.status, freq=excluded.freq,
               seen=excluded.seen, updated_at=excluded.updated_at`
          );
          await env.DB.batch(entries.map(([word, ws]) =>
            stmt.bind(userId, 'en', level, word, ws.status || 'new', ws.freq || 1, ws.seen || 0)
          ));
        }
        return json({ saved: entries.length });
      }

      // ── POST /api/quiz/:userId
      if (path.match(/^\/api\/quiz\/[^/]+$/) && request.method === 'POST') {
        const userId = path.split('/')[3];
        const { lang, level, score, correct, total, max_streak } = await request.json();
        const accuracy = total > 0 ? correct / total : 0;
        await env.DB.prepare(
          `INSERT INTO quiz_scores (user_id, lang, level, score, correct, total, accuracy, max_streak)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(userId, lang || 'en', level, score, correct, total, accuracy, max_streak).run();
        await env.DB.prepare('UPDATE users SET total_score = total_score + ? WHERE id = ?')
          .bind(score, userId).run();
        return json({ saved: true });
      }

      // ── GET /api/leaderboard/:lang/:level
      if (path.match(/^\/api\/leaderboard\/[^/]+\/[^/]+$/) && request.method === 'GET') {
        const parts = path.split('/');
        const lang = parts[3], level = parts[4];
        const rows = await env.DB.prepare(
          `SELECT u.name, MAX(q.score) as best_score, COUNT(*) as attempts,
                  ROUND(AVG(q.accuracy)*100) as avg_accuracy
           FROM quiz_scores q JOIN users u ON q.user_id = u.id
           WHERE q.lang = ? AND q.level = ?
           GROUP BY q.user_id ORDER BY best_score DESC LIMIT 20`
        ).bind(lang, level).all();
        return json({ leaderboard: rows.results });
      }

      // ── GET /api/leaderboard/:level  (backward compat)
      if (path.match(/^\/api\/leaderboard\/[^/]+$/) && request.method === 'GET') {
        const level = path.split('/')[3];
        const rows = await env.DB.prepare(
          `SELECT u.name, MAX(q.score) as best_score, COUNT(*) as attempts,
                  ROUND(AVG(q.accuracy)*100) as avg_accuracy
           FROM quiz_scores q JOIN users u ON q.user_id = u.id
           WHERE q.lang = 'en' AND q.level = ?
           GROUP BY q.user_id ORDER BY best_score DESC LIMIT 20`
        ).bind(level).all();
        return json({ leaderboard: rows.results });
      }

      // ── GET /api/stats/:userId
      if (path.match(/^\/api\/stats\/[^/]+$/) && request.method === 'GET') {
        const userId = path.split('/')[3];
        const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
        const quizzes = await env.DB.prepare(
          `SELECT lang, level, MAX(score) as best, COUNT(*) as count, ROUND(AVG(accuracy)*100) as avg_acc
           FROM quiz_scores WHERE user_id = ? GROUP BY lang, level`
        ).bind(userId).all();
        return json({ user, quizzes: quizzes.results });
      }

      return json({ error: 'Not found' }, 404);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }
};

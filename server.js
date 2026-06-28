// server.js — HabitFlow lokal, SQLite, tanpa setup database
require('dotenv').config();
const express = require('express');
const path    = require('path');
const crypto  = require('crypto');
const Database = require('better-sqlite3');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ─── SQLite: auto-create file & tabel ────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS habits (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT '#7c6af7',
    created_at TEXT NOT NULL,
    is_active  INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id   TEXT NOT NULL,
    log_date   TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(habit_id, log_date)
  );
  CREATE INDEX IF NOT EXISTS idx_log_date ON logs(log_date);
`);

// ─── HABITS ──────────────────────────────────────────────────────────────────
app.get('/api/habits', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM habits WHERE is_active = 1 ORDER BY created_at ASC').all();
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/habits', (req, res) => {
  const { name, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nama habit tidak boleh kosong' });
  try {
    const id    = crypto.randomUUID();
    const today = new Date().toISOString().slice(0, 10);
    const c     = color || '#7c6af7';
    db.prepare('INSERT INTO habits (id, name, color, created_at) VALUES (?, ?, ?, ?)').run(id, name.trim(), c, today);
    res.status(201).json({ data: { id, name: name.trim(), color: c, created_at: today } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/habits/:id', (req, res) => {
  try {
    db.prepare('UPDATE habits SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── LOGS ────────────────────────────────────────────────────────────────────
app.get('/api/logs', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(); defaultFrom.setDate(defaultFrom.getDate() - 60);
  const dateFrom = req.query.from || defaultFrom.toISOString().slice(0, 10);
  const dateTo   = req.query.to   || today;
  try {
    const rows = db.prepare(
      `SELECT habit_id, log_date FROM logs WHERE log_date BETWEEN ? AND ? ORDER BY log_date ASC`
    ).all(dateFrom, dateTo);
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.log_date]) grouped[row.log_date] = [];
      grouped[row.log_date].push(row.habit_id);
    }
    res.json({ data: grouped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logs/toggle', (req, res) => {
  const { habit_id, date } = req.body;
  if (!habit_id || !date) return res.status(400).json({ error: 'habit_id dan date wajib diisi' });
  try {
    const existing = db.prepare('SELECT id FROM logs WHERE habit_id = ? AND log_date = ?').get(habit_id, date);
    let action;
    if (existing) {
      db.prepare('DELETE FROM logs WHERE habit_id = ? AND log_date = ?').run(habit_id, date);
      action = 'unchecked';
    } else {
      db.prepare('INSERT INTO logs (habit_id, log_date) VALUES (?, ?)').run(habit_id, date);
      action = 'checked';
    }
    res.json({ success: true, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STATS ───────────────────────────────────────────────────────────────────
app.get('/api/stats/monthly', (req, res) => {
  const now   = new Date();
  const year  = parseInt(req.query.year)  || now.getFullYear();
  const month = parseInt(req.query.month) || (now.getMonth() + 1);
  const firstDay    = `${year}-${String(month).padStart(2,'0')}-01`;
  const lastDay     = new Date(year, month, 0).toISOString().slice(0, 10);
  const prevDate    = new Date(year, month - 2, 1);
  const prevYear    = prevDate.getFullYear();
  const prevMonth   = prevDate.getMonth() + 1;
  const firstDayPrev = `${prevYear}-${String(prevMonth).padStart(2,'0')}-01`;
  const lastDayPrev  = new Date(prevYear, prevMonth, 0).toISOString().slice(0, 10);
  try {
    const rows = db.prepare(
      `SELECT log_date, COUNT(*) as count FROM logs
       WHERE (log_date BETWEEN ? AND ?) OR (log_date BETWEEN ? AND ?)
       GROUP BY log_date ORDER BY log_date`
    ).all(firstDay, lastDay, firstDayPrev, lastDayPrev);
    const bucketize = (startStr, endStr, y, m) => {
      const weeks = [0, 0, 0, 0];
      for (const row of rows) {
        if (row.log_date < startStr || row.log_date > endStr) continue;
        const day = parseInt(row.log_date.slice(8), 10);
        weeks[Math.min(Math.floor((day - 1) / 7), 3)] += Number(row.count);
      }
      return weeks;
    };
    res.json({
      thisMonth: bucketize(firstDay, lastDay, year, month),
      lastMonth: bucketize(firstDayPrev, lastDayPrev, prevYear, prevMonth),
      labels: ['W1','W2','W3','W4'],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EXPORT CSV ──────────────────────────────────────────────────────────────
app.get('/api/export', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'Parameter from dan to wajib diisi' });

  try {
    const habits = db.prepare('SELECT id, name, color FROM habits WHERE is_active = 1').all();
    const logs   = db.prepare(
      'SELECT habit_id, log_date FROM logs WHERE log_date BETWEEN ? AND ? ORDER BY log_date ASC'
    ).all(from, to);

    // Buat set untuk lookup cepat
    const done = new Set(logs.map(r => `${r.habit_id}|${r.log_date}`));

    // Kumpulkan semua tanggal unik dalam range
    const dates = [];
    const cur = new Date(from);
    const end = new Date(to);
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }

    // Header CSV
    const habitNames = habits.map(h => `"${h.name.replace(/"/g,'""')}"`);
    const lines = [`Tanggal,${habitNames.join(',')}`];

    // Baris per tanggal
    for (const date of dates) {
      const cols = habits.map(h => done.has(`${h.id}|${date}`) ? '1' : '0');
      lines.push(`${date},${cols.join(',')}`);
    }

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="habitflow_${from}_${to}.csv"`);
    res.send('\uFEFF' + csv); // BOM supaya Excel bisa buka langsung
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', db: DB_PATH, time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// ─── Fallback → index.html ────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ HabitFlow berjalan di → http://localhost:${PORT}`);
  console.log(`   Database  : ${DB_PATH}`);
});

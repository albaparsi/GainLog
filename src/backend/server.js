import express from 'express';
import cors from 'cors';
import pool from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Create or find user
app.post('/api/users', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
  try {
    // If a user with the same name exists, return it; else insert new
    const existing = await pool.query('SELECT user_id, name FROM users WHERE name = $1 LIMIT 1', [name.trim()]);
    if (existing.rows.length) {
      return res.json(existing.rows[0]);
    }
    const inserted = await pool.query('INSERT INTO users (name) VALUES ($1) RETURNING user_id, name', [name.trim()]);
    res.status(201).json(inserted.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add workout entry (matching schema: workout_id, user_id, workout_date, reps, weight, sets, body_part, exercise)
app.post('/api/workouts', async (req, res) => {
  const { user_id, exercise, sets, reps, weight, body_part, workout_date } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  if (!exercise) return res.status(400).json({ error: 'exercise required' });
  if (!body_part) return res.status(400).json({ error: 'body_part required' });
  // workout_date optional; default to today if absent
  const dateVal = workout_date || new Date().toISOString().slice(0,10);
  try {
    const result = await pool.query(
      'INSERT INTO workouts (user_id, workout_date, reps, weight, sets, body_part, exercise) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING workout_id, user_id, workout_date, reps, weight, sets, body_part, exercise',
      [user_id, dateVal, reps ?? null, weight ?? null, sets ?? null, body_part, exercise]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// List workouts for a user
app.get('/api/users/:userId/workouts', async (req, res) => {
  try {
    const { userId } = req.params;
    const { date } = req.query; // optional date filter (YYYY-MM-DD)
    let result;
    if (date) {
      result = await pool.query(
        'SELECT workout_id, workout_date, body_part, exercise, sets, reps, weight FROM workouts WHERE user_id = $1 AND workout_date = $2 ORDER BY workout_id DESC',
        [userId, date]
      );
    } else {
      result = await pool.query(
        'SELECT workout_id, workout_date, body_part, exercise, sets, reps, weight FROM workouts WHERE user_id = $1 ORDER BY workout_date DESC, workout_id DESC',
        [userId]
      );
    }
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a workout
app.put('/api/workouts/:id', async (req, res) => {
  const { id } = req.params;
  const { exercise, sets, reps, weight, body_part, workout_date } = req.body;
  if (!exercise || !body_part) return res.status(400).json({ error: 'exercise and body_part required' });
  try {
    const result = await pool.query(
      'UPDATE workouts SET exercise = $1, sets = $2, reps = $3, weight = $4, body_part = $5, workout_date = $6 WHERE workout_id = $7 RETURNING workout_id, workout_date, body_part, exercise, sets, reps, weight',
      [exercise, sets ?? null, reps ?? null, weight ?? null, body_part, workout_date || new Date().toISOString().slice(0,10), id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 5174;
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));

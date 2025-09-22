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

// ---- Goals Endpoints ----
let GOALS_DATE_COL = 'set_goal_date';
(async function detectGoalsDateColumn(){
  try {
    const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='goals'");
    const cols = r.rows.map(c=>c.column_name);
    if (cols.includes('set_goal_date')) GOALS_DATE_COL='set_goal_date';
    else if (cols.includes('workout_date')) GOALS_DATE_COL='workout_date';
    else console.warn('Could not find a date column (set_goal_date/workout_date) in goals table');
    console.log('[Goals] Using date column:', GOALS_DATE_COL);
  } catch(e){
    console.error('Failed detecting goals date column', e);
  }
})();

function mapGoalRow(row){
  // Always expose set_goal_date field to client for consistency
  return {
    goal_id: row.goal_id ?? row.workout_id,
    user_id: row.user_id,
    set_goal_date: row[GOALS_DATE_COL],
    reps: row.reps,
    weight: row.weight,
    sets: row.sets,
    body_part: row.body_part,
    exercise: row.exercise
  };
}

// Create goal
app.post('/api/goals', async (req, res) => {
  const { user_id, exercise, sets, reps, weight, body_part } = req.body;
  let { set_goal_date, workout_date } = req.body; // accept either in request
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  if (!exercise) return res.status(400).json({ error: 'exercise required' });
  if (!body_part) return res.status(400).json({ error: 'body_part required' });
  const dateVal = set_goal_date || workout_date || new Date().toISOString().slice(0,10);
  try {
    const sql = `INSERT INTO goals (user_id, ${GOALS_DATE_COL}, reps, weight, sets, body_part, exercise) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING workout_id as goal_id, user_id, ${GOALS_DATE_COL}, reps, weight, sets, body_part, exercise`;
    const params = [user_id, dateVal, reps ?? null, weight ?? null, sets ?? null, body_part, exercise];
    const result = await pool.query(sql, params);
    res.status(201).json(mapGoalRow(result.rows[0]));
  } catch (e) {
    console.error('Create goal error', e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// List goals (?date= filters against whichever date column exists)
app.get('/api/users/:userId/goals', async (req, res) => {
  try {
    const { userId } = req.params;
    const { date } = req.query;
    let result;
    if (date) {
      const sql = `SELECT workout_id as goal_id, ${GOALS_DATE_COL}, body_part, exercise, sets, reps, weight, user_id FROM goals WHERE user_id=$1 AND ${GOALS_DATE_COL}=$2 ORDER BY workout_id DESC`;
      result = await pool.query(sql, [userId, date]);
    } else {
      const sql = `SELECT workout_id as goal_id, ${GOALS_DATE_COL}, body_part, exercise, sets, reps, weight, user_id FROM goals WHERE user_id=$1 ORDER BY ${GOALS_DATE_COL} DESC, workout_id DESC`;
      result = await pool.query(sql, [userId]);
    }
    res.json(result.rows.map(mapGoalRow));
  } catch (e) {
    console.error('List goals error', e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// Update goal
app.put('/api/goals/:id', async (req, res) => {
  const { id } = req.params;
  const { exercise, sets, reps, weight, body_part } = req.body;
  let { set_goal_date, workout_date } = req.body;
  if (!exercise || !body_part) return res.status(400).json({ error: 'exercise and body_part required' });
  const dateVal = set_goal_date || workout_date || new Date().toISOString().slice(0,10);
  try {
    const sql = `UPDATE goals SET exercise=$1, sets=$2, reps=$3, weight=$4, body_part=$5, ${GOALS_DATE_COL}=$6 WHERE workout_id=$7 RETURNING workout_id as goal_id, user_id, ${GOALS_DATE_COL}, reps, weight, sets, body_part, exercise`;
    const params = [exercise, sets ?? null, reps ?? null, weight ?? null, body_part, dateVal, id];
    const result = await pool.query(sql, params);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapGoalRow(result.rows[0]));
  } catch (e) {
    console.error('Update goal error', e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// Delete goal
app.delete('/api/goals/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM goals WHERE workout_id = $1 RETURNING workout_id', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success:true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 5174;
// Debug endpoint to list basic registered custom routes (simple manual list)
app.get('/api/debug/routes', (req,res)=> {
  res.json({ routes:[
    'POST /api/users',
    'POST /api/workouts',
    'GET /api/users/:userId/workouts',
    'PUT /api/workouts/:id',
    'POST /api/goals',
    'GET /api/users/:userId/goals',
    'PUT /api/goals/:id',
    'DELETE /api/goals/:id'
  ], goalsDateColumn: GOALS_DATE_COL });
});

console.log('[Startup] Registering goals routes with date column', GOALS_DATE_COL);
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));

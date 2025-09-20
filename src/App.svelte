<script>
  import { onMount } from 'svelte';
  let page = 'home';
  let userName = '';
  let inputName = '';
  let joinDate = '';
  let today = '';
  let activeSeconds = 0;
  let activeInterval;

  // Theme handling
  let theme = 'pink';
  let showThemePicker = false;
  const themes = {
    pink:  { bg: '#ffe4ec', text: '#2d2d2d', accent: '#ff8fb1', panel:'#ffd3e2', row:'#f9bed3', input:'#ffc3d9' },
    green: { bg: '#e3f9e5', text: '#1f3324', accent: '#5bbf72', panel:'#d2f0d8', row:'#bee6c7', input:'#b2dbbb' },
    yellow:{ bg: '#fff9d6', text: '#3a3200', accent: '#e0b300', panel:'#f5e7a8', row:'#ecd989', input:'#e3cd72' },
    orange:{ bg: '#ffe9d6', text: '#3b2412', accent: '#ff9a3c', panel:'#ffd2b0', row:'#ffc096', input:'#ffb27d' },
    blue:  { bg: '#e0f2ff', text: '#1e2b36', accent: '#6ab4ff', panel:'#cbe6ff', row:'#b5dbff', input:'#a4d1fc' }
  };

  function applyTheme(t) {
    theme = t;
    const body = document.body;
    for (const key of Object.keys(themes)) body.classList.remove('theme-' + key);
    body.classList.add('theme-' + t);
    const th = themes[t];
    body.style.setProperty('--color-bg', th.bg);
    body.style.setProperty('--color-text', th.text);
    body.style.setProperty('--color-accent', th.accent);
  body.style.setProperty('--color-panel', th.panel);
  body.style.setProperty('--color-row', th.row);
  body.style.setProperty('--color-input', th.input || th.row);
    localStorage.setItem('ft_theme', t);
    showThemePicker = false;
  }

  // Tracking page state
  let workoutQuestion = '';
  let setsOptions = Array.from({length: 10}, (_, i) => i + 1);
  let repsOptions = Array.from({length: 20}, (_, i) => i + 1);

  // For multiple exercises
  function createTemplateRow() { return { name: '', sets: 1, reps: 1, weight: '', editing: false, submitted: false, isTemplate: true }; }
  let exercises = [
    createTemplateRow()
  ];

  let showDonePrompt = false;
  let showSavedMsg = false;

  let userId = null;
  const API_BASE = 'http://localhost:5174/api';

  // Calendar & historical editing state
  let selectedDate = null; // YYYY-MM-DD
  let calendarYear;
  let calendarMonth; // 0-11
  let calendarDays = [];
  let loadingWorkouts = false;
  let dateWorkouts = []; // workouts for selected date
  let editingDate = false; // toggles edit mode for date workouts

  function initCalendar() {
    const now = new Date();
    calendarYear = now.getFullYear();
    calendarMonth = now.getMonth();
    buildCalendarDays();
  }

  function buildCalendarDays() {
    const first = new Date(calendarYear, calendarMonth, 1);
    const last = new Date(calendarYear, calendarMonth + 1, 0);
    const startWeekday = first.getDay();
    const daysInMonth = last.getDate();
    const arr = [];
    for (let i = 0; i < startWeekday; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    calendarDays = arr;
  }

  function prevMonth() {
    if (calendarMonth === 0) {
      calendarMonth = 11; calendarYear--;
    } else calendarMonth--;
    buildCalendarDays();
  }
  function nextMonth() {
    if (calendarMonth === 11) {
      calendarMonth = 0; calendarYear++;
    } else calendarMonth++;
    buildCalendarDays();
  }

  async function selectCalendarDay(day) {
    if (!day) return;
    const mm = String(calendarMonth + 1).padStart(2,'0');
    const dd = String(day).padStart(2,'0');
    selectedDate = `${calendarYear}-${mm}-${dd}`;
    await fetchWorkoutsForDate();
  }

  async function fetchWorkoutsForDate() {
    if (!userId || !selectedDate) return;
    loadingWorkouts = true;
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/workouts?date=${selectedDate}`);
      if (!res.ok) throw new Error('Failed to load workouts');
      dateWorkouts = await res.json();
      // Add local editing flags
      dateWorkouts = dateWorkouts.map(w => ({ ...w, _editing: false }));
    } catch (e) {
      console.error(e);
      alert('Unable to load workouts for date');
    } finally {
      loadingWorkouts = false;
    }
  }

  function goCalendar() {
    if (page !== 'calendar') {
      initCalendar();
      page = 'calendar';
    }
  }

  function goTracking() {
    if (page !== 'tracking') page = 'tracking';
  }

  function beginEdit(w) {
    dateWorkouts = dateWorkouts.map(item => {
      if (item === w) {
        return {
          ...item,
          _editing: true,
          _draft: {
            exercise: item.exercise ?? '',
            sets: item.sets ?? 0,
            reps: item.reps ?? 0,
            weight: item.weight ?? null,
            body_part: item.body_part ?? (workoutQuestion || 'General'),
            workout_date: item.workout_date
          }
        };
      }
      return item;
    });
  }
  function cancelEdit(w) {
    dateWorkouts = dateWorkouts.map(item => item === w ? { ...item, _editing: false, _draft: undefined } : item);
  }
  async function saveEdit(w) {
    const target = dateWorkouts.find(item => item === w);
    if (!target || !target._draft) return;
    try {
      const payload = { ...target._draft };
      const res = await fetch(`${API_BASE}/workouts/${target.workout_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      dateWorkouts = dateWorkouts.map(item => item === w ? { ...item, ...updated, _editing: false, _draft: undefined } : item);
    } catch (e) {
      console.error(e);
      alert('Unable to update workout');
    }
  }

  function addNewDateWorkoutRow() {
    if (!selectedDate) return;
    const newRow = { workout_id: null, workout_date: selectedDate, body_part: workoutQuestion || 'General', exercise: '', sets: 1, reps: 1, weight: null, _editing: true, _draft: { exercise: '', sets: 1, reps: 1, weight: null, body_part: workoutQuestion || 'General', workout_date: selectedDate } };
    dateWorkouts = [...dateWorkouts, newRow];
  }

  async function saveNewDateWorkout(w) {
    if (!userId) { alert('No user'); return; }
    const target = dateWorkouts.find(item => item === w);
    if (!target || !target._draft) return;
    try {
      const res = await fetch(`${API_BASE}/workouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, ...target._draft })
      });
      if (!res.ok) throw new Error('Create failed');
      const created = await res.json();
      dateWorkouts = dateWorkouts.map(item => item === w ? { ...item, ...created, _editing: false, _draft: undefined } : item);
    } catch (e) {
      console.error(e);
      alert('Unable to create workout');
    }
  }

  function addExerciseRow() {
    exercises = [...exercises, { name: '', sets: 1, reps: 1, weight: '', editing: false, submitted: false, isTemplate: false }];
  }

  function beginExerciseEdit(idx) {
    exercises = exercises.map((ex,i)=> i===idx ? { ...ex, editing:true } : ex);
  }

  function cancelExerciseEdit(idx) {
    const row = exercises[idx];
    if (!row) return;
    // If new unsaved non-template row and cancelled empty, remove it
    if (!row.isTemplate && !row.submitted && !row.name.trim()) {
      exercises = exercises.filter((_,i)=> i!==idx);
      return;
    }
    exercises = exercises.map((ex,i)=> i===idx ? { ...ex, editing:false } : ex);
  }

  async function persistExercise(idx) {
    const row = exercises[idx];
    if (!row) return;
    if (!row.name.trim()) return; // don't save empty
    // Local-only update; mark as submitted but no backend until Done Tracking
    exercises = exercises.map((ex,i)=> i===idx ? { ...ex, submitted:true, editing:false, isTemplate:false } : ex);
  }

  async function saveAllExercises() {
    if (!userId) { alert('Create a user first.'); return; }
    const todayIso = joinDate ? new Date(joinDate).toISOString().slice(0,10) : new Date().toISOString().slice(0,10);
    for (let i=0;i<exercises.length;i++) {
      const ex = exercises[i];
      if (!ex.name.trim()) continue;
      const payload = {
        user_id: userId,
        exercise: ex.name.trim(),
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight || null,
        body_part: workoutQuestion || 'General',
        workout_date: todayIso
      };
      try {
        if (ex.workout_id) {
          const res = await fetch(`${API_BASE}/workouts/${ex.workout_id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          if (!res.ok) throw new Error('Update failed');
          const data = await res.json();
          exercises[i] = { ...exercises[i], name:data.exercise, sets:data.sets, reps:data.reps, weight:data.weight };
        } else {
          const res = await fetch(`${API_BASE}/workouts`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          if (!res.ok) throw new Error('Create failed');
          const data = await res.json();
          exercises[i] = { ...exercises[i], workout_id:data.workout_id };
        }
      } catch(e) {
        console.error('Failed to save exercise', ex, e);
      }
    }
  }

  function removeExercise(idx) {
    const row = exercises[idx];
    if (!row) return;
    if (row.isTemplate) return; // keep initial template row
    if (row.workout_id) {
      // Placeholder for future backend DELETE call
    }
    exercises = exercises.filter((_,i)=> i!==idx);
  }

  onMount(() => {
    const d = new Date();
    today = d.toLocaleDateString();
    // Simulate join date as today for now
    joinDate = d.toLocaleDateString();
    const storedId = localStorage.getItem('ft_user_id');
    const storedName = localStorage.getItem('ft_user_name');
    const storedTheme = localStorage.getItem('ft_theme');
    if (storedId && storedName) {
      userId = storedId;
      userName = storedName;
      activeSeconds = 0;
      clearInterval(activeInterval);
      activeInterval = setInterval(() => { activeSeconds += 1; }, 1000);
    }
    if (storedTheme && themes[storedTheme]) {
      applyTheme(storedTheme);
    } else {
      applyTheme(theme);
    }
  });

  async function submitName() {
    if (!inputName.trim()) return;
    const nameValue = inputName.trim();
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameValue })
      });
      if (!res.ok) throw new Error('Failed to create user');
      const data = await res.json();
      userName = data.name;
      userId = data.user_id;
      localStorage.setItem('ft_user_id', userId);
      localStorage.setItem('ft_user_name', userName);
      inputName = '';
      activeSeconds = 0;
      clearInterval(activeInterval);
      activeInterval = setInterval(() => { activeSeconds += 1; }, 1000);
    } catch (e) {
      console.error(e);
      alert('Unable to save user. Is the backend running?');
    }
  }

  function startTracking() {
    page = 'tracking';
  }

  // workoutQuestion will be captured directly from input, no submit button

  function doneTracking() {
    showDonePrompt = true;
  }

  function confirmDoneTracking(yes) {
    showDonePrompt = false;
    if (yes) {
  saveAllExercises();
      showSavedMsg = true;
      setTimeout(() => showSavedMsg = false, 3000);
    }
  }

  $: activeTime = `${Math.floor(activeSeconds/60)}m ${activeSeconds%60}s`;
</script>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
    margin-bottom: 2rem;
  }
  .title {
    font-size: 2rem;
    font-weight: bold;
  }
  .top-right {
    text-align: right;
    font-size: 0.9rem;
    color: #666;
  }
  .center-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 4rem;
  }
  .input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  /* Removed unused original template selectors (.logo, .read-the-docs) */
  /* Theme switcher */
  .theme-switcher { position: fixed; top: 10px; left: 10px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; z-index: 1000; }
  .theme-btn { padding: 0.4rem 0.9rem; background: transparent; color: #000; font-size: 0.85rem; border:1px solid #000; border-radius:20px; cursor:pointer; transition: background .15s, color .15s; }
  .theme-btn:hover { background: rgba(0,0,0,0.07); }
  .theme-circles { display:flex; gap:8px; }
  .theme-circle { width:28px; height:28px; padding:0; aspect-ratio:1/1; border-radius:50%; cursor:pointer; border:1px solid #000; background: transparent; transition: transform 0.15s, border .15s; display:inline-block; }
  .theme-circle:hover { transform: scale(1.08); }
  .theme-circle.active { border:3px solid #000; }
  .nav-btn.active { background:#000; color:#fff; }
  /* Enlarged calendar */
  .calendar-wrapper { max-width: 880px; margin: 2rem auto 0; }
  .calendar-grid { display:grid; grid-template-columns: repeat(7, 110px); gap:12px; justify-content:center; }
  .calendar-head { font-weight:600; text-align:center; font-size:0.9rem; }
  .cal-cell { height:110px; width:110px; border:2px solid rgba(0,0,0,0.35); background: var(--color-row); border-radius:14px; display:flex; flex-direction:column; justify-content:flex-start; align-items:flex-start; padding:8px 10px; gap:6px; cursor:pointer; font-size:0.95rem; font-weight:500; transition: background .2s, transform .15s, box-shadow .2s; }
  .cal-cell:hover { background: var(--color-panel); }
  .cal-cell.selected { background: var(--color-accent); color:#fff; box-shadow:0 4px 10px rgba(0,0,0,0.15); }
  .cal-day-number { font-size:1.3rem; font-weight:600; line-height:1; color:#333; }
  .cal-cell.selected .cal-day-number { color:#fff; }
  /* marker style reserved (currently unused) */
  @media (max-width: 900px) {
    .calendar-grid { grid-template-columns: repeat(7, 1fr); gap:6px; }
    .cal-cell { height:70px; width:100%; padding:6px 6px; border-radius:10px; }
  /* marker small */
  }
  .track-table-wrapper { max-width:880px; width:880px; background:var(--color-panel); border:1px solid rgba(0,0,0,0.15); border-radius:12px; padding:1rem 1.2rem 1.2rem; box-shadow:0 3px 8px rgba(0,0,0,0.05); box-sizing:border-box; }
  table.track-table { width:100%; table-layout:fixed; border-collapse:separate; border-spacing:0 6px; }
  table.track-table tbody tr { background:var(--color-row); transition: background .15s; height:48px; }
  table.track-table td { padding:6px 10px; vertical-align:middle; height:48px; }
  .inline-input { width:100%; padding:4px 6px; font:inherit; border:1px solid #b4b4b4; border-radius:6px; background:var(--color-input); height:32px; box-sizing:border-box; }
  .tracker-footer { display:flex; margin-top:0.75rem; gap:0.75rem; min-height:42px; align-items:center; }
  .prompt-box { min-height:42px; }
  .faux-input { display:block; width:100%; height:32px; line-height:32px; background:var(--color-input); border:1px solid #b4b4b4; border-radius:6px; padding:0 8px; font-size:0.85rem; color:var(--color-text); box-sizing:border-box; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
  table.track-table th { color: var(--color-text); font-weight:600; }
  table.track-table td.numeric .faux-input { text-align:center; font-weight:600; }
  .faux-input.placeholder { color:#999; font-style:italic; }
  .action-btns { display:flex; gap:6px; justify-content:flex-start; }
</style>

<!-- Global Theme / Nav -->
<div class="theme-switcher">
  <div style="display:flex; align-items:center; gap:8px;">
    <button class="theme-btn" on:click={() => showThemePicker = !showThemePicker}>Theme</button>
    {#if showThemePicker}
      <div class="theme-circles">
        {#each Object.keys(themes) as t}
          <button
            class="theme-circle {theme===t ? 'active' : ''}"
            aria-label={"Select theme " + t}
            style="background:{themes[t].bg};"
            on:click={() => applyTheme(t)}
          ></button>
        {/each}
      </div>
    {/if}
  </div>
  {#if userName}
    <button class="theme-btn nav-btn {page==='calendar' ? 'active' : ''}" on:click={goCalendar}>Calendar</button>
    <button class="theme-btn nav-btn {page==='tracking' ? 'active' : ''}" on:click={goTracking}>Tracker</button>
  {/if}
</div>

{#if page === 'home'}
  <div class="header">
    <div class="title">Fitness Tracker</div>
    <div class="top-right">
      <div>{today}</div>
      <div>Active: {activeTime}</div>
      <div>Joined: {joinDate}</div>
    </div>
  </div>
  <div class="center-box">
    <div class="input-row">
      <span>Hello</span>
      {#if userName}
        <span style="font-weight:bold;">{userName}</span>
      {:else}
        <input type="text" placeholder="Enter your name" bind:value={inputName} on:keydown={(e) => e.key === 'Enter' && submitName()} />
        <button on:click={submitName}>Submit</button>
      {/if}
      <span>, let's start tracking.</span>
    </div>
    {#if userName}
      <button style="margin-top:2rem;" on:click={startTracking}>Start Tracking</button>
    {/if}
  </div>
{/if}

{#if page === 'tracking'}
  <div>
    <div class="track-table-wrapper">
      <div class="table-title" style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom:0.75rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
          <span style="font-size:1.15rem; font-weight:700;">What are we hitting today?</span>
          <div style="display:flex; gap:0.5rem; align-items:center; flex:1;">
            <input type="text" placeholder="e.g. Chest, Cardio..." bind:value={workoutQuestion} style="flex:1;" />
          </div>
        </div>
      </div>
      <table class="track-table">
        <thead>
          <tr>
            <th style="width:38%;">Exercise</th>
            <th style="width:14%;">Sets</th>
            <th style="width:14%;">Reps</th>
            <th style="width:14%;">Weight</th>
            <th style="width:20%; text-align:left;">Action</th>
          </tr>
        </thead>
        <tbody>
          {#each exercises as ex, idx}
            <tr class:{editing:ex.editing}>
              <td>
                {#if ex.editing}
                  <input class="inline-input" type="text" bind:value={exercises[idx].name} />
                {:else}
                  <span class="faux-input {ex.name ? '' : 'placeholder'}">{ex.name || 'Bench Press'}</span>
                {/if}
              </td>
              <td class="numeric">
                {#if ex.editing}
                  <select class="inline-input" bind:value={exercises[idx].sets}>
                    {#each setsOptions as n}<option value={n}>{n}</option>{/each}
                  </select>
                {:else}
                  <span class="faux-input {ex.sets ? '' : 'placeholder'}">{ex.sets || 3}</span>
                {/if}
              </td>
              <td class="numeric">
                {#if ex.editing}
                  <select class="inline-input" bind:value={exercises[idx].reps}>
                    {#each repsOptions as n}<option value={n}>{n}</option>{/each}
                  </select>
                {:else}
                  <span class="faux-input {ex.reps ? '' : 'placeholder'}">{ex.reps || 10}</span>
                {/if}
              </td>
              <td class="numeric">
                {#if ex.editing}
                  <input class="inline-input" type="text" bind:value={exercises[idx].weight} />
                {:else}
                  <span class="faux-input {ex.weight ? '' : 'placeholder'}">{ex.weight || '135 lb'}</span>
                {/if}
              </td>
              <td>
                <div class="action-btns">
                  {#if ex.editing}
                    <button on:click={() => persistExercise(idx)}>Save</button>
                    <button on:click={() => cancelExerciseEdit(idx)}>Cancel</button>
                  {:else}
                    <button on:click={() => beginExerciseEdit(idx)}>Edit</button>
                    {#if !ex.isTemplate}<button on:click={() => removeExercise(idx)}>Remove</button>{/if}
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <div class="tracker-footer">
        <button on:click={addExerciseRow}>Add Exercise</button>
        <button on:click={doneTracking}>Done Tracking</button>
      </div>
      {#if showDonePrompt}
        <div class="prompt-box" style="margin-top:1rem;">
          <span>Are you done tracking?</span>
          <button style="margin-left:1rem;" on:click={() => confirmDoneTracking(true)}>Yes</button>
          <button style="margin-left:0.5rem;" on:click={() => confirmDoneTracking(false)}>No</button>
        </div>
      {/if}
      {#if showSavedMsg}
        <div style="margin-top:1rem; color:green; font-weight:bold;">Your results have been saved.</div>
      {/if}
    </div>
  </div>
{/if}

{#if page === 'calendar'}
  <div class="panel calendar-wrapper">
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <button on:click={prevMonth}>&lt;</button>
        <strong>{new Date(calendarYear, calendarMonth).toLocaleString(undefined,{month:'long', year:'numeric'})}</strong>
        <button on:click={nextMonth}>&gt;</button>
      </div>
      {#if selectedDate}
        <div>Selected: {selectedDate}</div>
      {/if}
    </div>
    <div class="calendar-grid" style="margin-top:1rem;">
      <div class="calendar-head">Sun</div>
      <div class="calendar-head">Mon</div>
      <div class="calendar-head">Tue</div>
      <div class="calendar-head">Wed</div>
      <div class="calendar-head">Thu</div>
      <div class="calendar-head">Fri</div>
      <div class="calendar-head">Sat</div>
      {#each calendarDays as d}
        {#if d === null}
          <div></div>
        {:else}
          <button type="button" class="cal-cell {selectedDate && Number(selectedDate.slice(-2))===d && new Date(selectedDate).getMonth()===calendarMonth ? 'selected' : ''}" on:click={() => selectCalendarDay(d)}>
            <span class="cal-day-number">{d}</span>
          </button>
        {/if}
      {/each}
    </div>
    {#if selectedDate}
      <div style="margin-top:1rem;">
        <h3 style="margin:0 0 0.5rem 0;">Workouts on {selectedDate}</h3>
        <button on:click={addNewDateWorkoutRow}>Add Workout</button>
        {#if loadingWorkouts}
          <div>Loading...</div>
        {:else if !dateWorkouts.length}
          <div style="margin-top:0.5rem;">No workouts yet.</div>
        {/if}
        {#if dateWorkouts.length}
          <div style="margin-top:0.5rem;">
            <div style="display:grid; grid-template-columns: 120px 100px 100px 100px 120px 160px; gap:4px; font-weight:bold; font-size:0.85rem;">
              <div>Body Part</div>
              <div>Exercise</div>
              <div>Sets</div>
              <div>Reps</div>
              <div>Weight</div>
              <div>Actions</div>
            </div>
            {#each dateWorkouts as w}
              {#if w._editing}
                <div style="display:grid; grid-template-columns: 120px 100px 100px 100px 100px 160px; gap:4px; margin-top:4px;">
                  <input type="text" bind:value={w._draft.body_part} />
                  <input type="text" bind:value={w._draft.exercise} />
                  <input type="number" min="0" bind:value={w._draft.sets} />
                  <input type="number" min="0" bind:value={w._draft.reps} />
                  <input type="number" step="0.1" bind:value={w._draft.weight} />
                  {#if w.workout_id}
                    <div>
                      <button on:click={() => saveEdit(w)}>Save</button>
                      <button on:click={() => cancelEdit(w)} style="margin-left:4px;">Cancel</button>
                    </div>
                  {:else}
                    <div>
                      <button on:click={() => saveNewDateWorkout(w)}>Create</button>
                      <button on:click={() => cancelEdit(w)} style="margin-left:4px;">Cancel</button>
                    </div>
                  {/if}
                </div>
              {:else}
                <div style="display:grid; grid-template-columns: 120px 100px 100px 100px 100px 160px; gap:4px; margin-top:4px;">
                  <div>{w.body_part}</div>
                  <div>{w.exercise}</div>
                  <div>{w.sets}</div>
                  <div>{w.reps}</div>
                  <div>{w.weight}</div>
                  <div>
                    <button on:click={() => beginEdit(w)}>Edit</button>
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}


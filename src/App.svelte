
<script>
  import { onMount } from 'svelte';
  let page = 'home';
  let userName = '';
  let inputName = '';
  let joinDate = '';
  let today = '';
  let activeSeconds = 0;
  let activeInterval;

  // Tracking page state
  let workoutQuestion = '';
  let workoutInput = '';
  let setsOptions = Array.from({length: 10}, (_, i) => i + 1);
  let repsOptions = Array.from({length: 20}, (_, i) => i + 1);

  // For multiple exercises
  let exercises = [
    { name: '', sets: 1, reps: 1, weight: '' }
  ];

  let showDonePrompt = false;
  let showSavedMsg = false;

  let userId = null;
  const API_BASE = 'http://localhost:5174/api';

  // Calendar & historical editing state
  let showCalendar = false;
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

  function openCalendar() {
    if (!showCalendar) {
      initCalendar();
    }
    showCalendar = !showCalendar;
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
    exercises = [...exercises, { name: '', sets: 1, reps: 1, weight: '' }];
  }

  async function submitExerciseRow(idx) {
    if (!exercises[idx].name.trim()) return;
    if (!userId) {
      alert('Create a user first.');
      return;
    }
    const payload = {
      user_id: userId,
      exercise: exercises[idx].name.trim(),
      sets: exercises[idx].sets,
      reps: exercises[idx].reps,
      weight: exercises[idx].weight || null,
      body_part: workoutQuestion || 'General',
      workout_date: joinDate ? new Date(joinDate).toISOString().slice(0,10) : new Date().toISOString().slice(0,10)
    };
    try {
      const res = await fetch(`${API_BASE}/workouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save workout');
      const data = await res.json();
      exercises = exercises.map((ex, i) => i === idx ? { ...ex, submitted: true, workout_id: data.workout_id } : ex);
    } catch (e) {
      console.error(e);
      alert('Unable to save workout. Is the backend running?');
    }
  }

  function doneTracking() {
    showDonePrompt = true;
  }

  function confirmDoneTracking(yes) {
    showDonePrompt = false;
    if (yes) {
      showSavedMsg = true;
      setTimeout(() => showSavedMsg = false, 3000);
    }
  }

  onMount(() => {
    const d = new Date();
    today = d.toLocaleDateString();
    // Simulate join date as today for now
    joinDate = d.toLocaleDateString();
    const storedId = localStorage.getItem('ft_user_id');
    const storedName = localStorage.getItem('ft_user_name');
    if (storedId && storedName) {
      userId = storedId;
      userName = storedName;
      activeSeconds = 0;
      clearInterval(activeInterval);
      activeInterval = setInterval(() => { activeSeconds += 1; }, 1000);
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

  function submitWorkout() {
    if (workoutInput.trim()) {
      workoutQuestion = workoutInput.trim();
      workoutInput = '';
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
  .tracking-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .exercise-header-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
  }
  .exercise-input-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }
  .exercise-list-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
    background: #f7f7f7;
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
  }
  .exercise-label {
    min-width: 80px;
  }
  .dropdown {
    min-width: 60px;
  }
  .logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
  }
  .logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }
  .logo.svelte:hover {
    filter: drop-shadow(0 0 2em #ff3e00aa);
  }
  .read-the-docs {
    color: #888;
  }
</style>

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
    <div class="tracking-header">
      <span class="title" style="font-size:1.2rem;">What are we hitting today?</span>
      {#if workoutQuestion}
        <span style="font-weight:bold;">{workoutQuestion}</span>
      {:else}
        <input type="text" placeholder="e.g. Chest, Cardio..." bind:value={workoutInput} on:keydown={(e) => e.key === 'Enter' && submitWorkout()} />
        <button on:click={submitWorkout}>Submit</button>
      {/if}
  <button style="margin-left:1rem;" on:click={openCalendar}>Calendar</button>
    </div>
    {#if !selectedDate}
      <div>
        <div class="exercise-header-row">
          <span class="exercise-label">Exercise</span>
          <span>Set(s)</span>
          <span>Rep(s)</span>
          <span>Weight</span>
          <span></span>
        </div>
        {#each exercises as ex, idx}
          {#if !ex.submitted}
            <div class="exercise-input-row">
              <input type="text" placeholder="Exercise name" bind:value={exercises[idx].name} on:keydown={(e) => e.key === 'Enter' && submitExerciseRow(idx)} />
              <select class="dropdown" bind:value={exercises[idx].sets}>
                {#each setsOptions as n}
                  <option value={n}>{n}</option>
                {/each}
              </select>
              <select class="dropdown" bind:value={exercises[idx].reps}>
                {#each repsOptions as n}
                  <option value={n}>{n}</option>
                {/each}
              </select>
              <input type="text" placeholder="Weight" style="width:60px;" bind:value={exercises[idx].weight} on:keydown={(e) => e.key === 'Enter' && submitExerciseRow(idx)} />
              <button on:click={() => submitExerciseRow(idx)}>Submit</button>
            </div>
          {:else}
            <div class="exercise-list-row">
              <span class="exercise-label">{ex.name}</span>
              <span>{ex.sets}</span>
              <span>{ex.reps}</span>
              <span>{ex.weight}</span>
            </div>
          {/if}
        {/each}
        <button style="margin-top:0.5rem;" on:click={addExerciseRow}>Add Row</button>
        <button style="margin-top:0.5rem; margin-left:1rem;" on:click={doneTracking}>Done</button>
        {#if showDonePrompt}
          <div style="margin-top:1rem; background:#fffbe6; border:1px solid #ffe58f; padding:1rem; border-radius:6px;">
            <span>Are you done tracking?</span>
            <button style="margin-left:1rem;" on:click={() => confirmDoneTracking(true)}>Yes</button>
            <button style="margin-left:0.5rem;" on:click={() => confirmDoneTracking(false)}>No</button>
          </div>
        {/if}
        {#if showSavedMsg}
          <div style="margin-top:1rem; color:green; font-weight:bold;">Your results have been saved.</div>
        {/if}
      </div>
    {/if}
    {#if showCalendar}
      <div style="margin-top:2rem; border:1px solid #ccc; padding:1rem; border-radius:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; gap:0.5rem; align-items:center;">
            <button on:click={prevMonth}>&lt;</button>
            <strong>{new Date(calendarYear, calendarMonth).toLocaleString(undefined,{month:'long', year:'numeric'})}</strong>
            <button on:click={nextMonth}>&gt;</button>
          </div>
          {#if selectedDate}
            <div>Selected: {selectedDate}</div>
          {/if}
        </div>
        <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin-top:0.5rem; font-size:0.8rem;">
          <div style="text-align:center; font-weight:bold;">Sun</div>
          <div style="text-align:center; font-weight:bold;">Mon</div>
            <div style="text-align:center; font-weight:bold;">Tue</div>
            <div style="text-align:center; font-weight:bold;">Wed</div>
            <div style="text-align:center; font-weight:bold;">Thu</div>
            <div style="text-align:center; font-weight:bold;">Fri</div>
            <div style="text-align:center; font-weight:bold;">Sat</div>
          {#each calendarDays as d}
            {#if d === null}
              <div></div>
            {:else}
              <button on:click={() => selectCalendarDay(d)} style="padding:6px; {selectedDate && Number(selectedDate.slice(-2))===d && new Date(selectedDate).getMonth()===calendarMonth ? 'background:#007bff;color:#fff;border-radius:4px;' : ''}">{d}</button>
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
  </div>
{/if}


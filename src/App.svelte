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

  // Goals page state
  let goalMuscleGroup = '';
  function createGoalTemplateRow() { return { name: '', sets: 1, reps: 1, weight: '', editing: false, submitted: false, isTemplate: true, workout_id: null }; }
  let goalRows = [ createGoalTemplateRow() ];
  let savingGoals = false;
  let goalsSavedMsg = false;
  let goalSaveCounts = { success:0, failed:0 };
  let showDoneGoalsPrompt = false;

  function goGoals() { if (page !== 'goals') page = 'goals'; }
  function addGoalRow() { goalRows = [...goalRows, { name:'', sets:1, reps:1, weight:'', editing:false, submitted:false, isTemplate:false, workout_id:null }]; }
  let goalFailedRows = [];
  let goalFailedReasons = {};
  function localISO() {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth()+1).padStart(2,'0');
    const da = String(d.getDate()).padStart(2,'0');
    return `${yr}-${mo}-${da}`;
  }
  function saveAllGoals() {
    if (!userId) { alert('Create a user first.'); return; }
    const todayIso = localISO();
    let success=0, failed=0; 
    goalFailedRows = [];
    goalFailedReasons = {};
    
    for (let i=0;i<goalRows.length;i++) {
      const gr = goalRows[i];
      if (!gr.name || !gr.name.trim()) continue;
      
      try {
        const goalData = {
          id: goals.length + 1,
          user_id: userId,
          exercise: gr.name.trim(),
          sets: Number(gr.sets) || null,
          reps: Number(gr.reps) || null,
          weight: gr.weight ? extractWeightNumber(gr.weight) : null,
          body_part: goalMuscleGroup || 'General',
          set_goal_date: todayIso,
          created_at: new Date().toISOString()
        };
        
        goals = [...goals, goalData];
        goalRows[i] = { ...goalRows[i], workout_id: goalData.id, submitted:true, isTemplate:false };
        success++;
      } catch(e) {
        console.error('Failed saving goal row', gr, e);
        failed++;
        goalFailedRows.push(gr.name.trim());
        goalFailedReasons[gr.name.trim()] = e.message || 'Unknown error';
      }
    }
    
    goalSaveCounts = { success, failed };
    goalRows = [...goalRows];
    saveData();
  }
  function extractWeightNumber(val) {
    if (val == null) return null;
    const m = String(val).match(/\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  function doneGoals() { if (!hasGoalInputs) return; showDoneGoalsPrompt = true; }
  async function confirmDoneGoals(yes) {
    showDoneGoalsPrompt = false;
    if (!yes) return;
    if (savingGoals) return;
    savingGoals = true;
    await saveAllGoals();
    savingGoals = false;
    // Clear inputs and reset rows after saving
    goalMuscleGroup = '';
    goalRows = [ createGoalTemplateRow() ];
    goalsSavedMsg = true;
    setTimeout(()=> goalsSavedMsg = false, 3000);
  }
  function removeGoalRow(idx) {
    const row = goalRows[idx];
  if (!row) return;
  if (goalRows.length <= 1) return; // keep at least one row
  goalRows = goalRows.filter((_,i)=> i!==idx);
  }

  function ordinal(n) {
    const s = ["th","st","nd","rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // For multiple exercises
  function createTemplateRow() { return { name: '', sets: 1, reps: 1, weight: '', editing: false, submitted: false, isTemplate: true }; }
  let exercises = [
    createTemplateRow()
  ];

  // Guard flags: require full set of required fields before enabling Done buttons
  // Tracking requires: workoutQuestion + at least one exercise row with name, sets>0, reps>0, weight non-empty
  $: hasWorkoutInputs = !!workoutQuestion.trim() && Array.isArray(exercises) && exercises.some(ex => {
    if (!ex) return false;
    const nameOk = typeof ex.name === 'string' && ex.name.trim();
    const setsOk = Number(ex.sets) > 0;
    const repsOk = Number(ex.reps) > 0;
    const weightOk = typeof ex.weight === 'string' ? ex.weight.trim() : (ex.weight !== null && ex.weight !== undefined && ex.weight !== '');
    return nameOk && setsOk && repsOk && weightOk;
  });
  // Goals requires: goalMuscleGroup + at least one goal row with name, sets>0, reps>0, weight non-empty
  $: hasGoalInputs = !!goalMuscleGroup.trim() && Array.isArray(goalRows) && goalRows.some(gx => {
    if (!gx) return false;
    const nameOk = typeof gx.name === 'string' && gx.name.trim();
    const setsOk = Number(gx.sets) > 0;
    const repsOk = Number(gx.reps) > 0;
    const weightOk = typeof gx.weight === 'string' ? gx.weight.trim() : (gx.weight !== null && gx.weight !== undefined && gx.weight !== '');
    return nameOk && setsOk && repsOk && weightOk;
  });

  let showDonePrompt = false;
  let showSavedMsg = false;

  let userId = null;
  
  // Local data storage
  let users = [];
  let workouts = [];
  let goals = [];
  
  // Load data from localStorage on startup
  function loadData() {
    try {
      users = JSON.parse(localStorage.getItem('ft_users') || '[]');
      workouts = JSON.parse(localStorage.getItem('ft_workouts') || '[]');
      goals = JSON.parse(localStorage.getItem('ft_goals') || '[]');
    } catch (e) {
      console.error('Error loading data:', e);
      users = [];
      workouts = [];
      goals = [];
    }
  }
  
  // Save data to localStorage
  function saveData() {
    localStorage.setItem('ft_users', JSON.stringify(users));
    localStorage.setItem('ft_workouts', JSON.stringify(workouts));
    localStorage.setItem('ft_goals', JSON.stringify(goals));
  }

  // Calendar & historical editing state
  let selectedDate = null; // YYYY-MM-DD
  let calendarYear;
  let calendarMonth; // 0-11
  let calendarDays = [];
  let loadingWorkouts = false;
  let dateWorkouts = []; // workouts for selected date
  let editingDate = false; // toggles edit mode for date workouts
  let loadingGoals = false;
  let dateGoals = []; // goals for selected date
  // Today reference for calendar highlighting
  const __todayRef = new Date();
  const todayYear = __todayRef.getFullYear();
  const todayMonth = __todayRef.getMonth();
  const todayDay = __todayRef.getDate();

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
  await Promise.all([fetchWorkoutsForDate(), fetchGoalsForDate()]);
  }

  function fetchWorkoutsForDate() {
    if (!userId || !selectedDate) return;
    loadingWorkouts = true;
    
    try {
      // Filter workouts for the selected date and user
      dateWorkouts = workouts
        .filter(w => w.user_id == userId && w.workout_date === selectedDate)
        .map(w => ({ ...w, _editing: false }));
    } catch (e) {
      console.error(e);
      alert('Unable to load workouts for date');
    } finally {
      loadingWorkouts = false;
    }
  }

  function fetchGoalsForDate() {
    if (!userId || !selectedDate) return;
    loadingGoals = true;
    
    try {
      // Filter goals for the selected date and user
      dateGoals = goals
        .filter(g => g.user_id == userId && g.set_goal_date === selectedDate)
        .map(g => ({ ...g, _editing:false, _draft: null }));
      
      console.log('[Goals] Fetched for', selectedDate, 'count=', dateGoals.length);
    } catch (e) {
      console.error(e);
    } finally {
      loadingGoals = false;
    }
  }

  function beginGoalCalEdit(g) {
    dateGoals = dateGoals.map(item => item===g ? { ...item, _editing:true, _draft:{
      exercise: item.exercise || '',
      sets: item.sets || 0,
      reps: item.reps || 0,
      weight: item.weight ?? null,
      body_part: item.body_part || (goalMuscleGroup || 'General'),
      set_goal_date: item.set_goal_date || item.workout_date || selectedDate
    }} : item);
  }
  function cancelGoalCalEdit(g) {
    dateGoals = dateGoals.map(item => item===g ? { ...item, _editing:false, _draft:null } : item);
  }
  function saveGoalCalEdit(g) {
    const target = dateGoals.find(item => item===g);
    if (!target || !target._draft) return;
    
    try {
      const payload = { ...target._draft };
      const id = target.id;
      
      // Update in the main goals array
      const goalIndex = goals.findIndex(goal => goal.id === id);
      if (goalIndex !== -1) {
        goals[goalIndex] = { ...goals[goalIndex], ...payload };
        saveData();
      }
      
      dateGoals = dateGoals.map(item => item===g ? { ...item, ...payload, _editing:false, _draft:null } : item);
    } catch(e) {
      console.error(e);
      alert('Unable to update goal');
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
    // If this is a newly added unsaved calendar row, remove it entirely
    if (!w.workout_id) {
      dateWorkouts = dateWorkouts.filter(item => item !== w);
      return;
    }
    // Otherwise just exit edit mode
    dateWorkouts = dateWorkouts.map(item => item === w ? { ...item, _editing: false, _draft: undefined } : item);
  }
  function saveEdit(w) {
    const target = dateWorkouts.find(item => item === w);
    if (!target || !target._draft) return;
    
    try {
      const payload = { ...target._draft };
      
      // Update in the main workouts array
      const workoutIndex = workouts.findIndex(workout => workout.id === target.id);
      if (workoutIndex !== -1) {
        workouts[workoutIndex] = { ...workouts[workoutIndex], ...payload };
        saveData();
      }
      
      // Update in the display array
      dateWorkouts = dateWorkouts.map(item => item === w ? { ...item, ...payload, _editing: false, _draft: undefined } : item);
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

  function saveNewDateWorkout(w) {
    if (!userId) { alert('No user'); return; }
    const target = dateWorkouts.find(item => item === w);
    if (!target || !target._draft) return;
    
    try {
      const workoutData = {
        id: workouts.length + 1,
        user_id: userId,
        ...target._draft,
        created_at: new Date().toISOString()
      };
      
      workouts = [...workouts, workoutData];
      saveData();
      
      dateWorkouts = dateWorkouts.map(item => item === w ? { ...item, ...workoutData, _editing: false, _draft: undefined } : item);
    } catch (e) {
      console.error(e);
      alert('Unable to create workout');
    }
  }

  function removeDateWorkout(w) {
    // If it's a new unsaved row just drop it
    if (!w.id) {
      dateWorkouts = dateWorkouts.filter(item => item !== w);
      return;
    }
    if (!confirm('Remove this workout?')) return;
    
    try {
      // Remove from main workouts array
      workouts = workouts.filter(workout => workout.id !== w.id);
      saveData();
      
      // Remove from display array
      dateWorkouts = dateWorkouts.filter(item => item !== w);
    } catch (e) {
      console.error(e);
      alert('Unable to remove workout');
    }
  }

  function addExerciseRow() {
    exercises = [...exercises, { name: '', sets: 1, reps: 1, weight: '', editing: false, submitted: false, isTemplate: false }];
  }

  function saveAllExercises() {
    if (!userId) { alert('Create a user first.'); return; }
    const todayIso = localISO();
    
    for (let i=0;i<exercises.length;i++) {
      const ex = exercises[i];
      if (!ex.name.trim()) continue;
      
      const workoutData = {
        id: workouts.length + 1,
        user_id: userId,
        exercise: ex.name.trim(),
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight || null,
        body_part: workoutQuestion || 'General',
        workout_date: todayIso,
        created_at: new Date().toISOString()
      };
      
      workouts = [...workouts, workoutData];
      exercises[i] = { ...exercises[i], workout_id: workoutData.id };
    }
    
    saveData();
  }

  function removeExercise(idx) {
    const row = exercises[idx];
    if (!row) return;
  if (exercises.length <= 1) return; // keep at least one row
  // Placeholder for future backend DELETE call if row.workout_id
  exercises = exercises.filter((_,i)=> i!==idx);
  }

  onMount(() => {
    // Load all data from localStorage
    loadData();
    
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

  function submitName() {
    if (!inputName.trim()) return;
    const nameValue = inputName.trim();
    
    // Check if user already exists
    let existingUser = users.find(u => u.name.toLowerCase() === nameValue.toLowerCase());
    
    if (existingUser) {
      // Use existing user
      userId = existingUser.id;
      userName = existingUser.name;
    } else {
      // Create new user
      userId = users.length + 1;
      userName = nameValue;
      users = [...users, { id: userId, name: userName, created_at: new Date().toISOString() }];
      saveData();
    }
    
    localStorage.setItem('ft_user_id', userId);
    localStorage.setItem('ft_user_name', userName);
    inputName = '';
    activeSeconds = 0;
    clearInterval(activeInterval);
    activeInterval = setInterval(() => { activeSeconds += 1; }, 1000);
  }

  function changeUser() {
    // Stop activity timer
    if (activeInterval) {
      clearInterval(activeInterval);
      activeInterval = null;
    }
    activeSeconds = 0;
    // Clear stored user
    localStorage.removeItem('ft_user_id');
    localStorage.removeItem('ft_user_name');
    // Reset app state
    userId = null;
    userName = '';
    inputName = '';
    page = 'home';
    // Optional: clear tracking inputs
    workoutQuestion = '';
    exercises = [ createTemplateRow() ];
    goalMuscleGroup = '';
    goalRows = [ createGoalTemplateRow() ];
    selectedDate = null;
    dateWorkouts = [];
    dateGoals = [];
  }

  // Navigation + done tracking flow
  function startTracking() { page = 'tracking'; }
  function doneTracking() {
    if (!hasWorkoutInputs) return;
    showDonePrompt = true;
  }
  async function confirmDoneTracking(yes) {
    showDonePrompt = false;
    if (!yes) return;
    await saveAllExercises();
    // Clear inputs and reset rows after saving
    workoutQuestion = '';
    exercises = [ createTemplateRow() ];
    showSavedMsg = true;
    setTimeout(() => showSavedMsg = false, 3000);
  }
</script>

<style>
  .header {
    display:flex;
    justify-content:space-between;
    align-items:flex-end;
    width:100%;
    margin-bottom:0.75rem;
  }
  .title {
    font-size:3rem;
    line-height:1.05;
    font-weight:800;
    letter-spacing:0.5px;
  }
  .global-date { position:fixed; top:10px; right:14px; font-size:0.85rem; font-weight:500; color:#333; }
  .center-box {
    display:flex;
    flex-direction:column;
    align-items:flex-start;
    margin-top:0;
    gap:1rem;
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
  /* theme-btn now uses global button styling for consistency */
  .theme-circles { display:flex; gap:8px; }
  .theme-circle { width:28px; height:28px; padding:0; aspect-ratio:1/1; border-radius:50%; cursor:pointer; border:1px solid #000; background: transparent; transition: transform 0.15s, border .15s; display:inline-block; }
  .theme-circle:hover { transform: scale(1.08); }
  .theme-circle.active { border:3px solid #000; }
  /* Active nav state just adds an inset highlight */
  .nav-btn.active { box-shadow:0 0 0 2px rgba(255,255,255,0.6) inset; }
  /* Enlarged calendar */
  .calendar-wrapper { max-width: 880px; margin: 2rem auto 0; }
  .calendar-grid { display:grid; grid-template-columns: repeat(7, 110px); gap:12px; justify-content:center; }
  .calendar-head { font-weight:600; text-align:center; font-size:0.9rem; }
  .cal-cell { height:110px; width:110px; border:2px solid rgba(0,0,0,0.35); background: var(--color-row); border-radius:14px; display:flex; flex-direction:column; justify-content:flex-start; align-items:flex-start; padding:8px 10px; gap:6px; cursor:pointer; font-size:0.95rem; font-weight:500; transition: background .2s, transform .15s, box-shadow .2s; }
  .cal-cell:hover { background: var(--color-panel); }
  .cal-cell.selected { background: var(--color-accent); color:#fff; box-shadow:0 4px 10px rgba(0,0,0,0.15); }
  .cal-day-number { font-size:1.3rem; font-weight:600; line-height:1; color:#333; }
  .cal-cell.selected .cal-day-number { color:#fff; }
  /* Today marker */
  .cal-cell.today:not(.selected) { position:relative; }
  .cal-cell.today:not(.selected)::after { content:''; position:absolute; top:6px; right:6px; width:10px; height:10px; border-radius:50%; background:var(--color-accent); box-shadow:0 0 0 2px var(--color-panel); }
  .cal-cell.selected.today { box-shadow:0 0 0 3px var(--color-accent-hover) inset, 0 4px 10px rgba(0,0,0,0.15); }
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
  .inline-input:disabled { opacity:0.75; color:#555; }
  .tracker-footer { display:flex; margin-top:0.75rem; gap:0.75rem; min-height:42px; align-items:center; }
  .prompt-box { min-height:42px; }
  table.track-table th { color: var(--color-text); font-weight:600; }
  .action-btns { display:flex; gap:6px; justify-content:flex-start; }
  /* Common calendar table layout (responsive fractional columns) */
  .table-grid {
    display: grid;
    grid-template-columns: 2fr 3fr 1fr 1fr 1fr 2fr; /* Body Part | Exercise | Sets | Reps | Weight | Actions */
    align-items: center;
    gap: 0.5rem;
  }
  .table-header { font-weight: bold; text-align:left; margin-bottom:0.5rem; font-size:0.85rem; }
  .table-row { margin-top: 4px; }
  .table-row input { width:100%; box-sizing:border-box; }

  /* Calendar edit/create action buttons inline */
  .actions { display:flex; gap:0.5rem; }
  .actions button { flex:1; }

  /* Removed old theme/nav button overrides; all buttons share global styling */
</style>

<!-- Global Theme / Nav -->
<div class="global-date">Today's date: {today}</div>
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
  <button class="theme-btn nav-btn {page==='home' ? 'active' : ''}" on:click={() => page='home'}>Home</button>
  {#if userName}
    <button class="theme-btn nav-btn {page==='calendar' ? 'active' : ''}" on:click={goCalendar}>Calendar</button>
    <button class="theme-btn nav-btn {page==='tracking' ? 'active' : ''}" on:click={goTracking}>Tracker</button>
    <button class="theme-btn nav-btn {page==='goals' ? 'active' : ''}" on:click={goGoals}>Set Goal</button>
    <button class="theme-btn" on:click={changeUser}>Change User</button>
  {/if}
</div>

{#if page === 'home'}
  <div class="header">
    <div>
      <div class="title">Fitness Tracker</div>
      <div class="center-box">
  <div class="input-row" style="margin-top:0; justify-content:center; width:100%; text-align:center;">
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
          <div style="width:100%; display:flex; justify-content:center; margin-top:0.5rem; gap:0.5rem;">
            <button on:click={startTracking}>Start Tracking</button>
            <button on:click={changeUser}>Change User</button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if page === 'goals'}
  <div>
    <div class="track-table-wrapper">
      <div class="table-title" style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom:0.75rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
          <span style="font-size:1.3rem; font-weight:700;">Goals</span>
          <div style="display:flex; gap:0.5rem; align-items:center; flex:1;">
            <input class="inline-input" type="text" placeholder="Muscle Group" bind:value={goalMuscleGroup} style="flex:1;" />
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
          {#each goalRows as gx, gidx}
            <tr>
              <td>
                <input class="inline-input" type="text" bind:value={goalRows[gidx].name} placeholder="Exercise" />
              </td>
              <td class="numeric">
                <select class="inline-input" bind:value={goalRows[gidx].sets}>
                  {#each setsOptions as n}<option value={n}>{n}</option>{/each}
                </select>
              </td>
              <td class="numeric">
                <select class="inline-input" bind:value={goalRows[gidx].reps}>
                  {#each repsOptions as n}<option value={n}>{n}</option>{/each}
                </select>
              </td>
              <td class="numeric">
                <input class="inline-input" type="text" bind:value={goalRows[gidx].weight} placeholder="Weight" />
              </td>
              <td>
                <div class="action-btns">
                  <button disabled={goalRows.length === 1} on:click={() => removeGoalRow(gidx)}>Remove</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <div class="tracker-footer">
        <button on:click={addGoalRow}>Add Goal Exercise</button>
        <button on:click={doneGoals} disabled={!hasGoalInputs || savingGoals}>{savingGoals ? 'Saving...' : 'Done Setting Goals'}</button>
      </div>
      {#if showDoneGoalsPrompt}
        <div class="prompt-box" style="margin-top:1rem;">
          <span>Are you done setting goals?</span>
          <button class="ml-lg" on:click={() => confirmDoneGoals(true)}>Yes</button>
          <button class="ml-md" on:click={() => confirmDoneGoals(false)}>No</button>
        </div>
      {/if}
      {#if goalsSavedMsg}
        <div style="margin-top:1rem; font-weight:bold; color:{goalSaveCounts.failed ? 'darkred' : 'green'};">
          Goals processed: Saved {goalSaveCounts.success}{goalSaveCounts.failed ? `, Failed ${goalSaveCounts.failed}` : ''}.
          {#if goalSaveCounts.failed && goalFailedRows.length}
            <div style="margin-top:0.4rem; font-size:0.85rem; font-weight:500; color:darkred;">
              Failed:
              <ul style="margin:4px 0 0 16px; padding:0; list-style:disc;">
                {#each goalFailedRows as gname}
                  <li>{gname}{goalFailedReasons[gname] ? ` - ${goalFailedReasons[gname]}` : ''}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if page === 'tracking'}
  <div>
    <div class="track-table-wrapper">
      <div class="table-title" style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom:0.75rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
          <span style="font-size:1.15rem; font-weight:700;">What are we hitting today?</span>
          <div style="display:flex; gap:0.5rem; align-items:center; flex:1;">
            <input class="inline-input" type="text" placeholder="e.g. Chest, Cardio..." bind:value={workoutQuestion} style="flex:1;" />
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
            <tr>
              <td>
                <input class="inline-input" type="text" bind:value={exercises[idx].name} placeholder="Exercise" />
              </td>
              <td class="numeric">
                <select class="inline-input" bind:value={exercises[idx].sets}>
                  {#each setsOptions as n}<option value={n}>{ordinal(n)}</option>{/each}
                </select>
              </td>
              <td class="numeric">
                <select class="inline-input" bind:value={exercises[idx].reps}>
                  {#each repsOptions as n}<option value={n}>{n}</option>{/each}
                </select>
              </td>
              <td class="numeric">
                <input class="inline-input" type="text" bind:value={exercises[idx].weight} placeholder="Weight" />
              </td>
              <td>
                <div class="action-btns">
                  <button disabled={exercises.length === 1} on:click={() => removeExercise(idx)}>Remove</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <div class="tracker-footer">
        <button on:click={addExerciseRow}>Add Exercise</button>
        <button on:click={doneTracking} disabled={!hasWorkoutInputs}>Done Tracking</button>
      </div>
      {#if showDonePrompt}
        <div class="prompt-box" style="margin-top:1rem;">
          <span>Are you done tracking?</span>
          <button class="ml-lg" on:click={() => confirmDoneTracking(true)}>Yes</button>
          <button class="ml-md" on:click={() => confirmDoneTracking(false)}>No</button>
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
          <button type="button" class="cal-cell {selectedDate && Number(selectedDate.slice(-2))===d && new Date(selectedDate).getMonth()===calendarMonth ? 'selected' : ''} {calendarYear===todayYear && calendarMonth===todayMonth && d===todayDay ? 'today' : ''}" on:click={() => selectCalendarDay(d)}>
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
            <div class="table-grid table-header">
              <div>Body Part</div>
              <div>Exercise</div>
              <div>Sets</div>
              <div>Reps</div>
              <div>Weight</div>
              <div>Actions</div>
            </div>
            {#each dateWorkouts as w}
              {#if w._editing}
                <div class="table-grid table-row">
                  <input class="inline-input" type="text" bind:value={w._draft.body_part} />
                  <input class="inline-input" type="text" bind:value={w._draft.exercise} />
                  <input class="inline-input" type="number" min="0" bind:value={w._draft.sets} />
                  <input class="inline-input" type="number" min="0" bind:value={w._draft.reps} />
                  <input class="inline-input" type="number" step="0.1" bind:value={w._draft.weight} />
                  <div class="actions">
                    {#if w.id}
                      <button class="save-btn" on:click={() => saveEdit(w)}>Save</button>
                      <button class="cancel-btn" on:click={() => cancelEdit(w)}>Cancel</button>
                    {:else}
                      <button class="create-btn" on:click={() => saveNewDateWorkout(w)}>Create</button>
                      <button class="cancel-btn" on:click={() => cancelEdit(w)}>Cancel</button>
                    {/if}
                  </div>
                </div>
              {:else}
                <div class="table-grid table-row">
                  <div><input class="inline-input" type="text" value={w.body_part} disabled /></div>
                  <div><input class="inline-input" type="text" value={w.exercise} disabled /></div>
                  <div><input class="inline-input" type="text" value={w.sets} disabled /></div>
                  <div><input class="inline-input" type="text" value={w.reps} disabled /></div>
                  <div><input class="inline-input" type="text" value={w.weight || ''} disabled /></div>
                  <div class="actions"><button on:click={() => beginEdit(w)}>Edit</button></div>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
      <div style="margin-top:1.5rem;">
        <h3 style="margin:0 0 0.5rem 0;">Goals on {selectedDate}</h3>
        {#if loadingGoals}
          <div>Loading...</div>
        {:else if !dateGoals.length}
          <div style="margin-top:0.5rem;">No goals yet.</div>
        {/if}
        {#if dateGoals.length}
          <div style="margin-top:0.5rem;">
            <div class="table-grid table-header">
              <div>Body Part</div>
              <div>Exercise</div>
              <div>Sets</div>
              <div>Reps</div>
              <div>Weight</div>
              <div>Actions</div>
            </div>
            {#each dateGoals as g}
              {#if g._editing}
                <div class="table-grid table-row">
                  <input type="text" bind:value={g._draft.body_part} />
                  <input type="text" bind:value={g._draft.exercise} />
                  <input type="number" min="0" bind:value={g._draft.sets} />
                  <input type="number" min="0" bind:value={g._draft.reps} />
                  <input type="number" step="0.1" bind:value={g._draft.weight} />
                  <div class="actions">
                    <button class="save-btn" on:click={() => saveGoalCalEdit(g)}>Save</button>
                    <button class="cancel-btn" on:click={() => cancelGoalCalEdit(g)}>Cancel</button>
                  </div>
                </div>
              {:else}
                <div class="table-grid table-row">
                  <div><input class="inline-input" type="text" value={g.body_part} disabled /></div>
                  <div><input class="inline-input" type="text" value={g.exercise} disabled /></div>
                  <div><input class="inline-input" type="text" value={g.sets} disabled /></div>
                  <div><input class="inline-input" type="text" value={g.reps} disabled /></div>
                  <div><input class="inline-input" type="text" value={g.weight || ''} disabled /></div>
                  <div class="actions"><button on:click={() => beginGoalCalEdit(g)}>Edit</button></div>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}


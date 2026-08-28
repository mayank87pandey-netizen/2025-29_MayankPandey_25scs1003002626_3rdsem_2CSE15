/* ==========================================================================
   Momentum — script.js
   A small vanilla-JS productivity dashboard. No frameworks, no build step.
   Everything is persisted to localStorage.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     0. CONFIG — tweak these during development/testing
     ------------------------------------------------------------------ */
  const CONFIG = {
    FOCUS_MINUTES: 25,   // change to something small (e.g. 0.1) while testing
    BREAK_MINUTES: 5,
    POINTS: {
      TASK: 10,
      FOCUS_SESSION: 25,
      GOAL: 15
    },
    STORAGE_PREFIX: "momentum_"
  };

  /* ------------------------------------------------------------------
     1. STORAGE HELPERS
     Small wrapper around localStorage that always deals in JSON and
     never throws, even if storage is empty, missing or corrupted.
     ------------------------------------------------------------------ */
  function saveData(key, value) {
    try {
      localStorage.setItem(CONFIG.STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (err) {
      console.warn("Momentum: could not save '" + key + "'", err);
    }
  }

  function loadData(key, fallback) {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_PREFIX + key);
      if (raw === null || raw === undefined) return fallback;
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (err) {
      console.warn("Momentum: could not read '" + key + "', using default.", err);
      return fallback;
    }
  }

  /* ------------------------------------------------------------------
     2. APPLICATION STATE
     Loaded once at startup, mutated in memory, saved back on change.
     ------------------------------------------------------------------ */
  const state = {
    tasks: loadData("tasks", null),
    goals: loadData("goals", null),
    notes: loadData("notes", []),
    theme: loadData("theme", "light"),
    focus: loadData("focus", { sessionsCompleted: 0, totalMinutes: 0 }),
    points: loadData("points", 0),
    achievements: loadData("achievements", {
      firstStep: false,
      focused: false,
      productive: false,
      consistent: false
    }),
    streak: loadData("streak", { count: 0, lastActiveDate: null }),
    weekly: loadData("weekly", {}),      // { "2026-08-28": 35, ... }
    seeded: loadData("seeded", false),
    taskFilter: "all"
  };

  const ACHIEVEMENT_INFO = {
    firstStep: { icon: "🌱", name: "First Step", desc: "Complete your first task." },
    focused: { icon: "🎯", name: "Focused", desc: "Complete 5 focus sessions." },
    productive: { icon: "⭐", name: "Productive", desc: "Complete 10 tasks." },
    consistent: { icon: "🔥", name: "Consistent", desc: "Maintain a 3-day streak." }
  };

  /* ------------------------------------------------------------------
     3. SAMPLE DATA (first run only)
     ------------------------------------------------------------------ */
  function seedSampleDataIfNeeded() {
    if (state.seeded) return;

    if (state.tasks === null) {
      state.tasks = [
        { id: makeId(), title: "Finish JavaScript practice", priority: "high", completed: false, pointsAwarded: false, sample: true },
        { id: makeId(), title: "Review project documentation", priority: "medium", completed: false, pointsAwarded: false, sample: true },
        { id: makeId(), title: "Complete internship report", priority: "low", completed: false, pointsAwarded: false, sample: true }
      ];
    }
    if (state.goals === null) {
      state.goals = [
        { id: makeId(), title: "Plan tomorrow's top 3 tasks", completed: false, pointsAwarded: false, sample: true }
      ];
    }

    state.seeded = true;
    saveData("seeded", true);
    saveData("tasks", state.tasks);
    saveData("goals", state.goals);
  }

  // Fallbacks in case seeding above didn't run (e.g. seeded flag already true
  // but data was cleared manually) — never let the app crash on empty data.
  if (state.tasks === null) state.tasks = [];
  if (state.goals === null) state.goals = [];

  function makeId() {
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  /* ------------------------------------------------------------------
     4. DATE / TIME HELPERS
     ------------------------------------------------------------------ */
  function todayKey(date) {
    const d = date || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function formatReadableDate(date) {
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  }

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  /* ------------------------------------------------------------------
     5. TOAST NOTIFICATIONS
     ------------------------------------------------------------------ */
  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  /* ------------------------------------------------------------------
     6. POINTS, STREAK & ACHIEVEMENTS
     ------------------------------------------------------------------ */
  function addPoints(amount) {
    state.points += amount;
    saveData("points", state.points);

    const key = todayKey();
    state.weekly[key] = (state.weekly[key] || 0) + amount;
    saveData("weekly", state.weekly);
  }

  function registerProductiveAction() {
    const key = todayKey();
    const streak = state.streak;

    if (streak.lastActiveDate === key) {
      return; // already counted today
    }

    const yesterday = todayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

    if (streak.lastActiveDate === yesterday) {
      streak.count += 1;
    } else {
      streak.count = 1;
    }
    streak.lastActiveDate = key;
    saveData("streak", streak);
  }

  function checkAchievements() {
    const completedTasksCount = state.tasks.filter(t => t.completed).length;
    const unlocked = [];

    if (!state.achievements.firstStep && completedTasksCount >= 1) {
      state.achievements.firstStep = true;
      unlocked.push(ACHIEVEMENT_INFO.firstStep.name);
    }
    if (!state.achievements.focused && state.focus.sessionsCompleted >= 5) {
      state.achievements.focused = true;
      unlocked.push(ACHIEVEMENT_INFO.focused.name);
    }
    if (!state.achievements.productive && completedTasksCount >= 10) {
      state.achievements.productive = true;
      unlocked.push(ACHIEVEMENT_INFO.productive.name);
    }
    if (!state.achievements.consistent && state.streak.count >= 3) {
      state.achievements.consistent = true;
      unlocked.push(ACHIEVEMENT_INFO.consistent.name);
    }

    if (unlocked.length) {
      saveData("achievements", state.achievements);
      unlocked.forEach(name => showToast("🏆 Achievement unlocked: " + name));
    }
  }

  /* ------------------------------------------------------------------
     7. NAVIGATION
     ------------------------------------------------------------------ */
  function goToSection(sectionName) {
    document.querySelectorAll(".section").forEach(sec => {
      sec.classList.toggle("is-active", sec.id === "section-" + sectionName);
    });
    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.section === sectionName);
    });
    closeMobileSidebar();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function setupNavigation() {
    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => goToSection(btn.dataset.section));
    });
    document.querySelectorAll("[data-goto]").forEach(btn => {
      btn.addEventListener("click", () => goToSection(btn.dataset.goto));
    });
  }

  /* ------------------------------------------------------------------
     8. MOBILE SIDEBAR
     ------------------------------------------------------------------ */
  function openMobileSidebar() {
    document.getElementById("sidebar").classList.add("is-open");
    document.getElementById("scrim").classList.add("is-visible");
    document.getElementById("menuToggle").setAttribute("aria-expanded", "true");
  }
  function closeMobileSidebar() {
    document.getElementById("sidebar").classList.remove("is-open");
    document.getElementById("scrim").classList.remove("is-visible");
    document.getElementById("menuToggle").setAttribute("aria-expanded", "false");
  }
  function setupMobileSidebar() {
    document.getElementById("menuToggle").addEventListener("click", () => {
      const isOpen = document.getElementById("sidebar").classList.contains("is-open");
      isOpen ? closeMobileSidebar() : openMobileSidebar();
    });
    document.getElementById("scrim").addEventListener("click", closeMobileSidebar);
  }

  /* ------------------------------------------------------------------
     9. THEME
     ------------------------------------------------------------------ */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
    const icon = theme === "dark" ? "☀️" : "🌙";
    const label = theme === "dark" ? "Light mode" : "Dark mode";
    document.getElementById("themeIconDesktop").textContent = icon;
    document.getElementById("themeLabelDesktop").textContent = label;
    document.getElementById("themeIconMobile").textContent = icon;
  }

  function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    saveData("theme", state.theme);
    applyTheme(state.theme);
  }

  function setupTheme() {
    applyTheme(state.theme);
    document.getElementById("themeToggleDesktop").addEventListener("click", toggleTheme);
    document.getElementById("themeToggleMobile").addEventListener("click", toggleTheme);
  }

  /* ------------------------------------------------------------------
     10. TASKS
     ------------------------------------------------------------------ */
  function addTask(title, priority) {
    state.tasks.unshift({
      id: makeId(),
      title: title.trim(),
      priority: priority,
      completed: false,
      pointsAwarded: false
    });
    saveData("tasks", state.tasks);
  }

  function toggleTaskComplete(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;

    if (task.completed && !task.pointsAwarded) {
      task.pointsAwarded = true;
      addPoints(CONFIG.POINTS.TASK);
      registerProductiveAction();
    }

    saveData("tasks", state.tasks);
    checkAchievements();
    renderAll();
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveData("tasks", state.tasks);
    renderAll();
  }

  function setTaskFilter(filter) {
    state.taskFilter = filter;
    document.querySelectorAll(".filter-btn").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.filter === filter);
    });
    renderTasks();
  }

  function priorityLabel(p) {
    return p.charAt(0).toUpperCase() + p.slice(1);
  }

  function renderTasks() {
    const list = document.getElementById("taskList");
    const empty = document.getElementById("taskEmptyState");
    list.innerHTML = "";

    let visibleTasks = state.tasks;
    if (state.taskFilter === "pending") visibleTasks = state.tasks.filter(t => !t.completed);
    if (state.taskFilter === "completed") visibleTasks = state.tasks.filter(t => t.completed);

    if (state.tasks.length === 0) {
      empty.hidden = false;
      empty.textContent = "No tasks yet. Add your first task and build momentum.";
      return;
    }
    if (visibleTasks.length === 0) {
      empty.hidden = false;
      empty.textContent = "No tasks match this filter.";
      return;
    }
    empty.hidden = true;

    visibleTasks.forEach(task => {
      const li = document.createElement("li");
      li.className = "task-item" + (task.completed ? " is-completed" : "");

      const check = document.createElement("button");
      check.type = "button";
      check.className = "task-check" + (task.completed ? " is-checked" : "");
      check.setAttribute("aria-label", task.completed ? "Mark task as pending" : "Mark task as complete");
      check.innerHTML = task.completed
        ? '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : "";
      check.addEventListener("click", () => toggleTaskComplete(task.id));

      const title = document.createElement("span");
      title.className = "task-title";
      title.textContent = task.title;

      const tag = document.createElement("span");
      tag.className = "priority-tag priority-" + task.priority;
      tag.textContent = priorityLabel(task.priority);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "icon-delete";
      del.setAttribute("aria-label", "Delete task: " + task.title);
      del.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      del.addEventListener("click", () => deleteTask(task.id));

      li.append(check, title, tag, del);
      list.appendChild(li);
    });
  }

  function renderDashboardTasks() {
    const list = document.getElementById("dashboardTaskList");
    list.innerHTML = "";

    const items = state.tasks.slice(0, 5);
    if (items.length === 0) {
      list.innerHTML = '<li class="empty-state">No tasks yet. Add your first task and build momentum.</li>';
      return;
    }

    const priorityColor = { low: "var(--priority-low)", medium: "var(--priority-medium)", high: "var(--priority-high)" };

    items.forEach(task => {
      const li = document.createElement("li");
      li.className = "mini-task-item" + (task.completed ? " is-done" : "");
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = priorityColor[task.priority] || "var(--accent)";
      const label = document.createElement("span");
      label.textContent = task.title;
      li.append(dot, label);
      list.appendChild(li);
    });
  }

  /* ------------------------------------------------------------------
     11. GOALS
     ------------------------------------------------------------------ */
  function addGoal(title) {
    state.goals.unshift({ id: makeId(), title: title.trim(), completed: false, pointsAwarded: false });
    saveData("goals", state.goals);
  }

  function toggleGoalComplete(id) {
    const goal = state.goals.find(g => g.id === id);
    if (!goal) return;

    goal.completed = !goal.completed;

    if (goal.completed && !goal.pointsAwarded) {
      goal.pointsAwarded = true;
      addPoints(CONFIG.POINTS.GOAL);
      registerProductiveAction();
    }

    saveData("goals", state.goals);
    checkAchievements();
    renderAll();
  }

  function deleteGoal(id) {
    state.goals = state.goals.filter(g => g.id !== id);
    saveData("goals", state.goals);
    renderAll();
  }

  function renderGoals() {
    const list = document.getElementById("goalList");
    const empty = document.getElementById("goalEmptyState");
    list.innerHTML = "";

    if (state.goals.length === 0) {
      empty.hidden = false;
      updateGoalsProgress();
      return;
    }
    empty.hidden = true;

    state.goals.forEach(goal => {
      const li = document.createElement("li");
      li.className = "task-item" + (goal.completed ? " is-completed" : "");

      const check = document.createElement("button");
      check.type = "button";
      check.className = "task-check" + (goal.completed ? " is-checked" : "");
      check.setAttribute("aria-label", goal.completed ? "Mark goal as pending" : "Mark goal as complete");
      check.innerHTML = goal.completed
        ? '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : "";
      check.addEventListener("click", () => toggleGoalComplete(goal.id));

      const title = document.createElement("span");
      title.className = "task-title";
      title.textContent = goal.title;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "icon-delete";
      del.setAttribute("aria-label", "Delete goal: " + goal.title);
      del.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      del.addEventListener("click", () => deleteGoal(goal.id));

      li.append(check, title, del);
      list.appendChild(li);
    });

    updateGoalsProgress();
  }

  function updateGoalsProgress() {
    const total = state.goals.length;
    const done = state.goals.filter(g => g.completed).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    document.getElementById("goalsProgressPill").textContent = done + " / " + total + " completed";
    document.getElementById("goalsProgressFill").style.width = pct + "%";
    document.getElementById("goalsProgressBar").setAttribute("aria-valuenow", String(pct));
  }

  /* ------------------------------------------------------------------
     12. NOTES
     ------------------------------------------------------------------ */
  function addNote(text) {
    state.notes.unshift({ id: makeId(), text: text.trim(), updatedAt: Date.now() });
    saveData("notes", state.notes);
  }

  function updateNoteText(id, text) {
    const note = state.notes.find(n => n.id === id);
    if (!note) return;
    note.text = text;
    note.updatedAt = Date.now();
    saveData("notes", state.notes);
  }

  function deleteNote(id) {
    state.notes = state.notes.filter(n => n.id !== id);
    saveData("notes", state.notes);
    renderNotes();
  }

  function renderNotes() {
    const grid = document.getElementById("notesGrid");
    const empty = document.getElementById("noteEmptyState");
    grid.innerHTML = "";

    if (state.notes.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    state.notes.forEach(note => {
      const card = document.createElement("div");
      card.className = "note-card";

      const textarea = document.createElement("textarea");
      textarea.className = "note-textarea";
      textarea.value = note.text;
      textarea.setAttribute("aria-label", "Note content");

      const footer = document.createElement("div");
      footer.className = "note-footer";

      const date = document.createElement("span");
      date.className = "note-date";
      date.textContent = new Date(note.updatedAt).toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
      });

      const actions = document.createElement("div");
      actions.className = "note-actions";

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "note-save";
      saveBtn.textContent = "Save";
      saveBtn.addEventListener("click", () => {
        updateNoteText(note.id, textarea.value);
        date.textContent = new Date(note.updatedAt).toLocaleString(undefined, {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
        });
        showToast("Note saved.");
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "note-del";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => deleteNote(note.id));

      actions.append(saveBtn, delBtn);
      footer.append(date, actions);
      card.append(textarea, footer);
      grid.appendChild(card);
    });
  }

  /* ------------------------------------------------------------------
     13. FOCUS TIMER
     ------------------------------------------------------------------ */
  const timerState = {
    mode: "focus",           // "focus" | "break"
    secondsLeft: CONFIG.FOCUS_MINUTES * 60,
    isRunning: false,
    intervalId: null
  };

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function renderTimer() {
    document.getElementById("timerDisplay").textContent = formatTime(timerState.secondsLeft);
    document.getElementById("focusModeLabel").textContent = timerState.mode === "focus" ? "Focus session" : "Break";
    document.getElementById("timerSessionInfo").textContent =
      "Focus: " + CONFIG.FOCUS_MINUTES + " min · Break: " + CONFIG.BREAK_MINUTES + " min";

    const startBtn = document.getElementById("timerStart");
    const pauseBtn = document.getElementById("timerPause");
    startBtn.disabled = timerState.isRunning;
    pauseBtn.disabled = !timerState.isRunning;
    startBtn.textContent = timerState.secondsLeft === 0 ? "Start" : (timerState.isRunning ? "Running…" : "Start");
  }

  function tick() {
    if (timerState.secondsLeft > 0) {
      timerState.secondsLeft -= 1;
      renderTimer();
      return;
    }
    // Timer reached zero.
    stopInterval();
    timerState.isRunning = false;

    if (timerState.mode === "focus") {
      completeFocusSession();
      timerState.mode = "break";
      timerState.secondsLeft = CONFIG.BREAK_MINUTES * 60;
      showToast("Focus session complete. Time for a short break.");
    } else {
      timerState.mode = "focus";
      timerState.secondsLeft = CONFIG.FOCUS_MINUTES * 60;
      showToast("Break's over. Ready for another focus session.");
    }
    renderTimer();
  }

  function completeFocusSession() {
    state.focus.sessionsCompleted += 1;
    state.focus.totalMinutes += CONFIG.FOCUS_MINUTES;
    saveData("focus", state.focus);

    addPoints(CONFIG.POINTS.FOCUS_SESSION);
    registerProductiveAction();
    checkAchievements();
    renderAll();
  }

  function startInterval() {
    stopInterval();
    timerState.intervalId = setInterval(tick, 1000);
  }
  function stopInterval() {
    if (timerState.intervalId) {
      clearInterval(timerState.intervalId);
      timerState.intervalId = null;
    }
  }

  function startTimer() {
    if (timerState.isRunning) return;
    if (timerState.secondsLeft === 0) {
      timerState.secondsLeft = timerState.mode === "focus" ? CONFIG.FOCUS_MINUTES * 60 : CONFIG.BREAK_MINUTES * 60;
    }
    timerState.isRunning = true;
    startInterval();
    renderTimer();
  }

  function pauseTimer() {
    timerState.isRunning = false;
    stopInterval();
    renderTimer();
  }

  function resetTimer() {
    timerState.isRunning = false;
    stopInterval();
    timerState.mode = "focus";
    timerState.secondsLeft = CONFIG.FOCUS_MINUTES * 60;
    renderTimer();
  }

  function setupFocusTimer() {
    document.getElementById("timerStart").addEventListener("click", startTimer);
    document.getElementById("timerPause").addEventListener("click", pauseTimer);
    document.getElementById("timerReset").addEventListener("click", resetTimer);
    renderTimer();
  }

  /* ------------------------------------------------------------------
     14. WEEKLY CHART
     ------------------------------------------------------------------ */
  function renderWeekChart() {
    const container = document.getElementById("weekChart");
    container.innerHTML = "";

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      days.push({
        key: todayKey(d),
        label: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3),
        isToday: i === 0
      });
    }

    const values = days.map(d => state.weekly[d.key] || 0);
    const max = Math.max(...values, 10); // minimum scale so bars aren't huge with tiny data

    days.forEach((day, i) => {
      const col = document.createElement("div");
      col.className = "week-bar-col";

      const bar = document.createElement("div");
      bar.className = "week-bar" + (day.isToday ? " is-today" : "");
      const heightPct = Math.max(4, Math.round((values[i] / max) * 100));
      bar.style.height = heightPct + "%";
      bar.title = day.label + ": " + values[i] + " pts";

      const label = document.createElement("span");
      label.className = "week-label";
      label.textContent = day.label;

      col.append(bar, label);
      container.appendChild(col);
    });
  }

  /* ------------------------------------------------------------------
     15. ACHIEVEMENTS UI
     ------------------------------------------------------------------ */
  function renderAchievements() {
    const grid = document.getElementById("achievementsGrid");
    grid.innerHTML = "";

    Object.keys(ACHIEVEMENT_INFO).forEach(key => {
      const info = ACHIEVEMENT_INFO[key];
      const unlocked = !!state.achievements[key];

      const el = document.createElement("div");
      el.className = "achievement" + (unlocked ? " is-unlocked" : "");

      el.innerHTML =
        '<span class="achievement-icon" aria-hidden="true">' + info.icon + '</span>' +
        '<span>' +
          '<span class="achievement-name">' + info.name + '</span>' +
          '<span class="achievement-desc">' + info.desc + '</span>' +
        '</span>';

      grid.appendChild(el);
    });
  }

  /* ------------------------------------------------------------------
     16. DASHBOARD & PROGRESS SYNC
     ------------------------------------------------------------------ */
  function updateStats() {
    const completedCount = state.tasks.filter(t => t.completed).length;
    const pendingCount = state.tasks.filter(t => !t.completed).length;

    document.getElementById("statTasksCompleted").textContent = completedCount;
    document.getElementById("statTasksPending").textContent = pendingCount;
    document.getElementById("statFocusMinutes").textContent = state.focus.totalMinutes;
    document.getElementById("statStreak").textContent = state.streak.count;

    document.getElementById("focusSessionsCompleted").textContent = state.focus.sessionsCompleted;
    document.getElementById("focusTotalMinutes").textContent = state.focus.totalMinutes;

    document.getElementById("progTasksCompleted").textContent = completedCount;
    document.getElementById("progFocusSessions").textContent = state.focus.sessionsCompleted;
    document.getElementById("progFocusMinutes").textContent = state.focus.totalMinutes;
    document.getElementById("progStreak").textContent = state.streak.count;

    document.getElementById("pointsValue").textContent = state.points;
    document.getElementById("progPointsValue").textContent = state.points;

    const streakMsg = document.getElementById("streakMessage");
    streakMsg.textContent = state.streak.count > 0
      ? "You're on a " + state.streak.count + "-day streak. Keep it going!"
      : "Start today to build your streak.";

    const total = state.tasks.length;
    const pct = total === 0 ? 0 : Math.round((completedCount / total) * 100);
    document.getElementById("todayProgressPill").textContent = completedCount + " / " + total;
    document.getElementById("todayProgressFill").style.width = pct + "%";
    document.getElementById("todayProgressBar").setAttribute("aria-valuenow", String(pct));
    document.getElementById("todayProgressText").textContent =
      total === 0 ? "Add a task to start tracking progress." : pct + "% of today's tasks complete";
  }

  function updateDashboard() {
    document.getElementById("greetingText").textContent = getGreeting() + ", " + APP_USER_NAME + " 👋";
    document.getElementById("dateChip").textContent = formatReadableDate(new Date());
    renderDashboardTasks();
  }

  const APP_USER_NAME = "there"; // Kept generic and configurable — no personal data hard-coded.

  function renderAll() {
    renderTasks();
    renderGoals();
    renderNotes();
    updateStats();
    updateDashboard();
    renderWeekChart();
    renderAchievements();
  }

  /* ------------------------------------------------------------------
     17. FORM WIRING
     ------------------------------------------------------------------ */
  function setupForms() {
    document.getElementById("taskForm").addEventListener("submit", e => {
      e.preventDefault();
      const input = document.getElementById("taskInput");
      const priority = document.getElementById("taskPriority").value;
      if (!input.value.trim()) return;
      addTask(input.value, priority);
      input.value = "";
      input.focus();
      renderAll();
      showToast("Task added.");
    });

    document.getElementById("goalForm").addEventListener("submit", e => {
      e.preventDefault();
      const input = document.getElementById("goalInput");
      if (!input.value.trim()) return;
      addGoal(input.value);
      input.value = "";
      input.focus();
      renderAll();
      showToast("Goal added.");
    });

    document.getElementById("noteForm").addEventListener("submit", e => {
      e.preventDefault();
      const input = document.getElementById("noteInput");
      if (!input.value.trim()) return;
      addNote(input.value);
      input.value = "";
      renderNotes();
      showToast("Note saved.");
    });

    document.querySelectorAll(".filter-btn").forEach(btn => {
      btn.addEventListener("click", () => setTaskFilter(btn.dataset.filter));
    });

    document.getElementById("qaAddTask").addEventListener("click", () => {
      goToSection("tasks");
      setTimeout(() => document.getElementById("taskInput").focus(), 50);
    });
    document.getElementById("qaStartFocus").addEventListener("click", () => goToSection("focus"));
    document.getElementById("qaAddGoal").addEventListener("click", () => {
      goToSection("goals");
      setTimeout(() => document.getElementById("goalInput").focus(), 50);
    });
    document.getElementById("qaAddNote").addEventListener("click", () => {
      goToSection("notes");
      setTimeout(() => document.getElementById("noteInput").focus(), 50);
    });
  }

  /* ------------------------------------------------------------------
     18. INIT
     ------------------------------------------------------------------ */
  function init() {
    seedSampleDataIfNeeded();
    setupNavigation();
    setupMobileSidebar();
    setupTheme();
    setupForms();
    setupFocusTimer();
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

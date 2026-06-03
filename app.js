(() => {
  // App state
  const state = {
    schedule: {},      // loaded from schedule.json or localStorage
    activeDay: 0,      // 0 = Monday, ..., 6 = Sunday
    currentView: 'timetable', // 'timetable' | 'mysessions' | 'alarms'
    filter: 'all',     // 'all' | 'selected'
    alarmsEnabled: true,
    alarmSoundEnabled: true,
    reminderMins: 30
  };

  const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // --- Utility: Time Parser ---
  const parseTime = (timeStr) => {
    try {
      const parts = timeStr.split(/(\s+to\s+|\s*-\s*)/i);
      const startStr = parts[0].trim().toLowerCase();
      
      let hours = 0;
      let minutes = 0;
      
      const isPm = startStr.includes('pm');
      const isAm = startStr.includes('am');
      
      const cleanStr = startStr.replace(/(am|pm)/g, '').trim();
      const timeParts = cleanStr.split(/[:\.]/);
      
      hours = parseInt(timeParts[0], 10);
      if (timeParts.length > 1) {
        minutes = parseInt(timeParts[1], 10);
      }
      
      if (isPm && hours < 12) {
        hours += 12;
      } else if (isAm && hours === 12) {
        hours = 0;
      }
      
      return { hours, minutes };
    } catch (e) {
      console.error('Error parsing time string:', timeStr, e);
      return { hours: 0, minutes: 0 };
    }
  };

  // --- Utility: Play Premium Beep ---
  const playBeep = () => {
    if (!state.alarmSoundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const audioCtx = new AudioContext();
      
      const playTone = (delay, frequency, duration) => {
        setTimeout(() => {
          try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
            
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
          } catch (_) {}
        }, delay);
      };
      
      // Play a triple notification chord
      playTone(0, 880, 0.25);
      playTone(150, 880, 0.25);
      playTone(300, 1174.66, 0.4); // D6 note
    } catch (e) {
      console.warn('Web Audio API not supported or blocked by user gesture.', e);
    }
  };

  // --- Utility: Show Toast ---
  const showToast = (msg, icon = '🔔') => {
    const toastEl = document.getElementById('toast');
    const toastIcon = document.getElementById('toastIcon');
    const toastMsg = document.getElementById('toastMsg');
    if (!toastEl || !toastMsg) return;

    toastIcon.textContent = icon;
    toastMsg.textContent = msg;
    
    toastEl.classList.add('show');
    
    // Auto hide
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 4000);
  };

  // --- State Persistence ---
    const saveState = () => {
      try {
        localStorage.setItem('jjm_gym_schedule', JSON.stringify(state.schedule));
        localStorage.setItem('jjm_alarms_enabled', state.alarmsEnabled);
        localStorage.setItem('jjm_alarm_sound', state.alarmSoundEnabled);
        localStorage.setItem('jjm_reminder_mins', state.reminderMins);
        // Persist UI state
        localStorage.setItem('jjm_active_day', state.activeDay);
        localStorage.setItem('jjm_filter', state.filter);
        localStorage.setItem('jjm_current_view', state.currentView);
      } catch (e) {
        console.error('Failed to save state to localStorage', e);
      }
    };

  const loadState = () => {
    try {
      const savedSchedule = localStorage.getItem('jjm_gym_schedule');
      if (savedSchedule) {
        state.schedule = JSON.parse(savedSchedule);
      }
      
      const savedAlarmsEnabled = localStorage.getItem('jjm_alarms_enabled');
      if (savedAlarmsEnabled !== null) {
        state.alarmsEnabled = savedAlarmsEnabled === 'true';
      }
      
      const savedAlarmSound = localStorage.getItem('jjm_alarm_sound');
      if (savedAlarmSound !== null) {
        state.alarmSoundEnabled = savedAlarmSound === 'true';
      }
      
      const savedReminderMins = localStorage.getItem('jjm_reminder_mins');
      if (savedReminderMins !== null) {
        state.reminderMins = parseInt(savedReminderMins, 10);
      }
    } catch (e) {
      console.error('Failed to load state from localStorage', e);
    }
  };

  // --- Data Loading ---
  const loadSchedule = async () => {
    try {
      const res = await fetch('schedule.json');
      const data = await res.json();
      
      // Merge with persisted stars/alarms if they exist
      const merged = {};
      DAYS_ORDER.forEach(day => {
        merged[day] = (data[day] || []).map(newSession => {
          // Check if we already have this session starred in memory/state
          const existing = (state.schedule[day] || []).find(
            s => s.session === newSession.session && s.time === newSession.time
          );
          return {
            ...newSession,
            starred: existing ? existing.starred : false,
            alarmMins: existing ? existing.alarmMins : null,
            reminded: existing ? existing.reminded : false
          };
        });
      });
      state.schedule = merged;
    } catch (e) {
      console.error('Failed to fetch schedule.json. Loading fallback data.', e);
      if (Object.keys(state.schedule).length === 0) {
        // Fallback schedule
        state.schedule = {
          "Monday": [
            {"time":"9.30am to 10.15am","session":"RockBox"},
            {"time":"10.30am to 11.30am","session":"Clubbercise"},
            {"time":"11.30am to 12.15pm","session":"Yoga"},
            {"time":"11.30am to 12.15pm","session":"Aqua V1BE"},
            {"time":"12.30pm to 1.15pm","session":"Senior Circuits"}
          ],
          "Tuesday": [
            {"time":"9.30am to 10.15am","session":"STR1KE"},
            {"time":"10.30am to 11.15am","session":"Body conditioning"},
            {"time":"11.00am to 11.45am","session":"Aqua"},
            {"time":"11.30am to 12.15pm","session":"Pilates"}
          ],
          "Wednesday": [
            {"time":"07:00 - 07:45","session":"Yoga"},
            {"time":"09:15 - 10:00","session":"Line Dancing"}
          ],
          "Thursday": [
            {"time":"09:30 - 10:15","session":"Step"},
            {"time":"10:30 - 11:15","session":"Legs Bums Tums"}
          ],
          "Friday": [
            {"time":"07:00 - 07:45","session":"Yoga"},
            {"time":"09:00 - 09:45","session":"Aqua Combat"}
          ],
          "Saturday": [
            {"time":"9am to 9.45am","session":"Zumba"}
          ],
          "Sunday": [
            {"time":"8.15am to 9am","session":"Yoga"}
          ]
        };
      }
    }
    saveState();
  };

  // --- Rendering Functions ---

  // Format time range string for premium horizontal layout (splits by 'to' or '-')
  const formatTimeHtml = (timeStr) => {
    const parts = timeStr.split(/(\s+to\s+|\s*-\s*)/i);
    if (parts.length >= 3) {
      const start = parts[0].trim();
      const end = parts[2].trim();
      return `<span class="time-start">${start}</span><span class="time-end">${end}</span>`;
    }
    return `<span class="time-start">${timeStr}</span>`;
  };

  // Create HTML Card Node for a Session
  const createSessionCard = (session, day, index, isMyPlan = false) => {
    const card = document.createElement('div');
    card.className = 'session-card';
    if (session.starred) {
      card.classList.add('highlighted');
    }

    const timeHtml = formatTimeHtml(session.time);
    const starClass = session.starred ? 'action-btn starred' : 'action-btn';

    // Add remove button (visible only in My Plan view)
    const removeButtonHTML = isMyPlan ? `<button class="action-btn" data-action="remove" title="Remove session">🗑️</button>` : '';
    card.innerHTML = `
      <div class="session-time-col">
        ${timeHtml}
      </div>
      <div class="session-info-col">
        <div class="session-title">${session.session}</div>
        <div class="session-sub">
          <span>📍 Studio 1</span>
        </div>
      </div>
      <div class="session-actions-col">
        <button class="${starClass}" data-action="star" title="Highlight session">
          ${session.starred ? '★' : '☆'}
        </button>
        ${removeButtonHTML}
      </div>
    `;

    // Event Delegation / Specific bindings
    card.querySelector('[data-action="star"]').addEventListener('click', (e) => {
      e.stopPropagation();
      session.starred = !session.starred;
      // If unstarred, clear any specific alarm minutes
      if (!session.starred) {
        session.alarmMins = null;
      }
      saveState();
      renderActiveView();
    });

    // Remove session handler (used in My Plan view)
    const removeBtn = card.querySelector('[data-action="remove"]');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Find and remove the session from the day's schedule
        const daySchedule = state.schedule[day] || [];
        const idx = daySchedule.findIndex(s => s.session === session.session && s.time === session.time);
        if (idx !== -1) {
          daySchedule.splice(idx, 1);
          state.schedule[day] = daySchedule;
          saveState();
          renderActiveView();
        }
      });
    }

    return card;
  };

  // 1. Render Timetable View
  const renderTimetable = () => {
    const listContainer = document.getElementById('sessionList');
    const emptyState = document.getElementById('emptyState');
    if (!listContainer || !emptyState) return;

    listContainer.innerHTML = '';
    const dayName = DAYS_ORDER[state.activeDay];
    const sessions = state.schedule[dayName] || [];
    
    // Apply active filter (All vs Starred)
    let filteredSessions = sessions;
    if (state.filter === 'selected') {
      filteredSessions = sessions.filter(s => s.starred);
    }

    if (filteredSessions.length === 0) {
      emptyState.style.display = 'flex';
      listContainer.appendChild(emptyState);
    } else {
      emptyState.style.display = 'none';
      filteredSessions.forEach((session, index) => {
        listContainer.appendChild(createSessionCard(session, dayName, index));
      });
    }
  };

  // 2. Render My Plan View
  const renderMyPlan = () => {
    const container = document.getElementById('mySessionsList');
    if (!container) return;
    container.innerHTML = '';

    let hasAnyStarred = false;

    DAYS_ORDER.forEach(day => {
      const starred = (state.schedule[day] || []).filter(s => s.starred);
      if (starred.length > 0) {
        hasAnyStarred = true;
        const dayGroup = document.createElement('div');
        dayGroup.className = 'my-day-group';

        const dayHeader = document.createElement('div');
        dayHeader.className = 'my-day-title';
        dayHeader.textContent = day;
        dayGroup.appendChild(dayHeader);

        const groupList = document.createElement('div');
        groupList.className = 'session-list';

        starred.forEach((session, index) => {
          groupList.appendChild(createSessionCard(session, day, index, true));
        });

        dayGroup.appendChild(groupList);
        container.appendChild(dayGroup);
      }
    });

    if (!hasAnyStarred) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">⭐</span>
          <h3>No Highlighted Sessions</h3>
          <p>Highlight classes on the Timetable tab to build your weekly plan.</p>
        </div>
      `;
    }
  };

  const renderActiveView = () => {
    // Hide all view panels first
    const mainContent = document.getElementById('mainContent');
    const viewMySessions = document.getElementById('viewMySessions');
    const viewAlarms = document.getElementById('viewAlarms');
    
    if (mainContent) mainContent.style.display = 'none';
    if (viewMySessions) viewMySessions.style.display = 'none';
    if (viewAlarms) viewAlarms.style.display = 'none';

    // Show active view panel
    if (state.currentView === 'timetable') {
      if (mainContent) mainContent.style.display = 'flex';
      renderTimetable();
    } else if (state.currentView === 'mysessions') {
      if (viewMySessions) viewMySessions.style.display = 'block';
      renderMyPlan();
    }
  };

  // --- Navigation & Filter Handlers ---
  const initNavHandlers = () => {
    // Bottom navigation
    document.querySelectorAll('.bottom-nav button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentView = btn.dataset.view;
        renderActiveView();
        saveState(); // persist current view
      });
    });

    // Weekday tabs
    document.querySelectorAll('.day-tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        // Reset filter to 'all' when changing day to avoid empty views
        state.filter = 'all';
        // Update filter chip UI
        document.querySelectorAll('.filter-chip').forEach(f => f.classList.remove('active'));
        const allChip = document.querySelector('.filter-chip[data-filter="all"]');
        if (allChip) allChip.classList.add('active');
        // Persist changes
        saveState();
        document.querySelectorAll('.day-tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeDay = parseInt(btn.dataset.day, 10);
        renderTimetable();
      });
    });

    // Filter Chips
    document.querySelectorAll('.filter-bar button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-bar button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.filter = btn.dataset.filter;
        renderTimetable();
        saveState(); // persist filter
      });
    });
  };

  // --- Initialize App ---
  const init = async () => {
    // Initial UI state will be restored from localStorage below

    // Load UI state persistence before applying active classes
    const savedActiveDay = localStorage.getItem('jjm_active_day');
    if (savedActiveDay !== null) {
      state.activeDay = parseInt(savedActiveDay, 10);
    }
    const savedFilter = localStorage.getItem('jjm_filter');
    if (savedFilter !== null) {
      state.filter = savedFilter;
    }
    const savedCurrentView = localStorage.getItem('jjm_current_view');
    if (savedCurrentView !== null) {
      state.currentView = savedCurrentView;
    }
    // Apply persisted active tab class
    const activeTab = document.querySelector(`.day-tab[data-day="${state.activeDay}"]`);
    if (activeTab) activeTab.classList.add('active');
    // Apply persisted filter chip active class
    const activeFilterChip = document.querySelector(`.filter-chip[data-filter="${state.filter}"]`);
    if (activeFilterChip) activeFilterChip.classList.add('active');
    // Apply persisted bottom nav active class
    const activeNavBtn = document.querySelector(`.bottom-nav button[data-view="${state.currentView}"]`);
    if (activeNavBtn) activeNavBtn.classList.add('active');
    // Load persisted schedule and other state
    loadState();

    // 3. Load dynamic schedules
    await loadSchedule();

    // 4. Set up user gesture click for sound & notification request
    document.addEventListener('click', function requestPermission() {
      // AudioContext unlock
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
      } catch (_) {}

      // Browser Notification unlock
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      document.removeEventListener('click', requestPermission);
    }, { once: true });

    // 5. Initialize layout event handlers
    initNavHandlers();

    // Exit button handler
    const exitBtn = document.getElementById('exitBtn');
    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        // Redirect to a blank page to simulate exit
        window.location.href = 'about:blank';
      });
    }
    // 6. Draw active layout
    renderActiveView();

    // 7. Start monitor loop
    
  };

  document.addEventListener('DOMContentLoaded', init);
})();

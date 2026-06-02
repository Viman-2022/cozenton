// app.js – Cozenton Park Classes PWA with vertical day list, highlight & alarm
(() => {
  const STATE = {
    schedule: {}, // { Monday: [{time, session, starred, alarmMins, reminded}] }
    activeDay: null,
    alarmsEnabled: true,
  };

  // Load schedule (weekday keys)
  const loadSchedule = async () => {
    try {
      const res = await fetch('schedule.json');
      STATE.schedule = await res.json();
    } catch (e) {
      console.error('Failed to load schedule.json', e);
      // Fallback static schedule for when fetch fails (e.g., when opened via file://)
      STATE.schedule = {
        "Monday": [
          {"time":"9.30am to 10.15am","session":"RockBox"},
          {"time":"10.30am to 11.30am","session":"Clubbercise"},
          {"time":"11.30am to 12.15pm","session":"Yoga"},
          {"time":"11.30am to 12.15pm","session":"Aqua V1BE"},
          {"time":"12.30pm to 1.15pm","session":"Senior Circuits"},
          {"time":"5pm to 5.45pm","session":"Booty BandZ"},
          {"time":"6pm to 6.45pm","session":"Totally Shredded"},
          {"time":"7pm to 7.45pm","session":"L1FT"},
          {"time":"8pm to 8.45pm","session":"Line Dancing (improvers)"}
        ],
        "Tuesday": [
          {"time":"9.30am to 10.15am","session":"STR1KE"},
          {"time":"10.30am to 11.15am","session":"Body conditioning"},
          {"time":"11.00am to 11.45am","session":"Aqua"},
          {"time":"11.30am to 12.15pm","session":"Pilates"},
          {"time":"12.30pm to 1.15pm","session":"Chair Pilates"},
          {"time":"1.30pm to 2.15pm","session":"Senior Circuits"},
          {"time":"5.00pm to 5.45pm","session":"Yoga"},
          {"time":"6.00pm to 6.45pm","session":"Circuits"},
          {"time":"7.00pm to 7.45pm","session":"Line Dancing (beginners)"}
        ],
        "Wednesday": [
          {"time":"07:00 - 07:45","session":"Yoga"},
          {"time":"09:15 - 10:00","session":"Line Dancing"},
          {"time":"10:30 - 11:15","session":"Senior Circuits"},
          {"time":"11:30 - 12:30","session":"L!FT"},
          {"time":"18:00 - 18:45","session":"Zumba Toning"},
          {"time":"19:00 - 19:45","session":"Circuits"},
          {"time":"19:00 - 19:45","session":"Aqua Combat"},
          {"time":"20:00 - 20:45","session":"Pilates"}
        ],
        "Thursday": [
          {"time":"09:30 - 10:15","session":"Step"},
          {"time":"10:30 - 11:15","session":"Legs Bums Tums"},
          {"time":"11:30 - 12:15","session":"Kettlebells"},
          {"time":"12:30 - 13:15","session":"Pilates"},
          {"time":"13:30 - 14:15","session":"Chair Fit"},
          {"time":"18:00 - 18:45","session":"RockBox"},
          {"time":"19:00 - 19:45","session":"Clubbercise"}
        ],
        "Friday": [
          {"time":"07:00 - 07:45","session":"Yoga"},
          {"time":"09:00 - 09:45","session":"Aqua Combat"},
          {"time":"10:00 - 10:45","session":"Toning at Ten"},
          {"time":"11:00 - 11:45","session":"Zumba"},
          {"time":"12:15pm - 01:00pm","session":"Senior Circuits"}
        ],
        "Saturday": [
          {"time":"9am to 9.45am","session":"Zumba"},
          {"time":"10am to 10.45am","session":"Step"},
          {"time":"11am to 11.45am","session":"L!FT"}
        ],
        "Sunday": [
          {"time":"8.15am to 9am","session":"Yoga"},
          {"time":"9.15am to 10am","session":"Circuits"},
          {"time":"10.15 to 11am","session":"Kettlebells"}
        ]
      };
        // Old fallback removed
    }
  };

  // Persist to localStorage (so alarms survive reload)
  const persist = () => {
    try { localStorage.setItem('cozenton_schedule', JSON.stringify(STATE.schedule)); } catch (_) {}
  };
  const loadPersisted = () => {
    const stored = localStorage.getItem('cozenton_schedule');
    if (stored) {
      try { STATE.schedule = JSON.parse(stored); } catch (_) {}
    }
  };



  const toast = msg => {
    const container = document.getElementById('toastContainer') || document.body.appendChild(Object.assign(document.createElement('div'), {id:'toastContainer',className:'toast-container'}));
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(()=>el.remove(),3000);
  };



   // Render schedule table for active day
   const renderTable = () => {
     const tbody = document.querySelector('#scheduleTable tbody');
     if (!tbody) return;
     // Clear any existing rows
     tbody.innerHTML = '';
     // Iterate over each day in the schedule
     Object.keys(STATE.schedule).forEach(day => {
       const entries = STATE.schedule[day] || [];
       // Day header row (styled as a content box)
       const headerTr = document.createElement('tr');
       headerTr.className = 'day-header';
       headerTr.innerHTML = `<td colspan="4">${day}</td>`;
       tbody.appendChild(headerTr);
       // Render each class entry for the day
       entries.forEach((e, idx) => {
         const tr = document.createElement('tr');
         tr.dataset.idx = idx;
         tr.dataset.day = day;
         if (e.starred) tr.classList.add('highlighted');
         tr.innerHTML = `
           <td>${e.time}</td>
           <td>${e.session}</td>
           <td>
             <button class="action-btn star" title="Highlight">${e.starred ? '★' : '☆'}</button>
             <button class="action-btn alarm" title="Set reminder">⏰</button>
           </td>`;
         const starBtn = tr.querySelector('.star');
         starBtn.addEventListener('click', ev => {
           ev.stopPropagation();
           e.starred = !e.starred;
           tr.classList.toggle('highlighted', e.starred);
           starBtn.textContent = e.starred ? '★' : '☆';
           persist();
         });
         tr.querySelector('.alarm').addEventListener('click', ev => {
           ev.stopPropagation();
           const mins = parseInt(prompt('Remind how many minutes before?', e.alarmMins ?? 15), 10);
           if (!isNaN(mins)) { e.alarmMins = mins; e.reminded = false; persist(); toast(`Alarm set ${mins} min before ${e.session}`); }
         });
         // Row click toggles highlight as well
         tr.addEventListener('click', () => {
           e.starred = !e.starred;
           tr.classList.toggle('highlighted', e.starred);
           starBtn.textContent = e.starred ? '★' : '☆';
           persist();
         });
         tbody.appendChild(tr);
       });
       // Spacer row between days
       const spacerTr = document.createElement('tr');
       spacerTr.className = 'day-spacer';
       spacerTr.innerHTML = `<td colspan="4"></td>`;
       tbody.appendChild(spacerTr);
     });
   };

  // Alarm checker runs each minute
  const startAlarmChecker = () => {
    setInterval(() => {
      if (!STATE.alarmsEnabled) return;
      const now = new Date();
      const today = Object.keys(STATE.schedule).find(d => {
        // compare weekday name of today
        const wd = now.toLocaleDateString(undefined,{weekday:'long'});
        return d === wd;
      });
      if (!today) return;
      const list = STATE.schedule[today] || [];
      list.forEach(e => {
        if (!e.alarmMins || e.reminded) return;
        const [h,m] = e.time.split(':').map(Number);
        const classTime = new Date(now);
        classTime.setHours(h, m, 0, 0);
        const diff = (classTime - now) / 60000; // minutes
        if (diff <= e.alarmMins && diff > 0) {
          toast(`Upcoming: ${e.session} in ${Math.round(diff)} min`);
          e.reminded = true;
          persist();
        }
      });
    }, 60000);
  };

  const registerSW = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(err=>console.error('SW registration failed',err));
    }
  };

const init = async () => {
    registerSW();
    await loadSchedule();
    // loadPersisted(); // removed to avoid overwriting schedule
    renderTable();
    const tbody = document.querySelector('#scheduleTable tbody');
    tbody.addEventListener('click', (ev) => {
       const tr = ev.target.closest('tr');
       if (!tr) return;
       const day = tr.dataset.day;
       const idx = tr.dataset.idx;
       const e = STATE.schedule[day][idx];
       if (!e) return;
       if (ev.target.matches('.star')) {
          ev.stopPropagation();
          e.starred = !e.starred;
          tr.classList.toggle('highlighted', e.starred);
          ev.target.textContent = e.starred ? '★' : '☆';
          persist();
       } else if (ev.target.matches('.alarm')) {
          ev.stopPropagation();
          const mins = parseInt(prompt('Remind how many minutes before?', e.alarmMins ?? 15),10);
          if (!isNaN(mins)) { e.alarmMins = mins; e.reminded = false; persist(); toast(`Alarm set ${mins} min before ${e.session}`); }
       } else {
          e.starred = !e.starred;
          tr.classList.toggle('highlighted', e.starred);
          const starBtn = tr.querySelector('.star');
          if (starBtn) starBtn.textContent = e.starred ? '★' : '☆';
          persist();
       }
    });
    startAlarmChecker();
};
document.addEventListener('DOMContentLoaded', init);
})();

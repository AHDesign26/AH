// Call booking — fetches free slots from /api/slots and books one via
// /api/book. Times arrive as UTC instants and are rendered in the visitor's
// own zone, so the Sofia windows behind them never have to be explained.
(function () {
  var SLOTS_URL = '/api/slots';
  var BOOK_URL = '/api/book';
  var REQUEST_TIMEOUT_MS = 20000;

  function $(sel) { return document.querySelector(sel); }

  var els = {
    form: $('#callbooking'),
    zone: $('#cbZone'),
    loading: $('#cbLoading'),
    empty: $('#cbEmpty'),
    picker: $('#cbPicker'),
    days: $('#cbDays'),
    times: $('#cbTimes'),
    chosenTime: $('#cbChosenTime'),
    change: $('#cbChange'),
    slot: $('#cbSlot'),
    visitorZone: $('#cbVisitorZone'),
    name: $('#cbName'),
    email: $('#cbEmail'),
    phone: $('#cbPhone'),
    submit: $('#cbSubmit'),
    error: $('#cbError'),
    successText: $('#cbSuccessText')
  };

  if (!els.form) return;

  var panels = {
    slots: els.form.querySelector('[data-panel="slots"]'),
    details: els.form.querySelector('[data-panel="details"]'),
    success: els.form.querySelector('[data-panel="success"]')
  };

  var state = { slots: [], byDay: [], selectedDay: 0, chosen: null, duration: 30 };
  var visitorZone = '';
  try {
    visitorZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch (e) {
    visitorZone = '';
  }

  function show(panel) {
    Object.keys(panels).forEach(function (key) {
      if (panels[key]) panels[key].hidden = key !== panel;
    });
  }

  function showError(message) {
    if (!els.error) return;
    els.error.textContent = message;
    els.error.classList.add('is-visible');
  }

  function hideError() {
    if (!els.error) return;
    els.error.classList.remove('is-visible');
  }

  function fmt(date, options) {
    return new Intl.DateTimeFormat(navigator.language || 'en-GB', options).format(date);
  }

  // Group instants into calendar days as the visitor's own clock sees them,
  // not as Sofia does; an evening slot can otherwise land under yesterday.
  function groupByDay(isoList) {
    var days = [];
    var index = {};
    isoList.forEach(function (iso) {
      var date = new Date(iso);
      var key = fmt(date, { year: 'numeric', month: '2-digit', day: '2-digit' });
      if (!(key in index)) {
        index[key] = days.length;
        days.push({ key: key, date: date, slots: [] });
      }
      days[index[key]].slots.push({ iso: iso, date: date });
    });
    return days;
  }

  function renderDays() {
    els.days.textContent = '';
    state.byDay.forEach(function (day, i) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'cb-day';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', i === state.selectedDay ? 'true' : 'false');

      var weekday = document.createElement('span');
      weekday.className = 'cb-day__weekday';
      weekday.textContent = fmt(day.date, { weekday: 'short' });

      var date = document.createElement('span');
      date.className = 'cb-day__date';
      date.textContent = fmt(day.date, { day: 'numeric', month: 'short' });

      button.appendChild(weekday);
      button.appendChild(date);
      button.addEventListener('click', function () {
        state.selectedDay = i;
        renderDays();
        renderTimes();
      });
      els.days.appendChild(button);
    });
  }

  function renderTimes() {
    els.times.textContent = '';
    var day = state.byDay[state.selectedDay];
    if (!day) return;
    day.slots.forEach(function (slot) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'cb-time';
      button.setAttribute('role', 'option');
      button.textContent = fmt(slot.date, { hour: '2-digit', minute: '2-digit' });
      button.addEventListener('click', function () { choose(slot); });
      els.times.appendChild(button);
    });
  }

  function choose(slot) {
    state.chosen = slot;
    els.slot.value = slot.iso;
    els.chosenTime.textContent = fmt(slot.date, {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    }) + ' (' + state.duration + ' min)';
    hideError();
    show('details');
    if (els.name) els.name.focus();
  }

  function loadSlots() {
    els.loading.hidden = false;
    els.picker.hidden = true;
    els.empty.hidden = true;

    return fetch(SLOTS_URL, { headers: { accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('slots-failed');
        return res.json();
      })
      .then(function (data) {
        state.duration = data.durationMinutes || 30;
        state.slots = data.slots || [];
        state.byDay = groupByDay(state.slots);
        state.selectedDay = 0;
        els.loading.hidden = true;

        if (!state.byDay.length) {
          els.empty.hidden = false;
          return;
        }
        if (els.zone && visitorZone) {
          els.zone.textContent = 'Times are shown in your local time zone (' + visitorZone + ').';
        }
        els.picker.hidden = false;
        renderDays();
        renderTimes();
      })
      .catch(function () {
        els.loading.hidden = true;
        els.empty.hidden = false;
        showError('We could not load available times. Please reload, or email us instead.');
      });
  }

  function invalid(field, ok) {
    field.classList.toggle('is-invalid', !ok);
    return ok;
  }

  function validDetails() {
    var okName = invalid(els.name, els.name.value.trim().length > 1);
    var okEmail = invalid(els.email, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(els.email.value.trim()));
    var okPhone = invalid(els.phone, els.phone.value.replace(/\D/g, '').length >= 6);
    return okName && okEmail && okPhone;
  }

  function submit(event) {
    event.preventDefault();
    if (!state.chosen) return;
    if (!validDetails()) {
      showError('Please check your name, email and phone number.');
      return;
    }

    hideError();
    els.submit.disabled = true;
    els.submit.textContent = 'Booking…';

    if (els.visitorZone) els.visitorZone.value = visitorZone;
    var data = new FormData(els.form);

    // Abort rather than sit on a disabled button if the request stalls.
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var bail = setTimeout(function () { if (controller) controller.abort(); }, REQUEST_TIMEOUT_MS);

    fetch(BOOK_URL, {
      method: 'POST',
      body: data,
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (res.status === 409) {
            // Someone else took it, or one of us put something in the calendar
            // between loading the page and confirming.
            throw new Error('taken');
          }
          if (!res.ok || !body.success) throw new Error('failed');

          els.successText.textContent = 'We will call ' + els.phone.value.trim() +
            ' on ' + els.chosenTime.textContent.replace(/ \(\d+ min\)$/, '') + '.';
          show('success');
          if (window.turnstile) window.turnstile.reset();
        });
      })
      .catch(function (err) {
        if (err && err.message === 'taken') {
          showError('That time was just taken. Here are the times still free.');
          state.chosen = null;
          show('slots');
          loadSlots();
        } else if (err && err.name === 'AbortError') {
          showError('That took too long. Check your email before trying again, in case it went through.');
        } else {
          showError('Something went wrong, please try again.');
        }
        els.submit.disabled = false;
        els.submit.textContent = 'Confirm booking';
        if (window.turnstile) window.turnstile.reset();
      })
      .finally(function () { clearTimeout(bail); });
  }

  if (els.change) {
    els.change.addEventListener('click', function () {
      state.chosen = null;
      hideError();
      show('slots');
    });
  }
  els.form.addEventListener('submit', submit);

  loadSlots();
})();

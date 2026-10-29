/* Local demo page behaviour. Demo only. */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function dev(method, body) {
    return fetch('/api/dev' + (method === 'GET' ? '?action=' + body : ''), method === 'GET' ? undefined : { method: 'POST', body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }

  var live;
  function mountLive() { live = window.RABooking.mount($('#ra-booking'), { api: '/api' }); }

  // open decisions
  dev('GET', 'open').then(function (d) {
    var ul = $('#open');
    ul.innerHTML = '';
    d.open.forEach(function (o) { var li = document.createElement('li'); li.textContent = o.id + ': ' + o.note + (o.filled ? ' (decided)' : ' (waiting on Rafa)'); ul.appendChild(li); });
  });

  // state previews
  var names = [
    ['form', 'Booking form'], ['form-errors', 'Form errors'], ['single', 'Single sessions'], ['full', 'Full Day full'], ['closed', 'Booking not open'],
    ['amount', 'Amount step'], ['handoff', 'Stripe handoff'], ['thanks', 'Thank you (free)'], ['thanks-sessions', 'Thank you (sessions)'],
    ['paid', 'Back from Stripe: paid'], ['kept', 'Back from Stripe: abandoned'], ['waitlisted', 'Waitlisted'], ['partial', 'Partly waitlisted'],
    ['error-network', 'Error: network'], ['error-rate', 'Error: rate limit'], ['fatal', 'Error: could not load'],
  ];
  var bar = $('#states');
  names.forEach(function (n, i) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = n[1]; b.setAttribute('aria-pressed', 'false');
    b.onclick = function () {
      bar.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      window.RABooking.preview($('#ra-preview'), n[0]);
    };
    bar.appendChild(b);
    if (i === 0) b.click();
  });

  // controls
  var AFTER = '2026-11-28T12:05:00+08:00';
  function show(id, data) { $(id).textContent = JSON.stringify(data, null, 2); }
  var actions = {
    reset: function () { return dev('POST', { action: 'reset', seed: 13 }).then(mountLive); },
    fill: function () { return dev('POST', { action: 'fill-full-day' }).then(mountLive); },
    leave1: function () { return dev('POST', { action: 'fill-full-day', leave: 1 }).then(mountLive); },
    after: function () { return dev('POST', { action: 'now', at: new Date(AFTER).toISOString() }); },
    real: function () { return dev('POST', { action: 'now' }); },
    deadline: function () { return dev('POST', { action: 'run-deadline' }).then(function (r) { show('#events', r); return null; }); },
    events: function () { return dev('GET', 'events').then(function (d) { show('#events', d.events.length ? d.events : 'No events yet.'); }); },
    state: function () { return dev('GET', 'state').then(function (d) { show('#mstate', d); }); },
  };
  document.querySelectorAll('[data-do]').forEach(function (b) {
    b.onclick = function () { Promise.resolve(actions[b.getAttribute('data-do')]()).then(function () { actions.events(); }); };
  });

  // reconfirm page: a fresh Full Day guest each time, real signed link, real POST
  var frame = $('#rc');
  function sample() { return dev('POST', { action: 'reconfirm-sample' }); }
  document.querySelectorAll('[data-rc]').forEach(function (b) {
    b.onclick = function () {
      var kind = b.getAttribute('data-rc');
      sample().then(function (s) {
        if (!s.url) { $('#rc-url').textContent = 'Could not create a sample guest. Reset first.'; return; }
        $('#rc-url').textContent = s.url;
        if (kind === 'pending') { frame.removeAttribute('srcdoc'); frame.src = s.url; return; }
        var t = new URL(s.url).searchParams.get('t');
        fetch('/api/reconfirm', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ t: t, action: kind }).toString() })
          .then(function (r) { return r.text(); }).then(function (html) { frame.srcdoc = html; actions.events(); });
      });
    };
  });

  mountLive();
})();

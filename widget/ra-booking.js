/* RA anniversary booking widget. One script, plain JavaScript, no dependencies.
   All guest copy comes from window.RA_BK_STRINGS (config/strings.en.js, built in).

   Embed on Squarespace (Business plan or higher):
     <div id="ra-booking" data-api="https://SITE.netlify.app/api"></div>
     <link rel="stylesheet" href="https://SITE.netlify.app/ra-booking.css">
     <script src="https://SITE.netlify.app/ra-booking.js" defer></script>
   Optional: data-turnstile-sitekey="..." turns on Cloudflare Turnstile (only if approved).

   Tracking: pushes to window.dataLayer. No personal data in any event. See docs/tracking.md. */
(function () {
  'use strict';
  var S = window.RA_BK_STRINGS;
  if (!S) return;

  function fmt(s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? v[k] : m; }); }
  function push(event, data) { try { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: event }, data || {})); } catch (e) { /* tracking never breaks booking */ } }
  function uuid() { var a = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function money(n) { return Number(n).toLocaleString('en-US'); }

  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }

  var SAMPLE = {
    bookingOpen: true, opensAtDisplay: '8 November', eventDateDisplay: 'Tuesday 1 December 2026',
    deadlineDisplay: 'Saturday 28 November, 12:00 (Bali time)', deadlineDateDisplay: '28 November',
    fullDay: { capacity: 50, booked: 13, left: 37, waiting: 0, full: false },
    sessions: [
      { key: 'demo-a', label: 'Demo session A', time: '09:00 to 10:30', capacity: 30, left: 12, full: false, waitlist: true },
      { key: 'demo-b', label: 'Demo session B', time: '11:00 to 12:30', capacity: null, left: null, full: false, waitlist: true },
      { key: 'demo-c', label: 'Demo session C', time: '15:00 to 16:15', capacity: 2, left: 0, full: true, waitlist: true },
    ],
    contributions: { currency: 'IDR', suggestedAmounts: [100000, 250000, 500000], minimum: 10000, word: 'donation', recipientLine: '', refundWording: '' },
  };

  function mount(root, opts) {
    opts = opts || {};
    var api = (opts.api || root.getAttribute('data-api') || '/api').replace(/\/$/, '');
    var siteKey = root.getAttribute('data-turnstile-sitekey');
    var preview = !!opts.preview;
    root.classList.add('ra-bk');
    root.innerHTML = '';

    var st = {
      view: 'loading', tab: 'full', cfg: null, busy: false, alert: null, errors: {}, res: null, focus: null, idem: null, idemSig: null,
      f: { name: '', email: '', whatsapp: '', whole: false, sessions: {}, amount: null, custom: '' }, token: '',
    };

    // ---------- strings with the donation wording ----------
    function words() {
      var w = (st.cfg && st.cfg.contributions && st.cfg.contributions.word) || '';
      return { word: w, Word: w ? w.charAt(0).toUpperCase() + w.slice(1) : '' };
    }
    function t(str, extra) {
      var c = st.cfg || {};
      var v = Object.assign({
        first: (st.res && st.res.firstName) || (st.f.name.trim().split(' ')[0] || ''), email: st.f.email, date: c.opensAtDisplay,
        deadline: c.deadlineDateDisplay, eventDate: c.eventDateDisplay,
        currency: c.contributions && c.contributions.currency, min: c.contributions && money(c.contributions.minimum),
      }, words(), extra || {});
      return fmt(str, v);
    }

    // ---------- network ----------
    function request(method, path, body, idemKey) {
      if (preview) return Promise.reject(new Error('preview'));
      var headers = { 'content-type': 'application/json' };
      if (idemKey) headers['idempotency-key'] = idemKey;
      return fetch(api + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; }); });
    }
    function loadConfig() {
      return request('GET', '/spots').then(function (r) {
        if (r.status !== 200) throw new Error('load');
        st.cfg = r.body;
        return r.body;
      });
    }

    // ---------- validation (the server checks again) ----------
    function validate(tabType) {
      var e = {}, f = st.f;
      if (f.name.trim().length < 2 || !/[A-Za-zÀ-ɏЀ-ӿ؀-ۿ぀-鿿]/.test(f.name)) e.name = S.errors.name;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(f.email.trim())) e.email = S.errors.email;
      var wa = f.whatsapp.replace(/[\s().-]/g, ''); if (wa.indexOf('00') === 0) wa = '+' + wa.slice(2);
      if (!/^\+[1-9]\d{7,14}$/.test(wa)) e.whatsapp = S.errors.whatsapp;
      if (tabType === 'single' && !chosen().length) e.sessions = S.errors.sessions;
      st.errors = e;
      return Object.keys(e);
    }
    function chosen() { return Object.keys(st.f.sessions).filter(function (k) { return st.f.sessions[k]; }); }

    // ---------- rendering ----------
    function render() {
      root.innerHTML = '';
      var v = st.view, node;
      if (v === 'loading') node = h('p', { 'aria-live': 'polite', text: S.buttons.sending });
      else if (v === 'fatal') node = fatal();
      else if (v === 'closed') node = closed();
      else if (v === 'form') node = form();
      else if (v === 'amount') node = amountStep();
      else if (v === 'handoff') node = handoff();
      else if (v === 'thanks') node = thanks();
      else if (v === 'paid') node = paid(false);
      else if (v === 'kept') node = paid(true);
      else if (v === 'waitlisted') node = waitlisted();
      root.appendChild(node);
      var f = st.focus && root.querySelector(st.focus);
      if (!f && v !== 'form' && v !== 'loading') f = root.querySelector('.ra-bk__h');
      if (f) f.focus();
      st.focus = null;
    }
    function go(view, focus) { st.view = view; st.alert = null; st.focus = focus || null; render(); }

    function fatal() {
      return h('div', { class: 'ra-bk__done', role: 'alert' }, h('p', { text: S.errors.load }),
        h('button', { class: 'ra-bk__btn ra-bk__btn--pri', type: 'button', text: S.buttons.retry, onclick: start }));
    }
    function closed() {
      return h('div', { class: 'ra-bk__done' }, h('span', { class: 'ra-bk__rule', 'aria-hidden': 'true' }),
        h('h3', { class: 'ra-bk__h', tabindex: '-1', text: t(S.closed.title) }), h('p', { text: S.closed.body }));
    }

    function field(id, key, label, type, auto, hint) {
      var err = st.errors[key];
      var input = h('input', { id: 'ra-bk-' + id, type: type, name: id, value: st.f[key], autocomplete: auto, 'aria-invalid': err ? 'true' : null,
        'aria-describedby': err ? 'ra-bk-' + id + '-err' : (hint ? 'ra-bk-' + id + '-hint' : null), required: null,
        inputmode: key === 'whatsapp' ? 'tel' : null,
        oninput: function (ev) { st.f[key] = ev.target.value; if (st.errors[key]) { delete st.errors[key]; ev.target.removeAttribute('aria-invalid'); var m = document.getElementById('ra-bk-' + id + '-err'); if (m) m.remove(); } } });
      return h('div', { class: 'ra-bk__field' }, h('label', { for: 'ra-bk-' + id, text: label }), input,
        hint && !err ? h('p', { class: 'ra-bk__hint', id: 'ra-bk-' + id + '-hint', text: hint }) : null,
        err ? h('p', { class: 'ra-bk__err', id: 'ra-bk-' + id + '-err', text: err }) : null);
    }

    function form() {
      var c = st.cfg, fd = c.fullDay, isFull = st.tab === 'full';
      var el = h('form', { novalidate: '', 'aria-busy': st.busy ? 'true' : null, onsubmit: function (e) { e.preventDefault(); } });

      var tabs = h('div', { class: 'ra-bk__tabs', role: 'tablist', 'aria-label': S.tabsLabel });
      [['full', S.tabs.fullDay], ['single', S.tabs.single]].forEach(function (p) {
        tabs.appendChild(h('button', { class: 'ra-bk__tab', type: 'button', role: 'tab', id: 'ra-bk-tab-' + p[0], 'aria-selected': String(st.tab === p[0]), tabindex: st.tab === p[0] ? '0' : '-1',
          text: p[1], onclick: function () { switchTab(p[0]); },
          onkeydown: function (ev) { if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); switchTab(st.tab === 'full' ? 'single' : 'full'); } } }));
      });
      el.appendChild(tabs);

      var panel = h('div', { role: 'tabpanel', 'aria-labelledby': 'ra-bk-tab-' + st.tab });
      if (isFull) {
        panel.appendChild(h('p', { class: 'ra-bk__count', 'aria-live': 'polite',
          text: fd.full ? (fd.waiting ? t(S.count.full, { waiting: fd.waiting }) : S.count.fullNoQueue) : t(S.count.spots, { n: fd.left, cap: fd.capacity }) }));
      } else {
        var fs = h('fieldset', { 'aria-describedby': st.errors.sessions ? 'ra-bk-sessions-err' : null }, h('legend', { text: S.single.intro }));
        c.sessions.forEach(function (s) {
          var off = s.full && !s.waitlist;
          fs.appendChild(h('label', { class: 'ra-bk__tick', for: 'ra-bk-s-' + s.key },
            h('input', { type: 'checkbox', id: 'ra-bk-s-' + s.key, checked: st.f.sessions[s.key] ? true : null, disabled: off ? true : null,
              onchange: function (ev) { st.f.sessions[s.key] = ev.target.checked; if (st.errors.sessions) { delete st.errors.sessions; var m = document.getElementById('ra-bk-sessions-err'); if (m) m.remove(); } } }),
            h('span', null, s.label, h('small', { text: s.time }), s.full ? h('small', { class: 'ra-bk__tag', text: S.single.full }) : null)));
        });
        if (st.errors.sessions) fs.appendChild(h('p', { class: 'ra-bk__err', id: 'ra-bk-sessions-err', text: st.errors.sessions }));
        panel.appendChild(fs);
      }
      el.appendChild(panel);

      if (st.alert) el.appendChild(h('p', { class: 'ra-bk__alert', role: 'alert', text: st.alert }));
      el.appendChild(field('name', 'name', S.fields.name, 'text', 'name'));
      el.appendChild(field('email', 'email', S.fields.email, 'email', 'email'));
      el.appendChild(field('whatsapp', 'whatsapp', S.fields.whatsapp, 'tel', 'tel', S.fields.whatsappHint));
      el.appendChild(h('div', { class: 'ra-bk__hp', 'aria-hidden': 'true' }, h('label', { for: 'ra-bk-website', text: 'Website' }), h('input', { id: 'ra-bk-website', name: 'website', type: 'text', tabindex: '-1', autocomplete: 'off', value: '' })));
      if (siteKey) el.appendChild(h('div', { id: 'ra-bk-turnstile' }));

      var needTick = isFull && !fd.full;
      if (needTick) {
        el.appendChild(h('label', { class: 'ra-bk__tick', for: 'ra-bk-whole' },
          h('input', { type: 'checkbox', id: 'ra-bk-whole', checked: st.f.whole ? true : null, 'aria-describedby': 'ra-bk-whole-hint',
            onchange: function (ev) { st.f.whole = ev.target.checked; syncButtons(); } }),
          h('span', { text: S.wholeDay.tick })));
        el.appendChild(h('p', { class: 'ra-bk__hint', id: 'ra-bk-whole-hint', hidden: st.f.whole ? '' : null, text: S.wholeDay.hint }));
      }

      var label = function (txt) { return st.busy ? S.buttons.sending : txt; };
      if (isFull && fd.full) {
        el.appendChild(h('div', { class: 'ra-bk__stack' },
          h('button', { class: 'ra-bk__btn ra-bk__btn--pri ra-bk__btn--block', type: 'button', disabled: st.busy ? true : null, text: label(S.buttons.waitlist), onclick: function () { submit('free'); } }),
          h('button', { class: 'ra-bk__link', type: 'button', text: S.buttons.orSingle, onclick: function () { switchTab('single'); } })));
      } else {
        var off = needTick && !st.f.whole;
        el.appendChild(h('div', { class: 'ra-bk__btns' },
          h('button', { class: 'ra-bk__btn ra-bk__btn--sec', type: 'button', id: 'ra-bk-free', disabled: off || st.busy ? true : null, text: label(S.buttons.free), onclick: function () { submit('free'); } }),
          h('button', { class: 'ra-bk__btn ra-bk__btn--pri', type: 'button', id: 'ra-bk-donate', disabled: off || st.busy ? true : null, text: label(t(S.buttons.donate)), onclick: function () { submit('donate'); } })));
      }
      if (siteKey) renderTurnstile();
      return el;
    }
    function syncButtons() {
      var off = !st.f.whole;
      ['ra-bk-free', 'ra-bk-donate'].forEach(function (id) { var b = document.getElementById(id); if (b) b.disabled = off; });
      var hint = document.getElementById('ra-bk-whole-hint'); if (hint) hint.hidden = !off;
    }
    function switchTab(tab) {
      if (st.tab === tab) return;
      st.tab = tab; st.errors = {}; st.alert = null; st.focus = '#ra-bk-tab-' + tab; render();
      push('ra_bk_tab_change', { tab: tab === 'full' ? 'full_day' : 'single_sessions' });
    }

    // ---------- Turnstile (optional, proposed) ----------
    function renderTurnstile() {
      function draw() { var box = document.getElementById('ra-bk-turnstile'); if (box && window.turnstile && !box.hasChildNodes()) window.turnstile.render(box, { sitekey: siteKey, callback: function (tok) { st.token = tok; }, 'expired-callback': function () { st.token = ''; } }); }
      if (window.turnstile) return draw();
      if (!document.getElementById('ra-bk-ts')) { var s = document.createElement('script'); s.id = 'ra-bk-ts'; s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = draw; document.head.appendChild(s); }
    }

    // ---------- submit ----------
    function showErrors(keys) {
      render();
      var first = ['sessions', 'name', 'email', 'whatsapp'].filter(function (k) { return keys.indexOf(k) > -1; })[0];
      var target = first === 'sessions' ? root.querySelector('fieldset input') : root.querySelector('#ra-bk-' + first);
      if (target) target.focus();
    }
    function submit(intent) {
      if (st.busy) return;
      var tab = st.tab, bad = validate(tab); /* the waitlist button has no whole-day tick: see docs/decisions.md */
      if (bad.length) { showErrors(bad); return; }
      var hp = (document.getElementById('ra-bk-website') || {}).value || '';
      var body = { type: tab === 'full' ? 'full-day' : 'single', sessions: tab === 'single' ? chosen() : undefined, name: st.f.name, email: st.f.email, whatsapp: st.f.whatsapp,
        wholeDay: tab === 'full' ? (st.cfg.fullDay.full ? true : st.f.whole) : undefined, intent: intent, website: hp, turnstileToken: st.token || undefined };
      // The same key for the same details: a double click or a retry never books twice.
      var sig = JSON.stringify([body.type, body.sessions, body.name, body.email, body.whatsapp, body.intent]);
      if (st.idemSig !== sig) { st.idemSig = sig; st.idem = uuid(); }
      st.busy = true; st.alert = null; render();
      push('ra_bk_form_submit', { booking_type: body.type === 'full-day' ? 'full_day' : 'single_sessions', intent: intent });
      request('POST', '/book', body, st.idem).then(function (r) { st.busy = false; onBooked(r, body, intent); })
        .catch(function () { st.busy = false; st.alert = S.errors.network; push('ra_bk_error', { code: 'network' }); render(); });
    }
    function onBooked(r, body, intent) {
      var b = r.body || {};
      if (r.status === 201 || r.status === 200) {
        st.res = b; st.idem = null; st.idemSig = null;
        var kind = body.type === 'full-day' ? 'full_day' : 'single_sessions';
        if (b.status === 'waitlisted' || b.status === 'partial') push('ra_bk_waitlist_join', { booking_type: kind });
        if (b.status === 'booked' || b.status === 'partial') push('ra_bk_free_booking', { booking_type: kind, sessions_count: b.items ? b.items.length : 1 });
        if (b.status === 'waitlisted' || b.status === 'partial') return go('waitlisted');
        return go(b.next === 'amount' ? 'amount' : 'thanks');
      }
      var code = b.error || 'server';
      if (code === 'validation') {
        var e = {}, fields = b.fields || {};
        Object.keys(fields).forEach(function (k) { if (S.errors[fields[k]]) e[k] = S.errors[fields[k]]; });
        st.errors = e; if (e.wholeDay || !Object.keys(e).length) st.alert = S.errors.server;
        return showErrors(Object.keys(e));
      }
      if (code === 'closed') { st.alert = null; return loadConfig().then(function () { go('closed'); }).catch(function () { go('fatal'); }); }
      push('ra_bk_error', { code: code });
      st.alert = S.errors[code] || S.errors.server;
      loadConfig().then(render, render);
    }

    // ---------- amount step ----------
    function amountBand() { var c = st.cfg.contributions, i = c.suggestedAmounts.indexOf(st.f.amount); return i > -1 ? 'suggested_' + (i + 1) : 'other'; }
    function amountValue() { return st.f.amount === 'other' ? parseInt(String(st.f.custom).replace(/[^0-9]/g, ''), 10) || 0 : st.f.amount; }
    function amountStep() {
      var c = st.cfg.contributions;
      var wrap = h('div');
      wrap.appendChild(h('div', { class: 'ra-bk__done' }, h('span', { class: 'ra-bk__rule', 'aria-hidden': 'true' }),
        h('h3', { class: 'ra-bk__h', tabindex: '-1', text: t(S.amount.title) }), h('p', { text: S.amount.intro }),
        c.recipientLine ? h('p', { text: c.recipientLine }) : null, c.refundWording ? h('p', { class: 'ra-bk__hint', text: c.refundWording }) : null));
      var grp = h('div', { class: 'ra-bk__amounts', role: 'group', 'aria-label': S.amount.intro });
      c.suggestedAmounts.concat(['other']).forEach(function (a) {
        grp.appendChild(h('button', { class: 'ra-bk__amt', type: 'button', 'aria-pressed': String(st.f.amount === a), text: a === 'other' ? S.amount.other : c.currency + ' ' + money(a),
          onclick: function () { st.f.amount = a; delete st.errors.amount; st.focus = a === 'other' ? '#ra-bk-custom' : null; render(); } }));
      });
      wrap.appendChild(grp);
      if (st.f.amount === 'other') {
        var err = st.errors.amount;
        wrap.appendChild(h('div', { class: 'ra-bk__field' }, h('label', { for: 'ra-bk-custom', text: t(S.amount.otherLabel) }),
          h('input', { id: 'ra-bk-custom', type: 'text', inputmode: 'numeric', value: st.f.custom, 'aria-invalid': err ? 'true' : null, 'aria-describedby': err ? 'ra-bk-custom-err' : null,
            oninput: function (ev) { st.f.custom = ev.target.value; } }),
          err ? h('p', { class: 'ra-bk__err', id: 'ra-bk-custom-err', text: err }) : null));
      }
      if (st.alert) wrap.appendChild(h('p', { class: 'ra-bk__alert', role: 'alert', text: st.alert }));
      wrap.appendChild(h('p', { class: 'ra-bk__hint', text: S.amount.note }));
      wrap.appendChild(h('div', { class: 'ra-bk__stack' },
        h('button', { class: 'ra-bk__btn ra-bk__btn--pri ra-bk__btn--block', type: 'button', disabled: st.busy ? true : null, text: st.busy ? S.buttons.sending : S.buttons.pay, onclick: pay }),
        h('button', { class: 'ra-bk__link', type: 'button', text: S.buttons.skip, onclick: function () { go('thanks'); } })));
      return wrap;
    }
    function pay() {
      if (st.busy) return;
      var c = st.cfg.contributions, amt = amountValue();
      if (st.f.amount == null || amt < c.minimum) { st.errors.amount = t(S.errors.amount); st.f.amount = st.f.amount == null ? 'other' : st.f.amount; st.focus = '#ra-bk-custom'; return render(); }
      st.busy = true; st.alert = null; render();
      if (!st.payKey || st.payAmt !== amt) { st.payKey = uuid(); st.payAmt = amt; }
      request('POST', '/contribute', { bookingRef: st.res.bookingRef, amount: amt }, st.payKey).then(function (r) {
        st.busy = false;
        if (r.status !== 200 || !r.body.checkoutUrl) { st.alert = S.errors[r.body.error] || S.errors.server; push('ra_bk_error', { code: r.body.error || 'server' }); return render(); }
        push('ra_bk_donation_start', { amount_band: amountBand() });
        st.checkoutUrl = r.body.checkoutUrl; go('handoff');
        window.location.assign(r.body.checkoutUrl);
      }).catch(function () { st.busy = false; st.alert = S.errors.network; render(); });
    }
    function handoff() {
      return h('div', { class: 'ra-bk__done', role: 'status' }, h('span', { class: 'ra-bk__rule', 'aria-hidden': 'true' }),
        h('h3', { class: 'ra-bk__h', tabindex: '-1', text: S.amount.handoff }),
        h('a', { class: 'ra-bk__btn ra-bk__btn--pri', href: st.checkoutUrl || '#', text: S.amount.handoffLink }));
    }

    // ---------- result views ----------
    function again() { return h('button', { class: 'ra-bk__link', type: 'button', text: S.buttons.again, onclick: function () { st.res = null; st.f = { name: '', email: '', whatsapp: '', whole: false, sessions: {}, amount: null, custom: '' }; st.errors = {}; go('form'); } }); }
    function itemList() {
      var ul = h('ul'); (st.res.items || []).forEach(function (i) { ul.appendChild(h('li', null, i.label, ' ', h('span', { class: 'ra-bk__tag', text: i.status === 'booked' ? S.waitlisted.booked : S.waitlisted.waitlist }))); }); return ul;
    }
    function thanks() {
      var r = st.res || { items: [] }, c = st.cfg, full = r.items.length === 1 && r.items[0].key === 'full-day';
      var names = r.items.map(function (i) { return i.label; }).join(', ');
      return h('div', null, h('div', { class: 'ra-bk__done', role: 'status' }, h('span', { class: 'ra-bk__rule', 'aria-hidden': 'true' }),
        h('h3', { class: 'ra-bk__h', tabindex: '-1', text: t(S.thanks.free) }),
        h('p', { text: full ? t(S.thanks.fullDay) : t(S.thanks.sessions, { list: names }) }),
        h('p', { text: t(S.thanks.email) }),
        full ? h('p', { text: t(S.thanks.reconfirm) }) : null), again());
    }
    function paid(kept) {
      return h('div', null, h('div', { class: 'ra-bk__done', role: 'status' }, h('span', { class: 'ra-bk__rule', 'aria-hidden': 'true' }),
        h('h3', { class: 'ra-bk__h', tabindex: '-1', text: kept ? S.thanks.kept : t(S.thanks.paid) }), kept ? null : h('p', { text: S.thanks.paidBody })));
    }
    function waitlisted() {
      var r = st.res, partial = r.status === 'partial';
      return h('div', null, h('div', { class: 'ra-bk__done', role: 'status' }, h('span', { class: 'ra-bk__rule', 'aria-hidden': 'true' }),
        h('h3', { class: 'ra-bk__h', tabindex: '-1', text: t(S.waitlisted.title) }),
        partial ? h('p', { text: S.waitlisted.partial }) : null, partial || (r.items || []).length > 1 ? itemList() : null,
        h('p', { text: t(S.waitlisted.body) })),
        h('button', { class: 'ra-bk__link', type: 'button', text: S.buttons.bookSingle, onclick: function () { st.tab = 'single'; go('form', '#ra-bk-tab-single'); } }), again());
    }

    // ---------- start ----------
    function start() {
      st.view = 'loading'; render();
      (preview ? Promise.resolve(opts.sample || SAMPLE) : loadConfig()).then(function (c) {
        st.cfg = c;
        var m = /[?&]ra=(paid|cancelled)/.exec(window.location.search || '');
        if (m && !preview) {
          try { window.history.replaceState(null, '', window.location.pathname + window.location.search.replace(/[?&]ra=(paid|cancelled)/, '').replace(/^&/, '?') + window.location.hash); } catch (e) { /* ignore */ }
          if (m[1] === 'paid') { push('ra_bk_donation_paid'); return go('paid'); }
          return go('kept');
        }
        if (!c.bookingOpen) return go('closed');
        go('form');
      }).catch(function () { go('fatal'); });
    }

    if (preview) { st.cfg = opts.sample || SAMPLE; st.res = { firstName: 'Ayu', bookingRef: 'preview', items: [{ key: 'full-day', label: 'Full Day', status: 'booked' }], status: 'booked' }; }
    return { start: start, state: st, go: go, render: render };
  }

  // Static previews for the local demo page: every widget state with sample data, no API.
  function previewState(root, name) {
    var m = mount(root, { preview: true }), st = m.state, sample = JSON.parse(JSON.stringify(SAMPLE));
    st.f.name = 'Ayu Lestari'; st.f.email = 'ayu@example.com'; st.f.whatsapp = '+62 812 3456 7890';
    var wait = { status: 'waitlisted', firstName: 'Ayu', bookingRef: 'preview', items: [{ key: 'full-day', label: 'Full Day', status: 'waitlisted' }] };
    var sing = { status: 'booked', firstName: 'Ayu', bookingRef: 'preview', items: [{ key: 'demo-a', label: 'Demo session A', status: 'booked' }, { key: 'demo-b', label: 'Demo session B', status: 'booked' }] };
    switch (name) {
      case 'form': st.view = 'form'; break;
      case 'form-errors': st.view = 'form'; st.f.name = ''; st.f.email = 'ayu@'; st.f.whatsapp = '0812'; st.errors = { name: S.errors.name, email: S.errors.email, whatsapp: S.errors.whatsapp }; break;
      case 'single': st.view = 'form'; st.tab = 'single'; st.f.sessions = { 'demo-a': true }; break;
      case 'full': sample.fullDay = { capacity: 50, booked: 50, left: 0, waiting: 6, full: true }; st.view = 'form'; break;
      case 'closed': sample.bookingOpen = false; st.view = 'closed'; break;
      case 'amount': st.view = 'amount'; st.f.amount = 250000; break;
      case 'handoff': st.view = 'handoff'; st.checkoutUrl = '/mock-stripe.html'; break;
      case 'thanks': st.view = 'thanks'; break;
      case 'thanks-sessions': st.view = 'thanks'; st.res = sing; break;
      case 'paid': st.view = 'paid'; break;
      case 'kept': st.view = 'kept'; break;
      case 'waitlisted': st.view = 'waitlisted'; st.res = wait; break;
      case 'partial': st.view = 'waitlisted'; st.res = { status: 'partial', firstName: 'Ayu', bookingRef: 'preview', items: [{ key: 'demo-a', label: 'Demo session A', status: 'booked' }, { key: 'demo-c', label: 'Demo session C', status: 'waitlisted' }] }; break;
      case 'error-network': st.view = 'form'; st.alert = S.errors.network; break;
      case 'error-rate': st.view = 'form'; st.alert = S.errors.rate_limited; break;
      case 'fatal': st.view = 'fatal'; break;
    }
    st.cfg = sample; m.render();
    return m;
  }

  window.RABooking = { mount: function (root, opts) { var m = mount(root, opts); m.start(); return m; }, preview: previewState };

  function auto() { var r = document.getElementById('ra-booking'); if (r && !r.getAttribute('data-manual')) window.RABooking.mount(r); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();

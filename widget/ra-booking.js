/* RA anniversary booking widget. DRAFT SKELETON.
   Embed on Squarespace (Business plan or higher) with:
     <div id="ra-booking" data-api="https://<netlify-site>/api"></div>
     <link rel="stylesheet" href="https://<netlify-site>/ra-booking.css">
     <script src="https://<netlify-site>/ra-booking.js" defer></script>
   Renders the Full Day tab with the live counter and the whole-day tick.
   Single sessions, the amount step, Stripe handoff, waitlist, thank-you and the
   reconfirm page are listed in README > Build plan and still to build. */
(function () {
  var root = document.getElementById('ra-booking');
  if (!root) return;
  var api = root.getAttribute('data-api') || '/api';
  root.classList.add('ra-bk');

  function push(event, data) { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: event }, data || {})); }

  root.innerHTML =
    '<div class="ra-bk__tabs" role="tablist" aria-label="Booking type">' +
      '<button class="ra-bk__tab" role="tab" aria-selected="true" id="ra-bk-t-full">Full Day</button>' +
      '<button class="ra-bk__tab" role="tab" aria-selected="false" id="ra-bk-t-single">Single sessions</button>' +
    '</div>' +
    '<p class="ra-bk__count" id="ra-bk-count" aria-live="polite">Checking places</p>' +
    '<div class="ra-bk__field"><label for="ra-bk-name">Full name</label><input id="ra-bk-name" autocomplete="name"></div>' +
    '<div class="ra-bk__field"><label for="ra-bk-email">Email</label><input id="ra-bk-email" type="email" autocomplete="email"></div>' +
    '<div class="ra-bk__field"><label for="ra-bk-wa">WhatsApp, with country code</label><input id="ra-bk-wa" type="tel" autocomplete="tel"></div>' +
    '<label class="ra-bk__tick" for="ra-bk-whole"><input type="checkbox" id="ra-bk-whole"><span>I’m joining for the whole day</span></label>' +
    '<div class="ra-bk__btns">' +
      '<button class="ra-bk__btn ra-bk__btn--sec" id="ra-bk-free" disabled>Join for Free</button>' +
      '<button class="ra-bk__btn ra-bk__btn--pri" id="ra-bk-donate" disabled>Join with Donation</button>' +
    '</div>';

  var whole = root.querySelector('#ra-bk-whole');
  whole.addEventListener('change', function () {
    root.querySelector('#ra-bk-free').disabled = !whole.checked;
    root.querySelector('#ra-bk-donate').disabled = !whole.checked;
  });
  root.querySelector('#ra-bk-t-single').addEventListener('click', function () { push('ra_anniv_tab', { tab: 'single' }); /* TODO */ });

  fetch(api + '/spots').then(function (r) { return r.json(); }).then(function (d) {
    var s = d.fullDay || {};
    root.querySelector('#ra-bk-count').textContent = s.capped ? (s.left + ' of ' + s.capacity + ' places left') : '';
  }).catch(function () { root.querySelector('#ra-bk-count').textContent = ''; });
})();

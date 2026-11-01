/* Kelle Nails Design — lógica do site público */
(function () {
  'use strict';
  var cfg = window.KN_CONFIG || {};
  var I18N = window.KN_I18N;
  var params = new URLSearchParams(location.search);
  var DEMO = cfg.DEMO === true || params.get('demo') === '1';
  var API_ON = !!cfg.API_URL && !DEMO;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- Idioma ---------------- */
  var lang = params.get('lang') || safeGet('kn_lang') || 'pt';
  if (!I18N[lang]) lang = 'pt';
  function t(k) { return (I18N[lang] && I18N[lang][k]) || I18N.pt[k] || k; }
  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function applyLang() {
    document.documentElement.lang = lang === 'en' ? 'en-GB' : 'pt-BR';
    $$('[data-i18n]').forEach(function (el) {
      if (el.hasAttribute('data-animate')) return;
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    $$('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var p = pair.split(':'); el.setAttribute(p[0], t(p[1]));
      });
    });
    document.title = t('meta.title');
    $$('.lang-opt').forEach(function (o) { o.classList.toggle('on', o.getAttribute('data-l') === lang); });
    animateQuote();
    if (state.days) renderCalendar();
    renderTimes(); updateSummary(); renderPublic();
    if (!API_ON && !DEMO) setStatus(offlineHtml());
  }
  function switchLang() {
    lang = lang === 'pt' ? 'en' : 'pt';
    safeSet('kn_lang', lang);
    var u = new URL(location.href); u.searchParams.delete('lang'); history.replaceState(null, '', u);
    applyLang();
  }

  function animateQuote() {
    var el = $('#heroQuote'); if (!el) return;
    el.textContent = '';
    t('hero.quote').split(' ').forEach(function (word, i) {
      var s = document.createElement('span');
      s.className = 'w'; s.textContent = word;
      s.style.animationDelay = (0.35 + i * 0.075) + 's';
      el.appendChild(s); el.appendChild(document.createTextNode(' '));
    });
    el.setAttribute('aria-label', t('hero.quote'));
  }

  /* ---------------- Imagens em falta ---------------- */
  function handleImages() {
    $$('img[data-fallback], img[data-hide-missing]').forEach(function (img) {
      function missing() {
        img.hidden = true;
        var fb = img.getAttribute('data-fallback');
        if (fb) $('#' + fb).hidden = false;
        // sem fotografia da profissional: mostra a imagem dourada da marca e esconde a etiqueta
        if (fb === 'portraitBrand') { var tag = $('.portrait-tag'); if (tag) tag.hidden = true; }
      }
      if (img.complete && img.naturalWidth === 0) missing();
      else img.addEventListener('error', missing);
    });
  }

  /* ---------------- Datas (Europe/London) ---------------- */
  function todayLondon() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function ymd(y, m, d) { return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
  function dateObj(s) { var p = s.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)); }
  function fmtDate(s, opts) {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'pt-BR', Object.assign({ timeZone: 'UTC' }, opts)).format(dateObj(s));
  }

  /* ---------------- API ---------------- */
  function apiGet(action) {
    if (DEMO) return Promise.resolve(mock.get(action));
    return fetch(cfg.API_URL + '?action=' + encodeURIComponent(action), { cache: 'no-store' }).then(function (r) { return r.json(); });
  }
  function apiPost(body) {
    if (DEMO) return Promise.resolve(mock.post(body));
    // text/plain evita o "preflight" CORS — necessário para o Google Apps Script
    return fetch(cfg.API_URL, { method: 'POST', body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }

  /* Demonstração local: horários de EXEMPLO, nada é guardado nem enviado. */
  var mock = (function () {
    var taken = {};
    var sample = { 2: ['10:00', '13:00', '16:00'], 3: ['10:00', '13:00', '16:00'], 4: ['10:00', '13:00', '16:00'], 5: ['10:00', '13:00'], 6: ['10:00', '13:00'] };
    function days() {
      var out = {}, start = dateObj(todayLondon());
      for (var i = 1; i <= 60; i++) {
        var d = new Date(start.getTime() + i * 864e5);
        var key = ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        var free = (sample[d.getUTCDay()] || []).filter(function (h) { return !taken[key + ' ' + h]; });
        if (free.length) out[key] = free;
      }
      return out;
    }
    return {
      get: function (a) { return a === 'slots' ? { ok: true, days: days() } : { ok: true, reviews: [], photos: [] }; },
      post: function (b) {
        if (b.action !== 'book') return { ok: false, error: 'offline' };
        if ((days()[b.date] || []).indexOf(b.time) === -1) return { ok: false, error: 'slot_unavailable' };
        taken[b.date + ' ' + b.time] = true;
        var code = 'KN-DEMO' + Math.floor(Math.random() * 90 + 10);
        return { ok: true, demo: true, code: code, waUrl: null, text: message(b, code) };
      }
    };
  })();
  function message(b, code) {
    var svc = t('services.' + b.service + '.full');
    var dmy = b.date.split('-').reverse().join('/');
    var L = lang === 'en'
      ? ['Hello! I would like to request an appointment at Kelle Nails Design.', 'Name', 'Service', 'Date', 'Time', 'Referred by', 'Request code']
      : ['Olá! Gostaria de solicitar um agendamento na Kelle Nails Design.', 'Nome', 'Serviço', 'Data', 'Horário', 'Indicada por', 'Código do pedido'];
    return L[0] + '\n• ' + L[1] + ': ' + b.name + '\n• WhatsApp: ' + b.whatsapp + '\n• ' + L[2] + ': ' + svc +
      '\n• ' + L[3] + ': ' + dmy + '\n• ' + L[4] + ': ' + b.time + (b.referral ? '\n• ' + L[5] + ': ' + b.referral : '') + '\n• ' + L[6] + ': ' + code;
  }

  /* ---------------- Agendamento ---------------- */
  var state = { service: null, date: null, time: null, days: null, view: null, pub: { reviews: [], photos: [] } };
  var form = $('#bookingForm');

  function setStatus(html) { $('#bookingStatus').innerHTML = html || ''; }
  function offlineHtml() {
    return '<p style="margin:0">' + esc(t('book.offline')) + '</p><a class="btn btn-gold js-wa" target="_blank" rel="noopener" href="' + esc(cfg.WHATSAPP_LINK) + '">' + esc(t('btn.whatsapp')) + '</a>';
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function loadSlots() {
    if (!API_ON && !DEMO) { setStatus(offlineHtml()); $('#stepService').disabled = true; return Promise.resolve(); }
    setStatus('<p style="margin:0">' + esc(t('book.loading')) + '</p>');
    return apiGet('slots').then(function (res) {
      if (!res || !res.ok) throw new Error('bad');
      state.days = res.days || {};
      var keys = Object.keys(state.days).sort();
      if (!keys.length) { setStatus('<p style="margin:0">' + esc(t('book.noSlots')) + '</p><a class="btn btn-gold" target="_blank" rel="noopener" href="' + esc(cfg.WHATSAPP_LINK) + '">WhatsApp</a>'); }
      else setStatus('');
      if (state.date && !state.days[state.date]) { state.date = null; state.time = null; }
      if (!state.view) { var f = keys[0] || todayLondon(); state.view = { y: +f.slice(0, 4), m: +f.slice(5, 7) - 1 }; }
      syncSteps(); renderCalendar(); renderTimes();
    }).catch(function () {
      setStatus('<p style="margin:0">' + esc(t('book.error')) + '</p><button type="button" class="btn btn-line" id="retrySlots">' + esc(t('book.retry')) + '</button>');
      var b = $('#retrySlots'); if (b) b.addEventListener('click', loadSlots);
    });
  }

  function syncSteps() {
    var hasDays = state.days && Object.keys(state.days).length > 0;
    $('#stepDate').disabled = !(state.service && hasDays);
    $('#stepTime').disabled = !(state.service && state.date);
    $('#stepDetails').disabled = !(state.service && state.date && state.time);
    updateSummary();
  }

  function renderCalendar() {
    var grid = $('#calGrid'); if (!grid || !state.view) return;
    var y = state.view.y, m = state.view.m;
    var loc = lang === 'en' ? 'en-GB' : 'pt-BR';
    var title = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m, 15)));
    $('#calTitle').textContent = title.charAt(0).toUpperCase() + title.slice(1);
    grid.innerHTML = '';
    // semana começa na segunda-feira (padrão do Reino Unido)
    for (var i = 0; i < 7; i++) {
      var h = document.createElement('div'); h.className = 'cal-dow';
      h.textContent = new Intl.DateTimeFormat(loc, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i))).replace('.', '');
      grid.appendChild(h);
    }
    var first = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
    var total = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (var e = 0; e < first; e++) grid.appendChild(document.createElement('span'));
    var today = todayLondon();
    for (var d = 1; d <= total; d++) {
      var key = ymd(y, m, d);
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cal-day'; b.textContent = d; b.dataset.date = key;
      var avail = !!(state.days && state.days[key]);
      if (avail) { b.classList.add('avail'); b.setAttribute('aria-label', fmtDate(key, { weekday: 'long', day: 'numeric', month: 'long' }) + ' — ' + t('book.available')); }
      else { b.disabled = true; b.setAttribute('aria-label', fmtDate(key, { day: 'numeric', month: 'long' })); }
      if (key === today) b.classList.add('today');
      if (key === state.date) { b.classList.add('sel'); b.setAttribute('aria-pressed', 'true'); }
      grid.appendChild(b);
    }
    var keys = Object.keys(state.days || {}).sort();
    var minYm = today.slice(0, 7), maxYm = (keys[keys.length - 1] || today).slice(0, 7), cur = ymd(y, m, 1).slice(0, 7);
    $('#calPrev').disabled = cur <= minYm;
    $('#calNext').disabled = cur >= maxYm;
  }

  function renderTimes() {
    var box = $('#times'); if (!box) return;
    box.innerHTML = '';
    if (!state.date || !state.days || !state.days[state.date]) {
      var p = document.createElement('p'); p.className = 'hint'; p.textContent = t('book.pickDate'); box.appendChild(p); return;
    }
    state.days[state.date].forEach(function (time) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'time'; b.textContent = time; b.dataset.time = time;
      b.setAttribute('aria-pressed', String(time === state.time));
      box.appendChild(b);
    });
  }

  function updateSummary() {
    var box = $('#summary'); if (!box) return;
    if (!(state.service && state.date && state.time)) { box.hidden = true; return; }
    box.hidden = false;
    $('#summaryText').textContent = t('services.' + state.service + '.full') + ' · ' +
      fmtDate(state.date, { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + state.time;
  }

  function initBooking() {
    $$('input[name="service"]', form).forEach(function (r) {
      r.addEventListener('change', function () { state.service = r.value; syncSteps(); });
    });
    $$('.js-pick').forEach(function (a) {
      a.addEventListener('click', function () {
        var r = $('input[name="service"][value="' + a.dataset.service + '"]', form);
        if (r && !$('#stepService').disabled) { r.checked = true; state.service = r.value; syncSteps(); }
      });
    });
    $('#calGrid').addEventListener('click', function (e) {
      var b = e.target.closest('.cal-day.avail'); if (!b) return;
      state.date = b.dataset.date; state.time = null;
      renderCalendar(); renderTimes(); syncSteps();
      var first = $('#times .time'); if (first) first.focus({ preventScroll: true });
    });
    $('#calPrev').addEventListener('click', function () { moveMonth(-1); });
    $('#calNext').addEventListener('click', function () { moveMonth(1); });
    $('#times').addEventListener('click', function (e) {
      var b = e.target.closest('.time'); if (!b) return;
      state.time = b.dataset.time; renderTimes(); syncSteps();
    });
    form.addEventListener('submit', submitBooking);
    $('#again').addEventListener('click', function () {
      form.reset(); state.service = state.date = state.time = null;
      $('#result').hidden = true; form.hidden = false; syncSteps(); loadSlots();
      $('#agendar').scrollIntoView();
    });
    $('#copyMsg').addEventListener('click', function () {
      copy($('#resultText').textContent).then(function () { $('#copyMsg').textContent = t('book.copied'); });
    });
  }
  function moveMonth(n) {
    var d = new Date(Date.UTC(state.view.y, state.view.m + n, 1));
    state.view = { y: d.getUTCFullYear(), m: d.getUTCMonth() }; renderCalendar();
  }

  function submitBooking(e) {
    e.preventDefault();
    var err = $('#formError'); err.textContent = '';
    var fd = new FormData(form);
    var name = String(fd.get('name') || '').trim();
    var wa = String(fd.get('whatsapp') || '').trim();
    var digits = wa.replace(/\D/g, '');
    form.elements.name.setAttribute('aria-invalid', String(name.length < 2));
    form.elements.whatsapp.setAttribute('aria-invalid', String(digits.length < 8 || digits.length > 15));
    if (!state.service) return (err.textContent = t('book.pickService'));
    if (!state.date) return (err.textContent = t('book.pickDate'));
    if (!state.time) return (err.textContent = t('book.pickTime'));
    if (name.length < 2) return (err.textContent = t('err.invalid_name'));
    if (digits.length < 8 || digits.length > 15) return (err.textContent = t('err.invalid_phone'));
    if (!fd.get('acceptTerms')) return (err.textContent = t('err.terms_required'));

    var btn = $('#submitBtn'); btn.disabled = true; btn.textContent = t('book.sending');
    var body = {
      action: 'book', service: state.service, date: state.date, time: state.time, name: name, whatsapp: wa,
      referral: String(fd.get('referral') || '').trim(), photoConsent: !!fd.get('photoConsent'),
      acceptTerms: true, website: String(fd.get('website') || ''), lang: lang
    };
    apiPost(body).then(function (res) {
      if (!res || !res.ok) {
        var code = (res && res.error) || 'generic';
        err.textContent = I18N[lang]['err.' + code] ? t('err.' + code) : t('err.generic');
        if (code === 'slot_unavailable') { state.time = null; loadSlots(); }
        return;
      }
      showResult(res, body);
    }).catch(function () { err.textContent = t('err.generic'); })
      .then(function () { btn.disabled = false; btn.textContent = t('book.submit'); });
  }

  function showResult(res) {
    form.hidden = true;
    var r = $('#result'); r.hidden = false;
    $('#resultCode').textContent = res.code;
    $('#resultDemo').hidden = !res.demo;
    var wa = $('#resultWa');
    if (res.waUrl) { wa.href = res.waUrl; wa.hidden = false; $('#resultManual').hidden = true; }
    else {
      wa.hidden = true; $('#resultManual').hidden = false;
      $('#resultText').textContent = res.text || '';
      $('#copyMsg').textContent = t('book.copy');
    }
    r.focus(); r.scrollIntoView({ block: 'start' });
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {}
    ta.remove(); return Promise.resolve();
  }

  /* ---------------- Galeria e avaliações ---------------- */
  function loadPublic() {
    if (!API_ON) { renderPublic(); return; }
    apiGet('public').then(function (res) { if (res && res.ok) { state.pub = res; renderPublic(); } }).catch(function () {});
  }
  function renderPublic() {
    var g = $('#gallery'), rv = $('#reviews'); if (!g) return;
    g.innerHTML = ''; rv.innerHTML = '';
    var weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    (state.pub.photos || []).forEach(function (p) {
      if (!/^https:\/\//.test(p.url)) return;
      var f = document.createElement('figure'); f.className = 'g-item';
      var img = document.createElement('img'); img.src = p.url; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
      img.alt = p.caption || 'Kelle Nails Design'; f.appendChild(img);
      if (p.date >= weekAgo) { var b = document.createElement('span'); b.className = 'g-badge'; b.textContent = t('gallery.week'); f.appendChild(b); }
      if (p.caption) { var c = document.createElement('figcaption'); c.textContent = p.caption; f.appendChild(c); }
      g.appendChild(f);
    });
    $('#galleryEmpty').hidden = g.children.length > 0;
    (state.pub.reviews || []).forEach(function (r) {
      var f = document.createElement('figure'); f.className = 'review';
      var s = document.createElement('div'); s.className = 'review-stars'; s.textContent = '★★★★★'.slice(0, r.rating) + '☆☆☆☆☆'.slice(0, 5 - r.rating);
      s.setAttribute('aria-label', r.rating + '/5');
      var q = document.createElement('blockquote'); q.textContent = '“' + r.text + '”';
      var c = document.createElement('figcaption');
      c.textContent = t('reviews.verified') + (r.month ? ' · ' + fmtDate(r.month + '-15', { month: 'long', year: 'numeric' }) : '');
      f.appendChild(s); f.appendChild(q); f.appendChild(c); rv.appendChild(f);
    });
    $('#reviewsEmpty').hidden = rv.children.length > 0;
  }

  function initSmallForms() {
    $('#reviewForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, msg = $('.form-msg', f); msg.className = 'form-msg'; msg.textContent = '';
      if (!API_ON) { msg.textContent = t('err.offline'); return; }
      var fd = new FormData(f);
      apiPost({ action: 'review', code: fd.get('code'), whatsapp: fd.get('whatsapp'), rating: Number(fd.get('rating')),
        text: fd.get('text'), allowPublish: !!fd.get('allowPublish') }).then(function (res) {
        if (res && res.ok) { msg.className = 'form-msg ok'; msg.textContent = t('reviews.ok'); f.reset(); }
        else msg.textContent = t('err.' + ((res && res.error) || 'generic'));
      }).catch(function () { msg.textContent = t('err.generic'); });
    });
    $('#consentForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, msg = $('.form-msg', f); msg.className = 'form-msg'; msg.textContent = '';
      if (!API_ON) { msg.textContent = t('err.offline'); return; }
      var give = e.submitter && e.submitter.value === 'give';
      var fd = new FormData(f);
      apiPost({ action: 'consent', code: fd.get('code'), whatsapp: fd.get('whatsapp'), consent: give }).then(function (res) {
        if (res && res.ok) { msg.className = 'form-msg ok'; msg.textContent = t(give ? 'privacy.okGive' : 'privacy.okWithdraw'); loadPublic(); }
        else msg.textContent = t('err.' + ((res && res.error) || 'generic'));
      }).catch(function () { msg.textContent = t('err.generic'); });
    });
    $('#shareBtn').addEventListener('click', function () {
      var url = location.origin + location.pathname;
      var data = { title: 'Kelle Nails Design', text: t('ref.shareText'), url: url };
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      copy(t('ref.shareText') + ' ' + url).then(function () {
        var b = $('#shareBtn'); b.textContent = t('ref.copied');
        setTimeout(function () { b.textContent = t('ref.share'); }, 2500);
      });
    });
  }

  /* ---------------- Abertura (luz da marca a acender) ---------------- */
  function initIntro() {
    var intro = $('#intro'); if (!intro) return;
    var seen = false;
    try { seen = sessionStorage.getItem('kn_intro') === '1'; } catch (e) {}
    var img = $('.intro-img', intro);
    if (seen || params.get('intro') === '0') { intro.remove(); return; }
    document.body.classList.add('intro-on');
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      try { sessionStorage.setItem('kn_intro', '1'); } catch (e) {}
      intro.classList.add('out'); document.body.classList.remove('intro-on');
      setTimeout(function () { intro.remove(); }, 1000);
    }
    // se a imagem não existir, não mostra a abertura
    function missing() { intro.remove(); document.body.classList.remove('intro-on'); }
    if (img.complete && img.naturalWidth === 0) return missing();
    img.addEventListener('error', missing);
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(close, reduce ? 1800 : 4600);
    intro.addEventListener('click', close);
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { close(); document.removeEventListener('keydown', onKey); }
    });
  }

  /* ---------------- Geral ---------------- */
  function initChrome() {
    $$('.js-wa').forEach(function (a) { a.href = cfg.WHATSAPP_LINK; });
    $$('.js-ig').forEach(function (a) { a.href = cfg.INSTAGRAM_LINK; });
    $('#langBtn').addEventListener('click', switchLang);
    var menu = $('#menuBtn'), nav = $('#nav');
    menu.addEventListener('click', function () {
      var open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open));
    });
    $$('a', nav).forEach(function (a) { a.addEventListener('click', function () { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }); });
    $('#year').textContent = new Date().getFullYear();
    $('#demoBanner').hidden = !DEMO;
  }

  initIntro();
  initChrome();
  handleImages();
  initBooking();
  initSmallForms();
  applyLang();
  loadSlots();
  loadPublic();
  window.KN_DEBUG = { state: state, isDemo: DEMO, apiOn: API_ON };
})();

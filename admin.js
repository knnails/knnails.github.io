/* Kelle Nails Design — painel privado da profissional */
(function () {
  'use strict';
  var cfg = window.KN_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var SVC = {fibra: 'Alongamento em fibra de vidro (mãos)', shellac: 'Aplicação de Shellac', francesinha: 'Francesinha', cut_maos: 'Cutilagem — mãos', cut_pes: 'Cutilagem — pés', cut_maos_pes: 'Cutilagem — mãos e pés'};
  var SVC_EN = {fibra: 'fibreglass nail extensions (hands)', shellac: 'Shellac application', francesinha: 'French tips', cut_maos: 'cuticle care — hands', cut_pes: 'cuticle care — feet', cut_maos_pes: 'cuticle care — hands and feet'};
  var STATUS = { pendente: 'Por confirmar', confirmada: 'Confirmada', concluida: 'Concluída', cancelada: 'Cancelada' };
  var ERR = {
    unauthorized: 'Palavra-passe incorreta.', locked: 'Demasiadas tentativas. Aguarde 15 minutos.',
    admin_not_configured: 'Defina ADMIN_PASSWORD nas propriedades do Google Apps Script.',
    slot_unavailable: 'Esse horário já está ocupado por outro pedido.', no_consent: 'A cliente não autorizou fotografias.',
    no_permission: 'A cliente não autorizou a publicação deste comentário.', invalid_time: 'Horário inválido: ',
    too_large: 'Fotografia demasiado grande.', invalid_file: 'Use JPG, PNG ou WebP.'
  };
  var pw = sessionStorage.getItem('kn_pw') || '';
  var data = null, filter = 'proximos';

  function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date()); }
  function dmy(s) { return s ? s.split('-').reverse().join('/') : ''; }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, 3000); }
  function errMsg(res) { var e = (res && res.error) || 'erro'; return (ERR[e] || 'Erro: ' + e) + (res && res.value ? res.value : ''); }

  function call(body) {
    if (!cfg.API_URL) return Promise.resolve({ ok: false, error: 'Configure API_URL em config.js' });
    body.password = pw;
    return fetch(cfg.API_URL, { method: 'POST', body: JSON.stringify(body) }).then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, error: 'sem ligação' }; });
  }
  function act(body, okMsg) {
    return call(body).then(function (res) {
      if (res.ok) { toast(okMsg || 'Guardado'); return load(); }
      if (res.error === 'unauthorized') logout();
      toast(errMsg(res));
    });
  }

  /* ---------- Login ---------- */
  $('#login').addEventListener('submit', function (e) {
    e.preventDefault(); pw = $('#pw').value; $('#loginErr').textContent = '';
    call({ action: 'adminPing' }).then(function (res) {
      if (!res.ok) { $('#loginErr').textContent = errMsg(res); return; }
      sessionStorage.setItem('kn_pw', pw); start();
    });
  });
  function logout() { sessionStorage.removeItem('kn_pw'); pw = ''; $('#app').hidden = true; $('#logout').hidden = true; $('#login').hidden = false; }
  $('#logout').addEventListener('click', logout);
  function start() { $('#login').hidden = true; $('#app').hidden = false; $('#logout').hidden = false; load(); }

  function load() {
    return call({ action: 'adminData' }).then(function (res) {
      if (!res.ok) { if (res.error === 'unauthorized') logout(); toast(errMsg(res)); return; }
      data = res; render();
    });
  }

  /* ---------- Tabs ---------- */
  $$('.tabs .tab').forEach(function (t) {
    t.addEventListener('click', function () {
      $$('.tabs .tab').forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
      $$('[data-pane]').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== t.dataset.tab; });
    });
  });
  $$('[data-filter]').forEach(function (t) {
    t.addEventListener('click', function () {
      filter = t.dataset.filter;
      $$('[data-filter]').forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
      renderBookings();
    });
  });

  function render() {
    var s = data.settings, w = $('#warnings'); w.innerHTML = '';
    if (!s.whatsapp) w.appendChild(el('p', { class: 'warn', text: 'WHATSAPP_NUMBER ainda não está definido: as clientes recebem a mensagem para copiar e colar, em vez de ir já preenchida.' }));
    if (!data.schedule.some(function (d) { return d.times; })) w.appendChild(el('p', { class: 'warn', text: 'Ainda não definiu horários: o site não mostra nenhuma data disponível. Abra o separador “Horários”.' }));
    $('#cPend').textContent = data.bookings.filter(function (b) { return b.status === 'pendente' && b.date >= today(); }).length || '';
    $('#cFotos').textContent = data.photos.filter(function (p) { return p.status === 'pendente'; }).length || '';
    $('#cRev').textContent = data.reviews.filter(function (r) { return r.status === 'pendente'; }).length || '';
    $('#cRef').textContent = data.bookings.filter(function (b) { return b.referral && b.status === 'concluida' && b.paid && !b.reward; }).length || '';
    renderBookings(); renderSchedule(); renderBlocks(); renderPhotos(); renderReviews(); renderReferrals();
  }

  function clientWa(b, kind) {
    var svc = b.lang === 'en' ? SVC_EN[b.service] : SVC[b.service];
    var msg;
    if (b.lang === 'en') {
      msg = kind === 'confirm'
        ? 'Hello ' + b.name + '! Your ' + svc + ' appointment on ' + dmy(b.date) + ' at ' + b.time + ' is confirmed. Address: '
        : kind === 'review' ? 'Hello ' + b.name + '! Thank you for coming. If you would like to leave a review, use code ' + b.code + ' on the website.'
        : 'Hello ' + b.name + ', unfortunately I can’t do ' + dmy(b.date) + ' at ' + b.time + '. Could we find another time?';
    } else {
      msg = kind === 'confirm'
        ? 'Olá ' + b.name + '! O seu horário de ' + svc + ' no dia ' + dmy(b.date) + ' às ' + b.time + ' está confirmado. Endereço: '
        : kind === 'review' ? 'Olá ' + b.name + '! Obrigada pela visita. Se quiser deixar uma avaliação, use o código ' + b.code + ' no site.'
        : 'Olá ' + b.name + ', infelizmente não consigo atender no dia ' + dmy(b.date) + ' às ' + b.time + '. Podemos marcar outro horário?';
    }
    return 'https://wa.me/' + b.whatsapp + '?text=' + encodeURIComponent(msg);
  }

  function renderBookings() {
    var box = $('#bookings'); box.innerHTML = '';
    var t = today();
    var list = data.bookings.filter(function (b) {
      if (filter === 'proximos') return b.date >= t && b.status !== 'cancelada';
      if (filter === 'pendente') return b.status === 'pendente' && b.date >= t;
      if (filter === 'passados') return b.date < t;
      return true;
    });
    if (filter === 'passados') list.reverse();
    if (!list.length) box.appendChild(el('p', { class: 'empty', text: 'Nenhum pedido aqui.' }));
    list.forEach(function (b) {
      var A = function (label, body, cls) { return el('button', { class: 'btn ' + (cls || 'btn-line'), text: label, onclick: function () { act(Object.assign({ action: 'adminUpdateBooking', id: b.id }, body)); } }); };
      var acts = [];
      if (b.status === 'pendente') acts.push(A('Confirmar', { status: 'confirmada' }, 'btn-gold'));
      if (b.status === 'confirmada') acts.push(A('Marcar concluída', { status: 'concluida' }, 'btn-gold'));
      if (b.status !== 'cancelada' && b.status !== 'concluida') acts.push(A('Cancelar', { status: 'cancelada' }));
      if (b.status === 'cancelada') acts.push(A('Reativar', { status: 'pendente' }));
      if (b.status === 'concluida') acts.push(A(b.paid ? 'Pago ✓ (desfazer)' : 'Marcar pago', { paid: !b.paid }, b.paid ? 'btn-line' : 'btn-gold'));
      acts.push(el('a', { class: 'btn btn-line', target: '_blank', rel: 'noopener', href: clientWa(b, 'confirm'), text: 'WhatsApp: confirmar' }));
      if (b.status === 'concluida') acts.push(el('a', { class: 'btn btn-line', target: '_blank', rel: 'noopener', href: clientWa(b, 'review'), text: 'Pedir avaliação' }));
      if (b.status === 'pendente') acts.push(el('a', { class: 'btn btn-line', target: '_blank', rel: 'noopener', href: clientWa(b, 'decline'), text: 'WhatsApp: propor outro horário' }));
      box.appendChild(el('article', { class: 'card' }, [
        el('div', { class: 'row-head' }, [el('strong', { text: dmy(b.date) + ' · ' + b.time }), el('span', { class: 'pill ' + b.status, text: STATUS[b.status] || b.status })]),
        el('div', { class: 'meta' }, [
          el('span', { text: SVC[b.service] || b.service }),
          el('span', { text: b.name + ' · +' + b.whatsapp }),
          el('span', { text: 'Código ' + b.code + (b.referral ? ' · Indicada por ' + b.referral : '') }),
          el('span', { text: 'Fotografias: ' + (b.photoConsent ? 'autorizadas' : 'não autorizadas') + ' · Idioma: ' + (b.lang === 'en' ? 'inglês' : 'português') })
        ]),
        el('div', { class: 'actions' }, acts)
      ]));
    });
  }

  function renderSchedule() {
    var f = $('#schedForm'); f.innerHTML = '';
    // apresenta de segunda a domingo
    [1, 2, 3, 4, 5, 6, 0].forEach(function (i) {
      var d = data.schedule[i];
      f.appendChild(el('label', {}, [el('span', { text: d.name }), el('input', { name: String(i), value: d.times, placeholder: 'fechado', inputmode: 'numeric' })]));
    });
  }
  $('#schedForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var sch = {}; $$('input', e.target).forEach(function (i) { sch[i.name] = i.value; });
    act({ action: 'adminSaveSchedule', schedule: sch }, 'Horários guardados');
  });

  function renderBlocks() {
    var box = $('#blocks'); box.innerHTML = '';
    if (!data.blocks.length) box.appendChild(el('p', { class: 'empty', text: 'Nenhum dia bloqueado.' }));
    data.blocks.forEach(function (b) {
      box.appendChild(el('div', { class: 'card row-head' }, [el('span', { text: dmy(b.date) + (b.reason ? ' — ' + b.reason : '') }),
        el('button', { class: 'btn btn-line', text: 'Desbloquear', onclick: function () { act({ action: 'adminUnblock', date: b.date }, 'Dia desbloqueado'); } })]));
    });
  }
  $('#blockDate').min = today();
  $('#blockForm').addEventListener('submit', function (e) {
    e.preventDefault();
    act({ action: 'adminBlock', date: $('#blockDate').value, reason: $('#blockReason').value }, 'Dia bloqueado').then(function () { e.target.reset(); });
  });

  function renderPhotos() {
    var sel = $('#photoCode'); sel.innerHTML = '';
    var ok = data.bookings.filter(function (b) { return b.photoConsent && b.status === 'concluida'; }).reverse();
    sel.appendChild(el('option', { value: '', text: ok.length ? 'Escolha…' : 'Sem atendimentos concluídos com autorização' }));
    ok.forEach(function (b) { sel.appendChild(el('option', { value: b.code, text: dmy(b.date) + ' · ' + b.name + ' · ' + b.code })); });
    var box = $('#photos'); box.innerHTML = '';
    data.photos.forEach(function (p) {
      var acts = [];
      if (p.status !== 'aprovada' && p.status !== 'retirada') acts.push(el('button', { class: 'btn btn-gold', text: 'Aprovar', onclick: function () { act({ action: 'adminPhoto', id: p.id, status: 'aprovada' }, 'Publicada na galeria'); } }));
      if (p.status === 'aprovada') acts.push(el('button', { class: 'btn btn-line', text: 'Ocultar', onclick: function () { act({ action: 'adminPhoto', id: p.id, status: 'oculta' }, 'Ocultada'); } }));
      acts.push(el('button', { class: 'btn btn-line', text: 'Apagar', onclick: function () { act({ action: 'adminPhoto', id: p.id, status: 'apagar' }, 'Apagada'); } }));
      box.appendChild(el('figure', { class: 'card', style: 'margin:0' }, [
        p.status === 'retirada' ? el('p', { class: 'note', text: 'Autorização retirada pela cliente.' }) : el('img', { src: p.url, alt: p.caption || p.code, referrerpolicy: 'no-referrer', loading: 'lazy' }),
        el('p', { class: 'meta' }, [el('span', { class: 'pill', text: p.status }), el('span', { text: p.code + (p.caption ? ' · ' + p.caption : '') })]),
        el('div', { class: 'actions' }, acts)
      ]));
    });
  }
  function resize(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.width, img.height));
        var c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.onerror = reject; img.src = url;
    });
  }
  $('#photoForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = $('#photoFile').files[0]; if (!f || !$('#photoCode').value) return toast('Escolha o atendimento e a fotografia.');
    toast('A enviar…');
    resize(f).then(function (b64) {
      return act({ action: 'adminUploadPhoto', code: $('#photoCode').value, caption: $('#photoCaption').value, mime: 'image/jpeg', data: b64 }, 'Fotografia enviada — aguarda a sua aprovação');
    }).then(function () { e.target.reset(); }).catch(function () { toast('Não foi possível ler a fotografia.'); });
  });

  function renderReviews() {
    var box = $('#reviewsAdmin'); box.innerHTML = '';
    if (!data.reviews.length) box.appendChild(el('p', { class: 'empty', text: 'Ainda não há avaliações.' }));
    data.reviews.forEach(function (r) {
      var acts = [];
      if (r.allowPublish && r.status !== 'aprovada') acts.push(el('button', { class: 'btn btn-gold', text: 'Publicar', onclick: function () { act({ action: 'adminReview', id: r.id, status: 'aprovada' }, 'Publicada'); } }));
      if (r.status === 'aprovada') acts.push(el('button', { class: 'btn btn-line', text: 'Despublicar', onclick: function () { act({ action: 'adminReview', id: r.id, status: 'rejeitada' }, 'Retirada do site'); } }));
      if (r.status === 'pendente' && r.allowPublish) acts.push(el('button', { class: 'btn btn-line', text: 'Não publicar', onclick: function () { act({ action: 'adminReview', id: r.id, status: 'rejeitada' }); } }));
      acts.push(el('button', { class: 'btn btn-line', text: 'Apagar', onclick: function () { act({ action: 'adminReview', id: r.id, status: 'apagar' }, 'Apagada'); } }));
      box.appendChild(el('article', { class: 'card' }, [
        el('div', { class: 'row-head' }, [el('strong', { text: '★★★★★'.slice(0, r.rating) + '☆☆☆☆☆'.slice(0, 5 - r.rating) }), el('span', { class: 'pill', text: r.status })]),
        el('p', { text: '“' + r.text + '”' }),
        el('p', { class: 'note', text: r.code + ' · ' + (r.allowPublish ? 'Autorizou publicação' : 'NÃO autorizou publicação (só para si)') }),
        el('div', { class: 'actions' }, acts)
      ]));
    });
  }

  function renderReferrals() {
    var box = $('#referrals'); box.innerHTML = '';
    var list = data.bookings.filter(function (b) { return b.referral; }).reverse();
    if (!list.length) box.appendChild(el('p', { class: 'empty', text: 'Ainda não há atendimentos por indicação.' }));
    list.forEach(function (b) {
      var eligible = b.status === 'concluida' && b.paid && b.service === 'fibra';
      var state = b.reward ? 'Recompensa entregue (' + dmy(b.reward.slice(0, 10)) + ')'
        : eligible ? 'Recompensa disponível para: ' + b.referral
        : b.service !== 'fibra' ? 'Não elegível: a promoção é para alongamento em fibra de vidro'
        : 'Aguarda atendimento concluído e pago';
      var acts = [];
      if (eligible && !b.reward) acts.push(el('button', { class: 'btn btn-gold', text: 'Marcar recompensa entregue', onclick: function () { act({ action: 'adminUpdateBooking', id: b.id, reward: true }); } }));
      if (b.reward) acts.push(el('button', { class: 'btn btn-line', text: 'Desfazer', onclick: function () { act({ action: 'adminUpdateBooking', id: b.id, reward: false }); } }));
      box.appendChild(el('article', { class: 'card' }, [
        el('div', { class: 'row-head' }, [el('strong', { text: b.referral + ' indicou ' + b.name }), el('span', { class: 'pill ' + b.status, text: STATUS[b.status] })]),
        el('p', { class: 'meta', text: dmy(b.date) + ' · ' + (SVC[b.service] || b.service) + ' · ' + (b.paid ? 'pago' : 'por pagar') }),
        el('p', { text: state }),
        el('div', { class: 'actions' }, acts)
      ]));
    });
  }

  if (pw) start();
  if (!cfg.API_URL) $('#loginErr').textContent = 'O painel funciona depois de colar a URL do Google Apps Script em config.js (API_URL).';
})();

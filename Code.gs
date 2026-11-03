/**
 * Kelle Nails Design — backend gratuito (Google Apps Script + Google Sheets)
 * ---------------------------------------------------------------------------
 * Custo: 0 €. Corre na conta Google gratuita da profissional.
 * Guarda: pedidos de agendamento, horários, bloqueios, avaliações e fotografias.
 *
 * Configuração (Projeto > Definições do projeto > Propriedades do script):
 *   ADMIN_PASSWORD      (obrigatório) palavra-passe do painel privado
 *   WHATSAPP_NUMBER     (recomendado) número em formato internacional só com dígitos, ex.: 447700900123
 *                       Necessário para a mensagem do WhatsApp ir já preenchida.
 *                       Fica guardado aqui, NUNCA no código público do site.
 *   NOTIFY_EMAIL        (opcional) e-mail para receber aviso automático de cada novo pedido
 *   BOOKING_WINDOW_DAYS (opcional) quantos dias à frente se pode marcar (padrão 60)
 *   MIN_NOTICE_HOURS    (opcional) antecedência mínima em horas (padrão 0)
 *
 * Depois de colar este ficheiro: executar a função setup() uma vez e publicar
 * como "Aplicação Web" (Executar como: Eu · Acesso: Qualquer pessoa).
 */

var TZ = 'Europe/London';

// Serviços confirmados pela profissional (sem Nail Art). Novos serviços só depois da confirmação dela.
var SERVICES = {
  gel: { pt: 'Unhas de gel', en: 'Gel nails', french: true },
  fibra: { pt: 'Unhas de fibra (alongamento em fibra de vidro)', en: 'Fibreglass nails (extensions)', french: true },
  manut_gel: { pt: 'Manutenção (gel)', en: 'Maintenance (gel)', french: true },
  manut_fibra: { pt: 'Manutenção (fibra)', en: 'Maintenance (fibreglass)', french: true },
  shellac: { pt: 'Shellac', en: 'Shellac', french: true },
  banho_gel: { pt: 'Banho de gel', en: 'Gel overlay', french: true },
  cut_maos: { pt: 'Manicure (cutilagem — mãos)', en: 'Manicure (cuticle care — hands)', french: false },
  cut_pes: { pt: 'Pedicure (cutilagem — pés)', en: 'Pedicure (cuticle care — feet)', french: false },
  cut_maos_pes: { pt: 'Manicure e pedicure (cutilagem — mãos e pés)', en: 'Manicure and pedicure (cuticle care — hands and feet)', french: false }
};

var SHEETS = {
  Horarios:   ['dia_semana', 'nome', 'horarios'],
  Bloqueios:  ['data', 'motivo'],
  Reservas:   ['id', 'codigo', 'criado_em', 'servico', 'data', 'hora', 'nome', 'whatsapp', 'estado', 'pago',
               'indicada_por', 'autoriza_fotos', 'autoriza_fotos_em', 'recompensa_indicacao', 'notas', 'idioma'],
  Avaliacoes: ['id', 'codigo_reserva', 'criado_em', 'nota', 'texto', 'autoriza_publicar', 'estado'],
  Fotos:      ['id', 'codigo_reserva', 'criado_em', 'ficheiro_id', 'url', 'legenda', 'estado']
};
var WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
var ACTIVE = { pendente: 1, confirmada: 1, concluida: 1 }; // estados que ocupam o horário

/* =========================== Instalação =========================== */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1000, SHEETS[name].length).setNumberFormat('@'); // texto puro (evita datas automáticas)
      sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]);
      sh.setFrozenRows(1);
    }
  });
  var h = ss.getSheetByName('Horarios');
  if (h.getLastRow() < 2) {
    // Sem horários inventados: tudo começa fechado até a profissional preencher no painel.
    h.getRange(2, 1, 7, 3).setValues(WEEKDAYS.map(function (n, i) { return [String(i), n, '']; }));
  }
  ensureFolder_();
  return 'ok';
}

function ensureFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('DRIVE_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var folder = DriveApp.createFolder('Kelle Nails Design — Galeria');
  props.setProperty('DRIVE_FOLDER_ID', folder.getId());
  return folder;
}

/* =========================== Utilitários =========================== */

function prop_(k, d) {
  var v = PropertiesService.getScriptProperties().getProperty(k);
  return (v === null || v === undefined || v === '') ? d : v;
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function bool_(v) { return v === true || v === 'TRUE' || v === 'true' || v === 'sim'; }
function cell_(v, kind) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, kind === 'time' ? 'HH:mm' : 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v).trim();
}
function nowStr_(offsetHours) {
  return Utilities.formatDate(new Date(Date.now() + (offsetHours || 0) * 3600000), TZ, 'yyyy-MM-dd HH:mm');
}
function addDays_(ymd, n) {
  var p = ymd.split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n, 12));
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}
function weekday_(ymd) {
  var p = ymd.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)).getUTCDay();
}
function phone_(v) {
  var digits = String(v || '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}
function clean_(v, max) {
  return String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function code_() {
  var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
  var bytes = Utilities.getUuid().replace(/-/g, '');
  for (var i = 0; i < 6; i++) s += a[parseInt(bytes.substr(i * 2, 2), 16) % a.length];
  return 'KN-' + s;
}
function ymdToDisplay_(ymd) { var p = ymd.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

function table_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Execute setup() primeiro (folha em falta: ' + name + ')');
  var values = sh.getDataRange().getValues();
  var head = values[0].map(String);
  var rows = values.slice(1).map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, j) { o[h] = r[j]; });
    return o;
  }).filter(function (o) { return head.some(function (h) { return cell_(o[h]) !== ''; }); });
  return { sh: sh, head: head, rows: rows };
}
function append_(t, obj) {
  t.sh.appendRow(t.head.map(function (h) { return obj[h] === undefined ? '' : obj[h]; }));
}
function set_(t, row, field, value) {
  t.sh.getRange(row._row, t.head.indexOf(field) + 1).setValue(value);
  row[field] = value;
}

/* =========================== Disponibilidade =========================== */

function schedule_() {
  var map = {};
  table_('Horarios').rows.forEach(function (r) {
    var times = cell_(r.horarios, 'time').split(/[,;\s]+/).filter(function (t) { return /^\d{1,2}:\d{2}$/.test(t); })
      .map(function (t) { return ('0' + t).slice(-5); });
    map[Number(cell_(r.dia_semana))] = times.sort();
  });
  return map;
}

function computeSlots_() {
  var schedule = schedule_();
  var blocked = {};
  table_('Bloqueios').rows.forEach(function (r) { blocked[cell_(r.data)] = true; });
  var taken = {};
  table_('Reservas').rows.forEach(function (r) {
    if (ACTIVE[cell_(r.estado)]) taken[cell_(r.data) + ' ' + cell_(r.hora, 'time')] = true;
  });
  var windowDays = Math.min(Math.max(Number(prop_('BOOKING_WINDOW_DAYS', 60)) || 60, 1), 180);
  var threshold = nowStr_(Number(prop_('MIN_NOTICE_HOURS', 0)) || 0);
  var today = nowStr_().slice(0, 10);
  var out = {};
  for (var i = 0; i <= windowDays; i++) {
    var d = addDays_(today, i);
    if (blocked[d]) continue;
    var free = (schedule[weekday_(d)] || []).filter(function (t) {
      return !taken[d + ' ' + t] && (d + ' ' + t) > threshold;
    });
    if (free.length) out[d] = free;
  }
  return out;
}

/* =========================== Entradas HTTP =========================== */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  try {
    if (action === 'slots') return json_({ ok: true, days: computeSlots_(), services: Object.keys(SERVICES) });
    if (action === 'public') return json_(publicData_());
    return json_({ ok: true, service: 'Kelle Nails Design API' });
  } catch (err) {
    return json_({ ok: false, error: 'server_error' });
  }
}

function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  try {
    switch (b.action) {
      case 'book':    return json_(book_(b));
      case 'consent': return json_(consent_(b));
      case 'review':  return json_(review_(b));
    }
    var auth = checkAdmin_(b);
    if (!auth.ok) return json_(auth);
    switch (b.action) {
      case 'adminData':          return json_(adminData_());
      case 'adminSaveSchedule':  return json_(adminSaveSchedule_(b));
      case 'adminBlock':         return json_(adminBlock_(b));
      case 'adminUnblock':       return json_(adminUnblock_(b));
      case 'adminUpdateBooking': return json_(adminUpdateBooking_(b));
      case 'adminReview':        return json_(adminReview_(b));
      case 'adminUploadPhoto':   return json_(adminUploadPhoto_(b));
      case 'adminPhoto':         return json_(adminPhoto_(b));
      case 'adminPing':          return json_({ ok: true });
    }
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json_({ ok: false, error: 'server_error', detail: String(err && err.message || err) });
  }
}

/* =========================== Público =========================== */

function book_(b) {
  if (b.website) return { ok: false, error: 'invalid' };               // armadilha anti-spam
  var service = String(b.service || '');
  var date = String(b.date || ''), time = String(b.time || '');
  var name = clean_(b.name, 60), wa = phone_(b.whatsapp);
  var lang = b.lang === 'en' ? 'en' : 'pt';
  if (!SERVICES[service]) return { ok: false, error: 'invalid_service' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { ok: false, error: 'invalid_slot' };
  if (name.length < 2) return { ok: false, error: 'invalid_name' };
  if (!wa) return { ok: false, error: 'invalid_phone' };
  if (b.acceptTerms !== true) return { ok: false, error: 'terms_required' };
  var french = b.french === true && SERVICES[service].french === true;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'busy' };
  var result;
  try {
    var slots = computeSlots_();
    if ((slots[date] || []).indexOf(time) === -1) return { ok: false, error: 'slot_unavailable' };
    var t = table_('Reservas');
    var today = nowStr_().slice(0, 10);
    var activeForPhone = t.rows.filter(function (r) {
      return phone_(r.whatsapp) === wa && ACTIVE[cell_(r.estado)] && cell_(r.estado) !== 'concluida' && cell_(r.data) >= today;
    }).length;
    if (activeForPhone >= 3) return { ok: false, error: 'too_many' };
    var code = code_();
    append_(t, {
      id: Utilities.getUuid(), codigo: code, criado_em: nowStr_(), servico: service, data: date, hora: time,
      nome: name, whatsapp: wa, estado: 'pendente', pago: false, indicada_por: clean_(b.referral, 60),
      autoriza_fotos: b.photoConsent === true, autoriza_fotos_em: b.photoConsent === true ? nowStr_() : '',
      recompensa_indicacao: '', notas: french ? 'Francesinha' : '', idioma: lang
    });
    SpreadsheetApp.flush();
    result = { code: code };
  } finally {
    lock.releaseLock();
  }

  var text = bookingMessage_(lang, { name: name, wa: wa, service: service, date: date, time: time, code: result.code, referral: clean_(b.referral, 60), french: french });
  var owner = phone_(prop_('WHATSAPP_NUMBER', ''));
  var email = prop_('NOTIFY_EMAIL', '');
  if (email) {
    try { MailApp.sendEmail(email, 'Novo pedido de agendamento ' + result.code, bookingMessage_('pt', { name: name, wa: wa, service: service, date: date, time: time, code: result.code, referral: clean_(b.referral, 60), french: french })); } catch (err) {}
  }
  return {
    ok: true, code: result.code, text: text,
    waUrl: owner ? 'https://wa.me/' + owner + '?text=' + encodeURIComponent(text) : null,
    emailNotified: !!email
  };
}

function bookingMessage_(lang, d) {
  var s = SERVICES[d.service][lang] + (d.french ? (lang === 'en' ? ' + French tips' : ' + francesinha') : '');
  if (lang === 'en') {
    return 'Hello! I would like to request an appointment at Kelle Nails Design.\n' +
      '• Name: ' + d.name + '\n• WhatsApp: +' + d.wa + '\n• Service: ' + s +
      '\n• Date: ' + ymdToDisplay_(d.date) + '\n• Time: ' + d.time +
      (d.referral ? '\n• Referred by: ' + d.referral : '') + '\n• Request code: ' + d.code;
  }
  return 'Olá! Gostaria de solicitar um agendamento na Kelle Nails Design.\n' +
    '• Nome: ' + d.name + '\n• WhatsApp: +' + d.wa + '\n• Serviço: ' + s +
    '\n• Data: ' + ymdToDisplay_(d.date) + '\n• Horário: ' + d.time +
    (d.referral ? '\n• Indicada por: ' + d.referral : '') + '\n• Código do pedido: ' + d.code;
}

function findBooking_(t, code, wa) {
  code = String(code || '').trim().toUpperCase();
  wa = phone_(wa);
  if (!code || !wa) return null;
  for (var i = 0; i < t.rows.length; i++) {
    var r = t.rows[i];
    if (cell_(r.codigo).toUpperCase() === code && phone_(r.whatsapp) === wa) return r;
  }
  return null;
}

function consent_(b) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var t = table_('Reservas');
    var r = findBooking_(t, b.code, b.whatsapp);
    if (!r) return { ok: false, error: 'not_found' };
    var give = b.consent === true;
    set_(t, r, 'autoriza_fotos', give);
    set_(t, r, 'autoriza_fotos_em', nowStr_());
    if (!give) {
      var f = table_('Fotos');
      f.rows.forEach(function (p) {
        if (cell_(p.codigo_reserva) === cell_(r.codigo) && cell_(p.estado) !== 'retirada') {
          set_(f, p, 'estado', 'retirada');
          try { DriveApp.getFileById(cell_(p.ficheiro_id)).setTrashed(true); } catch (err) {}
        }
      });
    }
    return { ok: true, consent: give };
  } finally { lock.releaseLock(); }
}

function review_(b) {
  var rating = Math.round(Number(b.rating));
  var text = clean_(b.text, 600);
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: 'invalid_rating' };
  if (text.length < 3) return { ok: false, error: 'invalid_text' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var r = findBooking_(table_('Reservas'), b.code, b.whatsapp);
    if (!r) return { ok: false, error: 'not_found' };
    if (cell_(r.estado) !== 'concluida') return { ok: false, error: 'not_completed' };
    var a = table_('Avaliacoes');
    if (a.rows.some(function (x) { return cell_(x.codigo_reserva) === cell_(r.codigo); })) return { ok: false, error: 'already_reviewed' };
    append_(a, { id: Utilities.getUuid(), codigo_reserva: cell_(r.codigo), criado_em: nowStr_(), nota: rating,
      texto: text, autoriza_publicar: b.allowPublish === true, estado: 'pendente' });
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function publicData_() {
  var consent = {};
  table_('Reservas').rows.forEach(function (r) { consent[cell_(r.codigo)] = bool_(r.autoriza_fotos); });
  var reviews = table_('Avaliacoes').rows.filter(function (r) {
    return cell_(r.estado) === 'aprovada' && bool_(r.autoriza_publicar);
  }).map(function (r) {
    return { rating: Number(r.nota), text: cell_(r.texto), month: cell_(r.criado_em).slice(0, 7) }; // sem nomes
  }).reverse().slice(0, 30);
  var photos = table_('Fotos').rows.filter(function (p) {
    return cell_(p.estado) === 'aprovada' && consent[cell_(p.codigo_reserva)] === true;
  }).map(function (p) {
    return { url: cell_(p.url), caption: cell_(p.legenda), date: cell_(p.criado_em).slice(0, 10) };
  }).reverse().slice(0, 24);
  return { ok: true, reviews: reviews, photos: photos, services: Object.keys(SERVICES) };
}

/* =========================== Painel privado =========================== */

function checkAdmin_(b) {
  var pw = prop_('ADMIN_PASSWORD', '');
  if (!pw) return { ok: false, error: 'admin_not_configured' };
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('admin_fails') || 0);
  if (fails >= 10) return { ok: false, error: 'locked' };
  var given = String(b.password || '');
  var diff = given.length ^ pw.length;
  for (var i = 0; i < Math.max(given.length, pw.length); i++) diff |= (given.charCodeAt(i) || 0) ^ (pw.charCodeAt(i) || 0);
  if (diff !== 0) { cache.put('admin_fails', String(fails + 1), 900); return { ok: false, error: 'unauthorized' }; }
  return { ok: true };
}

function adminData_() {
  var since = addDays_(nowStr_().slice(0, 10), -90);
  var bookings = table_('Reservas').rows.filter(function (r) { return cell_(r.data) >= since; }).map(function (r) {
    return { id: cell_(r.id), code: cell_(r.codigo), created: cell_(r.criado_em), service: cell_(r.servico),
      date: cell_(r.data), time: cell_(r.hora, 'time'), name: cell_(r.nome), whatsapp: phone_(r.whatsapp),
      status: cell_(r.estado), paid: bool_(r.pago), referral: cell_(r.indicada_por), photoConsent: bool_(r.autoriza_fotos),
      reward: cell_(r.recompensa_indicacao), notes: cell_(r.notas), lang: cell_(r.idioma) || 'pt' };
  });
  bookings.sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
  var sched = schedule_();
  return {
    ok: true,
    bookings: bookings,
    schedule: WEEKDAYS.map(function (n, i) { return { day: i, name: n, times: (sched[i] || []).join(', ') }; }),
    blocks: table_('Bloqueios').rows.map(function (r) { return { date: cell_(r.data), reason: cell_(r.motivo) }; })
      .filter(function (x) { return x.date >= nowStr_().slice(0, 10); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }),
    reviews: table_('Avaliacoes').rows.map(function (r) { return { id: cell_(r.id), code: cell_(r.codigo_reserva),
      created: cell_(r.criado_em), rating: Number(r.nota), text: cell_(r.texto), allowPublish: bool_(r.autoriza_publicar), status: cell_(r.estado) }; }).reverse(),
    photos: table_('Fotos').rows.map(function (p) { return { id: cell_(p.id), code: cell_(p.codigo_reserva), created: cell_(p.criado_em),
      url: cell_(p.url), caption: cell_(p.legenda), status: cell_(p.estado) }; }).reverse(),
    settings: { whatsapp: !!phone_(prop_('WHATSAPP_NUMBER', '')), email: !!prop_('NOTIFY_EMAIL', ''),
      windowDays: Number(prop_('BOOKING_WINDOW_DAYS', 60)), noticeHours: Number(prop_('MIN_NOTICE_HOURS', 0)) }
  };
}

function adminSaveSchedule_(b) {
  var t = table_('Horarios');
  var input = b.schedule || {};
  for (var d = 0; d < 7; d++) {
    if (input[d] === undefined) continue;
    var times = String(input[d]).split(/[,;\s]+/).filter(Boolean);
    for (var i = 0; i < times.length; i++) {
      var m = /^(\d{1,2}):(\d{2})$/.exec(times[i]);
      if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return { ok: false, error: 'invalid_time', value: times[i] };
      times[i] = ('0' + m[1]).slice(-2) + ':' + m[2];
    }
    var uniq = times.filter(function (x, k) { return times.indexOf(x) === k; }).sort();
    var row = t.rows.filter(function (r) { return Number(cell_(r.dia_semana)) === d; })[0];
    if (row) set_(t, row, 'horarios', uniq.join(', '));
    else append_(t, { dia_semana: String(d), nome: WEEKDAYS[d], horarios: uniq.join(', ') });
  }
  return { ok: true };
}

function adminBlock_(b) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date || ''))) return { ok: false, error: 'invalid_date' };
  var t = table_('Bloqueios');
  if (!t.rows.some(function (r) { return cell_(r.data) === b.date; })) append_(t, { data: b.date, motivo: clean_(b.reason, 80) });
  return { ok: true };
}

function adminUnblock_(b) {
  var t = table_('Bloqueios');
  var rows = t.rows.filter(function (r) { return cell_(r.data) === b.date; }).sort(function (a, c) { return c._row - a._row; });
  rows.forEach(function (r) { t.sh.deleteRow(r._row); });
  return { ok: true };
}

function adminUpdateBooking_(b) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var t = table_('Reservas');
    var r = t.rows.filter(function (x) { return cell_(x.id) === b.id; })[0];
    if (!r) return { ok: false, error: 'not_found' };
    if (b.status !== undefined) {
      if (['pendente', 'confirmada', 'cancelada', 'concluida'].indexOf(b.status) === -1) return { ok: false, error: 'invalid_status' };
      if (ACTIVE[b.status] && !ACTIVE[cell_(r.estado)]) {
        // reativar um pedido cancelado: só se o horário continuar livre
        var clash = t.rows.some(function (x) { return x !== r && ACTIVE[cell_(x.estado)] && cell_(x.data) === cell_(r.data) && cell_(x.hora, 'time') === cell_(r.hora, 'time'); });
        if (clash) return { ok: false, error: 'slot_unavailable' };
      }
      set_(t, r, 'estado', b.status);
    }
    if (b.paid !== undefined) set_(t, r, 'pago', b.paid === true);
    if (b.reward !== undefined) set_(t, r, 'recompensa_indicacao', b.reward ? nowStr_() : '');
    if (b.notes !== undefined) set_(t, r, 'notas', clean_(b.notes, 300));
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function adminReview_(b) {
  var t = table_('Avaliacoes');
  var r = t.rows.filter(function (x) { return cell_(x.id) === b.id; })[0];
  if (!r) return { ok: false, error: 'not_found' };
  if (b.status === 'apagar') { t.sh.deleteRow(r._row); return { ok: true }; }
  if (b.status !== 'aprovada' && b.status !== 'rejeitada') return { ok: false, error: 'invalid_status' };
  if (b.status === 'aprovada' && !bool_(r.autoriza_publicar)) return { ok: false, error: 'no_permission' };
  set_(t, r, 'estado', b.status);
  return { ok: true };
}

function adminUploadPhoto_(b) {
  var r = table_('Reservas').rows.filter(function (x) { return cell_(x.codigo) === String(b.code || '').toUpperCase(); })[0];
  if (!r) return { ok: false, error: 'not_found' };
  if (!bool_(r.autoriza_fotos)) return { ok: false, error: 'no_consent' };
  var mime = String(b.mime || '');
  if (['image/jpeg', 'image/png', 'image/webp'].indexOf(mime) === -1) return { ok: false, error: 'invalid_file' };
  var data = String(b.data || '');
  if (data.length > 7000000) return { ok: false, error: 'too_large' };
  var blob = Utilities.newBlob(Utilities.base64Decode(data), mime, cell_(r.codigo) + '-' + Date.now());
  var file = ensureFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var id = file.getId();
  append_(table_('Fotos'), { id: Utilities.getUuid(), codigo_reserva: cell_(r.codigo), criado_em: nowStr_(), ficheiro_id: id,
    url: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1200', legenda: clean_(b.caption, 80), estado: 'pendente' });
  return { ok: true };
}

function adminPhoto_(b) {
  var t = table_('Fotos');
  var p = t.rows.filter(function (x) { return cell_(x.id) === b.id; })[0];
  if (!p) return { ok: false, error: 'not_found' };
  if (b.status === 'apagar') {
    try { DriveApp.getFileById(cell_(p.ficheiro_id)).setTrashed(true); } catch (err) {}
    t.sh.deleteRow(p._row);
    return { ok: true };
  }
  if (b.status !== 'aprovada' && b.status !== 'oculta') return { ok: false, error: 'invalid_status' };
  if (b.status === 'aprovada') {
    var r = table_('Reservas').rows.filter(function (x) { return cell_(x.codigo) === cell_(p.codigo_reserva); })[0];
    if (!r || !bool_(r.autoriza_fotos)) return { ok: false, error: 'no_consent' };
  }
  set_(t, p, 'estado', b.status);
  return { ok: true };
}

// KEKB admin console (P2-WP5). Security rules: the ID token stays in memory only (never in
// storage/URLs); all page text is set with textContent (no HTML injection); identity and roles
// are decided by the backend, never by this page.
(function () {
  'use strict';
  var MESSAGES = {
    UNAUTHENTICATED: 'ยืนยันตัวตนไม่สำเร็จ กรุณาลงชื่อเข้าใช้ใหม่',
    FORBIDDEN: 'บัญชีนี้ไม่ได้รับอนุญาตให้ทำรายการนี้',
    INVALID_INPUT: 'ข้อมูลไม่ถูกต้อง',
    NOT_FOUND: 'ไม่พบรายการ (อาจถูกเปลี่ยนแล้ว) — โหลดใหม่',
    REVISION_CONFLICT: 'มีคนแก้รายการนี้ก่อนคุณ — โหลดข้อมูลใหม่แล้วลองอีกครั้ง',
    IDEMPOTENCY_CONFLICT: 'คำขอซ้ำแต่ข้อมูลต่างกัน — โหลดใหม่',
    DEPENDENCY_UNAVAILABLE: 'บริการของ Google ไม่ตอบสนอง ลองใหม่ภายหลัง',
    RATE_LIMITED: 'ระบบกำลังทำงานอื่นอยู่ ลองใหม่อีกครั้ง',
    INTERNAL: 'เกิดข้อผิดพลาดภายใน',
    NETWORK: 'เชื่อมต่อ backend ไม่ได้',
  };
  var ACCESS = ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL'];
  var cfg = null; var idToken = null; var me = null;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, text, attrs) {
    var e = document.createElement(tag);
    if (text !== undefined && text !== null) e.textContent = String(text);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function status(text, kind) { var s = $('status'); s.textContent = text; s.className = kind || ''; }
  function newKey() { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }

  function api(action, payload, mutation) {
    var body = { action: action, idToken: idToken };
    if (payload !== undefined) body.payload = payload;
    if (mutation) body.idempotencyKey = newKey();
    // text/plain avoids a CORS preflight that Apps Script cannot answer
    return fetch(cfg.apiUrl, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, error: { code: 'NETWORK' } }; });
  }
  function explain(res) {
    var code = res && res.error && res.error.code || 'INTERNAL';
    return (MESSAGES[code] || MESSAGES.INTERNAL) + ' (' + code + (res && res.requestId ? ', ' + res.requestId : '') + ')';
  }

  function render(items) {
    var tbody = $('rows'); tbody.textContent = '';
    items.forEach(function (it) {
      var tr = el('tr');
      var fileTd = el('td');
      if (/^[A-Za-z0-9_-]+$/.test(it.driveFileId || '')) {
        fileTd.appendChild(el('a', 'เปิดไฟล์', { href: 'https://drive.google.com/file/d/' + it.driveFileId + '/view', target: '_blank', rel: 'noopener noreferrer' }));
      }
      fileTd.appendChild(el('div', it.sourceKind || '', { class: 'muted' }));
      fileTd.appendChild(el('code', (it.sha256 || '').slice(0, 12)));
      tr.appendChild(fileTd);
      tr.appendChild(el('td', it.workflowState));
      var access = el('select'); ACCESS.forEach(function (a) { var o = el('option', a, { value: a }); if (a === it.accessClassification) o.selected = true; access.appendChild(o); });
      var accessTd = el('td'); accessTd.appendChild(access); tr.appendChild(accessTd);
      var lang = el('input', null, { value: it.originalLanguage || '', placeholder: 'th, en', maxlength: '35' });
      var langTd = el('td'); langTd.appendChild(lang); tr.appendChild(langTd);
      var who = el('select'); who.appendChild(el('option', '— ไม่ระบุ —', { value: '' }));
      (me.assignableActors || []).forEach(function (a) { var o = el('option', a, { value: a }); if (a === it.assignedTo) o.selected = true; who.appendChild(o); });
      var whoTd = el('td'); whoTd.appendChild(who); tr.appendChild(whoTd);
      var note = el('textarea', it.note || '', { maxlength: '500' });
      var noteTd = el('td'); noteTd.appendChild(note); tr.appendChild(noteTd);
      var btn = el('button', 'บันทึก', { type: 'button' });
      btn.addEventListener('click', function () {
        var payload = { intakeId: it.intakeId, expectedUpdatedAt: it.updatedAt, accessClassification: access.value, note: note.value, assignedTo: who.value };
        if (lang.value.trim()) payload.originalLanguage = lang.value.trim();
        btn.disabled = true; status('กำลังบันทึก…');
        api('intake.update', payload, true).then(function (res) {
          btn.disabled = false;
          if (res.ok) { status('บันทึกแล้ว (' + res.requestId + ')', 'ok'); load(); } else status(explain(res), 'bad');
        });
      });
      var btnTd = el('td'); btnTd.appendChild(btn); tr.appendChild(btnTd);
      tbody.appendChild(tr);
    });
    if (!items.length) { var tr = el('tr'); tr.appendChild(el('td', 'ยังไม่มีไฟล์ที่รับเข้า — วางไฟล์ในโฟลเดอร์ SourceAssets แล้วรอไม่เกิน 15 นาที', { colspan: '7', class: 'muted' })); tbody.appendChild(tr); }
  }

  function load() {
    return api('intake.list').then(function (res) {
      if (!res.ok) { status(explain(res), 'bad'); return; }
      $('intake').hidden = false; render(res.data.items);
    });
  }

  function onCredential(resp) {
    idToken = resp && resp.credential; // memory only
    status('กำลังตรวจสิทธิ์…');
    api('whoami').then(function (res) {
      if (!res.ok) { idToken = null; status(explain(res), 'bad'); return; }
      me = res.data;
      $('who').textContent = 'ลงชื่อเข้าใช้เป็น ' + me.actorId + ' · สิทธิ์: ' + (me.roles.join(', ') || '-');
      status('');
      if (me.roles.indexOf('CONTRIBUTOR') >= 0 || me.roles.indexOf('REVIEWER') >= 0) load();
    });
  }

  function start() {
    fetch('config.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (c) {
      cfg = c;
      if (!cfg.apiUrl || !cfg.oauthClientId || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(cfg.apiUrl)) {
        status('ยังไม่ได้ตั้งค่า backend (config.json)', 'bad'); return;
      }
      var tries = 0;
      (function waitGis() {
        if (window.google && google.accounts && google.accounts.id) {
          google.accounts.id.initialize({ client_id: cfg.oauthClientId, callback: onCredential, auto_select: false, ux_mode: 'popup' });
          google.accounts.id.renderButton($('signin'), { theme: 'outline', size: 'large', locale: 'th' });
        } else if (tries++ < 50) setTimeout(waitGis, 100);
        else status('โหลดระบบลงชื่อเข้าใช้ของ Google ไม่สำเร็จ', 'bad');
      })();
    }).catch(function () { status('โหลด config.json ไม่สำเร็จ', 'bad'); });
  }
  start();
})();

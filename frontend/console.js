// KEKB admin console (P2-WP5 intake, P2-WP6 drafts / validation / review). Security rules: the ID token stays in
// memory only (never in storage/URLs); all page text is set with textContent (no HTML injection); identity, roles,
// envelope fields and approval are decided by the backend, never by this page.
(function () {
  'use strict';
  var MESSAGES = {
    UNAUTHENTICATED: 'ยืนยันตัวตนไม่สำเร็จ กรุณาลงชื่อเข้าใช้ใหม่',
    FORBIDDEN: 'บัญชีนี้ไม่ได้รับอนุญาตให้ทำรายการนี้',
    INVALID_INPUT: 'ข้อมูลไม่ถูกต้อง',
    NOT_FOUND: 'ไม่พบรายการ (อาจถูกเปลี่ยนแล้ว) — โหลดใหม่',
    REVISION_CONFLICT: 'ข้อมูลถูกเปลี่ยนก่อนหน้านี้ (หรือไฟล์ใน Drive ไม่ตรงกับที่รับเข้า) — โหลดใหม่แล้วลองอีกครั้ง',
    IDEMPOTENCY_CONFLICT: 'คำขอซ้ำแต่ข้อมูลต่างกัน — โหลดใหม่',
    INVALID_TRANSITION: 'สถานะปัจจุบันไม่อนุญาตให้ทำขั้นนี้',
    VALIDATION_FAILED: 'ยังมีร่างที่ไม่ผ่านการตรวจความถูกต้อง — กด “ตรวจความถูกต้องทั้งหมด” เพื่อดูรายละเอียด',
    STALE_REFERENCE: 'ร่างอ้าง revision เก่าที่ถูกแทนที่แล้ว',
    DEPENDENCY_UNAVAILABLE: 'บริการของ Google ไม่ตอบสนอง ลองใหม่ภายหลัง',
    RATE_LIMITED: 'ระบบกำลังทำงานอื่นอยู่ ลองใหม่อีกครั้ง',
    INTERNAL: 'เกิดข้อผิดพลาดภายใน',
    NETWORK: 'เชื่อมต่อ backend ไม่ได้',
  };
  var ACCESS = ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL'];
  var LOCATORS = ['page', 'section', 'table', 'figure', 'paragraph', 'row', 'timeRange', 'dataRange'];
  var SYSTEM_FIELDS = ['id', 'schemaVersion', 'revision', 'workflowState', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'provenance'];
  var cfg = null; var idToken = null; var me = null; var templates = {}; var editing = null;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, text, attrs) {
    var e = document.createElement(tag);
    if (text !== undefined && text !== null) e.textContent = String(text);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function td(child) { var t = el('td'); if (child) t.appendChild(typeof child === 'string' ? document.createTextNode(child) : child); return t; }
  function status(text, kind) { var s = $('status'); s.textContent = text; s.className = kind || ''; }
  function newKey() { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function has(role) { return !!me && me.roles.indexOf(role) >= 0; }
  function short(id) { return String(id || '').slice(-12); }
  function when(iso) {
    var d = new Date(iso);
    if (!iso || isNaN(d.getTime())) return '';
    try { return d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return d.toISOString().slice(0, 16); }
  }

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
    var err = (res && res.error) || {}; var code = err.code || 'INTERNAL';
    var extra = err.field ? ' · ช่อง: ' + err.field : '';
    if (err.details && err.details.codes) extra += ' · รหัส: ' + err.details.codes.join(', ');
    if (err.details && err.details.recordId) extra += ' · record …' + short(err.details.recordId);
    return (MESSAGES[code] || MESSAGES.INTERNAL) + extra + ' (' + code + (res && res.requestId ? ', ' + res.requestId : '') + ')';
  }
  /** Run a mutation with button lock + status; reloads all lists on success. */
  function act(btn, label, action, payload, after) {
    if (btn) btn.disabled = true;
    status(label + '…');
    return api(action, payload, true).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok) { status(explain(res), 'bad'); return res; }
      status(label + ' สำเร็จ (' + res.requestId + ')' + (res.data && res.data.selfReview ? ' · บันทึกว่าเป็นการตรวจงานตัวเอง' : ''), 'ok');
      if (after) after(res);
      return refresh().then(function () { return res; });
    });
  }

  // ---------------- 1 · intake ----------------
  function renderIntake(items) {
    var tbody = $('rows'); tbody.textContent = '';
    items.forEach(function (it) {
      var tr = el('tr'); var registered = !!it.sourceAssetId;
      var fileTd = el('td');
      if (/^[A-Za-z0-9_-]+$/.test(it.driveFileId || '')) {
        fileTd.appendChild(el('a', 'เปิดไฟล์', { href: 'https://drive.google.com/file/d/' + it.driveFileId + '/view', target: '_blank', rel: 'noopener noreferrer' }));
      }
      fileTd.appendChild(el('div', it.sourceKind || '', { class: 'muted' }));
      fileTd.appendChild(el('code', (it.sha256 || '').slice(0, 12)));
      tr.appendChild(fileTd);
      var st = td(it.workflowState);
      if (registered) st.appendChild(el('div', 'SourceAsset …' + short(it.sourceAssetId), { class: 'muted' }));
      tr.appendChild(st);
      var access = el('select');
      ACCESS.forEach(function (a) { var o = el('option', a, { value: a }); if (a === it.accessClassification) o.selected = true; access.appendChild(o); });
      access.disabled = registered; tr.appendChild(td(access));
      var lang = el('input', null, { value: it.originalLanguage || '', placeholder: 'th, en', maxlength: '35' });
      lang.disabled = registered; tr.appendChild(td(lang));
      var who = el('select'); who.appendChild(el('option', '— ไม่ระบุ —', { value: '' }));
      (me.assignableActors || []).forEach(function (a) { var o = el('option', a, { value: a }); if (a === it.assignedTo) o.selected = true; who.appendChild(o); });
      tr.appendChild(td(who));
      var note = el('textarea', it.note || '', { maxlength: '500' }); tr.appendChild(td(note));
      var save = el('button', 'บันทึก', { type: 'button' });
      save.addEventListener('click', function () {
        var p = { intakeId: it.intakeId, expectedUpdatedAt: it.updatedAt, note: note.value, assignedTo: who.value };
        if (!registered) { p.accessClassification = access.value; if (lang.value.trim()) p.originalLanguage = lang.value.trim(); }
        act(save, 'บันทึก', 'intake.update', p);
      });
      tr.appendChild(td(save));
      var next = el('td');
      if (it.workflowState === 'RECEIVED' && !registered) {
        var caps = el('div');
        LOCATORS.forEach(function (c) {
          var lb = el('label', null, { class: 'inline' }); var cb = el('input', null, { type: 'checkbox', value: c });
          if (c === 'page') cb.checked = true;
          lb.appendChild(cb); lb.appendChild(document.createTextNode(c)); caps.appendChild(lb);
        });
        var reg = el('button', 'ลงทะเบียน', { type: 'button' });
        reg.addEventListener('click', function () {
          var chosen = Array.prototype.filter.call(caps.querySelectorAll('input'), function (x) { return x.checked; }).map(function (x) { return x.value; });
          act(reg, 'ลงทะเบียน SourceAsset', 'source.register', { intakeId: it.intakeId, expectedUpdatedAt: it.updatedAt, locatorCapabilities: chosen }, function (res) {
            $('edRefs').value = JSON.stringify([{ id: res.data.sourceAssetId, type: 'SourceAsset', revision: res.data.revision }], null, 1);
          });
        });
        next.appendChild(el('div', 'ตำแหน่งอ้างอิงที่ไฟล์รองรับ', { class: 'muted' })); next.appendChild(caps); next.appendChild(reg);
      } else if (registered) {
        var use = el('button', 'ใช้เป็น sourceRefs', { type: 'button', class: 'secondary' });
        use.addEventListener('click', function () {
          $('edRefs').value = JSON.stringify([{ id: it.sourceAssetId, type: 'SourceAsset', revision: Number(it.sourceRevision) || 1 }], null, 1);
          status('ตั้ง sourceRefs ในตัวแก้ไขแล้ว', 'ok');
        });
        if (it.workflowState === 'REGISTERED') {
          var ex = el('button', 'ทำแบบจำลองเสร็จ', { type: 'button', title: 'REGISTERED → EXTRACTED' });
          ex.addEventListener('click', function () { act(ex, 'บันทึกสถานะ EXTRACTED', 'source.extracted', { sourceId: it.sourceAssetId }); });
          next.appendChild(ex);
        }
        next.appendChild(use);
      }
      tr.appendChild(next);
      tbody.appendChild(tr);
    });
    if (!items.length) {
      var tr = el('tr');
      tr.appendChild(el('td', 'ยังไม่มีไฟล์ที่รับเข้า — วางไฟล์ในโฟลเดอร์ SourceAssets แล้วรอไม่เกิน 15 นาที', { colspan: '8', class: 'muted' }));
      tbody.appendChild(tr);
    }
  }

  // ---------------- 2 · drafts ----------------
  function renderDrafts(items) {
    var tbody = $('draftRows'); tbody.textContent = '';
    items.slice().sort(function (a, b) { return a.type < b.type ? -1 : a.type > b.type ? 1 : (a.id < b.id ? -1 : 1); }).forEach(function (d) {
      var tr = el('tr');
      tr.appendChild(td(el('input', null, { type: 'checkbox', 'data-id': d.id, 'aria-label': 'เลือก ' + d.type })));
      tr.appendChild(td(d.type));
      var idCode = el('code', d.id, { title: 'คลิกเพื่อคัดลอก' });
      idCode.addEventListener('click', function () { if (navigator.clipboard) navigator.clipboard.writeText(d.id); status('คัดลอก ID แล้ว', 'ok'); });
      tr.appendChild(td(idCode));
      tr.appendChild(td(String(d.revision)));
      tr.appendChild(td(d.workflowState));
      tr.appendChild(td((d.updatedBy || '') + ' · ' + when(d.updatedAt)));
      var readOnly = d.type === 'SourceAsset' || d.type === 'ReviewSnapshot';
      var open = el('button', readOnly ? 'ดู' : 'แก้ไข', { type: 'button', class: 'secondary' });
      open.addEventListener('click', function () { openDraft(d.id); });
      tr.appendChild(td(open));
      tbody.appendChild(tr);
    });
    if (!items.length) {
      var tr = el('tr');
      tr.appendChild(el('td', 'ยังไม่มีร่าง — ลงทะเบียนไฟล์ แล้วเริ่มจาก template ในตัวแก้ไข', { colspan: '7', class: 'muted' }));
      tbody.appendChild(tr);
    }
    var sel = $('protocol'); sel.textContent = '';
    items.filter(function (d) { return d.type === 'ReviewProtocol'; }).forEach(function (d) { sel.appendChild(el('option', '…' + short(d.id) + ' rev ' + d.revision, { value: d.id })); });
    if (!sel.options.length) sel.appendChild(el('option', '— ต้องมี ReviewProtocol อย่างน้อย 1 รายการ —', { value: '' }));
  }
  function picked() {
    return Array.prototype.filter.call(document.querySelectorAll('#draftRows input[type=checkbox]'), function (x) { return x.checked; })
      .map(function (x) { return x.getAttribute('data-id'); });
  }
  function renderIssues(data) {
    var box = $('issues'); box.textContent = '';
    if (!data) return;
    box.appendChild(el('p', data.valid
      ? 'ผ่านการตรวจทั้งชุด ✓ (เปลี่ยนเป็น VALIDATED ' + data.validated.length + ' รายการ)'
      : 'ไม่ผ่าน: ' + data.issues.length + ' ปัญหา · VALIDATED ' + data.validated.length + ' · ไม่ผ่าน ' + data.failed.length, { class: data.valid ? 'ok' : 'bad' }));
    if (!data.issues.length) return;
    var ul = el('ul', null, { class: 'issues' });
    data.issues.slice(0, 100).forEach(function (i) {
      ul.appendChild(el('li', i.code + ' · ' + (i.recordType || '') + ' …' + short(i.recordId) + (i.path ? ' · ' + i.path : '') + (i.keyword ? ' (' + i.keyword + ')' : '')));
    });
    box.appendChild(ul);
  }

  // ---------------- 3 · editor ----------------
  function stripSystem(rec) { var o = {}; Object.keys(rec).forEach(function (k) { if (SYSTEM_FIELDS.indexOf(k) < 0) o[k] = rec[k]; }); return o; }
  function openDraft(id) {
    status('กำลังโหลดร่าง…');
    api('draft.get', { id: id }).then(function (res) {
      if (!res.ok) { status(explain(res), 'bad'); return; }
      var r = res.data.record; var readOnly = r.type === 'SourceAsset' || r.type === 'ReviewSnapshot';
      editing = readOnly ? null : { id: r.id, revision: r.revision };
      $('edTarget').value = r.type + ' …' + short(r.id) + ' rev ' + r.revision + ' (' + r.workflowState + ')' + (readOnly ? ' — อ่านอย่างเดียว' : '');
      $('edRecord').value = JSON.stringify(readOnly ? r : stripSystem(r), null, 2);
      $('edRefs').value = JSON.stringify((r.provenance && r.provenance.sourceRefs) || [], null, 1);
      $('btnSave').disabled = readOnly;
      status('');
      $('editor').scrollIntoView({ behavior: 'smooth' });
    });
  }
  function resetEditor() {
    editing = null; $('edTarget').value = ''; $('btnSave').disabled = false;
    var t = templates[$('tplType').value];
    $('edRecord').value = t ? JSON.stringify(t, null, 2) : '{\n  "type": ""\n}';
  }
  function saveDraft() {
    var rec; var refs;
    try { rec = JSON.parse($('edRecord').value); } catch (e) { status('JSON ของเนื้อหา record ไม่ถูกต้อง: ' + e.message, 'bad'); return; }
    try { refs = JSON.parse($('edRefs').value || '[]'); } catch (e2) { status('JSON ของ sourceRefs ไม่ถูกต้อง', 'bad'); return; }
    var payload = { record: rec, sourceRefs: refs };
    if (editing) { payload.id = editing.id; payload.expectedRevision = editing.revision; }
    act($('btnSave'), 'บันทึกร่าง', 'draft.save', payload, function (res) {
      editing = { id: res.data.id, revision: res.data.revision };
      $('edTarget').value = (rec.type || '') + ' …' + short(res.data.id) + ' rev ' + res.data.revision;
    });
  }

  // ---------------- 4 · reviews ----------------
  function renderReviews(items) {
    var box = $('reviewList'); box.textContent = '';
    if (!items.length) { box.appendChild(el('p', 'ยังไม่มีคำขอตรวจ', { class: 'muted' })); return; }
    items.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; }).forEach(function (r) {
      var c = el('div', null, { class: 'card' });
      var h = el('div'); h.appendChild(el('strong', 'คำขอ …' + short(r.requestId)));
      h.appendChild(el('span', r.status, { class: 'tag' }));
      if (r.decision) h.appendChild(el('span', r.decision, { class: 'tag' }));
      if (r.selfReview) h.appendChild(el('span', 'ตรวจงานตัวเอง', { class: 'tag warn', title: 'OD-08: อนุญาตแต่บันทึกไว้' }));
      c.appendChild(h);
      c.appendChild(el('div', r.targets.length + ' รายการ · ส่งโดย ' + r.createdBy + ' · ' + when(r.createdAt) + (r.reviewerId ? ' · ผู้ตรวจ ' + r.reviewerId + ' · ' + when(r.closedAt) : ''), { class: 'muted' }));
      var ul = el('ul', null, { class: 'issues' });
      r.targets.forEach(function (t) { ul.appendChild(el('li', t.type + ' …' + short(t.id) + ' rev ' + t.revision)); });
      c.appendChild(ul);
      if (r.status === 'OPEN' && has('REVIEWER')) {
        var dec = el('select');
        [['APPROVE', 'อนุมัติ'], ['NEEDS_REVISION', 'ส่งกลับแก้ไข'], ['REJECT', 'ปฏิเสธ']].forEach(function (d) { dec.appendChild(el('option', d[1], { value: d[0] })); });
        var reason = el('textarea', null, { maxlength: '2000', placeholder: 'เหตุผลของการตัดสิน (จำเป็น)' });
        var go = el('button', 'บันทึกผลตรวจ', { type: 'button' });
        go.addEventListener('click', function () {
          if (!reason.value.trim()) { status('กรุณาใส่เหตุผล', 'bad'); return; }
          act(go, 'บันทึกผลตรวจ', 'review.decide', { requestId: r.requestId, decision: dec.value, reason: { th: reason.value } });
        });
        var g = el('div', null, { class: 'grid' }); g.appendChild(dec); g.appendChild(reason);
        c.appendChild(g); c.appendChild(go);
      }
      box.appendChild(c);
    });
  }

  function refresh() {
    return Promise.all([
      api('intake.list').then(function (res) { if (res.ok) { $('intake').hidden = false; renderIntake(res.data.items); } else status(explain(res), 'bad'); }),
      api('draft.list').then(function (res) {
        $('drafts').hidden = false;
        if (res.ok) renderDrafts(res.data.items); else { $('draftRows').textContent = ''; $('issues').textContent = 'โหลดร่างไม่ได้: ' + explain(res); }
      }),
      api('review.list').then(function (res) { if (res.ok) { $('reviews').hidden = false; renderReviews(res.data.items); } }),
    ]);
  }

  function wire() {
    var sel = $('tplType');
    Object.keys(templates).forEach(function (t) { sel.appendChild(el('option', t, { value: t })); });
    sel.addEventListener('change', resetEditor);
    $('btnNew').addEventListener('click', resetEditor);
    $('btnSave').addEventListener('click', saveDraft);
    $('btnValidate').addEventListener('click', function () {
      act($('btnValidate'), 'ตรวจความถูกต้อง', 'draft.validate', {}, function (res) { renderIssues(res.data); });
    });
    $('btnRequest').addEventListener('click', function () {
      var ids = picked(); var protocolId = $('protocol').value;
      if (!ids.length) { status('เลือกร่างที่จะส่งตรวจก่อน', 'bad'); return; }
      if (!protocolId) { status('ต้องมี ReviewProtocol ก่อนส่งตรวจ', 'bad'); return; }
      act($('btnRequest'), 'ส่งเข้าคิวตรวจ', 'review.request', { targetIds: ids, protocolId: protocolId });
    });
    $('pickAll').addEventListener('change', function (e) {
      Array.prototype.forEach.call(document.querySelectorAll('#draftRows input[type=checkbox]'), function (x) { x.checked = e.target.checked; });
    });
    resetEditor();
  }

  function onCredential(resp) {
    idToken = resp && resp.credential; // memory only
    status('กำลังตรวจสิทธิ์…');
    api('whoami').then(function (res) {
      if (!res.ok) { idToken = null; status(explain(res), 'bad'); return; }
      me = res.data;
      $('who').textContent = 'ลงชื่อเข้าใช้เป็น ' + me.actorId + ' · สิทธิ์: ' + (me.roles.join(', ') || '-');
      status('');
      if (has('CONTRIBUTOR')) $('editor').hidden = false;
      if (has('CONTRIBUTOR') || has('REVIEWER')) refresh();
    });
  }

  function start() {
    Promise.all([
      fetch('config.json', { cache: 'no-store' }).then(function (r) { return r.json(); }),
      fetch('templates.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return { templates: {} }; }),
    ]).then(function (both) {
      cfg = both[0]; templates = both[1].templates || {};
      wire();
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

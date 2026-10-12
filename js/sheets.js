// July Daily — шторки: редакторы задач, повторов, целей, категорий, итогов
import { icon, esc, today, addDays, fmtDay, fmtDayShort, wd, pd, monthKey, yearKey, WD_SHORT, WD_ACC, MONTHS_GEN, PALETTE, CATEGORY_ICONS, plural, addMinutes, pad, cap } from './util.js';
import * as St from './store.js';
import { render, toast, ui, goalColor, doBackup, periodLabel } from './app.js';

const $ = s => document.querySelector(s);
const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
const stack = [];

export const sheetOpen = () => stack.length > 0;

function openSheet(o) {
  const root = $('#sheets');
  if (!stack.length) {
    const sc = document.createElement('div'); sc.className = 'scrim'; sc.addEventListener('click', () => closeSheet());
    root.appendChild(sc); requestAnimationFrame(() => sc.classList.add('on'));
  }
  const el = document.createElement('section');
  el.className = 'sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', o.title);
  const left = o.left === 'back' ? icon('chevron-left', 20, 2.4) : icon('x', 18, 2.4);
  el.innerHTML = `<div class="sh-grab"></div><div class="sh-h"><button type="button" class="glass round" data-a="_close" aria-label="${o.left === 'back' ? 'Назад' : 'Закрыть'}">${left}</button><h3>${esc(o.title)}</h3>${o.right ? `<button type="button" class="done-btn" data-a="${o.right.a}">${esc(o.right.label)}</button>` : '<span style="width:40px"></span>'}</div><div class="sh-b"></div>`;
  root.appendChild(el);
  const s = { el, ...o };
  stack.push(s);
  refresh(s);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  if (o.focus) setTimeout(() => { const f = el.querySelector(o.focus); if (f) f.focus(); }, 380);
  return s;
}

function refresh(s = stack[stack.length - 1]) {
  if (!s) return;
  const b = s.el.querySelector('.sh-b'), y = b.scrollTop;
  b.innerHTML = s.render();
  b.scrollTop = y;
}

export function closeSheet() {
  const s = stack.pop(); if (!s) return;
  s.el.classList.remove('on');
  setTimeout(() => s.el.remove(), 380);
  if (!stack.length) { const sc = $('#sheets .scrim'); if (sc) { sc.classList.remove('on'); setTimeout(() => sc.remove(), 300); } }
  if (s.onClose) s.onClose();
}
export function closeAllSheets() { while (stack.length) closeSheet(); }

// делегирование событий в шторках
$('#sheets').addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const sheetEl = el.closest('.sheet'); const s = stack.find(x => x.el === sheetEl); if (!s) return;
  e.preventDefault();
  if (el.dataset.a === '_close') { closeSheet(); return; }
  const fn = s.on && s.on[el.dataset.a]; if (fn) fn(el);
});
const onField = e => {
  const el = e.target.closest('[data-f]'); if (!el) return;
  const s = stack.find(x => x.el === el.closest('.sheet')); if (!s || !s.field) return;
  s.field(el.dataset.f, el.type === 'number' ? Number(el.value) : el.value, el, e.type);
};
$('#sheets').addEventListener('input', onField);
$('#sheets').addEventListener('change', onField);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) closeSheet(); });

// ---------- описание повтора ----------
const WD_EVERY = ['Каждый', 'Каждый', 'Каждую', 'Каждый', 'Каждую', 'Каждую', 'Каждое'];
const NTH = { 1: 'первый', 2: 'второй', 3: 'третий', 4: 'четвёртый', '-1': 'последний' };
const NTH_F = { 1: 'первую', 2: 'вторую', 3: 'третью', 4: 'четвёртую', '-1': 'последнюю' };
const NTH_N = { 1: 'первое', 2: 'второе', 3: 'третье', 4: 'четвёртое', '-1': 'последнее' };
export function describeRec(rec, end, start) {
  if (!rec) return 'Не повторять';
  const ev = rec.every || 1;
  let s = '';
  switch (rec.type) {
    case 'daily': s = ev === 1 ? 'Каждый день' : ev === 2 ? 'Через день' : `Каждые ${ev} ${plural(ev, 'день', 'дня', 'дней')}`; break;
    case 'weekly': {
      const d = (rec.days || []).slice().sort();
      if (ev === 1 && d.join() === '0,1,2,3,4') s = 'По будням';
      else if (ev === 1 && d.join() === '5,6') s = 'По выходным';
      else if (ev === 1 && d.length === 7) s = 'Каждый день';
      else if (ev === 1 && d.length === 1) s = WD_EVERY[d[0]] + ' ' + WD_ACC[d[0]];
      else s = (ev === 1 ? 'Каждую неделю' : ev === 2 ? 'Раз в две недели' : `Каждые ${ev} ${plural(ev, 'неделю', 'недели', 'недель')}`) + ': ' + d.map(x => WD_SHORT[x].toLowerCase()).join(', ');
      break;
    }
    case 'quota': s = `${rec.n} ${plural(rec.n, 'раз', 'раза', 'раз')} в ${rec.period === 'month' ? 'месяц' : 'неделю'}`; break;
    case 'monthDay': {
      const days = (rec.monthDays || []).slice().sort((a, b) => (a === -1 ? 99 : a) - (b === -1 ? 99 : b)).map(x => x === -1 ? 'последний день' : x + '-го');
      s = (ev === 1 ? 'Каждый месяц' : ev === 3 ? 'Раз в квартал' : ev === 6 ? 'Раз в полгода' : `Каждые ${ev} ${plural(ev, 'месяц', 'месяца', 'месяцев')}`) + ', ' + days.join(', ');
      break;
    }
    case 'monthNth': {
      const f = [2, 4, 5].includes(rec.weekday);
      s = (ev === 1 ? 'Каждый месяц' : `Каждые ${ev} ${plural(ev, 'месяц', 'месяца', 'месяцев')}`) + ', ' + (f ? NTH_F[rec.nth] : rec.weekday === 6 ? NTH_N[rec.nth] : NTH[rec.nth]) + ' ' + WD_ACC[rec.weekday];
      break;
    }
    case 'yearly': s = (ev === 1 ? 'Каждый год' : `Каждые ${ev} ${plural(ev, 'год', 'года', 'лет')}`) + ', ' + rec.day + ' ' + MONTHS_GEN[rec.month]; break;
  }
  if (end && end.type === 'until' && end.until) s += ', до ' + fmtDay(end.until);
  if (end && end.type === 'count' && end.count) s += ', ' + end.count + ' ' + plural(end.count, 'раз', 'раза', 'раз');
  return s;
}

// ---------- выбор «этот / следующие / все» ----------
export function openScope(title, cb, allowOne = true, danger = true) {
  const s = openSheet({
    title, render: () => `<div class="action-list">
      ${allowOne ? `<button type="button" class="btn btn-ghost" data-a="one">Только этот раз</button>` : ''}
      <button type="button" class="btn btn-ghost" data-a="future">Этот и следующие</button>
      <button type="button" class="btn btn-ghost" data-a="all" ${danger ? 'style="color:var(--danger)"' : ''}>Все повторы</button>
    </div>`,
    on: { one: () => pick('one'), future: () => pick('future'), all: () => pick('all') }
  });
  function pick(v) { closeSheet(); cb(v); }
  return s;
}

// ---------- редактор задачи / встречи ----------
function nextHour() { const d = new Date(); return pad(Math.min(22, d.getHours() + 1)) + ':00'; }

export function openItemEditor({ id, date, preset }) {
  let d, f = null;
  if (id) {
    f = St.findItem(id); if (!f) return;
    if (f.item) d = { ...clone(f.item), rec: null, end: { type: 'never' } };
    else {
      const occ = St.itemsForDate(f.date).find(x => x.id === id) || { ...f.rule, date: f.date, status: (f.rule.st || {})[f.date] || '' };
      d = { ...clone(occ), id, rec: clone(f.rule.rec), end: clone(f.rule.end) || { type: 'never' } };
    }
  } else {
    d = { kind: 'task', title: '', date: date || today(), startTime: null, endTime: null, cat: null, goal: null, note: '', rec: null, end: { type: 'never' }, ...(preset || {}) };
  }
  const orig = JSON.stringify({ rec: d.rec, end: d.end });
  const isNew = !id;

  const goalsFor = () => {
    const mg = St.goalsFor('month', monthKey(d.date)), yg = St.goalsFor('year', yearKey(d.date));
    return [...mg, ...yg];
  };

  const s = openSheet({
    title: isNew ? (d.kind === 'event' ? 'Новая встреча' : 'Новая задача') : (d.kind === 'event' ? 'Встреча' : 'Задача'),
    right: { label: 'Готово', a: 'save' },
    focus: isNew && !d.title ? '[data-f="title"]' : null,
    render: () => {
      const goals = goalsFor();
      return `
      <div class="seg glass">${[['task', 'Задача'], ['event', 'Встреча']].map(([v, l]) => `<button type="button" data-a="kind" data-v="${v}" aria-pressed="${d.kind === v}">${l}</button>`).join('')}</div>
      <div class="field big"><label class="sr" for="f-title">Название</label><input id="f-title" type="text" data-f="title" value="${esc(d.title)}" placeholder="${d.kind === 'event' ? 'Что за встреча?' : 'Что нужно сделать?'}" enterkeyhint="done"></div>
      <div class="field">
        <div class="frow"><span>Дата</span><input type="date" data-f="date" value="${d.date}" aria-label="Дата"></div>
        ${d.kind === 'event' ? `<div class="frow"><span>Начало</span><input type="time" data-f="startTime" value="${d.startTime || ''}" aria-label="Начало"></div><div class="frow"><span>Конец</span><input type="time" data-f="endTime" value="${d.endTime || ''}" aria-label="Конец"></div>` : ''}
        <button type="button" class="frow" style="width:100%;text-align:left" data-a="repeat"><span>Повтор</span><span class="val">${esc(describeRec(d.rec, d.end, d.date))} ${icon('chevron-right', 16)}</span></button>
      </div>
      <div class="lbl">Категория</div>
      <div class="chips"><button type="button" class="chip" data-a="cat" data-v="" aria-pressed="${!d.cat}" style="--c:#8E8AA3">Без категории</button>${St.S.cats.map(c => `<button type="button" class="chip" data-a="cat" data-v="${c.id}" aria-pressed="${d.cat === c.id}" style="--c:${c.color}">${icon(c.icon, 15)} ${esc(c.name)}</button>`).join('')}</div>
      ${goals.length ? `<div class="lbl">Цель</div><div class="chips"><button type="button" class="chip" data-a="goal" data-v="" aria-pressed="${!d.goal}">Без цели</button>${goals.map(g => `<button type="button" class="chip" data-a="goal" data-v="${g.id}" aria-pressed="${d.goal === g.id}" style="--c:${goalColor(g)}">${icon('target', 14)} ${esc(g.title)}</button>`).join('')}</div>` : ''}
      <div class="field"><label class="sr" for="f-note">Заметка</label><textarea id="f-note" data-f="note" placeholder="Заметка">${esc(d.note || '')}</textarea></div>
      ${!isNew ? `<div class="action-list">${d.kind !== 'event' && d.status !== 'done' ? `<button type="button" class="btn btn-ghost" data-a="tomorrow">${icon('arrow', 18)} Перенести на ${d.date < today() ? 'сегодня' : 'следующий день'}</button>` : ''}<button type="button" class="btn btn-danger" data-a="del">${icon('trash', 18)} Удалить</button></div>` : ''}`;
    },
    field: (k, v, el, type) => {
      if (k === 'title' || k === 'note') { d[k] = v; return; }
      if (type !== 'change' && (k === 'date' || k.endsWith('Time'))) return;
      if (k === 'date' && v) { d.date = v; refresh(); return; }
      if (k === 'startTime') { const dur = d.startTime && d.endTime ? minutes(d.endTime) - minutes(d.startTime) : 60; d.startTime = v || null; if (v) d.endTime = addMinutes(v, Math.max(15, dur)); refresh(); return; }
      if (k === 'endTime') { d.endTime = v || null; return; }
    },
    on: {
      kind: el => { d.kind = el.dataset.v; if (d.kind === 'event' && !d.startTime) { d.startTime = nextHour(); d.endTime = addMinutes(d.startTime, 60); } s.el.querySelector('h3').textContent = isNew ? (d.kind === 'event' ? 'Новая встреча' : 'Новая задача') : (d.kind === 'event' ? 'Встреча' : 'Задача'); refresh(); },
      cat: el => { d.cat = el.dataset.v || null; refresh(); },
      goal: el => { d.goal = el.dataset.v || null; refresh(); },
      repeat: () => openRepeat(d, (rec, end) => { d.rec = rec; d.end = end; refresh(); }),
      save: () => save(),
      del: () => {
        if (f && f.rule) { openScope('Удалить повторяющуюся запись?', scope => { St.deleteItem(id, scope); closeSheet(); render(); toast('Удалено'); }); return; }
        const backup = clone(f.item); St.deleteItem(id); closeSheet(); render();
        toast((d.kind === 'event' ? 'Встреча удалена' : 'Задача удалена'), 'Вернуть', () => { St.S.items.push(backup); St.save(); render(); });
      },
      tomorrow: () => { const to = d.date < today() ? today() : addDays(d.date, 1); St.transferOne(id, to); closeSheet(); render(); toast('Перенесено на ' + fmtDay(to)); }
    }
  });

  function fields() {
    const o = { kind: d.kind, title: d.title.trim(), note: d.note || '', cat: d.cat, goal: d.goal, date: d.date };
    if (d.kind === 'event') { o.startTime = d.startTime || null; o.endTime = d.endTime || null; }
    else { o.startTime = null; o.endTime = null; }
    return o;
  }
  function save() {
    if (!d.title.trim()) { toast('Напиши название'); const t = s.el.querySelector('[data-f="title"]'); t && t.focus(); return; }
    const o = fields();
    if (d.rec && d.rec.type === 'yearly') { d.rec.month = pd(d.date).getMonth(); d.rec.day = pd(d.date).getDate(); }
    if (isNew) {
      if (d.rec) St.addRule({ kind: o.kind, title: o.title, note: o.note, cat: o.cat, goal: o.goal, startTime: o.startTime, endTime: o.endTime, start: o.date, rec: d.rec, end: d.end });
      else St.addItem(o);
      closeSheet(); ui.cur = o.date; render();
      toast((o.kind === 'event' ? 'Встреча' : 'Задача') + ' добавлена' + (o.date !== today() ? ' на ' + fmtDay(o.date) : ''));
      return;
    }
    if (f.item) {
      St.updateItem(id, d.rec ? { ...o, rec: d.rec, end: d.end } : o);
      closeSheet(); render(); return;
    }
    const recChanged = JSON.stringify({ rec: d.rec, end: d.end }) !== orig;
    const patch = { ...o };
    if (recChanged) { patch.rec = d.rec; patch.end = d.end; }
    if (patch.date === f.date) delete patch.date;
    openScope('Изменить повторяющуюся запись', scope => { St.updateItem(id, patch, scope); closeSheet(); render(); toast('Сохранено'); }, !recChanged, false);
  }
}
const minutes = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// ---------- редактор повтора ----------
function quickOptions(date) {
  const w = wd(date), day = pd(date).getDate(), month = pd(date).getMonth();
  return [
    ['Не повторять', null],
    ['Каждый день', { type: 'daily', every: 1 }],
    ['По будням', { type: 'weekly', every: 1, days: [0, 1, 2, 3, 4] }],
    ['По выходным', { type: 'weekly', every: 1, days: [5, 6] }],
    [WD_EVERY[w] + ' ' + WD_ACC[w], { type: 'weekly', every: 1, days: [w] }],
    ['Каждый месяц, ' + day + '-го', { type: 'monthDay', every: 1, monthDays: [day] }],
    ['Каждый год, ' + day + ' ' + MONTHS_GEN[month], { type: 'yearly', every: 1, month, day }]
  ];
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function openRepeat(d, done) {
  let r = clone(d.rec), e = clone(d.end) || { type: 'never' };
  const qo = quickOptions(d.date);
  let custom = !!r && !qo.some(([, v]) => same(v, r));
  const w = wd(d.date), day = pd(d.date).getDate();
  const defaults = {
    daily: { type: 'daily', every: 2 }, weekly: { type: 'weekly', every: 1, days: [w] }, quota: { type: 'quota', n: 3, period: 'week' },
    monthDay: { type: 'monthDay', every: 1, monthDays: [day] }, monthNth: { type: 'monthNth', every: 1, nth: Math.min(4, Math.ceil(day / 7)), weekday: w },
    yearly: { type: 'yearly', every: 1, month: pd(d.date).getMonth(), day }
  };
  const stepper = (k, val, min, max, unit) => `<div class="stepper"><button type="button" data-a="step" data-k="${k}" data-d="-1" aria-label="Меньше">${icon('minus', 16, 2.6)}</button><b>${val}</b><button type="button" data-a="step" data-k="${k}" data-d="1" aria-label="Больше">${icon('plus', 16, 2.6)}</button>${unit ? `<span style="color:var(--text2);font-size:15px;margin-left:4px">${unit}</span>` : ''}</div>`;
  openSheet({
    title: 'Повтор', left: 'back', right: { label: 'Готово', a: 'ok' },
    render: () => {
      let h = `<div class="opt-list">${qo.map(([l, v], i) => `<button type="button" data-a="quick" data-i="${i}">${esc(l)}<span class="ok">${!custom && same(v, r) ? icon('check', 20, 2.6) : ''}</span></button>`).join('')}<button type="button" data-a="custom">Настроить…<span class="ok">${custom ? icon('check', 20, 2.6) : icon('chevron-right', 18)}</span></button></div>`;
      if (custom && r) {
        h += `<div class="lbl">Как повторять</div><div class="chips">${[['daily', 'Каждые N дней'], ['weekly', 'По дням недели'], ['quota', 'N раз за период'], ['monthDay', 'По числам месяца'], ['monthNth', 'По дню недели месяца'], ['yearly', 'Каждый год']].map(([v, l]) => `<button type="button" class="chip" data-a="type" data-v="${v}" aria-pressed="${r.type === v}">${l}</button>`).join('')}</div>`;
        h += `<div class="field" style="padding:12px 14px;display:flex;flex-direction:column;gap:12px">`;
        if (r.type === 'daily') h += `<div class="frow" style="padding:0">Каждые ${stepper('every', r.every || 1, 1, 365, plural(r.every || 1, 'день', 'дня', 'дней'))}</div>`;
        if (r.type === 'weekly') h += `<div class="wdays">${WD_SHORT.map((x, i) => `<button type="button" data-a="wday" data-i="${i}" aria-pressed="${(r.days || []).includes(i)}">${x}</button>`).join('')}</div><div class="frow" style="padding:0">Каждые ${stepper('every', r.every || 1, 1, 52, plural(r.every || 1, 'неделю', 'недели', 'недель'))}</div>`;
        if (r.type === 'quota') h += `<div class="frow" style="padding:0">${stepper('n', r.n, 1, 31, plural(r.n, 'раз', 'раза', 'раз'))}</div><div class="seg small">${[['week', 'в неделю'], ['month', 'в месяц']].map(([v, l]) => `<button type="button" data-a="period" data-v="${v}" aria-pressed="${r.period === v}">${l}</button>`).join('')}</div><p class="cap" style="margin:0">Задача видна каждый день, пока не набрано нужное количество. Дни выбираешь сама.</p>`;
        if (r.type === 'monthDay') h += `<div class="mdays">${Array.from({ length: 31 }, (_, i) => `<button type="button" data-a="mday" data-i="${i + 1}" aria-pressed="${(r.monthDays || []).includes(i + 1)}">${i + 1}</button>`).join('')}<button type="button" class="last" data-a="mday" data-i="-1" aria-pressed="${(r.monthDays || []).includes(-1)}">Последний</button></div><div class="frow" style="padding:0">Каждые ${stepper('every', r.every || 1, 1, 24, plural(r.every || 1, 'месяц', 'месяца', 'месяцев'))}</div><p class="cap" style="margin:0">Если в месяце нет 31-го числа, задача встанет на последний день.</p>`;
        if (r.type === 'monthNth') h += `<div class="chips">${[1, 2, 3, 4, -1].map(n => `<button type="button" class="chip" data-a="nth" data-i="${n}" aria-pressed="${r.nth === n}">${cap(NTH[n])}</button>`).join('')}</div><div class="wdays">${WD_SHORT.map((x, i) => `<button type="button" data-a="nwd" data-i="${i}" aria-pressed="${r.weekday === i}">${x}</button>`).join('')}</div><div class="frow" style="padding:0">Каждые ${stepper('every', r.every || 1, 1, 24, plural(r.every || 1, 'месяц', 'месяца', 'месяцев'))}</div>`;
        if (r.type === 'yearly') h += `<div class="frow" style="padding:0">${esc(fmtDay(d.date))}, каждые ${stepper('every', r.every || 1, 1, 10, plural(r.every || 1, 'год', 'года', 'лет'))}</div>`;
        h += `</div>`;
      }
      if (r) {
        h += `<div class="lbl">Окончание</div><div class="seg small">${[['never', 'Никогда'], ['until', 'До даты'], ['count', 'После N раз']].map(([v, l]) => `<button type="button" data-a="end" data-v="${v}" aria-pressed="${e.type === v}">${l}</button>`).join('')}</div>`;
        if (e.type === 'until') h += `<div class="field"><div class="frow"><span>Последний день</span><input type="date" data-f="until" value="${e.until || ''}" min="${d.date}" aria-label="Последний день"></div></div>`;
        if (e.type === 'count') h += `<div class="field"><div class="frow"><span>Повторить</span>${stepper('count', e.count || 10, 1, 999, plural(e.count || 10, 'раз', 'раза', 'раз'))}</div></div>`;
        h += `<p class="cap">${esc(describeRec(r, e, d.date))}</p>`;
      }
      return h;
    },
    field: (k, v) => { if (k === 'until') { e.until = v; refresh(); } },
    on: {
      quick: el => { r = clone(qo[Number(el.dataset.i)][1]); custom = false; refresh(); },
      custom: () => { custom = true; if (!r) r = clone(defaults.daily); refresh(); },
      type: el => { const prev = r; r = clone(defaults[el.dataset.v]); if (prev && prev.every && r.every) r.every = 1; refresh(); },
      step: el => {
        const k = el.dataset.k, dd = Number(el.dataset.d);
        if (k === 'count') e.count = Math.max(1, (e.count || 10) + dd);
        else r[k] = Math.max(1, Math.min(k === 'n' ? 31 : 365, (r[k] || 1) + dd));
        refresh();
      },
      wday: el => { const i = Number(el.dataset.i); r.days = (r.days || []).includes(i) ? r.days.filter(x => x !== i) : [...(r.days || []), i].sort(); refresh(); },
      mday: el => { const i = Number(el.dataset.i); r.monthDays = (r.monthDays || []).includes(i) ? r.monthDays.filter(x => x !== i) : [...(r.monthDays || []), i]; refresh(); },
      nth: el => { r.nth = Number(el.dataset.i); refresh(); },
      nwd: el => { r.weekday = Number(el.dataset.i); refresh(); },
      period: el => { r.period = el.dataset.v; refresh(); },
      end: el => { e = { type: el.dataset.v }; if (e.type === 'count') e.count = 10; if (e.type === 'until') e.until = addDays(d.date, 30); refresh(); },
      ok: () => {
        if (r && r.type === 'weekly' && !(r.days || []).length) { toast('Выбери хотя бы один день недели'); return; }
        if (r && r.type === 'monthDay' && !(r.monthDays || []).length) { toast('Выбери хотя бы одно число'); return; }
        closeSheet(); done(r, r ? e : { type: 'never' });
      }
    }
  });
}

// ---------- редактор цели ----------
export function openGoalEditor({ id, level, period }) {
  const ex = id ? St.goal(id) : null;
  const g = ex ? clone(ex) : { level: level || 'month', period: period || (level === 'year' ? yearKey(today()) : monthKey(today())), title: '', type: 'tasks', target: 10, count: 0, checked: false, parent: null, color: PALETTE[(St.S.goals.length + 1) % PALETTE.length] };
  if (!g.color) g.color = goalColor(ex);
  const s = openSheet({
    title: ex ? 'Цель' : 'Новая цель', right: { label: 'Готово', a: 'save' }, focus: ex ? null : '[data-f="title"]',
    render: () => {
      const yg = St.goalsFor('year', g.period.slice(0, 4)).filter(x => x.id !== id);
      let h = '';
      if (!ex) h += `<div class="seg glass">${[['month', 'На месяц'], ['year', 'На год']].map(([v, l]) => `<button type="button" data-a="level" data-v="${v}" aria-pressed="${g.level === v}">${l}</button>`).join('')}</div>`;
      h += `<div class="field big"><label class="sr" for="g-title">Название цели</label><input id="g-title" type="text" data-f="title" value="${esc(g.title)}" placeholder="${g.level === 'year' ? 'Например, выучить английский до B2' : 'Например, запустить сайт-портфолио'}"></div>`;
      h += `<div class="field"><div class="frow"><span>${g.level === 'year' ? 'Год' : 'Месяц'}</span>${g.level === 'year' ? `<div class="stepper"><button type="button" data-a="year" data-d="-1" aria-label="Предыдущий год">${icon('minus', 16, 2.6)}</button><b>${g.period}</b><button type="button" data-a="year" data-d="1" aria-label="Следующий год">${icon('plus', 16, 2.6)}</button></div>` : `<input type="month" data-f="period" value="${g.period}" aria-label="Месяц">`}</div></div>`;
      h += `<div class="lbl">Как считать прогресс</div><div class="opt-list">${[['tasks', 'По задачам', g.level === 'year' ? 'по целям месяцев или привязанным задачам' : 'по задачам, привязанным к цели'], ['counter', 'Счётчик', 'например, «прочитать 12 книг»'], ['check', 'Отметка', 'просто отметить, когда достигнута']].map(([v, l, sub]) => `<button type="button" data-a="type" data-v="${v}"><span style="display:flex;flex-direction:column"><span>${l}</span><small style="color:var(--text3);font-size:13px">${sub}</small></span><span class="ok">${g.type === v ? icon('check', 20, 2.6) : ''}</span></button>`).join('')}</div>`;
      if (g.type === 'counter') h += `<div class="field"><div class="frow"><span>Цель</span><input type="number" inputmode="numeric" min="1" data-f="target" value="${g.target}" style="width:90px;text-align:right;border:0;background:var(--track);border-radius:10px;padding:6px 10px;font-size:16px" aria-label="Целевое значение"></div><div class="frow"><span>Сейчас</span><div class="stepper"><button type="button" data-a="cnt" data-d="-1" aria-label="Убавить">${icon('minus', 16, 2.6)}</button><b>${g.count}</b><button type="button" data-a="cnt" data-d="1" aria-label="Прибавить">${icon('plus', 16, 2.6)}</button></div></div></div>`;
      if (g.level === 'month' && yg.length) h += `<div class="lbl">Часть цели года</div><div class="chips"><button type="button" class="chip" data-a="parent" data-v="" aria-pressed="${!g.parent}">Нет</button>${yg.map(y => `<button type="button" class="chip" data-a="parent" data-v="${y.id}" aria-pressed="${g.parent === y.id}" style="--c:${goalColor(y)}">${esc(y.title)}</button>`).join('')}</div>`;
      h += `<div class="lbl">Цвет</div><div class="palette">${PALETTE.map(c => `<button type="button" data-a="color" data-v="${c}" aria-pressed="${g.color === c}" style="--c:${c}" aria-label="Цвет ${c}"></button>`).join('')}</div>`;
      if (ex) {
        const t = St.goalTasks(ex);
        if (g.type === 'tasks') h += `<p class="cap">Привязано задач: ${t.total}, выполнено: ${t.done}. Привязать задачу можно в её карточке.</p>`;
        h += `<button type="button" class="btn btn-danger" data-a="del">${icon('trash', 18)} Удалить цель</button>`;
      }
      return h;
    },
    field: (k, v, el, type) => {
      if (k === 'title') g.title = v;
      if (k === 'target') g.target = Math.max(1, Number(v) || 1);
      if (k === 'period' && v && type === 'change') { g.period = v; g.parent = null; refresh(); }
    },
    on: {
      level: el => { g.level = el.dataset.v; g.period = g.level === 'year' ? g.period.slice(0, 4) : (g.period.length === 4 ? g.period + '-' + monthKey(today()).slice(5) : g.period); g.parent = null; refresh(); },
      year: el => { g.period = String(Number(g.period) + Number(el.dataset.d)); refresh(); },
      type: el => { g.type = el.dataset.v; refresh(); },
      cnt: el => { g.count = Math.max(0, g.count + Number(el.dataset.d)); refresh(); },
      parent: el => { g.parent = el.dataset.v || null; refresh(); },
      color: el => { g.color = el.dataset.v; refresh(); },
      save: () => {
        if (!g.title.trim()) { toast('Напиши, какая цель'); s.el.querySelector('[data-f="title"]').focus(); return; }
        g.title = g.title.trim();
        if (ex) Object.assign(ex, g); else St.addGoal(g);
        St.save(); closeSheet(); render(); if (!ex) toast('Цель добавлена');
      },
      del: () => {
        if (!confirm('Удалить цель «' + ex.title + '»? Задачи останутся, но без привязки.')) return;
        St.S.goals = St.S.goals.filter(x => x !== ex);
        for (const i of St.S.items) if (i.goal === ex.id) i.goal = null;
        for (const r of St.S.rules) if (r.goal === ex.id) r.goal = null;
        for (const c of St.S.goals) if (c.parent === ex.id) c.parent = null;
        St.save(); closeSheet(); render(); toast('Цель удалена');
      }
    }
  });
}

// ---------- редактор категории ----------
export function openCatEditor({ id }) {
  const ex = id ? St.cat(id) : null;
  const c = ex ? clone(ex) : { name: '', color: PALETTE[St.S.cats.length % PALETTE.length], icon: 'star' };
  const s = openSheet({
    title: ex ? 'Категория' : 'Новая категория', right: { label: 'Готово', a: 'save' }, focus: ex ? null : '[data-f="name"]',
    render: () => `
      <div style="display:flex;align-items:center;gap:12px"><span class="mi-ic" style="--c:${c.color};width:52px;height:52px;border-radius:16px">${icon(c.icon, 26)}</span><div class="field big" style="flex:1"><label class="sr" for="c-name">Название</label><input id="c-name" type="text" data-f="name" value="${esc(c.name)}" placeholder="Название"></div></div>
      <div class="lbl">Цвет</div><div class="palette">${PALETTE.map(x => `<button type="button" data-a="color" data-v="${x}" aria-pressed="${c.color === x}" style="--c:${x}" aria-label="Цвет ${x}"></button>`).join('')}</div>
      <div class="lbl">Иконка</div><div class="icons" style="--c:${c.color}">${CATEGORY_ICONS.map(n => `<button type="button" data-a="icon" data-v="${n}" aria-pressed="${c.icon === n}" aria-label="${n}">${icon(n, 22)}</button>`).join('')}</div>
      ${ex ? `<button type="button" class="btn btn-danger" data-a="del">${icon('trash', 18)} Удалить категорию</button>` : ''}`,
    field: (k, v) => { if (k === 'name') c.name = v; },
    on: {
      color: el => { c.color = el.dataset.v; refresh(); },
      icon: el => { c.icon = el.dataset.v; refresh(); },
      save: () => {
        if (!c.name.trim()) { toast('Напиши название'); return; }
        c.name = c.name.trim();
        if (ex) Object.assign(ex, c); else St.S.cats.push({ id: Math.random().toString(36).slice(2, 9), ...c });
        St.save(); closeSheet(); render();
      },
      del: () => {
        if (!confirm('Удалить категорию «' + ex.name + '»? Записи останутся без категории.')) return;
        St.S.cats = St.S.cats.filter(x => x !== ex);
        for (const i of St.S.items) if (i.cat === ex.id) i.cat = null;
        for (const r of St.S.rules) if (r.cat === ex.id) r.cat = null;
        St.S.keywords = St.S.keywords.filter(k => k.cat !== ex.id);
        St.save(); closeSheet(); render();
      }
    }
  });
}

// ---------- итоги ----------
const TYPE_GEN = { week: 'недели', month: 'месяца', year: 'года' };
function statsHtml(type, from, to, stats) {
  if (!stats) return '';
  const pct = stats.total ? Math.round(stats.done / stats.total * 100) : 0;
  let h = `<div class="stat-row"><div><b>${stats.done}</b><small>выполнено</small></div><div><b>${stats.fail}</b><small>не выполнено</small></div><div><b>${pct}%</b><small>результат</small></div></div>`;
  const cats = Object.entries(stats.byCat);
  if (cats.length) {
    h += `<div class="lbl">По категориям</div><div class="field" style="padding:12px 14px;display:flex;flex-direction:column;gap:10px">` + cats.map(([id, v]) => {
      const c = St.cat(id === '_' ? null : id);
      return `<div class="cat-stat" style="--c:${c ? c.color : '#8E8AA3'}"><span style="width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c ? c.name : 'Без категории')}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(v.done / v.total * 100)}%"></div></div><span>${v.done}/${v.total}</span></div>`;
    }).join('') + `</div>`;
  }
  if (stats.quotas && stats.quotas.length) h += `<div class="lbl">Повторы «N раз»</div><div class="field" style="padding:12px 14px;display:flex;flex-direction:column;gap:6px">${stats.quotas.map(q => `<div class="cat-stat"><span style="flex:1">${esc(q.title)}</span><span style="width:auto;color:${q.done >= q.n ? 'var(--ok)' : 'var(--danger)'}">${q.done} из ${q.n}</span></div>`).join('')}</div>`;
  const goals = type === 'year' ? St.goalsFor('year', yearKey(from)) : St.goalsFor('month', monthKey(to));
  if (goals.length) h += `<div class="lbl">${type === 'year' ? 'Цели года' : 'Цели месяца'}</div>` + goals.map(g => { const p = St.goalProgress(g); return `<div class="goal soft" style="--c:${goalColor(g)}"><div class="goal-h"><b>${esc(g.title)}</b><small>${esc(p.label)}</small></div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(p.pct * 100)}%"></div></div></div>`; }).join('');
  return h;
}

export function openReview(type, anchor) {
  const [from, to] = St.reviewRange(type, anchor);
  const key = St.reviewKey(type, anchor);
  const prev = St.S.reviews.find(r => r.key === key && !r.skipped);
  const qs = St.S.questions[type];
  const answers = prev ? [...prev.answers] : qs.map(() => '');
  const stats = St.periodStats(from, to);
  const fake = { type, from, to };
  openSheet({
    title: 'Итоги ' + TYPE_GEN[type], right: { label: 'Сохранить', a: 'save' },
    render: () => `<p class="cap" style="text-align:center;margin:0">${esc(cap(periodLabel(fake)))}</p>` + statsHtml(type, from, to, stats) +
      `<div class="lbl">Анкета</div>` + qs.map((q, i) => /^оценк/i.test(q)
        ? `<div class="q"><label>${esc(q)}</label><div class="rate">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button type="button" data-a="rate" data-i="${i}" data-v="${n}" aria-pressed="${String(answers[i]) === String(n)}">${n}</button>`).join('')}</div></div>`
        : `<div class="q"><label for="q${i}">${esc(q)}</label><div class="field"><textarea id="q${i}" data-f="a${i}" style="min-height:70px">${esc(answers[i] || '')}</textarea></div></div>`).join('') +
      `<button type="button" class="btn btn-ghost" data-a="backup">${icon('download', 18)} Заодно сохранить бэкап</button>
       <div class="sh-acts"><button type="button" class="btn btn-ghost" data-a="skip">Пропустить</button><button type="button" class="btn btn-primary" data-a="save">Сохранить итоги</button></div>`,
    field: (k, v) => { if (k[0] === 'a') answers[Number(k.slice(1))] = v; },
    on: {
      rate: el => { answers[Number(el.dataset.i)] = Number(el.dataset.v); refresh(); },
      backup: () => doBackup(),
      skip: () => { St.S.reviews = St.S.reviews.filter(r => r.key !== key); St.saveReview(type, anchor, [], true); closeSheet(); render(); },
      save: () => { St.S.reviews = St.S.reviews.filter(r => r.key !== key); St.saveReview(type, anchor, answers); closeSheet(); render(); toast('Итоги сохранены'); }
    }
  });
}

export function openReviewView(id) {
  const r = St.S.reviews.find(x => x.id === id); if (!r) return;
  openSheet({
    title: 'Итоги ' + TYPE_GEN[r.type],
    render: () => `<p class="cap" style="text-align:center;margin:0">${esc(cap(periodLabel(r)))}${r.skipped ? ' · пропущено' : ''}</p>` + statsHtml(r.type, r.from, r.to, r.stats) +
      (r.skipped ? `<button type="button" class="btn btn-primary" data-a="fill">Заполнить сейчас</button>` : (r.questions || []).map((q, i) => r.answers[i] !== '' && r.answers[i] != null ? `<div class="q"><label>${esc(q)}</label><div class="field" style="padding:12px 16px;white-space:pre-wrap;font-size:16px;line-height:1.4;-webkit-user-select:text;user-select:text">${esc(r.answers[i])}</div></div>` : '').join('')) +
      `<button type="button" class="btn btn-danger" data-a="del">Удалить итоги</button>`,
    on: {
      fill: () => { closeSheet(); openReview(r.type, r.to); },
      del: () => { if (!confirm('Удалить эти итоги?')) return; St.S.reviews = St.S.reviews.filter(x => x !== r); St.save(); closeSheet(); render(); }
    }
  });
}

export { openSheet, refresh as refreshSheet };

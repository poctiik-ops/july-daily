// July Daily — интерфейс: экраны, навигация, жесты
import * as U from './util.js';
import { icon, esc, today, addDays, addMonths, fmtDay, wd, weekStart, monthKey, yearKey, monthStart, monthEnd, MONTHS_GEN, WD_SHORT, WD_FULL, plural, PALETTE } from './util.js';
import * as St from './store.js';
import { S } from './store.js';
import { openItemEditor, openGoalEditor, openCatEditor, openReview, openReviewView, openScope, closeAllSheets, describeRec, sheetOpen } from './sheets.js';
import { initAssistant } from './assist.js';

export const VERSION = '1.0.0';

export const ui = {
  tab: 'cal', view: 'day', cur: today(),
  gTab: 'month', gMonth: monthKey(today()), gYear: yearKey(today()),
  more: null, qTab: 'week', lastToday: today()
};

const $ = s => document.querySelector(s);
const st = () => St.S;

// ---------- тема и фон ----------
export function applyTheme() {
  const h = new Date().getHours();
  const t = h >= 5 && h < 10 ? 'dawn' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 21 ? 'sunset' : 'night';
  const dark = t === 'sunset' || t === 'night';
  const b = document.body;
  b.classList.remove('t-dawn', 't-day', 't-sunset', 't-night');
  b.classList.add('t-' + t);
  b.dataset.theme = dark ? 'dark' : 'light';
  const photo = st().settings.bg === 'photo' && st().settings.photo;
  b.classList.toggle('has-photo', !!photo);
  $('#bg').style.backgroundImage = photo ? `url("${photo}")` : '';
  document.querySelectorAll('meta[name=theme-color]').forEach(m => m.content = dark ? '#14112A' : '#F4EEF8');
}

// ---------- тост ----------
let toastTimer;
export function toast(msg, action, fn, ms = 3500) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button type="button">${esc(action)}</button>` : '');
  if (action) el.querySelector('button').onclick = () => { el.classList.remove('on'); fn && fn(); };
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), ms);
}

// ---------- общие куски ----------
const catOf = id => St.cat(id);
const colorOf = id => St.catColor(id);
function seg(items, cur, act, cls = '') {
  return `<div class="seg glass ${cls}" role="group">${items.map(([v, l]) => `<button type="button" data-a="${act}" data-v="${v}" aria-pressed="${v === cur}">${esc(l)}</button>`).join('')}</div>`;
}
function rbtn(name, act, label, extra = '') { return `<button type="button" class="glass round press" data-a="${act}" aria-label="${esc(label)}" ${extra}>${icon(name, 20, 2.2)}</button>`; }
export function ring(p, size = 72, color = '#4F7CF5') {
  const r = (size - 12) / 2, c = 2 * Math.PI * r, pct = Math.round(p * 100);
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Прогресс ${pct}%"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="8"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-size="${size > 60 ? 16 : 12}" font-weight="700" fill="currentColor">${pct}%</text></svg>`;
}
export function goalColor(g) { return g.color || PALETTE[(St.S.goals.indexOf(g) + 1) % PALETTE.length]; }
const typeLabel = { tasks: 'по задачам', counter: 'счётчик', check: 'отметка' };

function itemMeta(i) {
  const parts = [];
  const c = catOf(i.cat); if (c) parts.push(esc(c.name));
  if (i.goal) { const g = St.goal(i.goal); if (g) parts.push('цель «' + esc(g.title) + '»'); }
  if (i.recurring && !i.quota) parts.push(icon('repeat', 12, 2.2));
  if (i.quota) parts.push(`<span class="quota">${i.quota.done} из ${i.quota.n} ${i.quota.period === 'month' ? 'в месяце' : 'на неделе'}</span>`);
  if (i.origin) parts.push('перенесено');
  if (i.note) parts.push(icon('message', 12, 2));
  return parts.join(' · ').replace(/ · (<svg)/g, ' $1');
}

function taskRow(i) {
  const s = i.effStatus, c = colorOf(i.cat);
  const chk = s === 'done' ? icon('check', 15, 3.2) : s === 'fail' ? icon('x', 14, 3) : '';
  const label = (s === 'done' ? 'Снять отметку: ' : 'Отметить выполненной: ') + i.title;
  const right = s === 'fail' && !i.recurring && !i.handled ? `<button type="button" class="chip-btn" data-a="moveTomorrow" data-id="${i.id}">На завтра</button>` : `<span class="dot"></span>`;
  return `<div class="row ${s ? 'is-' + s : ''}" data-id="${i.id}" style="--c:${c}">
    <div class="row-bg r">${icon('check', 18, 3)}&nbsp;Готово</div><div class="row-bg l">Удалить&nbsp;${icon('trash', 18)}</div>
    <div class="row-in">
      <button type="button" class="chk ${s}" data-a="toggle" data-id="${i.id}" aria-label="${esc(label)}">${chk}</button>
      <button type="button" class="row-txt" data-a="edit" data-id="${i.id}"><b>${esc(i.title)}</b>${itemMeta(i) ? `<small>${itemMeta(i)}</small>` : ''}</button>
      ${right}
    </div></div>`;
}

function eventCard(i) {
  const c = catOf(i.cat), col = colorOf(i.cat);
  const time = i.startTime ? i.startTime + (i.endTime ? ' – ' + i.endTime : '') : 'весь день';
  return `<button type="button" class="event soft press" data-a="edit" data-id="${i.id}" style="--c:${col}">
    <span class="bar"></span>
    <span class="row-txt"><b>${esc(i.title)}</b><small>${time}${c ? ' · ' + esc(c.name) : ''}${i.recurring ? ' ' + icon('repeat', 12, 2.2) : ''}</small></span>
    ${c ? `<span class="ic">${icon(c.icon, 20)}</span>` : ''}
  </button>`;
}

function notice(ic, color, title, sub, acts) {
  return `<div class="notice glass"><div class="n-ic" style="background:${color}22;color:${color}">${icon(ic, 18, 2.4)}</div><div class="n-txt"><b>${title}</b><span>${sub}</span></div><div class="n-acts">${acts}</div></div>`;
}

// ---------- шапка ----------
function renderTop() {
  const T = today();
  let h = '';
  if (ui.tab === 'cal') {
    const views = [['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год']];
    if (ui.view === 'day') {
      const sub = (ui.cur === T ? 'Сегодня · ' : ui.cur === addDays(T, 1) ? 'Завтра · ' : ui.cur === addDays(T, -1) ? 'Вчера · ' : '') + WD_FULL[wd(ui.cur)].toLowerCase();
      h += `<div class="hrow"><div><div class="h-sub">${U.cap(sub)}</div><div class="h-title">${fmtDay(ui.cur)}</div></div>
        <div style="display:flex;gap:8px">${ui.cur !== T ? `<button type="button" class="glass chip-btn press" style="height:44px;border-radius:22px;padding:0 14px" data-a="goToday">Сегодня</button>` : ''}
        <label class="glass round datepick press" aria-label="Выбрать дату">${icon('calendar', 20)}<input type="date" data-ch="pickDate" value="${ui.cur}"></label></div></div>`;
      h += seg(views, ui.view, 'view');
      const ws = weekStart(ui.cur);
      h += `<div class="week-strip">` + [0, 1, 2, 3, 4, 5, 6].map(k => {
        const d = addDays(ws, k), has = St.itemsForDate(d).length > 0;
        return `<button type="button" data-a="pickDay" data-d="${d}" ${d === ui.cur ? 'aria-current="date"' : ''} class="${d === T ? 'is-today' : ''}" aria-label="${WD_FULL[k]}, ${fmtDay(d)}"><span>${WD_SHORT[k]}</span><b>${U.pd(d).getDate()}</b>${has ? '<i></i>' : ''}</button>`;
      }).join('') + `</div>`;
    } else {
      let title = '', small = '';
      if (ui.view === 'week') {
        const a = weekStart(ui.cur), b = addDays(a, 6);
        title = U.pd(a).getMonth() === U.pd(b).getMonth() ? `${U.pd(a).getDate()}–${U.pd(b).getDate()} ${MONTHS_GEN[U.pd(b).getMonth()]}` : `${fmtDay(a)} – ${fmtDay(b)}`;
        const ps = St.periodStats(a, b); small = ps.total ? `выполнено ${ps.done} из ${ps.total}` : 'неделя';
      } else if (ui.view === 'month') {
        title = U.fmtMonthName(monthKey(ui.cur));
        const ps = St.periodStats(monthStart(ui.cur), monthEnd(ui.cur));
        small = yearKey(ui.cur) + (ps.total ? ` · выполнено ${Math.round(ps.done / ps.total * 100)}%` : '');
      } else { title = yearKey(ui.cur); small = 'год'; }
      h += `<div class="hrow center">${rbtn('chevron-left', 'prev', 'Назад')}<div class="h-mid"><div class="h-title">${esc(title)}</div><small>${esc(small)}</small></div>${rbtn('chevron-right', 'next', 'Вперёд')}</div>`;
      h += seg(views, ui.view, 'view');
    }
  } else if (ui.tab === 'goals') {
    const label = ui.gTab === 'month' ? U.fmtMonth(ui.gMonth) : ui.gYear + ' год';
    h += `<div class="hrow center">${rbtn('chevron-left', 'gPrev', 'Предыдущий период')}<div class="h-mid"><div class="h-title">Цели</div><small>${esc(label)}</small></div>${rbtn('chevron-right', 'gNext', 'Следующий период')}</div>`;
    h += seg([['month', 'Месяц'], ['year', 'Год']], ui.gTab, 'gTab');
  } else {
    const titles = { cats: 'Категории', kw: 'Словарь помощника', questions: 'Вопросы итогов', bg: 'Фон', reviews: 'Архив итогов' };
    if (ui.more) h += `<div class="hrow center">${rbtn('chevron-left', 'moreBack', 'Назад')}<div class="h-mid"><div class="h-title" style="font-size:24px">${titles[ui.more]}</div></div><span style="width:44px"></span></div>`;
    else h += `<div class="hrow"><div><div class="h-sub">July Daily</div><div class="h-title">Ещё</div></div></div>`;
  }
  $('#top').innerHTML = h;
}

// ---------- экраны ----------
function viewDay() {
  const T = ui.cur, today_ = today();
  let h = '';
  if (T === today_) {
    const pf = St.pendingFailed();
    if (pf.length) {
      const allY = pf.every(i => i.date === addDays(today_, -1));
      h += notice('x', '#D9485B', (allY ? 'Вчера не сделано: ' : 'Не сделано: ') + pf.length, 'Перенести на сегодня?', `<button type="button" class="btn btn-primary btn-sm" data-a="transferAll">Перенести</button><button type="button" class="round" style="width:34px;height:34px" data-a="dismissFailed" aria-label="Не переносить">${icon('x', 16)}</button>`);
    }
    const fg = St.pendingFailedGoals();
    if (fg.length) h += notice('target', '#8A63E8', 'Цели не достигнуты: ' + fg.length, esc(fg.slice(0, 2).map(g => g.title).join(', ')) + ' — перенести?', `<button type="button" class="btn btn-primary btn-sm" data-a="transferGoals">Перенести</button><button type="button" class="round" style="width:34px;height:34px" data-a="dismissGoals" aria-label="Не переносить">${icon('x', 16)}</button>`);
    for (const r of St.dueReviews()) {
      const names = { week: 'недели', month: 'месяца', year: 'года' };
      h += notice('sparkles', '#4F7CF5', 'Подведём итоги ' + names[r.type] + '?', 'Пара минут: статистика и короткая анкета', `<button type="button" class="btn btn-primary btn-sm" data-a="startReview" data-t="${r.type}" data-d="${r.anchor}">Начать</button><button type="button" class="round" style="width:34px;height:34px" data-a="skipReview" data-t="${r.type}" data-d="${r.anchor}" aria-label="Пропустить">${icon('x', 16)}</button>`);
    }
  }
  const { events, tasks } = St.sortDay(St.itemsForDate(T));
  if (!events.length && !tasks.length) {
    h += `<div class="empty soft"><b>${T < today_ ? 'В этот день ничего не было' : 'День свободен'}</b>Скажи помощнику, например «завтра в 15:00 созвон», или нажми «+».</div>`;
  }
  if (events.length) h += `<div class="sec-h"><h2>Встречи</h2><span>${events.length}</span></div>` + events.map(eventCard).join('');
  if (tasks.length) {
    const done = tasks.filter(t => t.effStatus === 'done').length;
    h += `<div class="sec-h"><h2>Задачи</h2><span>${done} из ${tasks.length}</span></div><div class="list soft" data-list="tasks">${tasks.map(taskRow).join('')}</div>`;
  }
  return `<div class="stack">${h}</div>`;
}

function viewWeek() {
  const a = weekStart(ui.cur), T = today();
  let h = '';
  for (let k = 0; k < 7; k++) {
    const d = addDays(a, k);
    const { events, tasks } = St.sortDay(St.itemsForDate(d));
    const done = tasks.filter(t => t.effStatus === 'done').length;
    h += `<div class="wk-day soft ${d === T ? 'today' : ''}"><button type="button" class="wk-h" data-a="openDay" data-d="${d}"><b>${WD_FULL[k]}, ${fmtDay(d)}</b><span>${tasks.length ? done + '/' + tasks.length : ''}</span></button>`;
    if (!events.length && !tasks.length) h += `<div class="wk-none">Свободно</div>`;
    for (const e of events) h += `<button type="button" class="wk-it" data-a="edit" data-id="${e.id}" style="--c:${colorOf(e.cat)}"><span class="t">${e.startTime || ''}</span><span class="dot"></span><span class="ttl">${esc(e.title)}</span></button>`;
    for (const t of tasks) {
      const s = t.effStatus;
      h += `<div class="wk-it ${s ? 'is-' + s : ''}" style="--c:${colorOf(t.cat)}"><button type="button" class="chk ${s}" data-a="toggle" data-id="${t.id}" aria-label="Отметить: ${esc(t.title)}">${s === 'done' ? icon('check', 13, 3.2) : s === 'fail' ? icon('x', 12, 3) : ''}</button><button type="button" class="ttl" style="text-align:left" data-a="edit" data-id="${t.id}">${esc(t.title)}${t.quota ? ` <span class="quota">${t.quota.done}/${t.quota.n}</span>` : ''}</button></div>`;
    }
    h += `</div>`;
  }
  return `<div class="stack">${h}</div>`;
}

function goalMini(g) {
  const p = St.goalProgress(g), col = goalColor(g);
  return `<button type="button" class="goal soft press" data-a="editGoal" data-id="${g.id}" style="--c:${col}"><div class="goal-h"><b>${esc(g.title)}</b><small>${esc(p.label)}</small></div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(p.pct * 100)}%"></div></div></button>`;
}

function viewMonth() {
  const ms = monthStart(ui.cur), me = monthEnd(ui.cur), T = today();
  let cells = '';
  for (let i = 0; i < wd(ms); i++) cells += '<span></span>';
  for (let d = ms; d <= me; d = addDays(d, 1)) {
    const items = St.itemsForDate(d);
    const tasks = items.filter(i => i.kind !== 'event' && !(i.quota && i.effStatus !== 'done'));
    const done = tasks.filter(i => i.effStatus === 'done').length;
    const cats = [...new Set(items.map(i => i.cat || '_'))].slice(0, 3);
    const cls = [d < T ? 'past' : '', d === T ? 'today' : '', d === ui.cur ? 'sel' : '', d < T && tasks.length && done === tasks.length ? 'full' : ''].join(' ');
    cells += `<button type="button" class="${cls}" data-a="openDay" data-d="${d}" aria-label="${fmtDay(d)}${tasks.length ? ', выполнено ' + done + ' из ' + tasks.length : ''}"><b>${U.pd(d).getDate()}</b><small>${tasks.length ? done + '/' + tasks.length : ''}</small><span class="dots">${items.length ? cats.map(c => `<i style="--c:${colorOf(c === '_' ? null : c)}"></i>`).join('') : ''}</span></button>`;
  }
  const mk = monthKey(ui.cur);
  const goals = St.goalsFor('month', mk);
  let h = `<div class="cal soft"><div class="cal-wd">${WD_SHORT.map(w => `<span>${w}</span>`).join('')}</div><div class="cal-grid">${cells}</div></div>`;
  h += `<div class="sec-h"><h2>Цели на ${U.MONTHS[Number(mk.slice(5)) - 1]}</h2><button type="button" data-a="goGoals" data-m="${mk}">Все цели</button></div>`;
  h += goals.length ? goals.map(goalMini).join('') : `<div class="empty soft">Целей на этот месяц пока нет.<br><button type="button" class="btn btn-ghost btn-sm" style="margin-top:10px" data-a="newGoal" data-l="month" data-p="${mk}">Добавить цель</button></div>`;
  return `<div class="stack">${h}</div>`;
}

function viewYear() {
  const y = yearKey(ui.cur), T = today();
  let h = '<div class="yr">';
  for (let m = 0; m < 12; m++) {
    const ms = y + '-' + U.pad(m + 1) + '-01';
    const ps = ms <= T ? St.periodStats(ms, monthEnd(ms) < T ? monthEnd(ms) : T) : { total: 0, done: 0 };
    const pct = ps.total ? ps.done / ps.total : 0;
    h += `<button type="button" class="soft press ${monthKey(T) === monthKey(ms) ? 'now' : ''}" data-a="openMonth" data-d="${ms}" style="--c:${pct >= .8 ? '#34A86B' : '#4F7CF5'}"><b>${U.cap(U.MONTHS[m]).slice(0, 3)}</b><div class="bar-track"><div class="bar-fill" style="width:${Math.round(pct * 100)}%"></div></div><small>${ps.total ? ps.done + ' из ' + ps.total : ms > T ? 'впереди' : '—'}</small></button>`;
  }
  h += '</div>';
  const goals = St.goalsFor('year', y);
  h += `<div class="sec-h"><h2>Цели на ${y} год</h2><button type="button" data-a="goGoalsYear" data-y="${y}">Все цели</button></div>`;
  h += goals.length ? goals.map(goalMini).join('') : `<div class="empty soft">Целей на этот год пока нет.<br><button type="button" class="btn btn-ghost btn-sm" style="margin-top:10px" data-a="newGoal" data-l="year" data-p="${y}">Добавить цель</button></div>`;
  return `<div class="stack">${h}</div>`;
}

function goalCard(g) {
  const p = St.goalProgress(g), col = goalColor(g), pct = Math.round(p.pct * 100);
  const fail = g.status === 'fail';
  if (g.level === 'year') {
    return `<button type="button" class="goal year glass press ${fail ? 'is-fail' : ''}" data-a="editGoal" data-id="${g.id}">${ring(p.pct, 72, col)}<span class="g-txt"><small>${fail ? 'не достигнута' : 'Цель года'}</small><b style="font-size:18px">${esc(g.title)}</b><small>${esc(p.label)}</small></span></button>` +
      (g.type === 'counter' ? `<div class="goal soft" style="--c:${col}"><div class="goal-ctr"><button type="button" class="ctr-btn" style="background:var(--track);color:var(--accent)" data-a="goalDec" data-id="${g.id}" aria-label="Убавить">${icon('minus', 18, 2.6)}</button><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><span class="num">${g.count} / ${g.target}</span><button type="button" class="ctr-btn" style="background:${col}" data-a="goalInc" data-id="${g.id}" aria-label="Прибавить">${icon('plus', 18, 2.6)}</button></div></div>` : '') +
      (g.type === 'check' ? `<div class="goal soft" style="--c:${col}"><div class="goal-ctr"><button type="button" class="chk ${g.checked ? 'done' : ''}" data-a="goalCheck" data-id="${g.id}" aria-label="Отметить цель достигнутой">${g.checked ? icon('check', 15, 3.2) : ''}</button><span>${g.checked ? 'Достигнута' : 'Отметить достигнутой'}</span></div></div>` : '');
  }
  const parent = g.parent ? St.goal(g.parent) : null;
  let body = '';
  if (g.type === 'counter') body = `<div class="goal-ctr"><button type="button" class="ctr-btn" style="background:var(--track);color:var(--accent)" data-a="goalDec" data-id="${g.id}" aria-label="Убавить">${icon('minus', 18, 2.6)}</button><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><span class="num">${g.count} / ${g.target}</span><button type="button" class="ctr-btn" style="background:${col}" data-a="goalInc" data-id="${g.id}" aria-label="Прибавить">${icon('plus', 18, 2.6)}</button></div>`;
  else if (g.type === 'check') body = `<div class="goal-ctr"><button type="button" class="chk ${g.checked ? 'done' : ''}" data-a="goalCheck" data-id="${g.id}" aria-label="Отметить цель достигнутой">${g.checked ? icon('check', 15, 3.2) : ''}</button><span style="font-size:15px">${g.checked ? 'Достигнута' : 'Отметить достигнутой'}</span></div>`;
  else body = `<div class="bar-track" style="height:8px"><div class="bar-fill" style="width:${pct}%"></div></div><small>${esc(p.label)}</small>`;
  return `<div class="goal soft ${fail ? 'is-fail' : ''}" style="--c:${col}"><button type="button" class="goal-h" data-a="editGoal" data-id="${g.id}" style="text-align:left;width:100%"><b>${esc(g.title)}${fail ? ' · не достигнута' : ''}</b><span class="badge" style="background:${col}22;color:${col}">${typeLabel[g.type]}</span></button>${body}${parent ? `<small>Цель года: ${esc(parent.title)}</small>` : ''}</div>`;
}

function viewGoals() {
  let h = '';
  const fg = St.pendingFailedGoals();
  if (fg.length) h += notice('target', '#8A63E8', 'Не достигнуто: ' + fg.length, esc(fg.map(g => g.title).join(', ')), `<button type="button" class="btn btn-primary btn-sm" data-a="transferGoals">Перенести</button><button type="button" class="round" style="width:34px;height:34px" data-a="dismissGoals" aria-label="Не переносить">${icon('x', 16)}</button>`);
  if (ui.gTab === 'month') {
    const year = St.goalsFor('year', ui.gMonth.slice(0, 4));
    const goals = St.goalsFor('month', ui.gMonth);
    if (goals.length) h += goals.map(goalCard).join('');
    else h += `<div class="empty soft"><b>Целей на ${U.MONTHS[Number(ui.gMonth.slice(5)) - 1]} пока нет</b>Нажми «+», чтобы добавить цель месяца.</div>`;
    if (year.length) h += `<div class="sec-h"><h2>Цели года</h2><button type="button" data-a="gTab" data-v="year">Открыть</button></div>` + year.map(goalMini).join('');
  } else {
    const goals = St.goalsFor('year', ui.gYear);
    if (goals.length) h += goals.map(goalCard).join('');
    else h += `<div class="empty soft"><b>Целей на ${ui.gYear} год пока нет</b>Нажми «+», чтобы добавить цель года.</div>`;
  }
  return `<div class="stack">${h}</div>`;
}

function viewMore() {
  const s = st();
  if (ui.more === 'cats') {
    return `<div class="stack"><div class="menu soft">${s.cats.map(c => `<button type="button" data-a="editCat" data-id="${c.id}"><span class="mi-ic" style="--c:${c.color}">${icon(c.icon, 17)}</span><span class="mi-txt">${esc(c.name)}</span><span class="mi-end">${icon('chevron-right', 18)}</span></button>`).join('')}</div>
      <button type="button" class="btn btn-ghost" data-a="addCat">${icon('plus', 18)} Новая категория</button></div>`;
  }
  if (ui.more === 'kw') {
    const opts = s.cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    return `<div class="stack"><p class="cap">Когда в фразе для помощника встречается слово из списка, запись получает эту категорию. Достаточно начала слова: «стоматолог» найдётся и в «стоматолога».</p>
      <div class="field" style="padding:8px"><div class="kw-row"><input type="text" id="kw-new" placeholder="Слово или начало слова" style="border:0;background:transparent;padding:8px;font-size:16px;outline:none"><select id="kw-cat" style="border:0;background:var(--track);border-radius:10px;padding:8px;font-size:15px">${opts}</select><button type="button" class="ctr-btn" style="background:var(--accent);color:var(--on-accent)" data-a="kwAdd" aria-label="Добавить слово">${icon('plus', 18, 2.6)}</button></div></div>
      <div class="menu soft">${s.keywords.map((k, i) => { const c = St.cat(k.cat); return `<div class="mi"><span class="mi-ic" style="--c:${c ? c.color : '#8E8AA3'}">${icon(c ? c.icon : 'tag', 16)}</span><span class="mi-txt">${esc(k.word)}<small>${c ? esc(c.name) : 'категория удалена'}</small></span><button type="button" class="round" style="width:36px;height:36px;color:var(--text3)" data-a="kwDel" data-i="${i}" aria-label="Удалить слово ${esc(k.word)}">${icon('x', 16)}</button></div>`; }).join('')}</div></div>`;
  }
  if (ui.more === 'questions') {
    const qs = s.questions[ui.qTab];
    return `<div class="stack">${seg([['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год']], ui.qTab, 'qTab', 'small')}
      <p class="cap">Вопрос, который начинается со слова «Оценка», показывается шкалой от 1 до 10.</p>
      ${qs.map((q, i) => `<div class="field kw-row" style="padding-right:6px"><input type="text" value="${esc(q)}" data-ch="qEdit" data-i="${i}" aria-label="Вопрос ${i + 1}"><button type="button" class="round" style="width:36px;height:36px;color:var(--text3)" data-a="qDel" data-i="${i}" aria-label="Удалить вопрос">${icon('x', 16)}</button></div>`).join('')}
      <button type="button" class="btn btn-ghost" data-a="qAdd">${icon('plus', 18)} Добавить вопрос</button>
      <button type="button" class="btn btn-danger" data-a="qReset">Вернуть вопросы по умолчанию</button></div>`;
  }
  if (ui.more === 'bg') {
    const p = s.settings.photo;
    return `<div class="stack"><div class="opt-list"><button type="button" data-a="bgMode" data-v="auto">По времени суток<span class="ok">${s.settings.bg !== 'photo' ? icon('check', 20, 2.6) : ''}</span></button><button type="button" data-a="bgMode" data-v="photo" ${p ? '' : 'disabled style="opacity:.5"'}>Своё фото<span class="ok">${s.settings.bg === 'photo' ? icon('check', 20, 2.6) : ''}</span></button></div>
      <p class="cap">Утром и днём интерфейс светлый, вечером и ночью — тёмный. С фото тема тоже меняется по времени суток.</p>
      ${p ? `<div class="soft" style="border-radius:22px;height:180px;background:url(&quot;${p}&quot;) center/cover"></div>` : ''}
      <label class="btn btn-ghost">${icon('image', 18)} ${p ? 'Выбрать другое фото' : 'Выбрать фото'}<input type="file" accept="image/*" data-ch="photo" class="sr"></label>
      ${p ? `<button type="button" class="btn btn-danger" data-a="photoDel">Удалить фото</button>` : ''}</div>`;
  }
  if (ui.more === 'reviews') {
    const list = [...s.reviews].sort((a, b) => b.from.localeCompare(a.from));
    if (!list.length) return `<div class="empty soft"><b>Итогов пока нет</b>Они появятся здесь после первой анкеты.</div>`;
    return `<div class="menu soft">${list.map(r => { const n = { week: 'Неделя', month: 'Месяц', year: 'Год' }[r.type]; const sub = r.skipped ? 'пропущено' : r.stats && r.stats.total ? `выполнено ${Math.round(r.stats.done / r.stats.total * 100)}%` : 'без задач'; return `<button type="button" data-a="viewReview" data-id="${r.id}"><span class="mi-ic" style="--c:${r.skipped ? '#8E8AA3' : '#4F7CF5'}">${icon(r.type === 'week' ? 'list' : r.type === 'month' ? 'calendar' : 'star', 16)}</span><span class="mi-txt">${n}: ${esc(periodLabel(r))}<small>${sub}</small></span><span class="mi-end">${icon('chevron-right', 18)}</span></button>`; }).join('')}</div>`;
  }
  const lb = s.settings.lastBackup;
  return `<div class="stack">
    <div class="menu soft">
      <button type="button" data-a="more" data-v="cats"><span class="mi-ic" style="--c:#4F7CF5">${icon('tag', 17)}</span><span class="mi-txt">Категории</span><span class="mi-end">${s.cats.length} ${icon('chevron-right', 18)}</span></button>
      <button type="button" data-a="more" data-v="kw"><span class="mi-ic" style="--c:#8A63E8">${icon('sparkles', 17)}</span><span class="mi-txt">Словарь помощника<small>Какие слова дают какую категорию</small></span><span class="mi-end">${icon('chevron-right', 18)}</span></button>
      <button type="button" data-a="more" data-v="questions"><span class="mi-ic" style="--c:#E85D9A">${icon('message', 17)}</span><span class="mi-txt">Вопросы итогов</span><span class="mi-end">${icon('chevron-right', 18)}</span></button>
      <button type="button" data-a="more" data-v="bg"><span class="mi-ic" style="--c:#F08A3E">${icon('image', 17)}</span><span class="mi-txt">Фон</span><span class="mi-end">${s.settings.bg === 'photo' ? 'фото' : 'по времени'} ${icon('chevron-right', 18)}</span></button>
    </div>
    <div class="menu soft">
      <button type="button" data-a="reviewNow" data-t="week"><span class="mi-ic" style="--c:#34A86B">${icon('list', 17)}</span><span class="mi-txt">Подвести итоги недели</span><span class="mi-end">${icon('chevron-right', 18)}</span></button>
      <button type="button" data-a="reviewNow" data-t="month"><span class="mi-ic" style="--c:#34A86B">${icon('calendar', 17)}</span><span class="mi-txt">Подвести итоги месяца</span><span class="mi-end">${icon('chevron-right', 18)}</span></button>
      <button type="button" data-a="more" data-v="reviews"><span class="mi-ic" style="--c:#14A3A3">${icon('archive', 17)}</span><span class="mi-txt">Архив итогов</span><span class="mi-end">${s.reviews.length} ${icon('chevron-right', 18)}</span></button>
    </div>
    <div class="menu soft">
      <button type="button" data-a="backup"><span class="mi-ic" style="--c:#3FA9F5">${icon('download', 17)}</span><span class="mi-txt">Сохранить бэкап<small>${lb ? 'Последний: ' + fmtDay(lb.slice(0, 10)) : 'Ещё ни разу'}</small></span></button>
      <label><span class="mi-ic" style="--c:#6B7A8F">${icon('upload', 17)}</span><span class="mi-txt">Восстановить из файла<small>Заменит все текущие данные</small></span><input type="file" accept="application/json,.json" data-ch="restore" class="sr"></label>
    </div>
    <p class="cap">July Daily ${VERSION}. Все данные хранятся только на этом телефоне. Если удалить приложение с экрана «Домой», они пропадут — сохраняй бэкап в «Файлы» или iCloud Drive.</p>
  </div>`;
}
export function periodLabel(r) {
  if (r.type === 'week') return U.pd(r.from).getDate() + ' ' + (U.pd(r.from).getMonth() !== U.pd(r.to).getMonth() ? MONTHS_GEN[U.pd(r.from).getMonth()] + ' ' : '') + '– ' + fmtDay(r.to);
  if (r.type === 'month') return U.fmtMonth(monthKey(r.from)).toLowerCase();
  return yearKey(r.from);
}

function renderMain() {
  const m = $('#main');
  let h;
  if (ui.tab === 'cal') h = ui.view === 'day' ? viewDay() : ui.view === 'week' ? viewWeek() : ui.view === 'month' ? viewMonth() : viewYear();
  else if (ui.tab === 'goals') h = viewGoals();
  else h = viewMore();
  m.innerHTML = h;
}

function renderTabs() {
  const tabs = [['cal', 'calendar', 'Календарь'], ['goals', 'target', 'Цели'], ['more', 'more', 'Ещё']];
  $('#tabs').innerHTML = tabs.map(([v, ic, l]) => `<button type="button" data-a="tab" data-v="${v}" ${ui.tab === v ? 'aria-current="page"' : ''}>${icon(ic, 22)}${l}</button>`).join('');
  const plus = $('#plus');
  plus.innerHTML = icon('plus', 26, 2.4);
  plus.setAttribute('aria-label', ui.tab === 'goals' ? 'Новая цель' : ui.tab === 'more' && ui.more === 'cats' ? 'Новая категория' : 'Новая задача');
}

let keepScroll = false;
export function render(opts = {}) {
  const m = $('#main'), y = m.scrollTop;
  applyTheme(); renderTop(); renderMain(); renderTabs();
  if (opts.keep !== false && keepScroll) m.scrollTop = y;
  keepScroll = true;
}
function go(fn) { keepScroll = false; fn(); render(); $('#main').scrollTop = 0; }

// ---------- действия ----------
const A = {
  tab: el => go(() => { ui.tab = el.dataset.v; if (ui.tab !== 'more') ui.more = null; if (ui.tab === 'cal' && ui.view === 'day' && ui.cur !== today()) {} }),
  view: el => go(() => { ui.view = el.dataset.v; }),
  prev: () => go(() => shiftPeriod(-1)),
  next: () => go(() => shiftPeriod(1)),
  goToday: () => go(() => { ui.cur = today(); }),
  pickDay: el => { ui.cur = el.dataset.d; render(); },
  openDay: el => go(() => { ui.cur = el.dataset.d; ui.view = 'day'; ui.tab = 'cal'; }),
  openMonth: el => go(() => { ui.cur = el.dataset.d; ui.view = 'month'; }),
  toggle: el => {
    const id = el.dataset.id, f = St.findItem(id); if (!f) return;
    const cur = f.item ? f.item.status : (f.rule.st || {})[f.date] || '';
    const next = cur === 'done' ? '' : 'done';
    St.setStatus(id, next);
    if (f.item && f.item.handled && next === '') f.item.handled = false;
    render();
    const nb = document.querySelector(`.chk[data-id="${CSS.escape(id)}"]`); if (nb && next === 'done') nb.classList.add('pop');
  },
  edit: el => openItemEditor({ id: el.dataset.id }),
  moveTomorrow: el => { St.transferOne(el.dataset.id, addDays(today(), 1)); render(); toast('Перенесено на завтра'); },
  transferAll: () => { const ids = St.pendingFailed().map(i => i.id); St.transferFailed(ids); render(); toast(ids.length + ' ' + plural(ids.length, 'задача перенесена', 'задачи перенесены', 'задач перенесено') + ' на сегодня'); },
  dismissFailed: () => { St.dismissFailed(St.pendingFailed().map(i => i.id)); render(); },
  transferGoals: () => { St.transferGoals(St.pendingFailedGoals().map(g => g.id)); render(); toast('Цели перенесены'); },
  dismissGoals: () => { St.dismissGoals(St.pendingFailedGoals().map(g => g.id)); render(); },
  startReview: el => openReview(el.dataset.t, el.dataset.d),
  skipReview: el => { St.saveReview(el.dataset.t, el.dataset.d, [], true); render(); toast('Итоги пропущены', 'Вернуть', () => { St.S.reviews.pop(); St.save(); render(); }); },
  reviewNow: el => openReview(el.dataset.t, today()),
  viewReview: el => openReviewView(el.dataset.id),
  gTab: el => go(() => { ui.gTab = el.dataset.v; }),
  gPrev: () => go(() => { if (ui.gTab === 'month') ui.gMonth = monthKey(addMonths(ui.gMonth + '-01', -1)); else ui.gYear = String(Number(ui.gYear) - 1); }),
  gNext: () => go(() => { if (ui.gTab === 'month') ui.gMonth = monthKey(addMonths(ui.gMonth + '-01', 1)); else ui.gYear = String(Number(ui.gYear) + 1); }),
  goGoals: el => go(() => { ui.tab = 'goals'; ui.gTab = 'month'; ui.gMonth = el.dataset.m; }),
  goGoalsYear: el => go(() => { ui.tab = 'goals'; ui.gTab = 'year'; ui.gYear = el.dataset.y; }),
  newGoal: el => openGoalEditor({ level: el.dataset.l, period: el.dataset.p }),
  editGoal: el => openGoalEditor({ id: el.dataset.id }),
  goalInc: el => { const g = St.goal(el.dataset.id); g.count = (g.count || 0) + 1; St.save(); render(); if (g.count === g.target) toast('Цель «' + g.title + '» достигнута'); },
  goalDec: el => { const g = St.goal(el.dataset.id); g.count = Math.max(0, (g.count || 0) - 1); St.save(); render(); },
  goalCheck: el => { const g = St.goal(el.dataset.id); g.checked = !g.checked; St.save(); render(); },
  more: el => go(() => { ui.more = el.dataset.v; }),
  moreBack: () => go(() => { ui.more = null; }),
  editCat: el => openCatEditor({ id: el.dataset.id }),
  addCat: () => openCatEditor({}),
  kwAdd: () => {
    const inp = $('#kw-new'), w = inp.value.trim().toLowerCase(); if (!w) { inp.focus(); return; }
    St.S.keywords.unshift({ word: w, cat: $('#kw-cat').value }); St.save(); render(); toast('Слово добавлено');
  },
  kwDel: el => { St.S.keywords.splice(Number(el.dataset.i), 1); St.save(); render(); },
  qTab: el => { ui.qTab = el.dataset.v; render(); },
  qAdd: () => { St.S.questions[ui.qTab].push('Новый вопрос'); St.save(); render(); const ins = document.querySelectorAll('[data-ch="qEdit"]'); const last = ins[ins.length - 1]; if (last) { last.focus(); last.select(); } },
  qDel: el => { St.S.questions[ui.qTab].splice(Number(el.dataset.i), 1); St.save(); render(); },
  qReset: () => { St.S.questions[ui.qTab] = [...St.DEFAULT_QUESTIONS]; St.save(); render(); toast('Вопросы восстановлены'); },
  bgMode: el => { St.S.settings.bg = el.dataset.v; St.save(); render(); },
  photoDel: () => { St.S.settings.photo = null; St.S.settings.bg = 'auto'; St.save(); render(); },
  backup: () => doBackup()
};

function shiftPeriod(n) {
  if (ui.view === 'day') ui.cur = addDays(ui.cur, n);
  else if (ui.view === 'week') ui.cur = addDays(ui.cur, 7 * n);
  else if (ui.view === 'month') ui.cur = monthStart(addMonths(monthStart(ui.cur), n));
  else ui.cur = String(Number(yearKey(ui.cur)) + n) + '-01-01';
}

const CH = {
  pickDate: el => { if (el.value) go(() => { ui.cur = el.value; }); },
  qEdit: el => { St.S.questions[ui.qTab][Number(el.dataset.i)] = el.value; St.save(); },
  photo: async el => {
    const f = el.files && el.files[0]; if (!f) return;
    try { St.S.settings.photo = await shrinkImage(f, 1400); St.S.settings.bg = 'photo'; St.save(); render(); toast('Фон обновлён'); }
    catch (e) { toast('Не получилось открыть фото'); }
  },
  restore: el => {
    const f = el.files && el.files[0]; if (!f) return;
    if (!confirm('Заменить все текущие данные данными из файла? Это нельзя отменить.')) { el.value = ''; return; }
    const r = new FileReader();
    r.onload = () => { try { St.importJSON(r.result); render(); toast('Данные восстановлены'); } catch (e) { toast('Файл не подошёл: ' + e.message); } };
    r.readAsText(f);
  }
};

function shrinkImage(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = rej; img.src = url;
  });
}

async function doBackup() {
  const name = 'july-daily-' + today() + '.json';
  const blob = new Blob([St.exportJSON()], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Бэкап July Daily' });
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    St.S.settings.lastBackup = new Date().toISOString(); St.save(); render();
    toast('Бэкап сохранён');
  } catch (e) { if (e && e.name !== 'AbortError') toast('Не получилось сохранить файл'); }
}
export { doBackup };

// ---------- клики и изменения ----------
let suppressClick = false;
document.addEventListener('click', e => {
  if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
  const el = e.target.closest('[data-a]');
  if (!el || el.closest('#sheets') || el.closest('#assist-card')) return;
  const fn = A[el.dataset.a];
  if (fn) { e.preventDefault(); fn(el, e); }
}, true);
document.addEventListener('change', e => {
  const el = e.target.closest('[data-ch]');
  if (!el || el.closest('#sheets')) return;
  const fn = CH[el.dataset.ch]; if (fn) fn(el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-ch="qEdit"]'); if (el) CH.qEdit(el);
});

$('#plus').addEventListener('click', () => {
  if (ui.tab === 'goals') openGoalEditor({ level: ui.gTab, period: ui.gTab === 'month' ? ui.gMonth : ui.gYear });
  else if (ui.tab === 'more' && ui.more === 'cats') openCatEditor({});
  else openItemEditor({ date: ui.tab === 'cal' && ui.view === 'day' ? ui.cur : ui.cur >= today() ? ui.cur : today() });
});

// ---------- жесты: свайп по задаче, перетаскивание, листание дней ----------
const main = $('#main');
let G = null;
main.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  const row = e.target.closest('.row');
  G = { x: t.clientX, y: t.clientY, row, mode: null, t0: Date.now(), lp: null };
  if (row && !e.target.closest('.chk, .chip-btn')) {
    G.lp = setTimeout(() => { if (G && !G.mode) startDrag(); }, 420);
  }
}, { passive: true });

main.addEventListener('touchmove', e => {
  if (!G) return;
  const t = e.touches[0], dx = t.clientX - G.x, dy = t.clientY - G.y;
  if (!G.mode) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    clearTimeout(G.lp);
    if (Math.abs(dx) > Math.abs(dy) * 1.3) G.mode = G.row ? 'swipe' : 'page';
    else { G.mode = 'scroll'; return; }
  }
  if (G.mode === 'scroll') return;
  e.preventDefault();
  if (G.mode === 'swipe') {
    const inEl = G.row.querySelector('.row-in');
    const x = Math.max(-140, Math.min(140, dx));
    inEl.style.transition = 'none'; inEl.style.transform = `translateX(${x}px)`;
    G.row.querySelector('.row-bg.r').style.opacity = x > 0 ? Math.min(1, x / 90) : 0;
    G.row.querySelector('.row-bg.l').style.opacity = x < 0 ? Math.min(1, -x / 90) : 0;
    G.dx = x;
  } else if (G.mode === 'drag') {
    moveDrag(t.clientY);
  }
}, { passive: false });

main.addEventListener('touchend', e => {
  if (!G) return;
  clearTimeout(G.lp);
  const g = G; G = null;
  const t = e.changedTouches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
  if (g.mode === 'swipe') {
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 350);
    const inEl = g.row.querySelector('.row-in');
    inEl.style.transition = ''; inEl.style.transform = '';
    g.row.querySelectorAll('.row-bg').forEach(b => b.style.opacity = 0);
    const id = g.row.dataset.id;
    if (g.dx > 80) { A.toggle({ dataset: { id } }); }
    else if (g.dx < -80) { swipeDelete(id); }
  } else if (g.mode === 'drag') { endDrag(); suppressClick = true; setTimeout(() => { suppressClick = false; }, 350); }
  else if (g.mode === 'page' && Math.abs(dx) > 70 && Math.abs(dy) < 60 && ui.tab === 'cal') {
    shiftPeriod(dx < 0 ? 1 : -1); keepScroll = false; render(); main.scrollTop = 0;
  }
}, { passive: true });
main.addEventListener('touchcancel', () => { if (G && G.mode === 'drag') endDrag(); G = null; });

function swipeDelete(id) {
  const f = St.findItem(id); if (!f) return;
  if (f.rule) { openScope('Удалить повторяющуюся задачу?', scope => { St.deleteItem(id, scope); render(); toast('Удалено'); }, true); return; }
  const backup = JSON.parse(JSON.stringify(f.item));
  St.deleteItem(id); render();
  toast('Задача удалена', 'Вернуть', () => { St.S.items.push(backup); St.save(); render(); });
}

let D = null;
function startDrag() {
  const row = G.row, list = row.closest('[data-list="tasks"]'); if (!list) return;
  G.mode = 'drag';
  if (navigator.vibrate) navigator.vibrate(10);
  const rows = [...list.querySelectorAll('.row')];
  D = { row, list, rows, idx: rows.indexOf(row), startY: G.y, h: row.offsetHeight, mids: rows.map(r => { const b = r.getBoundingClientRect(); return b.top + b.height / 2; }) };
  row.classList.add('dragging');
}
function moveDrag(y) {
  if (!D) return;
  const dy = y - D.startY;
  D.row.style.transform = `translateY(${dy}px)`;
  const cy = D.mids[D.idx] + dy;
  let to = D.mids.findIndex(m => cy < m); if (to === -1) to = D.rows.length - 1; else if (to > D.idx) to--;
  D.to = to;
  D.rows.forEach((r, i) => {
    if (r === D.row) return;
    let s = 0;
    if (D.idx < to && i > D.idx && i <= to) s = -D.h;
    if (D.idx > to && i >= to && i < D.idx) s = D.h;
    r.style.transition = 'transform .2s'; r.style.transform = s ? `translateY(${s}px)` : '';
  });
}
function endDrag() {
  if (!D) return;
  const d = D; D = null;
  const ids = d.rows.map(r => r.dataset.id);
  if (d.to !== undefined && d.to !== d.idx) {
    const [m] = ids.splice(d.idx, 1); ids.splice(d.to, 0, m);
    ids.forEach((id, i) => { const f = St.findItem(id); if (!f) return; if (f.item) f.item.order = i; else f.rule.order = i; });
    St.save();
  }
  d.rows.forEach(r => { r.style.transform = ''; r.style.transition = ''; });
  d.row.classList.remove('dragging');
  render();
}

// ---------- запуск ----------
function tick() {
  const t = today();
  if (t !== ui.lastToday) { if (ui.cur === ui.lastToday) ui.cur = t; ui.lastToday = t; render(); }
  else applyTheme();
}

async function start() {
  await St.load();
  render();
  initAssistant();
  setInterval(tick, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  registerSW();
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => toast('Доступна новая версия', 'Обновить', () => w.postMessage('skip'), 15000);
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    setInterval(() => reg.update().catch(() => {}), 3600 * 1000);
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

start();
export { closeAllSheets, describeRec, sheetOpen };

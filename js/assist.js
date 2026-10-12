// July Daily — помощник: голос, разбор фразы, карточка подтверждения
import { icon, esc, today, addDays, fmtDay, fmtDayFull, relDay, addMinutes, cap, plural, pd } from './util.js';
import * as St from './store.js';
import { parse, matchItems } from './parser.js';
import { render, toast, ui } from './app.js';
import { openItemEditor, describeRec, sheetOpen } from './sheets.js';

const $ = s => document.querySelector(s);
let card, input, btn, form, recog = null, listening = false, hideTimer = null, actions = {};

export function initAssistant() {
  card = $('#assist-card'); input = $('#ask-input'); btn = $('#ask-btn'); form = $('#ask');
  $('#ask .ask-spark').innerHTML = icon('sparkles', 18);
  setBtn();
  input.addEventListener('input', setBtn);
  form.addEventListener('submit', e => { e.preventDefault(); submit(); });
  btn.addEventListener('click', () => {
    if (listening) { stopVoice(); return; }
    if (input.value.trim()) submit(); else startVoice();
  });
  card.addEventListener('click', e => {
    const el = e.target.closest('[data-x]'); if (!el) return;
    e.preventDefault();
    const fn = actions[el.dataset.x]; if (fn) fn(el);
  });
  document.querySelector('#main').addEventListener('touchstart', () => { if (card.innerHTML && !card.dataset.sticky) hide(); }, { passive: true });
  document.querySelector('#tabs').addEventListener('click', () => hide());
}

function setBtn() {
  const has = input.value.trim().length > 0;
  btn.innerHTML = listening ? icon('stop', 16) : has ? icon('send', 18, 2.2) : icon('mic', 18, 2.2);
  btn.setAttribute('aria-label', listening ? 'Остановить запись' : has ? 'Отправить' : 'Голосовой ввод');
  form.classList.toggle('listening', listening);
}

function submit() {
  const t = input.value.trim(); if (!t) return;
  input.value = ''; input.blur(); setBtn();
  handle(t);
}

// ---------- голос ----------
function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    toast('Голосовой ввод тут недоступен — нажми на поле и продиктуй через микрофон клавиатуры', null, null, 5000);
    input.focus(); return;
  }
  try {
    recog = new SR();
    recog.lang = 'ru-RU'; recog.interimResults = true; recog.continuous = false; recog.maxAlternatives = 1;
    let finalText = '';
    recog.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript; else interim += e.results[i][0].transcript;
      }
      input.value = (finalText + interim).trim();
    };
    recog.onerror = e => {
      const m = { 'not-allowed': 'Нет доступа к микрофону — разреши его в настройках', 'service-not-allowed': 'Распознавание речи недоступно — продиктуй через микрофон клавиатуры', 'no-speech': 'Ничего не услышала, попробуй ещё раз', 'audio-capture': 'Микрофон не найден', 'network': 'Для распознавания речи нужен интернет — продиктуй через клавиатуру' };
      toast(m[e.error] || 'Не получилось распознать речь', null, null, 4500);
      if (e.error === 'service-not-allowed' || e.error === 'network') input.focus();
    };
    recog.onend = () => {
      listening = false; setBtn();
      const t = (finalText || input.value).trim();
      if (t) { input.value = ''; setBtn(); handle(t); }
    };
    recog.start();
    listening = true; input.value = ''; input.placeholder = 'Слушаю…'; setBtn();
    hide();
  } catch (e) { listening = false; setBtn(); toast('Не получилось включить микрофон'); }
}
function stopVoice() { if (recog) try { recog.stop(); } catch (_) {} input.placeholder = 'Скажи или напиши…'; }

// ---------- карточка ----------
function show(html, said, sticky = true) {
  clearTimeout(hideTimer);
  input.placeholder = 'Скажи или напиши…';
  card.dataset.sticky = sticky ? '1' : '';
  card.innerHTML = (said ? `<div style="display:flex;justify-content:flex-end"><div class="a-said">${esc(said)}</div></div>` : '') + `<div class="a-card glass">${html}</div>`;
  document.body.classList.toggle('assist-on', sticky);
  setTimeout(() => { card.dataset.sticky = ''; }, 600);
}
export function hide() { clearTimeout(hideTimer); card.innerHTML = ''; actions = {}; document.body.classList.remove('assist-on'); }
const head = (ic, text) => `<div class="a-head">${icon(ic, 16)}<span>${esc(text)}</span><button type="button" class="x" data-x="close" aria-label="Закрыть">${icon('x', 16)}</button></div>`;
const whenText = it => (it.date ? cap(fmtDayFull(it.date).toLowerCase()) : '') + (it.startTime ? ', ' + it.startTime + (it.endTime ? '–' + it.endTime : '') : '');

function guessCat(text) {
  const low = String(text || '').toLowerCase().replace(/ё/g, 'е');
  for (const k of St.S.keywords) if (k.word && low.includes(k.word.toLowerCase().replace(/ё/g, 'е')) && St.cat(k.cat)) return k.cat;
  return null;
}

function handle(text) {
  if (sheetOpen()) return;
  const r = parse(text);
  actions = { close: () => hide() };
  if (r.action === 'create') return confirmCreate(r, text);
  if (r.action === 'query') return showDay(r.date, text);
  if (r.action === 'delete' || r.action === 'move' || r.action === 'done') return command(r, text);
  // не поняли — предлагаем создать задачу как есть
  actions.create = () => { hide(); openItemEditor({ preset: { title: cap(text), date: ui.cur >= today() ? ui.cur : today() } }); };
  show(head('sparkles', 'Не совсем поняла') + `<div style="font-size:15px;color:var(--text2)">Можно сказать, например: «завтра в 15:00 стоматолог», «перенеси созвон на пятницу», «что у меня завтра?».</div><div class="a-btns"><button type="button" class="btn btn-ghost" data-x="close">Закрыть</button><button type="button" class="btn btn-primary" data-x="create">Создать задачу</button></div>`, text);
}

// ---------- создание ----------
function confirmCreate(r, said) {
  const d = { kind: r.kind, title: r.title, date: r.date, startTime: r.kind === 'event' ? r.startTime : null, endTime: r.kind === 'event' ? r.endTime : null, rec: r.rec, end: { type: 'never' }, cat: guessCat(r.title + ' ' + said), note: '', goal: null };
  if (d.rec && d.rec.type === 'yearly') { const dt = pd(d.date); d.rec.month = dt.getMonth(); d.rec.day = dt.getDate(); }
  const c = St.cat(d.cat);
  const kindLabel = d.rec ? (d.kind === 'event' ? 'Повторяющаяся встреча' : 'Повторяющаяся задача') : (d.kind === 'event' ? 'Новая встреча' : 'Новая задача');
  actions.edit = () => { hide(); openItemEditor({ preset: d }); };
  actions.save = () => {
    let undo;
    if (d.rec) { const rule = St.addRule({ kind: d.kind, title: d.title, note: '', cat: d.cat, goal: null, startTime: d.startTime, endTime: d.endTime, start: d.date, rec: d.rec, end: d.end }); undo = () => { St.S.rules = St.S.rules.filter(x => x !== rule); St.save(); }; }
    else { const it = St.addItem({ kind: d.kind, title: d.title, date: d.date, startTime: d.startTime, endTime: d.endTime, cat: d.cat }); undo = () => { St.S.items = St.S.items.filter(x => x !== it); St.save(); }; }
    render();
    actions.undo = () => { undo(); hide(); render(); toast('Отменено'); };
    show(`<div style="display:flex;align-items:center;gap:12px"><span style="width:40px;height:40px;border-radius:20px;background:var(--ok);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon('check', 20, 3)}</span><span style="flex:1;min-width:0;display:flex;flex-direction:column"><b style="font-size:16px">Записала</b><span style="font-size:13px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.title)} · ${esc(d.rec ? describeRec(d.rec, d.end, d.date).toLowerCase() : relDay(d.date).toLowerCase() + (d.startTime ? ', ' + d.startTime : ''))}</span></span><button type="button" class="btn btn-ghost btn-sm" data-x="undo">Отменить</button></div>`, null, false);
    hideTimer = setTimeout(hide, 5000);
  };
  show(head('sparkles', kindLabel) +
    `<div class="a-title"><span class="bar" style="background:${c ? c.color : '#8E8AA3'}"></span><div style="min-width:0"><b>${esc(d.title)}</b><span>${esc(d.rec ? 'с ' + fmtDay(d.date) : cap(fmtDayFull(d.date).toLowerCase()))}</span></div></div>
     <div class="a-grid">
       <div><small>${d.kind === 'event' ? 'Время' : 'Время'}</small><strong>${d.startTime ? d.startTime + (d.endTime ? ' – ' + d.endTime : '') : 'без времени'}</strong></div>
       <div><small>Категория</small><strong>${c ? `<span class="dot" style="--c:${c.color}"></span>${esc(c.name)}` : 'без категории'}</strong></div>
       ${d.rec ? `<div style="grid-column:span 2"><small>Повтор</small><strong>${icon('repeat', 14, 2.2)} ${esc(describeRec(d.rec, d.end, d.date))}</strong></div>` : ''}
     </div>
     <div class="a-btns"><button type="button" class="btn btn-ghost" data-x="edit">Изменить</button><button type="button" class="btn btn-primary" data-x="save">Сохранить</button></div>`, said);
}

// ---------- «что у меня …» ----------
function showDay(date, said) {
  const { events, tasks } = St.sortDay(St.itemsForDate(date));
  actions.open = () => { hide(); ui.tab = 'cal'; ui.view = 'day'; ui.cur = date; render(); };
  const lines = [...events.map(e => `<div><span class="dot" style="--c:${St.catColor(e.cat)}"></span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(e.title)}</span><small>${e.startTime || ''}</small></div>`),
    ...tasks.map(t => `<div><span class="dot" style="--c:${St.catColor(t.cat)}"></span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;${t.effStatus === 'done' ? 'text-decoration:line-through;color:var(--text3)' : ''}">${esc(t.title)}</span><small>${t.effStatus === 'done' ? 'готово' : t.effStatus === 'fail' ? 'не сделано' : ''}</small></div>`)];
  const sum = !lines.length ? 'Ничего не запланировано' : [events.length ? events.length + ' ' + plural(events.length, 'встреча', 'встречи', 'встреч') : '', tasks.length ? tasks.length + ' ' + plural(tasks.length, 'задача', 'задачи', 'задач') : ''].filter(Boolean).join(', ');
  show(head('calendar', relDay(date) + (relDay(date).includes(',') ? '' : ', ' + fmtDay(date))) +
    `<div style="font-size:15px;font-weight:600">${sum}</div>${lines.length ? `<div class="a-list" style="max-height:220px;overflow-y:auto">${lines.slice(0, 8).join('')}${lines.length > 8 ? `<div style="color:var(--text3)">и ещё ${lines.length - 8}</div>` : ''}</div>` : ''}
     <div class="a-btns"><button type="button" class="btn btn-ghost" data-x="close">Закрыть</button><button type="button" class="btn btn-primary" data-x="open">Открыть день</button></div>`, said);
}

// ---------- отмени / перенеси / отметь ----------
function command(r, said) {
  const T = today();
  let pool = St.upcomingItems(T, 120, r.action === 'done' ? 14 : 3);
  if (r.action === 'done') pool = pool.filter(i => i.kind !== 'event' && i.effStatus !== 'done' && i.date <= addDays(T, 14));
  if (r.action === 'delete' && r.date) pool = pool.filter(i => i.date === r.date);
  const found = matchItems(r.title, pool, T);
  const verb = { delete: 'удалить', move: 'перенести', done: 'отметить' }[r.action];
  if (!r.title) { show(head('search', 'Что ' + verb + '?') + `<div style="font-size:15px;color:var(--text2)">Назови запись, например: «${r.action === 'move' ? 'перенеси стоматолога на пятницу' : r.action === 'delete' ? 'отмени стоматолога' : 'отметь растяжку'}».</div>`, said); return; }
  if (!found.length) { show(head('search', 'Не нашла') + `<div style="font-size:15px;color:var(--text2)">Не вижу записи «${esc(r.title.toLowerCase())}» в ближайших днях. Проверь название или найди её в календаре.</div>`, said); return; }
  if (found.length > 1) {
    found.slice(0, 5).forEach((it, i) => { actions['pick' + i] = () => confirmCommand(r, it, said); });
    show(head('list', 'Какую именно?') + `<div class="a-list">${found.slice(0, 5).map((it, i) => `<button type="button" data-x="pick${i}"><span class="dot" style="--c:${St.catColor(it.cat)}"></span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(it.title)}</span><small>${esc(relDay(it.date))}${it.startTime ? ', ' + it.startTime : ''}</small></button>`).join('')}</div>`, said);
    return;
  }
  confirmCommand(r, found[0], said);
}

function confirmCommand(r, it, said) {
  const c = St.cat(it.cat);
  const titleBlock = `<div class="a-title"><span class="bar" style="background:${c ? c.color : '#8E8AA3'}"></span><div style="min-width:0"><b>${esc(it.title)}</b><span>${esc(whenText(it))}${it.recurring ? ' · повторяется' : ''}</span></div></div>`;
  actions = { close: () => hide() };
  if (r.action === 'delete') {
    const doDel = scope => { St.deleteItem(it.id, scope); hide(); render(); toast((it.kind === 'event' ? 'Встреча удалена' : 'Задача удалена')); };
    actions.one = () => doDel('one'); actions.all = () => doDel('all');
    show(head('trash', it.kind === 'event' ? 'Удалить встречу?' : 'Удалить задачу?') + titleBlock +
      `<div class="a-btns">${it.recurring ? `<button type="button" class="btn btn-ghost" data-x="one">Только этот раз</button><button type="button" class="btn btn-primary" style="background:var(--danger);color:#fff" data-x="all">Все повторы</button>` : `<button type="button" class="btn btn-ghost" data-x="close">Отмена</button><button type="button" class="btn btn-primary" style="background:var(--danger);color:#fff" data-x="one">Удалить</button>`}</div>`, said);
    return;
  }
  if (r.action === 'done') {
    actions.ok = () => { St.setStatus(it.id, 'done'); hide(); render(); toast('Отмечено: ' + it.title); };
    show(head('check', 'Отметить выполненной?') + titleBlock + `<div class="a-btns"><button type="button" class="btn btn-ghost" data-x="close">Отмена</button><button type="button" class="btn btn-primary" data-x="ok">Отметить</button></div>`, said);
    return;
  }
  // перенос
  if (!r.date && !r.startTime) {
    show(head('arrow', 'Куда перенести?') + titleBlock + `<div style="font-size:15px;color:var(--text2)">Скажи дату или время, например: «перенеси ${esc(it.title.toLowerCase())} на пятницу в 18:00».</div>`, said);
    return;
  }
  const date = r.date || it.date;
  let st = it.startTime, en = it.endTime;
  if (r.startTime) {
    const dur = it.startTime && it.endTime ? mins(it.endTime) - mins(it.startTime) : 60;
    st = r.startTime; en = r.endTime || addMinutes(st, Math.max(15, dur));
  }
  const to = { ...it, date, startTime: st, endTime: en };
  actions.ok = () => {
    const patch = { startTime: st, endTime: en };
    if (date !== it.date) patch.date = date;
    if (st && it.kind !== 'event') patch.kind = 'event';
    St.updateItem(it.id, patch, 'one');
    hide(); ui.cur = date; render(); toast('Перенесено на ' + relDay(date).toLowerCase() + (st ? ', ' + st : ''));
  };
  show(head('arrow', 'Перенести?') + titleBlock +
    `<div class="a-grid"><div><small>Было</small><strong>${esc(relDay(it.date))}${it.startTime ? ', ' + it.startTime : ''}</strong></div><div><small>Станет</small><strong>${esc(relDay(to.date))}${st ? ', ' + st : ''}</strong></div></div>
     <div class="a-btns"><button type="button" class="btn btn-ghost" data-x="close">Отмена</button><button type="button" class="btn btn-primary" data-x="ok">Перенести</button></div>`, said);
}
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// July Daily — данные: хранение в IndexedDB, повторы, цели, итоги
import { uid, today, addDays, addMonths, pd, ds, wd, weekStart, diffDays, daysInMonth, monthKey, yearKey, monthStart, monthEnd, cmpTime, PALETTE } from './util.js';

const DB_NAME = 'july-daily', STORE = 'kv', KEY = 'state';

export const DEFAULT_QUESTIONS = [
  'Оценка от 1 до 10',
  'Что получилось лучше всего?',
  'Что не получилось и почему?',
  'Чему научилась или что поняла?',
  'За что благодарна?',
  'Фокус на следующий период: 1–3 главные задачи или цели'
];

export const DEFAULT_KEYWORDS = [
  ['стоматолог', 'health'], ['врач', 'health'], ['зубн', 'health'], ['анализ', 'health'], ['тренир', 'health'], ['растяж', 'health'], ['йог', 'health'], ['бассейн', 'health'], ['массаж', 'health'],
  ['созвон', 'work'], ['митинг', 'work'], ['дедлайн', 'work'], ['клиент', 'work'], ['макет', 'work'], ['презентац', 'work'], ['отчёт', 'work'], ['отчет', 'work'],
  ['урок', 'study'], ['курс', 'study'], ['лекци', 'study'], ['английск', 'study'], ['домашк', 'study'], ['экзамен', 'study'], ['вебинар', 'study'],
  ['уборк', 'home'], ['купить', 'home'], ['продукт', 'home'], ['стирк', 'home'], ['корм', 'home'], ['ремонт', 'home'],
  ['маме', 'me'], ['папе', 'me'], ['подруг', 'me'], ['день рождени', 'me'], ['кино', 'me'], ['свидани', 'me']
].map(([word, cat]) => ({ word, cat }));

function freshState() {
  return {
    v: 1,
    cats: [
      { id: 'work', name: 'Работа', color: PALETTE[0], icon: 'briefcase' },
      { id: 'study', name: 'Учёба', color: PALETTE[1], icon: 'graduation-cap' },
      { id: 'home', name: 'Дом', color: PALETTE[2], icon: 'house' },
      { id: 'health', name: 'Здоровье', color: PALETTE[3], icon: 'heart' },
      { id: 'me', name: 'Личное', color: PALETTE[4], icon: 'star' }
    ],
    items: [],   // разовые задачи и встречи
    rules: [],   // повторяющиеся
    goals: [],
    reviews: [],
    questions: { week: [...DEFAULT_QUESTIONS], month: [...DEFAULT_QUESTIONS], year: [...DEFAULT_QUESTIONS] },
    keywords: DEFAULT_KEYWORDS,
    settings: { bg: 'auto', photo: null, lastBackup: null, created: today() }
  };
}

export let S = freshState();

// ---------- хранение ----------
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
let dbp = null;
async function db() { if (!dbp) dbp = openDB(); return dbp; }

export async function load() {
  try {
    const d = await db();
    const v = await new Promise((res, rej) => {
      const t = d.transaction(STORE).objectStore(STORE).get(KEY);
      t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error);
    });
    if (v) S = migrate(v);
  } catch (e) {
    try { const raw = localStorage.getItem('jd-state'); if (raw) S = migrate(JSON.parse(raw)); } catch (_) {}
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  return S;
}

function migrate(v) {
  const f = freshState();
  for (const k of Object.keys(f)) if (v[k] === undefined) v[k] = f[k];
  v.settings = Object.assign(f.settings, v.settings);
  v.questions = Object.assign(f.questions, v.questions);
  return v;
}

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const d = await db();
      d.transaction(STORE, 'readwrite').objectStore(STORE).put(JSON.parse(JSON.stringify(S)), KEY);
    } catch (e) {
      try { localStorage.setItem('jd-state', JSON.stringify(S)); } catch (_) {}
    }
  }, 150);
}

export function replaceState(v) { S = migrate(v); save(); }
export function exportJSON() { return JSON.stringify({ app: 'July Daily', exported: new Date().toISOString(), data: S }, null, 1); }
export function importJSON(text) {
  const o = JSON.parse(text);
  const data = o.data || o;
  if (!data.items || !data.cats) throw new Error('Это не файл бэкапа July Daily');
  replaceState(data);
}

// ---------- категории ----------
export const cat = id => S.cats.find(c => c.id === id) || null;
export const catColor = id => (cat(id) || {}).color || '#8E8AA3';

// ---------- повторы ----------
// rule.rec = { type, every, days, monthDays, nth, weekday, month, day, n, period }
// type: daily | weekly | monthDay | monthNth | yearly | quota
// rule.end = { type: never|until|count, until, count }

function rawMatch(r, s) {
  const rec = r.rec, start = r.start;
  if (s < start) return false;
  const every = Math.max(1, rec.every || 1);
  switch (rec.type) {
    case 'daily': return diffDays(start, s) % every === 0;
    case 'weekly': {
      const weeks = Math.floor(diffDays(weekStart(start), weekStart(s)) / 7);
      return weeks % every === 0 && (rec.days || []).includes(wd(s));
    }
    case 'monthDay': {
      const a = pd(start), b = pd(s);
      const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
      if (months % every !== 0) return false;
      const dim = daysInMonth(b.getFullYear(), b.getMonth()), d = b.getDate();
      return (rec.monthDays || []).some(md => md === -1 ? d === dim : Math.min(md, dim) === d);
    }
    case 'monthNth': {
      const a = pd(start), b = pd(s);
      const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
      if (months % every !== 0) return false;
      return matchNth(b, rec.nth, rec.weekday);
    }
    case 'yearly': {
      const a = pd(start), b = pd(s);
      if ((b.getFullYear() - a.getFullYear()) % every !== 0) return false;
      if (b.getMonth() !== rec.month) return false;
      if (rec.nth) return matchNth(b, rec.nth, rec.weekday);
      return b.getDate() === Math.min(rec.day, daysInMonth(b.getFullYear(), b.getMonth()));
    }
    case 'quota': return true;
  }
  return false;
}

function matchNth(b, nth, weekday) {
  if ((b.getDay() + 6) % 7 !== weekday) return false;
  const d = b.getDate(), dim = daysInMonth(b.getFullYear(), b.getMonth());
  if (nth === -1) return d + 7 > dim;
  return Math.ceil(d / 7) === nth;
}

const countCache = new Map();
function occurrenceIndex(r, s) {
  // номер вхождения (с 1) для окончания «после N раз»
  const key = r.id + '|' + r.start + '|' + JSON.stringify(r.rec) + '|' + s;
  if (countCache.has(key)) return countCache.get(key);
  let n = 0, d = r.start;
  for (let i = 0; i < 4000 && d <= s; i++) { if (rawMatch(r, d)) n++; d = addDays(d, 1); }
  countCache.set(key, n);
  return n;
}

export function ruleOccurs(r, s) {
  if (!rawMatch(r, s)) return false;
  const ex = r.ex && r.ex[s];
  if (ex && ex.deleted) return false;
  const e = r.end || { type: 'never' };
  if (e.type === 'until' && e.until && s > e.until) return false;
  if (e.type === 'count' && e.count && r.rec.type !== 'quota' && occurrenceIndex(r, s) > e.count) return false;
  return true;
}

export function quotaPeriod(r, s) {
  return r.rec.period === 'month' ? [monthStart(s), monthEnd(s)] : [weekStart(s), addDays(weekStart(s), 6)];
}
export function quotaCount(r, s) {
  const [a, b] = quotaPeriod(r, s);
  return Object.entries(r.st || {}).filter(([d, v]) => v === 'done' && d >= a && d <= b).length;
}

// Вхождение повтора в день как «виртуальный» элемент
function occurrence(r, s) {
  const ex = (r.ex && r.ex[s]) || {};
  const o = {
    id: r.id + '@' + s, ruleId: r.id, date: s, kind: r.kind,
    title: ex.title ?? r.title, note: ex.note ?? r.note, cat: ex.cat ?? r.cat, goal: r.goal,
    startTime: ex.startTime ?? r.startTime, endTime: ex.endTime ?? r.endTime,
    status: (r.st && r.st[s]) || '', order: r.order ?? 500, recurring: true
  };
  if (r.rec.type === 'quota') { o.quota = { n: r.rec.n, done: quotaCount(r, s), period: r.rec.period }; }
  return o;
}

// ---------- элементы дня ----------
export function itemsForDate(s) {
  const t = today();
  const list = S.items.filter(i => i.date === s).map(i => ({ ...i }));
  for (const r of S.rules) {
    if (!ruleOccurs(r, s)) continue;
    const o = occurrence(r, s);
    if (o.quota) {
      // квота: видна каждый день периода, пока не набрана; в прошлом — только если выполнена в этот день
      if (o.status === 'done') { list.push(o); continue; }
      if (s < t) continue;
      if (o.quota.done >= o.quota.n) continue;
      if (r.end && r.end.type === 'until' && s > r.end.until) continue;
    }
    list.push(o);
  }
  for (const i of list) i.effStatus = effStatus(i, t);
  return list;
}

export function effStatus(i, t = today()) {
  if (i.kind === 'event') return '';
  if (i.status === 'done') return 'done';
  if (i.status === 'fail') return 'fail';
  if (i.quota) return '';
  return i.date < t ? 'fail' : '';
}

export function sortDay(list) {
  const events = list.filter(i => i.kind === 'event').sort((a, b) => cmpTime(a.startTime, b.startTime));
  const tasks = list.filter(i => i.kind !== 'event').sort((a, b) => (a.order ?? 500) - (b.order ?? 500) || (a.created || '').localeCompare(b.created || ''));
  return { events, tasks };
}

export function dayStats(s) {
  const tasks = itemsForDate(s).filter(i => i.kind !== 'event');
  return { total: tasks.length, done: tasks.filter(i => i.effStatus === 'done').length, events: itemsForDate(s).filter(i => i.kind === 'event').length, cats: [...new Set(itemsForDate(s).map(i => i.cat).filter(Boolean))] };
}

// ---------- изменение ----------
export function findItem(id) {
  if (id.includes('@')) {
    const [rid, date] = id.split('@');
    const r = S.rules.find(x => x.id === rid);
    return r ? { rule: r, date } : null;
  }
  const it = S.items.find(x => x.id === id);
  return it ? { item: it } : null;
}

export function setStatus(id, status) {
  const f = findItem(id); if (!f) return;
  if (f.item) f.item.status = status;
  else { f.rule.st = f.rule.st || {}; if (status) f.rule.st[f.date] = status; else delete f.rule.st[f.date]; }
  save();
}

export function addItem(data) {
  const it = { id: uid(), kind: 'task', title: '', note: '', cat: null, goal: null, date: today(), startTime: null, endTime: null, status: '', order: Date.now() % 1e9 / 1e6 + 500, created: new Date().toISOString(), ...data };
  S.items.push(it); save(); return it;
}

export function addRule(data) {
  const r = { id: uid(), kind: 'task', title: '', note: '', cat: null, goal: null, startTime: null, endTime: null, start: today(), rec: { type: 'daily', every: 1 }, end: { type: 'never' }, ex: {}, st: {}, order: 500, created: new Date().toISOString(), ...data };
  S.rules.push(r); save(); return r;
}

export function deleteItem(id, scope = 'one') {
  const f = findItem(id); if (!f) return;
  if (f.item) { S.items = S.items.filter(x => x !== f.item); }
  else if (scope === 'one') { f.rule.ex = f.rule.ex || {}; f.rule.ex[f.date] = { deleted: true }; }
  else if (scope === 'future') {
    if (f.date <= f.rule.start) S.rules = S.rules.filter(x => x !== f.rule);
    else f.rule.end = { type: 'until', until: addDays(f.date, -1) };
  } else { S.rules = S.rules.filter(x => x !== f.rule); }
  save();
}

// Обновить элемент. patch — поля разового элемента (title, date, startTime, …, rec/end для повтора).
export function updateItem(id, patch, scope = 'one') {
  const f = findItem(id); if (!f) return;
  if (f.item) {
    if (patch.rec) { // разовый стал повторяющимся
      const { rec, end, ...rest } = patch;
      const base = { ...f.item, ...rest };
      S.items = S.items.filter(x => x !== f.item);
      addRule({ kind: base.kind, title: base.title, note: base.note, cat: base.cat, goal: base.goal, startTime: base.startTime, endTime: base.endTime, start: base.date, rec, end: end || { type: 'never' } });
    } else Object.assign(f.item, patch);
    save(); return;
  }
  const r = f.rule;
  const ruleFields = ['title', 'note', 'cat', 'goal', 'startTime', 'endTime', 'kind'];
  if (patch.rec === null) { // повтор убран: оставляем разовый элемент на этот день
    const { rec, end, ...rest } = patch;
    const occ = occurrence(r, f.date);
    deleteItem(id, scope === 'one' ? 'one' : scope);
    addItem({ kind: occ.kind, title: occ.title, note: occ.note, cat: occ.cat, goal: occ.goal, startTime: occ.startTime, endTime: occ.endTime, date: f.date, status: occ.status, ...rest });
    return;
  }
  if (scope === 'one') {
    if (patch.date && patch.date !== f.date) { // перенос одного вхождения = исключение + разовый элемент
      const occ = occurrence(r, f.date);
      r.ex = r.ex || {}; r.ex[f.date] = { deleted: true };
      const { rec, end, ...rest } = patch;
      addItem({ kind: occ.kind, title: occ.title, note: occ.note, cat: occ.cat, goal: occ.goal, startTime: occ.startTime, endTime: occ.endTime, ...rest });
    } else {
      r.ex = r.ex || {}; const e = r.ex[f.date] = r.ex[f.date] || {};
      for (const k of ruleFields) if (k in patch && k !== 'kind' && k !== 'goal') e[k] = patch[k];
    }
  } else if (scope === 'future' && f.date > r.start) {
    const copy = JSON.parse(JSON.stringify(r));
    r.end = { type: 'until', until: addDays(f.date, -1) };
    copy.id = uid(); copy.start = patch.date || f.date; copy.ex = {}; copy.st = {};
    for (const [d, v] of Object.entries(r.st || {})) if (d >= f.date) { copy.st[d] = v; delete r.st[d]; }
    for (const k of ruleFields) if (k in patch) copy[k] = patch[k];
    if (patch.rec) copy.rec = patch.rec;
    if (patch.end) copy.end = patch.end;
    S.rules.push(copy);
  } else {
    for (const k of ruleFields) if (k in patch) r[k] = patch[k];
    if (patch.rec) r.rec = patch.rec;
    if (patch.end) r.end = patch.end;
    if (patch.date && patch.date !== f.date) r.start = patch.date < r.start || scope === 'all' ? (patch.date) : r.start;
  }
  countCache.clear();
  save();
}

// ---------- невыполненные: предложение переноса ----------
export function pendingFailed() {
  const t = today();
  return S.items.filter(i => i.kind !== 'event' && i.date < t && i.status !== 'done' && !i.handled);
}
export function transferFailed(ids, toDate = today()) {
  for (const it of S.items.filter(i => ids.includes(i.id))) {
    it.status = 'fail'; it.handled = true;
    addItem({ kind: it.kind, title: it.title, note: it.note, cat: it.cat, goal: it.goal, date: toDate, origin: it.id });
  }
  save();
}
export function dismissFailed(ids) {
  for (const it of S.items.filter(i => ids.includes(i.id))) { it.status = it.status || 'fail'; it.handled = true; }
  save();
}
export function transferOne(id, toDate) {
  const f = findItem(id); if (!f) return;
  if (f.item) { transferFailed([id], toDate); return; }
  // повторяющееся: отметить ✕ и создать разовую копию
  const occ = occurrence(f.rule, f.date);
  setStatus(id, 'fail');
  addItem({ kind: occ.kind, title: occ.title, note: occ.note, cat: occ.cat, goal: occ.goal, date: toDate });
}

// ---------- цели ----------
// goal: { id, level: 'year'|'month', period: 'YYYY' | 'YYYY-MM', title, type: 'tasks'|'counter'|'check', target, count, checked, parent, status: ''|'fail', handled, origin }
export function addGoal(data) {
  const g = { id: uid(), level: 'month', period: monthKey(today()), title: '', type: 'tasks', target: 10, count: 0, checked: false, parent: null, status: '', created: new Date().toISOString(), ...data };
  S.goals.push(g); save(); return g;
}
export const goal = id => S.goals.find(g => g.id === id) || null;

export function goalTasks(g) {
  const items = S.items.filter(i => i.goal === g.id && i.kind !== 'event' && !(i.handled && i.status === 'fail' && S.items.some(x => x.origin === i.id)));
  let total = items.length, done = items.filter(i => i.status === 'done').length;
  for (const r of S.rules.filter(r => r.goal === g.id)) {
    const n = Object.values(r.st || {}).filter(v => v === 'done').length;
    done += n; total += n;
  }
  return { total, done };
}

export function goalProgress(g) {
  if (g.level === 'year') {
    const kids = S.goals.filter(x => x.parent === g.id);
    if (kids.length && g.type === 'tasks') {
      const p = kids.reduce((a, k) => a + goalProgress(k).pct, 0) / kids.length;
      return { pct: p, label: kids.filter(k => goalProgress(k).pct >= 1).length + ' из ' + kids.length + ' целей месяцев', kids: kids.length };
    }
  }
  if (g.type === 'counter') return { pct: g.target ? Math.min(1, g.count / g.target) : 0, label: g.count + ' / ' + g.target };
  if (g.type === 'check') return { pct: g.checked ? 1 : 0, label: g.checked ? 'достигнута' : 'отметка' };
  const t = goalTasks(g);
  return { pct: t.total ? t.done / t.total : 0, label: t.done + ' из ' + t.total + ' ' + (t.total === 1 ? 'задачи' : 'задач') };
}

export function goalsFor(level, period) { return S.goals.filter(g => g.level === level && g.period === period); }

export function pendingFailedGoals() {
  const t = today(), mk = monthKey(t), yk = yearKey(t);
  return S.goals.filter(g => !g.handled && ((g.level === 'month' && g.period < mk) || (g.level === 'year' && g.period < yk)) && goalProgress(g).pct < 1);
}
export function transferGoals(ids) {
  const t = today();
  for (const g of S.goals.filter(x => ids.includes(x.id))) {
    g.status = 'fail'; g.handled = true;
    const copy = addGoal({ level: g.level, period: g.level === 'month' ? monthKey(t) : yearKey(t), title: g.title, type: g.type, target: g.target, count: g.type === 'counter' ? g.count : 0, parent: g.level === 'month' ? g.parent : null, origin: g.id });
    // незакрытые задачи цели остаются за старой целью; новые привязывай к копии
    void copy;
  }
  save();
}
export function dismissGoals(ids) { for (const g of S.goals.filter(x => ids.includes(x.id))) { g.status = 'fail'; g.handled = true; } save(); }

// ---------- статистика периода и итоги ----------
export function periodStats(from, to) {
  let total = 0, done = 0; const byCat = {};
  const last = to < today() ? to : today(); // будущие дни не считаем
  for (let d = from; d <= last; d = addDays(d, 1)) {
    for (const i of itemsForDate(d)) {
      if (i.kind === 'event') continue;
      if (i.quota && i.effStatus !== 'done') continue;
      total++; if (i.effStatus === 'done') done++;
      const c = i.cat || '_';
      byCat[c] = byCat[c] || { total: 0, done: 0 }; byCat[c].total++; if (i.effStatus === 'done') byCat[c].done++;
    }
  }
  const quotas = S.rules.filter(r => r.rec.type === 'quota' && r.start <= to).map(r => {
    const per = r.rec.period;
    if ((per === 'week' && to !== addDays(weekStart(from), 6)) || (per === 'month' && from !== monthStart(from))) return null;
    return { title: r.title, n: r.rec.n, done: Object.entries(r.st || {}).filter(([d, v]) => v === 'done' && d >= from && d <= to).length };
  }).filter(Boolean);
  return { total, done, fail: total - done, byCat, quotas };
}

export function reviewKey(type, s) {
  if (type === 'week') return 'week:' + weekStart(s);
  if (type === 'month') return 'month:' + monthKey(s);
  return 'year:' + yearKey(s);
}
export function reviewRange(type, s) {
  if (type === 'week') return [weekStart(s), addDays(weekStart(s), 6)];
  if (type === 'month') return [monthStart(s), monthEnd(s)];
  return [yearKey(s) + '-01-01', yearKey(s) + '-12-31'];
}

// Какие итоги сейчас предложить: [{type, anchor}]
export function dueReviews(now = new Date()) {
  const t = ds(now), h = now.getHours(), out = [];
  const have = k => S.reviews.some(r => r.key === k);
  const created = S.settings.created || t;
  // неделя: воскресенье с 18:00 → текущая неделя; пн–ср → прошлая
  const w = wd(t);
  if (w === 6 && h >= 18) out.push({ type: 'week', anchor: t });
  else if (w <= 2) { const prev = addDays(weekStart(t), -1); if (addDays(weekStart(prev), 6) >= created) out.push({ type: 'week', anchor: prev }); }
  // месяц: последний день с 18:00 → текущий; 1–3 число → прошлый
  const d = pd(t).getDate();
  if (t === monthEnd(t) && h >= 18) out.push({ type: 'month', anchor: t });
  else if (d <= 3) { const prev = addDays(monthStart(t), -1); if (prev >= created) out.push({ type: 'month', anchor: prev }); }
  // год
  if (t.slice(5) === '12-31' && h >= 18) out.push({ type: 'year', anchor: t });
  else if (t.slice(5) <= '01-03') { const prev = addDays(yearKey(t) + '-01-01', -1); if (prev >= created) out.push({ type: 'year', anchor: prev }); }
  return out.filter(x => !have(reviewKey(x.type, x.anchor)));
}

export function saveReview(type, anchor, answers, skipped = false) {
  const [from, to] = reviewRange(type, anchor);
  S.reviews.push({ id: uid(), type, key: reviewKey(type, anchor), from, to, answers, questions: S.questions[type], stats: skipped ? null : periodStats(from, to), skipped, date: new Date().toISOString() });
  save();
}

// ---------- поиск для помощника ----------
export function upcomingItems(fromDate, days = 120, back = 7) {
  const out = [];
  for (let i = -back; i <= days; i++) {
    const d = addDays(fromDate, i);
    for (const it of itemsForDate(d)) out.push(it);
  }
  return out;
}

export { addMonths };

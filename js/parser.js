// July Daily — локальный разбор фраз помощника (без интернета)
import { ds, pd, addDays, addMonths, wd, weekStart, daysInMonth, pad, addMinutes } from './util.js';

const B = '(?<![\\p{L}\\d])', E = '(?![\\p{L}\\d])';
const rx = (s, f = 'iu') => new RegExp(s, f);
const rxg = s => new RegExp(s, 'giu');

// ---------- числа словами → цифры ----------
const UNITS = { 'один': 1, 'одна': 1, 'два': 2, 'две': 2, 'три': 3, 'четыре': 4, 'пять': 5, 'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9 };
const CARD = Object.assign({ 'ноль': 0, 'десять': 10, 'одиннадцать': 11, 'двенадцать': 12, 'тринадцать': 13, 'четырнадцать': 14, 'пятнадцать': 15, 'шестнадцать': 16, 'семнадцать': 17, 'восемнадцать': 18, 'девятнадцать': 19, 'двадцать': 20, 'тридцать': 30, 'сорок': 40, 'пятьдесят': 50 }, UNITS);
const TENS = { 'двадцать': 20, 'тридцать': 30, 'сорок': 40, 'пятьдесят': 50 };
const GEN = { 'одного': 1, 'двух': 2, 'трех': 3, 'трёх': 3, 'четырех': 4, 'четырёх': 4, 'пяти': 5, 'шести': 6, 'семи': 7, 'восьми': 8, 'девяти': 9, 'десяти': 10, 'одиннадцати': 11, 'двенадцати': 12, 'тринадцати': 13, 'четырнадцати': 14, 'пятнадцати': 15, 'шестнадцати': 16, 'семнадцати': 17, 'восемнадцати': 18, 'девятнадцати': 19, 'двадцати': 20, 'тридцати': 30, 'сорока': 40, 'пятидесяти': 50 };
const ORD = { 'перв': 1, 'втор': 2, 'трет': 3, 'четверт': 4, 'четвёрт': 4, 'пят': 5, 'шест': 6, 'седьм': 7, 'восьм': 8, 'девят': 9, 'десят': 10, 'одиннадцат': 11, 'двенадцат': 12, 'тринадцат': 13, 'четырнадцат': 14, 'пятнадцат': 15, 'шестнадцат': 16, 'семнадцат': 17, 'восемнадцат': 18, 'девятнадцат': 19, 'двадцат': 20, 'тридцат': 30 };
const ORD_END = '(?:ого|ое|ой|ом|ым|ый|ий|ье|ья|ей|ая|ую)';
const keys = o => Object.keys(o).sort((a, b) => b.length - a.length).join('|');

export function wordsToNumbers(t) {
  const unitOrd = 'перв|втор|трет|четверт|четвёрт|пят|шест|седьм|восьм|девят';
  // полпятого → половина 5-го
  t = t.replace(rxg(B + 'пол(' + keys(ORD) + ')' + ORD_END + E), (m, s) => 'половина ' + ORD[s.toLowerCase()] + '-го');
  // двадцать первого → 21-го
  t = t.replace(rxg(B + '(двадцать|тридцать)\\s+(' + unitOrd + ')' + ORD_END + E), (m, a, b) => (TENS[a.toLowerCase()] + ORD[b.toLowerCase()]) + '-го');
  t = t.replace(rxg(B + '(' + keys(ORD) + ')' + ORD_END + E), (m, s) => ORD[s.toLowerCase()] + '-го');
  // двадцати одного
  t = t.replace(rxg(B + '(двадцати|тридцати|сорока|пятидесяти)\\s+(одного|двух|тр[её]х|четыр[её]х|пяти|шести|семи|восьми|девяти)' + E), (m, a, b) => GEN[a.toLowerCase()] + GEN[b.toLowerCase()]);
  t = t.replace(rxg(B + '(' + keys(GEN) + ')' + E), (m, s) => String(GEN[s.toLowerCase()]));
  // двадцать пять
  t = t.replace(rxg(B + '(двадцать|тридцать|сорок|пятьдесят)\\s+(' + keys(UNITS) + ')' + E), (m, a, b) => TENS[a.toLowerCase()] + UNITS[b.toLowerCase()]);
  t = t.replace(rxg(B + '(' + keys(CARD) + ')' + E), (m, s) => String(CARD[s.toLowerCase()]));
  return t;
}

// ---------- словари ----------
const MON = ['январ', 'феврал', 'март', 'апрел', 'ма', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
const MON_RX = '(январ[яьею]|феврал[яьею]|март[ае]?|апрел[яьею]|ма[яйе]|июн[яьею]|июл[яьею]|август[ае]?|сентябр[яьею]|октябр[яьею]|ноябр[яьею]|декабр[яьею])';
function monIndex(w) { w = w.toLowerCase(); for (let i = MON.length - 1; i >= 0; i--) if (w.startsWith(MON[i]) && !(i === 4 && w.length > 3)) return i; return -1; }
const WD_FORMS = [
  'понедельник(?:ам|и|а)?', 'вторник(?:ам|и|а)?', 'сред(?:ам|у|а|ы)', 'четверг(?:ам|и|а)?', 'пятниц(?:ам|у|а|ы)', 'суббот(?:ам|у|а|ы)', 'воскресень(?:ям|е|я)'
];
const WD_RX = '(' + WD_FORMS.join('|') + ')';
function wdIndex(w) { w = w.toLowerCase(); const st = ['пон', 'вто', 'сре', 'чет', 'пят', 'суб', 'вос']; return st.findIndex(s => w.startsWith(s)); }

// ---------- основной разбор ----------
export function parse(input, now = new Date()) {
  const T = ds(now);
  let t = ' ' + String(input || '').replace(/\s+/g, ' ').trim().replace(/[!?…]+$/u, '') + ' ';
  const raw = input;
  t = wordsToNumbers(t);
  // «15 0 0» → 15:00, «9 0 5» → 9:05
  t = t.replace(/(\d{1,2}) 0 0(?!\d)/g, '$1:00').replace(/(\d{1,2}) 0 (\d)(?!\d)/g, '$1:0$2');
  // «в 15 30» → «в 15:30»
  t = t.replace(rxg(B + '(в|с|до|на|к)\\s+(\\d{1,2})\\s+([0-5]\\d)' + E), '$1 $2:$3');
  t = t.replace(/(\d{1,2})\.(\d{2})(?![.\d])/g, (m, h, mm) => Number(h) < 24 ? h + ':' + mm : m);

  const res = { raw, action: 'create', kind: null, title: '', date: null, startTime: null, endTime: null, rec: null, end: null };
  const cut = (re, fn) => { const m = t.match(re); if (m) { t = t.replace(re, ' '); fn && fn(m); return true; } return false; };

  // приветствия и вежливость
  t = t.replace(rxg(B + '(привет|здравствуй|слушай|пожалуйста|плиз|ок|окей|так|эм|ну)' + E + '[,]?'), ' ');

  // ----- команды -----
  if (cut(rx('^\\s*(что|чего)\\s+(у\\s+меня|по\\s+планам|запланировано)' + E), null) || cut(rx('^\\s*(покажи|какие)\\s+(мои\\s+)?(дела|задачи|планы|встречи)?' + E), null)) {
    res.action = 'query';
  } else if (cut(rx('^\\s*(отмени(те)?|удали(те)?|убери(те)?|отменить|удалить)' + E))) {
    res.action = 'delete';
  } else if (cut(rx('^\\s*(перенеси(те)?|передвинь|сдвинь|перемести|переставь|перенести)' + E))) {
    res.action = 'move';
  } else if (cut(rx('^\\s*(отметь(те)?|отмечай|я\\s+сделал[аи]?|сделал[аи]?|выполнил[аи]?|я\\s+выполнил[аи]?|готово)' + E))) {
    res.action = 'done';
    t = t.replace(rxg(B + 'как\\s+(сделанн|выполненн|готов)\\p{L}*' + E), ' ').replace(rxg(B + '(сделано|выполнено|готово)' + E), ' ');
  }

  // ----- повторы -----
  const startDate = () => res.date || T;
  if (cut(rx(B + '(\\d+)\\s+раз[а]?\\s+в\\s+(неделю|месяц)' + E), m => { res.rec = { type: 'quota', n: Number(m[1]), period: m[2].toLowerCase() === 'месяц' ? 'month' : 'week' }; })) {}
  else if (cut(rx(B + '(каждый|каждое|каждую)\\s+день' + E + '|' + B + 'ежедневно' + E), () => { res.rec = { type: 'daily', every: 1 }; })) {}
  else if (cut(rx(B + 'через\\s+день' + E), () => { res.rec = { type: 'daily', every: 2 }; })) {}
  else if (cut(rx(B + 'кажды[ейх]\\s+(\\d+)\\s+(дня|дней)' + E), m => { res.rec = { type: 'daily', every: Number(m[1]) }; })) {}
  else if (cut(rx(B + 'по\\s+будням' + E), () => { res.rec = { type: 'weekly', every: 1, days: [0, 1, 2, 3, 4] }; })) {}
  else if (cut(rx(B + 'по\\s+выходным' + E), () => { res.rec = { type: 'weekly', every: 1, days: [5, 6] }; })) {}
  else if (cut(rx('(?:' + B + '(?:каждый|каждое|каждую|каждые|по)\\s+)' + WD_RX + '((?:\\s*(?:,|и)\\s*' + WD_RX + ')*)' + E), m => {
    const all = (m[0].match(rxg(WD_RX)) || []).map(wdIndex).filter(i => i >= 0);
    res.rec = { type: 'weekly', every: 1, days: [...new Set(all)].sort() };
  })) {}
  else if (cut(rx(B + 'кажды[ейх]\\s+(\\d+)\\s+недел[иь]' + E), m => { res.rec = { type: 'weekly', every: Number(m[1]), days: null }; })) {}
  else if (cut(rx(B + '(каждую\\s+неделю|еженедельно)' + E), () => { res.rec = { type: 'weekly', every: 1, days: null }; })) {}
  else if (cut(rx(B + '(каждый\\s+месяц|ежемесячно)' + E), () => { res.rec = { type: 'monthDay', every: 1, monthDays: null }; })) {}
  else if (cut(rx(B + '(каждый\\s+год|ежегодно)' + E), () => { res.rec = { type: 'yearly', every: 1 }; })) {}

  // ----- время -----
  let qual = null;
  const qualRe = '(?:\\s*(утра|дня|вечера|ночи))?';
  const hm = (h, m) => ({ h: Number(h), m: Number(m || 0) });
  let st = null, en = null;
  if (cut(rx(B + 'с\\s+(\\d{1,2})(?::(\\d{2}))?(?:\\s*час(?:ов|а)?)?' + qualRe + '\\s+до\\s+(\\d{1,2})(?::(\\d{2}))?(?:\\s*час(?:ов|а)?)?' + qualRe + E), m => {
    st = hm(m[1], m[2]); en = hm(m[4], m[5]); qual = m[3] || m[6] || null; if (m[3] && !m[6]) en.q = null;
  })) {}
  else if (cut(rx(B + '(?:в\\s+)?половин[аеуы]\\s+(\\d{1,2})-го' + qualRe + E), m => { st = { h: Number(m[1]) - 1, m: 30 }; qual = m[2]; })) {}
  else if (cut(rx(B + '(?:в\\s+)?четверть\\s+(\\d{1,2})-го' + qualRe + E), m => { st = { h: Number(m[1]) - 1, m: 15 }; qual = m[2]; })) {}
  else if (cut(rx(B + '(?:в\\s+)?без\\s+(\\d{1,2}|четверти)(?:\\s+минут)?\\s+(\\d{1,2})' + qualRe + E), m => {
    const mm = /четверт/i.test(m[1]) ? 15 : Number(m[1]); st = { h: Number(m[2]) - 1, m: 60 - mm }; qual = m[3];
  })) {}
  else if (cut(rx(B + '(?:в|к|на)\\s+(\\d{1,2}):(\\d{2})' + qualRe + E), m => { st = hm(m[1], m[2]); qual = m[3]; })) {}
  else if (cut(rx(B + '(?:в|к|на)\\s+(\\d{1,2})(?:\\s*час(?:ов|а)?)?' + qualRe + E + '(?!\\s*(?:-го|' + MON_RX + '|числа|раз|минут|дн|недел|месяц))'), m => {
    if (Number(m[1]) <= 24 && (m[2] || /час/i.test(m[0]) || true)) { st = hm(m[1]); qual = m[2]; }
  })) {}
  else if (cut(rx(B + '(\\d{1,2}):(\\d{2})' + qualRe + E), m => { st = hm(m[1], m[2]); qual = m[3]; })) {}
  else if (cut(rx(B + '(?:в\\s+)?(полдень)' + E), () => { st = { h: 12, m: 0 }; qual = 'дня'; })) {}
  else if (cut(rx(B + '(\\d{1,2})\\s*час(?:ов|а)?' + qualRe + E), m => { st = hm(m[1]); qual = m[2]; })) {}
  else if (cut(rx(B + '(утром|днём|днем|вечером)' + E), m => { const w = m[1].toLowerCase(); st = null; res.partOfDay = w; })) {}

  const fixH = (x, q, explicitMin) => {
    if (!x) return null;
    let h = x.h;
    q = q && q.toLowerCase();
    if (q === 'вечера' && h < 12) h += 12;
    else if (q === 'дня' && h < 12 && h <= 6) h += 12;
    else if (q === 'ночи' && h === 12) h = 0;
    else if (!q && h >= 1 && h <= 7) h += 12;
    if (h === 24) h = 0;
    if (h > 23 || x.m > 59) return null;
    return pad(h) + ':' + pad(x.m);
  };
  if (st) {
    res.startTime = fixH(st, qual);
    if (en) {
      let e = fixH(en, qual);
      if (e && res.startTime && e <= res.startTime && en.h < 12) e = fixH({ h: en.h + 12, m: en.m }, null);
      res.endTime = e && res.startTime && e > res.startTime ? e : null;
    }
  }

  // ----- дата -----
  const setDate = d => { if (!res.date) res.date = d; };
  cut(rx(B + '(?:на\\s+)?послезавтра' + E), () => setDate(addDays(T, 2)));
  cut(rx(B + '(?:на\\s+)?завтра' + E), () => setDate(addDays(T, 1)));
  cut(rx(B + '(?:на\\s+)?сегодня' + E), () => setDate(T));
  cut(rx(B + 'позавчера' + E), () => setDate(addDays(T, -2)));
  cut(rx(B + 'вчера' + E), () => setDate(addDays(T, -1)));
  cut(rx(B + 'через\\s+(\\d+)?\\s*(день|дня|дней|неделю|недели|недель|месяц|месяца|месяцев|год)' + E), m => {
    const n = Number(m[1] || 1), u = m[2].toLowerCase();
    if (u.startsWith('д')) setDate(addDays(T, n));
    else if (u.startsWith('нед')) setDate(addDays(T, 7 * n));
    else if (u.startsWith('мес')) setDate(addMonths(T, n));
    else setDate(addMonths(T, 12 * n));
  });
  cut(rx(B + '(?:(?:в|во|на|к)\\s+)?следующ\\p{L}*\\s+' + WD_RX + E), m => setDate(addDays(weekStart(T), 7 + wdIndex(m[1]))));
  cut(rx(B + '(?:на\\s+)?следующ\\p{L}*\\s+недел\\p{L}*' + E), () => setDate(addDays(weekStart(T), 7)));
  // 12 ноября [2027]
  cut(rx(B + '(?:на\\s+|к\\s+)?(\\d{1,2})(?:-?го|-?е)?\\s+' + MON_RX + '(?:\\s+(\\d{4})(?:\\s*года?)?)?' + E), m => {
    const d = Number(m[1]), mi = monIndex(m[2]); if (mi < 0) return;
    let y = m[3] ? Number(m[3]) : now.getFullYear();
    let s = ds(new Date(y, mi, Math.min(d, daysInMonth(y, mi))));
    if (!m[3] && s < T) { y++; s = ds(new Date(y, mi, Math.min(d, daysInMonth(y, mi)))); }
    setDate(s);
  });
  // 12.11[.2026]
  cut(rx(B + '(?:на\\s+)?(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{2,4}))?' + E), m => {
    const d = Number(m[1]), mo = Number(m[2]) - 1; if (mo > 11 || d > 31) return;
    let y = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : now.getFullYear();
    let s = ds(new Date(y, mo, Math.min(d, daysInMonth(y, mo))));
    if (!m[3] && s < T) s = ds(new Date(y + 1, mo, Math.min(d, daysInMonth(y + 1, mo))));
    setDate(s);
  });
  // 12-го [числа]
  cut(rx(B + '(?:на\\s+|к\\s+)?(\\d{1,2})-?го(?:\\s+числа)?' + E), m => {
    const d = Number(m[1]); if (d < 1 || d > 31) return;
    let y = now.getFullYear(), mo = now.getMonth();
    let s = ds(new Date(y, mo, Math.min(d, daysInMonth(y, mo))));
    if (s < T) { const n = new Date(y, mo + 1, 1); s = ds(new Date(n.getFullYear(), n.getMonth(), Math.min(d, daysInMonth(n.getFullYear(), n.getMonth())))); }
    setDate(s);
  });
  // в пятницу
  cut(rx(B + '(?:(?:в|во|на|к|до)\\s+)?(?:эт\\p{L}+\\s+)?' + WD_RX + E), m => {
    const w = wdIndex(m[1]); const delta = (w - wd(T) + 7) % 7; setDate(addDays(T, delta));
  });

  // ----- тип -----
  if (rx(B + 'встреч\\p{L}*' + E).test(t)) res.kind = 'event';
  t = t.replace(rxg(B + '(задачу|задача|задачка|дело)' + E), m => { res.kind = res.kind || 'task'; return ' '; });
  if (!res.kind) res.kind = res.startTime ? 'event' : 'task';

  // ----- заголовок -----
  t = t.replace(rxg(B + '(запиши(те)?|записать|добавь(те)?|добавить|создай(те)?|поставь(те)?|запланируй|напомни(те)?|напоминание|мне|у\\s+меня|нужно|надо|можешь|могу|пожалуйста)' + E), ' ');
  t = t.replace(rxg(B + 'встречу' + E), 'встреча');
  t = t.replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim();
  // висячие предлоги по краям
  for (let i = 0; i < 3; i++) t = t.replace(rx('^(в|во|на|к|с|до|и|а|про|что)\\s+'), '').replace(rx('\\s+(в|во|на|к|с|до|и|а|из|по)$'), '').replace(/^[-–—:]\s*/, '').trim();
  res.title = t ? t[0].toUpperCase() + t.slice(1) : '';

  // ----- значения по умолчанию -----
  if (res.action === 'create') {
    if (res.startTime && !res.endTime) res.endTime = addMinutes(res.startTime, 60);
    if (res.rec) {
      const s0 = res.date || T;
      if (res.rec.type === 'weekly' && !res.rec.days) res.rec.days = [wd(s0)];
      if (res.rec.type === 'weekly' && res.rec.days && !res.date) {
        // первое подходящее число не раньше сегодня
        let d = T; for (let i = 0; i < 7 && !res.rec.days.includes(wd(d)); i++) d = addDays(d, 1);
        res.date = d;
      }
      if (res.rec.type === 'monthDay' && !res.rec.monthDays) res.rec.monthDays = [pd(s0).getDate()];
      if (res.rec.type === 'yearly') { res.rec.month = pd(s0).getMonth(); res.rec.day = pd(s0).getDate(); }
    }
    if (!res.date) res.date = T;
    if (!res.title) res.action = 'unknown';
  }
  if (res.action === 'query' && !res.date) res.date = T;
  return res;
}

// ---------- поиск записи по словам ----------
function stems(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е').split(/[^\p{L}\d]+/u).filter(w => w.length > 2 && !['для', 'про', 'как', 'что', 'это'].includes(w)).map(w => w.slice(0, Math.max(3, Math.min(5, w.length - 1))));
}
export function matchItems(query, items, T) {
  const q = stems(query);
  if (!q.length) return [];
  const scored = [];
  for (const it of items) {
    const ws = stems(it.title);
    let sc = 0;
    for (const a of q) if (ws.some(b => b.startsWith(a) || a.startsWith(b))) sc++;
    if (sc) scored.push({ it, sc: sc / q.length, dist: Math.abs((pd(it.date) - pd(T)) / 86400000) + (it.date < T ? 30 : 0) });
  }
  scored.sort((a, b) => b.sc - a.sc || a.dist - b.dist);
  const best = scored.length ? scored[0].sc : 0;
  // убираем повторы одного правила, оставляя ближайшее вхождение
  const seen = new Set(), out = [];
  for (const s of scored.filter(s => s.sc === best)) {
    const k = s.it.ruleId || s.it.id;
    if (seen.has(k)) continue; seen.add(k); out.push(s.it);
  }
  return out;
}

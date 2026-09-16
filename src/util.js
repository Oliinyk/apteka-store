const MAP = {
  а:'a',б:'b',в:'v',г:'h',ґ:'g',д:'d',е:'e',є:'ie',ж:'zh',з:'z',и:'y',і:'i',ї:'i',й:'i',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',
  ш:'sh',щ:'shch',ь:'',ю:'iu',я:'ia',ы:'y',э:'e',ё:'e',ъ:'',
};

export function slugify(input, fallback = 'item') {
  const slug = String(input || '')
    .toLowerCase()
    .split('')
    .map((ch) => (ch in MAP ? MAP[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback + '-' + Date.now().toString(36);
}

export function uniqueSlug(db, table, base, id = 0) {
  let slug = base;
  let i = 2;
  const stmt = db.prepare(`SELECT id FROM ${table} WHERE slug = ?`);
  while (true) {
    const row = stmt.get(slug);
    if (!row || row.id === id) return slug;
    slug = `${base}-${i++}`;
  }
}

export const int = (v, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

export const bool = (v) => (v === 'on' || v === '1' || v === 'true' ? 1 : 0);

export const toArray = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);

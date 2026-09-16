import { db, json, getSetting } from './db.js';
import { esc, attr, price, specsOf } from './render.js';
import { SETTINGS_SCHEMA } from './settings-schema.js';

const NAV = [
  ['/admin', 'Огляд'],
  ['/admin/products', 'Товари'],
  ['/admin/categories', 'Категорії'],
  ['/admin/orders', 'Замовлення'],
  ['/admin/texts', 'Тексти сайту'],
  ['/admin/pages', 'Сторінки'],
  ['/admin/account', 'Акаунт'],
];

export const imageCard = (src, i) => `<figure class="img-card${i === 0 ? ' is-main' : ''}" draggable="true" data-index="${i}">
  <img src="${attr(src)}" alt="">
  <input type="hidden" name="images" value="${attr(src)}">
  ${i === 0 ? '<span class="img-main">Головне</span>' : ''}
  <div class="img-tools">
    <button type="button" data-move="-1" title="Перемістити ліворуч">←</button>
    <button type="button" data-main title="Зробити головним">★</button>
    <button type="button" data-move="1" title="Перемістити праворуч">→</button>
    <button type="button" data-del title="Видалити">✕</button>
  </div>
</figure>`;

const STATUSES = {
  new: 'Нове', confirmed: 'Підтверджено', shipped: 'Відправлено',
  done: 'Виконано', canceled: 'Скасовано',
};

export function adminLayout({ title, body, active = '', user, flash = '' }) {
  return `<!doctype html>
<html lang="uk"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — адмінка</title>
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/admin.css">
</head><body>
<aside class="side">
  <a class="side-logo" href="/"><span>${esc(getSetting('site.name', '•').trim().charAt(0).toUpperCase())}</span><b>${esc(getSetting('site.name', ''))}</b></a>
  <nav>${NAV.map(([href, label]) =>
    `<a href="${href}" class="${active === href ? 'on' : ''}">${esc(label)}</a>`).join('')}</nav>
  <div class="side-foot">
    <a href="/" target="_blank">Відкрити сайт ↗</a>
    <form method="post" action="/admin/logout"><button type="submit">Вийти (${esc(user?.username || '')})</button></form>
  </div>
</aside>
<main class="admin-main">
  ${flash ? `<div class="flash">${esc(flash)}</div>` : ''}
  ${body}
</main>
<script src="/admin.js"></script>
</body></html>`;
}

export function loginPage(error = '', showHint = false) {
  return `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Вхід в адмінку</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/admin.css"></head>
<body class="login-body">
<form class="login-card" method="post" action="/admin/login">
  <div class="login-logo">${esc(getSetting('site.name', '•').trim().charAt(0).toUpperCase())}</div>
  <h1>Вхід в адмінку</h1>
  ${error ? `<p class="error">${esc(error)}</p>` : ''}
  <label>Логін<input name="username" autocomplete="username" autofocus required></label>
  <label>Пароль<input name="password" type="password" autocomplete="current-password" required></label>
  <button type="submit">Увійти</button>
  ${showHint ? '<p class="hint">За замовчуванням: <b>admin</b> / <b>admin123</b></p>' : ''}
</form>
</body></html>`;
}

export function accountPage(user, { error = '', flash = '' } = {}) {
  const body = `
<header class="head"><h1>Акаунт</h1></header>
<section class="panel panel-narrow">
  <h2>Зміна логіна та пароля</h2>
  <p class="muted small">Щоб зберегти зміни, введіть поточний пароль. Пароль можна не міняти —
    тоді заповніть лише логін і поточний пароль.</p>
  ${error ? `<p class="form-error">${esc(error)}</p>` : ''}
  <form method="post" action="/admin/account" autocomplete="off">
    <label>Логін<input name="username" value="${attr(user.username)}" required autocomplete="username"></label>
    <label>Поточний пароль *<input name="current" type="password" required autocomplete="current-password"></label>
    <label>Новий пароль (мінімум 6 символів)<input name="password" type="password" autocomplete="new-password"></label>
    <label>Повторіть новий пароль<input name="password2" type="password" autocomplete="new-password"></label>
    <div class="form-actions"><button class="btn" type="submit">Зберегти</button></div>
  </form>
</section>`;
  return adminLayout({ title: 'Акаунт', body, active: '/admin/account', user, flash });
}

export function dashboardPage(user) {
  const n = (sql) => db.prepare(sql).get().n;
  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) AS n FROM orders WHERE status <> 'canceled'").get().n;
  const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 6').all();
  const low = db.prepare('SELECT * FROM products WHERE active = 1 AND stock <= 8 ORDER BY stock LIMIT 6').all();

  const cards = [
    ['Товарів', n('SELECT COUNT(*) AS n FROM products'), '/admin/products'],
    ['Активних', n('SELECT COUNT(*) AS n FROM products WHERE active = 1'), '/admin/products'],
    ['Замовлень', n('SELECT COUNT(*) AS n FROM orders'), '/admin/orders'],
    ['Нових замовлень', n("SELECT COUNT(*) AS n FROM orders WHERE status = 'new'"), '/admin/orders?status=new'],
    ['Сума замовлень', price(revenue), '/admin/orders'],
  ].map(([label, value, href]) => `<a class="stat-card" href="${href}"><span>${esc(label)}</span><b>${esc(value)}</b></a>`).join('');

  const body = `
<header class="head"><h1>Огляд</h1><div class="head-actions"><a class="btn" href="/admin/products/new">+ Додати товар</a></div></header>
<div class="stat-grid">${cards}</div>
<div class="two-col">
  <section class="panel">
    <h2>Останні замовлення</h2>
    ${orders.length ? `<table class="table"><tbody>${orders.map((o) => `
      <tr><td><a href="/admin/orders/${o.id}">№${o.id}</a></td><td>${esc(o.name || '')}</td>
      <td>${price(o.total)}</td><td><span class="pill pill-${esc(o.status)}">${esc(STATUSES[o.status] || o.status)}</span></td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">Замовлень ще немає.</p>'}
  </section>
  <section class="panel">
    <h2>Закінчується на складі</h2>
    ${low.length ? `<table class="table"><tbody>${low.map((p) => `
      <tr><td><a href="/admin/products/${p.id}">${esc(p.title)}</a></td><td class="right">${p.stock} шт</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">Усе в достатку.</p>'}
  </section>
</div>`;
  return adminLayout({ title: 'Огляд', body, active: '/admin', user });
}

export function productsPage(user, query, flash) {
  const q = (query.get('q') || '').trim();
  const cat = query.get('cat') || '';
  const params = [];
  const where = [];
  if (q) { where.push('p.title LIKE ?'); params.push(`%${q}%`); }
  if (cat) { where.push('c.slug = ?'); params.push(cat); }
  const items = db.prepare(`SELECT p.*, c.title AS cat_title FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.sort, p.id`).all(...params);
  const cats = db.prepare('SELECT * FROM categories ORDER BY sort').all();

  const body = `
<header class="head">
  <h1>Товари <span class="count">${items.length}</span></h1>
  <div class="head-actions"><a class="btn" href="/admin/products/new">+ Додати товар</a></div>
</header>
<form class="toolbar" method="get">
  <input name="q" value="${attr(q)}" placeholder="Пошук за назвою">
  <select name="cat"><option value="">Усі категорії</option>${cats.map((c) =>
    `<option value="${attr(c.slug)}"${c.slug === cat ? ' selected' : ''}>${esc(c.title)}</option>`).join('')}</select>
  <button class="btn btn-ghost" type="submit">Фільтрувати</button>
</form>
<table class="table table-products">
  <thead><tr><th></th><th>Назва</th><th>Категорія</th><th>Ціна</th><th>Залишок</th><th>Статус</th><th></th></tr></thead>
  <tbody>${items.map((p) => `
    <tr>
      <td><img class="mini" src="${attr(p.image || '/favicon.svg')}" alt=""></td>
      <td><a href="/admin/products/${p.id}"><b>${esc(p.title)}</b></a><div class="muted small">/${esc(p.slug)}</div></td>
      <td>${esc(p.cat_title || '—')}</td>
      <td>${price(p.price)}${p.old_price > p.price ? `<div class="muted small"><s>${price(p.old_price)}</s></div>` : ''}</td>
      <td class="${p.stock <= 0 ? 'danger' : ''}">${p.stock}</td>
      <td>${p.active ? '<span class="pill pill-done">Активний</span>' : '<span class="pill">Прихований</span>'}</td>
      <td class="right nowrap">
        <a class="btn btn-ghost btn-sm" href="/product/${attr(p.slug)}" target="_blank">↗</a>
        <a class="btn btn-ghost btn-sm" href="/admin/products/${p.id}">Змінити</a>
        <form method="post" action="/admin/products/${p.id}/delete" class="inline" data-confirm="Видалити «${attr(p.title)}»?">
          <button class="btn btn-danger btn-sm" type="submit">✕</button>
        </form>
      </td>
    </tr>`).join('')}
  </tbody>
</table>
${items.length ? '' : '<p class="muted">Нічого не знайдено.</p>'}`;
  return adminLayout({ title: 'Товари', body, active: '/admin/products', user, flash });
}

export function productFormPage(user, product, flash) {
  const cats = db.prepare('SELECT * FROM categories ORDER BY sort').all();
  const p = product || { id: 0, slug: '', title: '', category_id: cats[0]?.id, price: 0, old_price: 0, sku: '', stock: 0,
    short_desc: '', description: '', specs: '[]', image: '', gallery: '[]', is_new: 1, is_hit: 0, active: 1, sort: 0 };
  const specsText = specsOf(p).map((r) => `${r.k}: ${r.v}`).join('\n');
  const images = [p.image, ...json(p.gallery, [])].map((src) => String(src || '').trim()).filter(Boolean);

  const body = `
<header class="head">
  <h1>${p.id ? 'Редагування товару' : 'Новий товар'}</h1>
  <div class="head-actions">
    ${p.id ? `<a class="btn btn-ghost" href="/product/${attr(p.slug)}" target="_blank">Дивитися на сайті ↗</a>` : ''}
    <a class="btn btn-ghost" href="/admin/products">Назад</a>
  </div>
</header>
<form method="post" action="/admin/products/save" enctype="multipart/form-data" class="form-grid">
  <input type="hidden" name="id" value="${p.id}">
  <section class="panel">
    <h2>Основне</h2>
    <label>Назва *<input name="title" value="${attr(p.title)}" required></label>
    <label>URL (латиницею, порожнє — згенерується)<input name="slug" value="${attr(p.slug)}" placeholder="brazil-serrado"></label>
    <label>Категорія<select name="category_id">
      <option value="">— без категорії —</option>
      ${cats.map((c) => `<option value="${c.id}"${c.id === p.category_id ? ' selected' : ''}>${esc(c.title)}</option>`).join('')}
    </select></label>
    <label>Короткий опис (у картці товару)<textarea name="short_desc" rows="2">${esc(p.short_desc)}</textarea></label>
    <label>Повний опис (абзаци через порожній рядок)<textarea name="description" rows="8">${esc(p.description)}</textarea></label>
    <label>Характеристики — по одній у рядок у форматі <code>Назва: значення</code>
      <textarea name="specs" rows="6" placeholder="Регіон: Уїла&#10;Вага: 250 г">${esc(specsText)}</textarea></label>
  </section>
  <section class="panel">
    <h2>Ціна та наявність</h2>
    <div class="row">
      <label>Ціна, грн *<input name="price" type="number" min="0" value="${p.price}" required></label>
      <label>Стара ціна (0 — без знижки)<input name="old_price" type="number" min="0" value="${p.old_price}"></label>
    </div>
    <div class="row">
      <label>Залишок, шт<input name="stock" type="number" min="0" value="${p.stock}"></label>
      <label>Артикул<input name="sku" value="${attr(p.sku)}"></label>
    </div>
    <label>Порядок сортування<input name="sort" type="number" value="${p.sort}"></label>
    <div class="checks">
      <label class="check"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> Показувати на сайті</label>
      <label class="check"><input type="checkbox" name="is_new" ${p.is_new ? 'checked' : ''}> Плашка «Новинка»</label>
      <label class="check"><input type="checkbox" name="is_hit" ${p.is_hit ? 'checked' : ''}> Плашка «Хіт»</label>
    </div>

    <h2>Зображення</h2>
    <div class="img-manager" id="img-manager" data-images="${attr(JSON.stringify(images))}">${images.map(imageCard).join('')}</div>
    <div class="img-actions">
      <label class="file-btn">Завантажити фото<input type="file" id="img-input" name="image_files" accept="image/*" multiple></label>
      <button class="btn btn-ghost btn-sm" type="button" data-add-url>Додати за посиланням</button>
    </div>
    <p class="muted small" id="img-status">Перше фото — головне. Перетягуйте картки, щоб змінити порядок.</p>

    <div class="form-actions">
      <button class="btn" type="submit">Зберегти</button>
      ${p.id ? `<form method="post" action="/admin/products/${p.id}/delete" class="inline" data-confirm="Видалити товар?"><button class="btn btn-danger" type="submit">Видалити</button></form>` : ''}
    </div>
  </section>
</form>`;
  return adminLayout({ title: p.id ? p.title : 'Новий товар', body, active: '/admin/products', user, flash });
}

export function categoriesPage(user, flash) {
  const cats = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS n
                           FROM categories c ORDER BY c.sort, c.title`).all();
  const body = `
<header class="head"><h1>Категорії</h1></header>
<div class="two-col">
  <section class="panel">
    <h2>Список</h2>
    <table class="table"><thead><tr><th>Назва</th><th>URL</th><th>Товарів</th><th></th></tr></thead><tbody>
    ${cats.map((c) => `<tr>
      <td>${esc(c.title)}<div class="muted small">${esc(c.description)}</div></td>
      <td class="muted small">${esc(c.slug)}</td>
      <td>${c.n}</td>
      <td class="right nowrap">
        <button class="btn btn-ghost btn-sm" data-edit-cat='${attr(JSON.stringify(c))}'>Змінити</button>
        <form method="post" action="/admin/categories/${c.id}/delete" class="inline" data-confirm="Видалити категорію? Товари залишаться без категорії.">
          <button class="btn btn-danger btn-sm" type="submit">✕</button></form>
      </td></tr>`).join('')}
    </tbody></table>
  </section>
  <section class="panel">
    <h2 id="cat-form-title">Нова категорія</h2>
    <form method="post" action="/admin/categories/save" id="cat-form">
      <input type="hidden" name="id" value="">
      <label>Назва *<input name="title" required></label>
      <label>URL (латиницею)<input name="slug" placeholder="espresso"></label>
      <label>Опис<textarea name="description" rows="3"></textarea></label>
      <label>Сортування<input name="sort" type="number" value="0"></label>
      <div class="form-actions"><button class="btn" type="submit">Зберегти</button>
        <button class="btn btn-ghost" type="reset" data-cat-reset>Очистити</button></div>
    </form>
  </section>
</div>`;
  return adminLayout({ title: 'Категорії', body, active: '/admin/categories', user, flash });
}

export function pagesPage(user, flash) {
  const pages = db.prepare('SELECT * FROM pages ORDER BY sort, title').all();
  const body = `
<header class="head"><h1>Сторінки</h1></header>
<div class="two-col">
  <section class="panel"><h2>Список</h2>
    <table class="table"><tbody>${pages.map((p) => `<tr>
      <td><b>${esc(p.title)}</b><div class="muted small">/page/${esc(p.slug)}</div></td>
      <td>${p.in_menu ? '<span class="pill pill-done">У меню</span>' : '<span class="pill">Прихована</span>'}</td>
      <td class="right nowrap">
        <a class="btn btn-ghost btn-sm" href="/page/${attr(p.slug)}" target="_blank">↗</a>
        <a class="btn btn-ghost btn-sm" href="/admin/pages/${p.id}">Змінити</a>
        <form method="post" action="/admin/pages/${p.id}/delete" class="inline" data-confirm="Видалити сторінку?"><button class="btn btn-danger btn-sm">✕</button></form>
      </td></tr>`).join('')}</tbody></table>
  </section>
  <section class="panel"><h2>Нова сторінка</h2>
    <form method="post" action="/admin/pages/save">
      <input type="hidden" name="id" value="">
      <label>Заголовок *<input name="title" required></label>
      <label>URL<input name="slug" placeholder="delivery"></label>
      <label>Текст<textarea name="content" rows="8"></textarea></label>
      <label>Сортування<input name="sort" type="number" value="0"></label>
      <label class="check"><input type="checkbox" name="in_menu" checked> Показувати в меню</label>
      <div class="form-actions"><button class="btn" type="submit">Створити</button></div>
    </form>
  </section>
</div>`;
  return adminLayout({ title: 'Сторінки', body, active: '/admin/pages', user, flash });
}

export function pageFormPage(user, page, flash) {
  const body = `
<header class="head"><h1>${esc(page.title)}</h1>
  <div class="head-actions"><a class="btn btn-ghost" href="/page/${attr(page.slug)}" target="_blank">Дивитися ↗</a>
  <a class="btn btn-ghost" href="/admin/pages">Назад</a></div></header>
<section class="panel panel-wide">
  <form method="post" action="/admin/pages/save">
    <input type="hidden" name="id" value="${page.id}">
    <label>Заголовок *<input name="title" value="${attr(page.title)}" required></label>
    <label>URL<input name="slug" value="${attr(page.slug)}"></label>
    <label>Текст (абзаци через порожній рядок)<textarea name="content" rows="16">${esc(page.content)}</textarea></label>
    <label>Сортування<input name="sort" type="number" value="${page.sort}"></label>
    <label class="check"><input type="checkbox" name="in_menu" ${page.in_menu ? 'checked' : ''}> Показувати в меню</label>
    <div class="form-actions"><button class="btn" type="submit">Зберегти</button></div>
  </form>
</section>`;
  return adminLayout({ title: page.title, body, active: '/admin/pages', user, flash });
}

export function textsPage(user, settings, flash) {
  const groups = SETTINGS_SCHEMA.map((group, gi) => `
    <section class="panel" id="g${gi}">
      <h2>${esc(group.group)}</h2>
      ${group.hint ? `<p class="muted small">${esc(group.hint)}</p>` : ''}
      ${group.fields.map((f) => {
        const value = settings[f.key] ?? '';
        if (f.type === 'textarea')
          return `<label>${esc(f.label)}<textarea name="${attr(f.key)}" rows="4">${esc(value)}</textarea><span class="key">${esc(f.key)}</span></label>`;
        if (f.type === 'image')
          return `<label>${esc(f.label)}
            <div class="img-preview small-preview">${value ? `<img src="${attr(value)}" alt="">` : ''}</div>
            <input name="${attr(f.key)}" value="${attr(value)}">
            <input type="file" name="file:${attr(f.key)}" accept="image/*">
            <span class="key">${esc(f.key)}</span></label>`;
        return `<label>${esc(f.label)}<input name="${attr(f.key)}" value="${attr(value)}"><span class="key">${esc(f.key)}</span></label>`;
      }).join('')}
    </section>`).join('');

  const body = `
<header class="head">
  <h1>Тексти сайту</h1>
  <div class="head-actions"><a class="btn btn-ghost" href="/" target="_blank">Дивитися сайт ↗</a></div>
</header>
<p class="muted">Тут редагується будь-який текст вітрини: банер, переваги, блок «про нас», підвал, контакти, підписи кошика й оформлення.</p>
<nav class="anchors">${SETTINGS_SCHEMA.map((g, i) => `<a href="#g${i}">${esc(g.group)}</a>`).join('')}</nav>
<form method="post" action="/admin/texts" enctype="multipart/form-data" class="texts-form">
  ${groups}
  <div class="sticky-save"><button class="btn" type="submit">Зберегти всі тексти</button></div>
</form>`;
  return adminLayout({ title: 'Тексти сайту', body, active: '/admin/texts', user, flash });
}

export function ordersPage(user, query, flash) {
  const status = query.get('status') || '';
  const orders = status
    ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC').all(status)
    : db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  const tabs = [['', 'Усі'], ...Object.entries(STATUSES)]
    .map(([v, l]) => `<a class="chip${v === status ? ' on' : ''}" href="/admin/orders${v ? '?status=' + v : ''}">${esc(l)}</a>`).join('');

  const body = `
<header class="head"><h1>Замовлення <span class="count">${orders.length}</span></h1></header>
<nav class="chips">${tabs}</nav>
${orders.length ? `<table class="table">
  <thead><tr><th>№</th><th>Дата</th><th>Клієнт</th><th>Телефон</th><th>Сума</th><th>Статус</th><th></th></tr></thead>
  <tbody>${orders.map((o) => `<tr>
    <td><a href="/admin/orders/${o.id}"><b>№${o.id}</b></a></td>
    <td class="muted small">${esc(new Date(o.created_at).toLocaleString('uk-UA'))}</td>
    <td>${esc(o.name || '')}<div class="muted small">${esc(o.city || '')}</div></td>
    <td>${esc(o.phone || '')}</td>
    <td>${price(o.total)}</td>
    <td><span class="pill pill-${esc(o.status)}">${esc(STATUSES[o.status] || o.status)}</span></td>
    <td class="right"><a class="btn btn-ghost btn-sm" href="/admin/orders/${o.id}">Відкрити</a></td>
  </tr>`).join('')}</tbody></table>` : '<p class="muted">Замовлень немає.</p>'}`;
  return adminLayout({ title: 'Замовлення', body, active: '/admin/orders', user, flash });
}

export function orderPage(user, order, flash) {
  const items = json(order.items, []);
  const body = `
<header class="head"><h1>Замовлення №${order.id}</h1>
  <div class="head-actions"><a class="btn btn-ghost" href="/admin/orders">Назад</a></div></header>
<div class="two-col">
  <section class="panel">
    <h2>Склад замовлення</h2>
    <table class="table"><tbody>${items.map((it) => `<tr>
      <td><img class="mini" src="${attr(it.image || '/favicon.svg')}" alt=""></td>
      <td>${esc(it.title)}<div class="muted small">${price(it.price)} × ${it.qty}</div></td>
      <td class="right"><b>${price(it.price * it.qty)}</b></td></tr>`).join('')}</tbody></table>
    <div class="order-total">Разом: <b>${price(order.total)}</b></div>
  </section>
  <section class="panel">
    <h2>Клієнт</h2>
    <dl class="dl">
      <dt>Імʼя</dt><dd>${esc(order.name || '')}</dd>
      <dt>Телефон</dt><dd><a href="tel:${attr(order.phone || '')}">${esc(order.phone || '')}</a></dd>
      <dt>E-mail</dt><dd>${esc(order.email || '—')}</dd>
      <dt>Місто</dt><dd>${esc(order.city || '')}</dd>
      <dt>Доставка</dt><dd>${esc(order.delivery || '')}</dd>
      <dt>Оплата</dt><dd>${esc(order.payment || '')}</dd>
      <dt>Коментар</dt><dd>${esc(order.note || '—')}</dd>
      <dt>Створено</dt><dd>${esc(new Date(order.created_at).toLocaleString('uk-UA'))}</dd>
    </dl>
    <form method="post" action="/admin/orders/${order.id}/status" class="status-form">
      <label>Статус<select name="status">${Object.entries(STATUSES).map(([v, l]) =>
        `<option value="${v}"${order.status === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <button class="btn" type="submit">Оновити</button>
    </form>
    <form method="post" action="/admin/orders/${order.id}/delete" data-confirm="Видалити замовлення?">
      <button class="btn btn-danger btn-sm" type="submit">Видалити замовлення</button>
    </form>
  </section>
</div>`;
  return adminLayout({ title: 'Замовлення №' + order.id, body, active: '/admin/orders', user, flash });
}

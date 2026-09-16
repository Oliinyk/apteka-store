import { db, json } from './db.js';
import { layout, shopContext, productCard, esc, attr, price, paragraphs, lines, specsOf } from './render.js';

const activeProducts = (extra = '', params = []) =>
  db.prepare(`SELECT p.*, c.slug AS cat_slug, c.title AS cat_title
              FROM products p LEFT JOIN categories c ON c.id = p.category_id
              WHERE p.active = 1 ${extra}`).all(...params);

export function homePage() {
  const ctx = shopContext();
  const { s } = ctx;
  const limit = Math.max(1, parseInt(s['catalog.limit'] || '8', 10) || 8);
  const items = activeProducts('ORDER BY p.is_hit DESC, p.sort, p.id').slice(0, limit);
  const total = db.prepare('SELECT COUNT(*) AS n FROM products WHERE active = 1').get().n;

  const usp = [1, 2, 3, 4]
    .map((i) => `<div class="usp-item"><span class="usp-num">0${i}</span><h3>${esc(s[`usp.${i}.title`] || '')}</h3><p>${esc(s[`usp.${i}.text`] || '')}</p></div>`)
    .join('');

  const stats = [1, 2, 3]
    .map((i) => `<div class="stat"><strong>${esc(s[`about.stat${i}.value`] || '')}</strong><span>${esc(s[`about.stat${i}.label`] || '')}</span></div>`)
    .join('');

  const cats = ctx.categories
    .map((c) => {
      const n = db.prepare('SELECT COUNT(*) AS n FROM products WHERE category_id = ? AND active = 1').get(c.id).n;
      return `<a class="cat-card" href="/catalog?cat=${attr(c.slug)}">
        <h3>${esc(c.title)}</h3><p>${esc(c.description)}</p><span>${n} позицій →</span></a>`;
    })
    .join('');

  const body = `
<section class="hero">
  <div class="shell hero-grid">
    <div class="hero-copy">
      <span class="eyebrow">${esc(s['hero.eyebrow'] || '')}</span>
      <h1>${esc(s['hero.title'] || '').replace(/\n/g, '<br>')}</h1>
      <p>${esc(s['hero.subtitle'] || '')}</p>
      <a class="btn btn-lg" href="${attr(s['hero.cta_link'] || '/catalog')}">${esc(s['hero.cta'] || 'Каталог')}</a>
    </div>
    <div class="hero-media">
      <img src="${attr(s['hero.image'] || '/uploads/hero.svg')}" alt="${attr(s['site.name'] || '')}">
      ${s['hero.badge'] ? `<span class="hero-badge">${esc(s['hero.badge'])}</span>` : ''}
    </div>
  </div>
</section>

<section class="usp"><div class="shell usp-grid">${usp}</div></section>

<section class="section">
  <div class="shell">
    <div class="section-head">
      <div>
        <h2>${esc(s['catalog.title'] || '')}</h2>
        <p>${esc(s['catalog.subtitle'] || '')} · ${total} товарів</p>
      </div>
      <a class="btn btn-ghost" href="/catalog">Увесь каталог</a>
    </div>
    <div class="grid">${items.map(productCard).join('')}</div>
  </div>
</section>

<section class="section section-alt">
  <div class="shell">
    <div class="section-head"><div><h2>Категорії</h2><p>Оберіть за методом заварювання</p></div></div>
    <div class="cat-grid">${cats}</div>
  </div>
</section>

<section class="section about">
  <div class="shell about-grid">
    <div class="about-visual"><div class="about-mark">Z</div><span>${esc(s['about.eyebrow'] || '')}</span></div>
    <div>
      <span class="eyebrow">Про магазин</span>
      <h2>${esc(s['about.title'] || '')}</h2>
      ${paragraphs(s['about.text'])}
      <div class="stats">${stats}</div>
      <a class="link-arrow" href="${attr(s['about.link'] || '/page/about')}">Докладніше про нас →</a>
    </div>
  </div>
</section>`;

  return layout({ title: s['site.meta_title'] || s['site.name'] || 'Магазин', body, ctx });
}

export function catalogPage(query) {
  const ctx = shopContext();
  const { s } = ctx;
  const cat = query.get('cat') || '';
  const q = (query.get('q') || '').trim();
  const sort = query.get('sort') || 'default';

  const where = [];
  const params = [];
  if (cat) { where.push('c.slug = ?'); params.push(cat); }
  if (q) { where.push('(p.title LIKE ? OR p.short_desc LIKE ? OR p.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }

  const orderBy = {
    price_asc: 'p.price ASC',
    price_desc: 'p.price DESC',
    new: 'p.id DESC',
    default: 'p.is_hit DESC, p.sort, p.id',
  }[sort] || 'p.sort, p.id';

  const items = activeProducts(
    (where.length ? 'AND ' + where.join(' AND ') + ' ' : '') + 'ORDER BY ' + orderBy,
    params
  );

  const current = ctx.categories.find((c) => c.slug === cat);
  const chips = [{ slug: '', title: 'Усі' }, ...ctx.categories]
    .map((c) => {
      const params2 = new URLSearchParams();
      if (c.slug) params2.set('cat', c.slug);
      if (q) params2.set('q', q);
      if (sort !== 'default') params2.set('sort', sort);
      const href = '/catalog' + (params2.toString() ? '?' + params2 : '');
      return `<a class="chip${c.slug === cat ? ' chip-on' : ''}" href="${attr(href)}">${esc(c.title)}</a>`;
    })
    .join('');

  const options = [
    ['default', 'Спочатку популярні'],
    ['new', 'Спочатку нові'],
    ['price_asc', 'Дешевші спершу'],
    ['price_desc', 'Дорожчі спершу'],
  ].map(([v, l]) => `<option value="${v}"${sort === v ? ' selected' : ''}>${esc(l)}</option>`).join('');

  const body = `
<section class="page-head">
  <div class="shell">
    <nav class="crumbs"><a href="/">Головна</a> / <span>${esc(current ? current.title : s['catalog.page_title'] || 'Каталог')}</span></nav>
    <h1>${esc(current ? current.title : s['catalog.page_title'] || 'Каталог')}</h1>
    <p>${esc(current ? current.description : s['catalog.page_text'] || '')}</p>
  </div>
</section>
<section class="section">
  <div class="shell">
    <form class="filters" method="get" action="/catalog">
      ${cat ? `<input type="hidden" name="cat" value="${attr(cat)}">` : ''}
      <input class="search" type="search" name="q" value="${attr(q)}" placeholder="Пошук за назвою або смаком">
      <select name="sort" onchange="this.form.submit()">${options}</select>
      <button class="btn btn-sm" type="submit">Знайти</button>
    </form>
    <div class="chips">${chips}</div>
    <p class="result-count">Знайдено: ${items.length}</p>
    ${items.length
      ? `<div class="grid">${items.map(productCard).join('')}</div>`
      : '<p class="empty">Нічого не знайшли. Спробуйте змінити запит або оберіть іншу категорію.</p>'}
  </div>
</section>`;

  return layout({ title: (current ? current.title : 'Каталог') + ' — ' + (s['site.name'] || ''), body, ctx });
}

export function productPage(slug) {
  const ctx = shopContext();
  const p = db.prepare(`SELECT p.*, c.slug AS cat_slug, c.title AS cat_title
                        FROM products p LEFT JOIN categories c ON c.id = p.category_id
                        WHERE p.slug = ? AND p.active = 1`).get(slug);
  if (!p) return null;

  const gallery = [p.image, ...json(p.gallery, [])].filter(Boolean);
  const specs = specsOf(p)
    .map((row) => `<div class="spec"><span>${esc(row.k)}</span><b>${esc(row.v)}</b></div>`)
    .join('');
  const related = db.prepare(`SELECT p.*, c.slug AS cat_slug FROM products p LEFT JOIN categories c ON c.id = p.category_id
                              WHERE p.active = 1 AND p.id <> ? AND p.category_id IS ?
                              ORDER BY RANDOM() LIMIT 4`).all(p.id, p.category_id);
  const discount = p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0;

  const body = `
<section class="section product-page">
  <div class="shell">
    <nav class="crumbs">
      <a href="/">Головна</a> / <a href="/catalog">Каталог</a>
      ${p.cat_slug ? ` / <a href="/catalog?cat=${attr(p.cat_slug)}">${esc(p.cat_title)}</a>` : ''}
      / <span>${esc(p.title)}</span>
    </nav>
    <div class="product-grid">
      <div class="product-media">
        <img id="main-image" src="${attr(gallery[0] || '/uploads/hero.svg')}" alt="${attr(p.title)}">
        ${gallery.length > 1
          ? `<div class="thumbs">${gallery.map((g, i) => `<button class="thumb${i === 0 ? ' thumb-on' : ''}" data-src="${attr(g)}"><img src="${attr(g)}" alt=""></button>`).join('')}</div>`
          : ''}
      </div>
      <div class="product-info">
        <div class="card-badges inline">
          ${discount ? `<span class="badge badge-sale">−${discount}%</span>` : ''}
          ${p.is_new ? '<span class="badge">Новинка</span>' : ''}
          ${p.is_hit ? '<span class="badge badge-hit">Хіт</span>' : ''}
        </div>
        <h1>${esc(p.title)}</h1>
        <p class="lead">${esc(p.short_desc)}</p>
        <div class="buy">
          <div class="prices">
            <span class="price price-lg">${price(p.price)}</span>
            ${p.old_price > p.price ? `<s class="old">${price(p.old_price)}</s>` : ''}
          </div>
          <div class="stock ${p.stock > 0 ? 'in' : 'out'}">${p.stock > 0 ? `В наявності: ${p.stock} шт` : 'Немає в наявності'}</div>
        </div>
        ${p.stock > 0 ? `<div class="buy-row">
          <div class="qty"><button type="button" data-qty="-1">−</button><input id="qty" type="number" value="1" min="1" max="${p.stock}"><button type="button" data-qty="1">+</button></div>
          <button class="btn btn-lg add-to-cart" data-id="${p.id}" data-title="${attr(p.title)}" data-price="${p.price}" data-image="${attr(p.image)}" data-slug="${attr(p.slug)}" data-qty-input="qty">Додати в кошик</button>
        </div>` : '<p class="empty">Лот закінчився. Напишіть нам — підкажемо схожу позицію.</p>'}
        <div class="meta-row">${p.sku ? `<span>Артикул: ${esc(p.sku)}</span>` : ''}${p.cat_title ? `<span>Категорія: ${esc(p.cat_title)}</span>` : ''}</div>
        ${ctx.s['site.disclaimer'] ? `<p class="notice">${esc(ctx.s['site.disclaimer'])}</p>` : ''}
        <div class="prose">${paragraphs(p.description)}</div>
        ${specs ? `<div class="specs"><h3>Характеристики</h3>${specs}</div>` : ''}
      </div>
    </div>
    ${related.length ? `<div class="section-head related-head"><div><h2>Схожі позиції</h2></div></div><div class="grid">${related.map(productCard).join('')}</div>` : ''}
  </div>
</section>`;

  return layout({ title: `${p.title} — ${ctx.s['site.name'] || ''}`, body, ctx, description: p.short_desc });
}

export function cartPage() {
  const ctx = shopContext();
  const { s } = ctx;
  const body = `
<section class="page-head"><div class="shell">
  <nav class="crumbs"><a href="/">Головна</a> / <span>${esc(s['cart.title'] || 'Кошик')}</span></nav>
  <h1>${esc(s['cart.title'] || 'Кошик')}</h1>
</div></section>
<section class="section"><div class="shell">
  <div id="cart-root" data-empty-text="${attr(s['cart.empty'] || '')}" data-free-from="${attr(s['checkout.free_from'] || '0')}"></div>
</div></section>`;
  return layout({ title: 'Кошик — ' + (s['site.name'] || ''), body, ctx });
}

export function checkoutPage() {
  const ctx = shopContext();
  const { s } = ctx;
  const delivery = lines(s['checkout.delivery_options']).map((o) => `<option>${esc(o)}</option>`).join('');
  const payment = lines(s['checkout.payment_options']).map((o) => `<option>${esc(o)}</option>`).join('');

  const body = `
<section class="page-head"><div class="shell">
  <nav class="crumbs"><a href="/">Головна</a> / <a href="/cart">Кошик</a> / <span>Оформлення</span></nav>
  <h1>${esc(s['checkout.title'] || 'Оформлення замовлення')}</h1>
  <p>${esc(s['checkout.note'] || '')}</p>
</div></section>
<section class="section"><div class="shell checkout-grid">
  <form id="checkout-form" class="form-card">
    <div class="field"><label for="name">Імʼя та прізвище *</label><input id="name" name="name" required></div>
    <div class="field-row">
      <div class="field"><label for="phone">Телефон *</label><input id="phone" name="phone" required placeholder="+380"></div>
      <div class="field"><label for="email">E-mail</label><input id="email" name="email" type="email"></div>
    </div>
    <div class="field"><label for="city">Місто *</label><input id="city" name="city" required></div>
    <div class="field-row">
      <div class="field"><label for="delivery">Доставка</label><select id="delivery" name="delivery">${delivery}</select></div>
      <div class="field"><label for="payment">Оплата</label><select id="payment" name="payment">${payment}</select></div>
    </div>
    <div class="field"><label for="note">Коментар (помел, відділення тощо)</label><textarea id="note" name="note" rows="3"></textarea></div>
    <button class="btn btn-lg" type="submit">Підтвердити замовлення</button>
    <p class="form-note" id="form-note"></p>
  </form>
  <aside class="summary" id="checkout-summary" data-free-from="${attr(s['checkout.free_from'] || '0')}" data-success="${attr(s['checkout.success'] || '')}"></aside>
</div></section>`;
  return layout({ title: 'Оформлення — ' + (s['site.name'] || ''), body, ctx });
}

export function staticPage(slug) {
  const ctx = shopContext();
  const page = db.prepare('SELECT * FROM pages WHERE slug = ?').get(slug);
  if (!page) return null;
  const body = `
<section class="page-head"><div class="shell">
  <nav class="crumbs"><a href="/">Головна</a> / <span>${esc(page.title)}</span></nav>
  <h1>${esc(page.title)}</h1>
</div></section>
<section class="section"><div class="shell"><div class="prose prose-wide">${paragraphs(page.content)}</div></div></section>`;
  return layout({ title: `${page.title} — ${ctx.s['site.name'] || ''}`, body, ctx });
}

export function notFoundPage() {
  const ctx = shopContext();
  const body = `<section class="section notfound"><div class="shell">
    <h1>404</h1><p>Такої сторінки немає. Можливо, лот уже закінчився.</p>
    <a class="btn" href="/">На головну</a>
  </div></section>`;
  return layout({ title: '404', body, ctx });
}

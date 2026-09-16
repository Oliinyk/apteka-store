import { db, allSettings, json } from './db.js';

export const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const attr = esc;

export const price = (v) => new Intl.NumberFormat('uk-UA').format(Number(v) || 0) + ' грн';

export const paragraphs = (text) =>
  String(text ?? '')
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');

export const lines = (text) => String(text ?? '').split('\n').map((s) => s.trim()).filter(Boolean);

export function shopContext() {
  return {
    s: allSettings(),
    categories: db.prepare('SELECT * FROM categories ORDER BY sort, title').all(),
    menuPages: db.prepare('SELECT * FROM pages WHERE in_menu = 1 ORDER BY sort, title').all(),
  };
}

export function productCard(p) {
  const discount = p.old_price > p.price && p.old_price > 0
    ? Math.round((1 - p.price / p.old_price) * 100) : 0;
  const badges = [
    discount ? `<span class="badge badge-sale">−${discount}%</span>` : '',
    p.is_new ? '<span class="badge">Новинка</span>' : '',
    p.is_hit ? '<span class="badge badge-hit">Хіт</span>' : '',
  ].join('');
  const out = p.stock <= 0;
  return `<article class="card${out ? ' card-out' : ''}">
  <a class="card-media" href="/product/${attr(p.slug)}">
    <img src="${attr(p.image || '/uploads/hero.svg')}" alt="${attr(p.title)}" loading="lazy">
    <span class="card-badges">${badges}</span>
  </a>
  <div class="card-body">
    <a class="card-title" href="/product/${attr(p.slug)}">${esc(p.title)}</a>
    <p class="card-desc">${esc(p.short_desc)}</p>
    <div class="card-foot">
      <div class="prices">
        <span class="price">${price(p.price)}</span>
        ${p.old_price > p.price ? `<s class="old">${price(p.old_price)}</s>` : ''}
      </div>
      ${out
        ? '<span class="stock-out">Немає</span>'
        : `<button class="btn btn-sm add-to-cart" data-id="${p.id}" data-title="${attr(p.title)}" data-price="${p.price}" data-image="${attr(p.image)}" data-slug="${attr(p.slug)}">У кошик</button>`}
    </div>
  </div>
</article>`;
}

export function layout({ title, body, ctx, description = '', bodyClass = '' }) {
  const { s, categories, menuPages } = ctx;
  const initial = (s['site.name'] || '•').trim().charAt(0).toUpperCase();
  const catLinks = categories
    .map((c) => `<a href="/catalog?cat=${attr(c.slug)}">${esc(c.title)}</a>`)
    .join('');
  const pageLinks = menuPages
    .map((p) => `<a href="/page/${attr(p.slug)}">${esc(p.title)}</a>`)
    .join('');

  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description || s['site.meta_description'] || '')}">
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/styles.css">
</head>
<body class="${attr(bodyClass)}">
${s['topbar.text'] ? `<div class="topbar">${esc(s['topbar.text'])}</div>` : ''}
<header class="site-header">
  <div class="shell header-inner">
    <a class="logo" href="/">
      <span class="logo-mark">${esc(initial)}</span>
      <span class="logo-text"><strong>${esc(s['site.name'] || 'ZERNO')}</strong><small>${esc(s['site.tagline'] || '')}</small></span>
    </a>
    <nav class="nav">
      <a href="/catalog">Каталог</a>
      ${catLinks}
      ${pageLinks}
    </nav>
    <div class="header-actions">
      <a class="phone" href="tel:${attr(String(s['site.phone'] || '').replace(/[^\d+]/g, ''))}">${esc(s['site.phone'] || '')}</a>
      <a class="cart-link" href="/cart">Кошик<span class="cart-count" data-cart-count>0</span></a>
      <button class="burger" aria-label="Меню" data-burger>☰</button>
    </div>
  </div>
</header>
<main>${body}</main>
<footer class="site-footer">
  <div class="shell footer-grid">
    <div>
      <div class="logo logo-light">
        <span class="logo-mark">${esc(initial)}</span>
        <span class="logo-text"><strong>${esc(s['site.name'] || '')}</strong><small>${esc(s['site.tagline'] || '')}</small></span>
      </div>
      <p class="footer-about">${esc(s['footer.about'] || '')}</p>
    </div>
    <div>
      <h4>Каталог</h4>
      ${categories.map((c) => `<a href="/catalog?cat=${attr(c.slug)}">${esc(c.title)}</a>`).join('')}
    </div>
    <div>
      <h4>Інформація</h4>
      ${menuPages.map((p) => `<a href="/page/${attr(p.slug)}">${esc(p.title)}</a>`).join('')}
    </div>
    <div>
      <h4>Контакти</h4>
      <a href="tel:${attr(String(s['site.phone'] || '').replace(/[^\d+]/g, ''))}">${esc(s['site.phone'] || '')}</a>
      <a href="mailto:${attr(s['site.email'] || '')}">${esc(s['site.email'] || '')}</a>
      <span>${esc(s['site.address'] || '')}</span>
      <span>${esc(s['site.schedule'] || '')}</span>
      <span>${esc(s['site.telegram'] || '')}</span>
    </div>
  </div>
  ${s['site.disclaimer'] ? `<div class="shell disclaimer">${esc(s['site.disclaimer'])}</div>` : ''}
  <div class="shell footer-bottom">
    <span>${esc(s['footer.copyright'] || '')}</span>
    <a href="/admin">Адмінка</a>
  </div>
</footer>
<script src="/shop.js"></script>
</body>
</html>`;
}

export const specsOf = (p) => json(p.specs, []);

import http from 'node:http';
import { createReadStream, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import path from 'node:path';
import { db, verifyPassword, hashPassword, allSettings, setSetting, json } from './src/db.js';
import { seed } from './src/seed.js';
import { PUBLIC_DIR, UPLOADS_DIR } from './src/paths.js';
import { SETTINGS_KEYS } from './src/settings-schema.js';
import { slugify, uniqueSlug, int, bool, toArray } from './src/util.js';
import * as shop from './src/views-shop.js';
import * as admin from './src/views-admin.js';

seed();

const PORT = int(process.env.PORT, 3001);
const sessions = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
};

const html = (res, body, status = 200) => {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
};
const sendJson = (res, data, status = 200) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};
const redirect = (res, location) => { res.writeHead(302, { location }); res.end(); };

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('='));
  }
  return out;
}

function defaultPasswordInUse() {
  const account = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
  return Boolean(account) && verifyPassword('admin123', account);
}

function currentUser(req) {
  const sid = cookies(req).sid;
  const session = sid && sessions.get(sid);
  if (!session) return null;
  return db.prepare('SELECT id, username FROM users WHERE id = ?').get(session.userId) || null;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 25 * 1024 * 1024) throw new Error('Файл завеликий (ліміт 25 МБ)');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function put(target, key, value) {
  if (!Object.hasOwn(target, key)) target[key] = value;
  else if (Array.isArray(target[key])) target[key].push(value);
  else target[key] = [target[key], value];
}

async function parseForm(req) {
  const buffer = await readBody(req);
  const type = req.headers['content-type'] || '';
  if (type.startsWith('application/json')) return { fields: json(buffer.toString('utf8'), {}), files: {} };

  const fields = {};
  const files = {};
  if (type.startsWith('multipart/form-data')) {
    const form = await new Response(buffer, { headers: { 'content-type': type } }).formData();
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') put(fields, key, value);
      else if (value.size > 0) (files[key] ||= []).push(value);
    }
  } else {
    for (const [key, value] of new URLSearchParams(buffer.toString('utf8'))) put(fields, key, value);
  }
  return { fields, files };
}

const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/avif': '.avif' };

async function saveUpload(file) {
  const ext = EXT[file.type] || path.extname(file.name) || '.bin';
  if (!EXT[file.type]) return '';
  const name = `${slugify(path.parse(file.name).name, 'img')}-${randomBytes(4).toString('hex')}${ext}`;
  mkdirSync(UPLOADS_DIR, { recursive: true });
  writeFileSync(path.join(UPLOADS_DIR, name), Buffer.from(await file.arrayBuffer()));
  return '/uploads/' + name;
}

function serveStatic(req, res, pathname) {
  const file = path.join(PUBLIC_DIR, decodeURIComponent(pathname));
  if (!file.startsWith(PUBLIC_DIR) || !existsSync(file) || !statSync(file).isFile()) return false;
  res.writeHead(200, {
    'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'cache-control': pathname.startsWith('/uploads/') ? 'public, max-age=86400' : 'no-cache',
  });
  createReadStream(file).pipe(res);
  return true;
}

function flashOf(url) {
  return { saved: 'Збережено.', deleted: 'Видалено.', created: 'Створено.', updated: 'Оновлено.' }[url.searchParams.get('ok')] || '';
}

async function handleAdmin(req, res, url, user) {
  const p = url.pathname;
  const flash = flashOf(url);

  if (p === '/admin/login') {
    if (req.method === 'POST') {
      const { fields } = await parseForm(req);
      const account = db.prepare('SELECT * FROM users WHERE username = ?').get(String(fields.username || '').trim());
      if (!account || !verifyPassword(String(fields.password || ''), account))
        return html(res, admin.loginPage('Невірний логін або пароль', defaultPasswordInUse()), 401);
      const sid = randomUUID();
      sessions.set(sid, { userId: account.id });
      res.writeHead(302, { location: '/admin', 'set-cookie': `sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800` });
      return res.end();
    }
    return user ? redirect(res, '/admin') : html(res, admin.loginPage('', defaultPasswordInUse()));
  }

  if (p === '/admin/logout' && req.method === 'POST') {
    sessions.delete(cookies(req).sid);
    res.writeHead(302, { location: '/admin/login', 'set-cookie': 'sid=; Path=/; Max-Age=0' });
    return res.end();
  }

  if (!user) return redirect(res, '/admin/login');

  if (p === '/admin' || p === '/admin/') return html(res, admin.dashboardPage(user));

  if (p === '/admin/account') {
    if (req.method !== 'POST') return html(res, admin.accountPage(user, { flash }));

    const { fields } = await parseForm(req);
    const account = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    const username = String(fields.username || '').trim();
    const next = String(fields.password || '');
    const repeat = String(fields.password2 || '');
    const fail = (error) => html(res, admin.accountPage(user, { error }), 400);

    if (!verifyPassword(String(fields.current || ''), account)) return fail('Поточний пароль введено невірно.');
    if (!username) return fail('Логін не може бути порожнім.');
    if (db.prepare('SELECT 1 FROM users WHERE username = ? AND id <> ?').get(username, account.id))
      return fail('Такий логін уже зайнятий.');
    if (next || repeat) {
      if (next.length < 6) return fail('Новий пароль має містити щонайменше 6 символів.');
      if (next !== repeat) return fail('Новий пароль і повтор не збігаються.');
    }

    if (next) {
      const { salt, hash } = hashPassword(next);
      db.prepare('UPDATE users SET username = ?, hash = ?, salt = ? WHERE id = ?').run(username, hash, salt, account.id);
      for (const [sid, session] of sessions)
        if (session.userId === account.id && sid !== cookies(req).sid) sessions.delete(sid);
    } else {
      db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, account.id);
    }
    return redirect(res, '/admin/account?ok=saved');
  }

  if (p === '/admin/upload' && req.method === 'POST') {
    const { files } = await parseForm(req);
    const urls = [];
    let skipped = 0;
    for (const file of files.files || []) {
      const saved = await saveUpload(file);
      if (saved) urls.push(saved); else skipped += 1;
    }
    return sendJson(res, { urls, skipped });
  }

  if (p === '/admin/products') return html(res, admin.productsPage(user, url.searchParams, flash));

  if (p === '/admin/products/new') return html(res, admin.productFormPage(user, null, flash));

  if (p === '/admin/products/save' && req.method === 'POST') {
    const { fields, files } = await parseForm(req);
    const id = int(fields.id);
    const title = String(fields.title || '').trim() || 'Без назви';
    const slug = uniqueSlug(db, 'products', slugify(fields.slug || title, 'product'), id);

    const images = toArray(fields.images).map((src) => String(src).trim()).filter(Boolean);
    for (const file of files.image_files || []) {
      const saved = await saveUpload(file);
      if (saved) images.push(saved);
    }
    const ordered = [...new Set(images)];
    const image = ordered[0] || '';
    const gallery = ordered.slice(1);

    const specs = String(fields.specs || '').split('\n').map((line) => {
      const i = line.indexOf(':');
      return i > 0 ? { k: line.slice(0, i).trim(), v: line.slice(i + 1).trim() } : null;
    }).filter(Boolean);

    const values = [
      slug, title, fields.category_id ? int(fields.category_id) : null, int(fields.price), int(fields.old_price),
      String(fields.sku || '').trim(), int(fields.stock), String(fields.short_desc || ''), String(fields.description || ''),
      JSON.stringify(specs), image, JSON.stringify(gallery),
      bool(fields.is_new), bool(fields.is_hit), bool(fields.active), int(fields.sort),
    ];

    if (id) {
      db.prepare(`UPDATE products SET slug=?, title=?, category_id=?, price=?, old_price=?, sku=?, stock=?,
        short_desc=?, description=?, specs=?, image=?, gallery=?, is_new=?, is_hit=?, active=?, sort=? WHERE id=?`)
        .run(...values, id);
      return redirect(res, `/admin/products/${id}?ok=saved`);
    }
    const info = db.prepare(`INSERT INTO products (slug, title, category_id, price, old_price, sku, stock,
      short_desc, description, specs, image, gallery, is_new, is_hit, active, sort, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...values, new Date().toISOString());
    return redirect(res, `/admin/products/${info.lastInsertRowid}?ok=created`);
  }

  let m = p.match(/^\/admin\/products\/(\d+)(\/delete)?$/);
  if (m) {
    const id = int(m[1]);
    if (m[2] && req.method === 'POST') {
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
      return redirect(res, '/admin/products?ok=deleted');
    }
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) return redirect(res, '/admin/products');
    return html(res, admin.productFormPage(user, product, flash));
  }

  if (p === '/admin/categories') return html(res, admin.categoriesPage(user, flash));

  if (p === '/admin/categories/save' && req.method === 'POST') {
    const { fields } = await parseForm(req);
    const id = int(fields.id);
    const title = String(fields.title || '').trim() || 'Категорія';
    const slug = uniqueSlug(db, 'categories', slugify(fields.slug || title, 'category'), id);
    if (id) db.prepare('UPDATE categories SET slug=?, title=?, description=?, sort=? WHERE id=?')
      .run(slug, title, String(fields.description || ''), int(fields.sort), id);
    else db.prepare('INSERT INTO categories (slug, title, description, sort) VALUES (?,?,?,?)')
      .run(slug, title, String(fields.description || ''), int(fields.sort));
    return redirect(res, '/admin/categories?ok=saved');
  }

  m = p.match(/^\/admin\/categories\/(\d+)\/delete$/);
  if (m && req.method === 'POST') {
    db.prepare('DELETE FROM categories WHERE id = ?').run(int(m[1]));
    return redirect(res, '/admin/categories?ok=deleted');
  }

  if (p === '/admin/pages') return html(res, admin.pagesPage(user, flash));

  if (p === '/admin/pages/save' && req.method === 'POST') {
    const { fields } = await parseForm(req);
    const id = int(fields.id);
    const title = String(fields.title || '').trim() || 'Сторінка';
    const slug = uniqueSlug(db, 'pages', slugify(fields.slug || title, 'page'), id);
    if (id) db.prepare('UPDATE pages SET slug=?, title=?, content=?, in_menu=?, sort=? WHERE id=?')
      .run(slug, title, String(fields.content || ''), bool(fields.in_menu), int(fields.sort), id);
    else db.prepare('INSERT INTO pages (slug, title, content, in_menu, sort) VALUES (?,?,?,?,?)')
      .run(slug, title, String(fields.content || ''), bool(fields.in_menu), int(fields.sort));
    return redirect(res, '/admin/pages?ok=saved');
  }

  m = p.match(/^\/admin\/pages\/(\d+)(\/delete)?$/);
  if (m) {
    const id = int(m[1]);
    if (m[2] && req.method === 'POST') {
      db.prepare('DELETE FROM pages WHERE id = ?').run(id);
      return redirect(res, '/admin/pages?ok=deleted');
    }
    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
    if (!page) return redirect(res, '/admin/pages');
    return html(res, admin.pageFormPage(user, page, flash));
  }

  if (p === '/admin/texts') {
    if (req.method === 'POST') {
      const { fields, files } = await parseForm(req);
      for (const key of SETTINGS_KEYS) {
        if (key in fields) setSetting(key, fields[key]);
      }
      for (const [name, list] of Object.entries(files)) {
        if (!name.startsWith('file:')) continue;
        const saved = await saveUpload(list[0]);
        if (saved) setSetting(name.slice(5), saved);
      }
      return redirect(res, '/admin/texts?ok=saved');
    }
    return html(res, admin.textsPage(user, allSettings(), flash));
  }

  if (p === '/admin/orders') return html(res, admin.ordersPage(user, url.searchParams, flash));

  m = p.match(/^\/admin\/orders\/(\d+)(\/status|\/delete)?$/);
  if (m) {
    const id = int(m[1]);
    if (m[2] === '/status' && req.method === 'POST') {
      const { fields } = await parseForm(req);
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(String(fields.status || 'new'), id);
      return redirect(res, `/admin/orders/${id}?ok=updated`);
    }
    if (m[2] === '/delete' && req.method === 'POST') {
      db.prepare('DELETE FROM orders WHERE id = ?').run(id);
      return redirect(res, '/admin/orders?ok=deleted');
    }
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) return redirect(res, '/admin/orders');
    return html(res, admin.orderPage(user, order, flash));
  }

  return html(res, admin.dashboardPage(user), 404);
}

async function createOrder(req, res) {
  const { fields } = await parseForm(req);
  const rawItems = Array.isArray(fields.items) ? fields.items : [];
  if (!rawItems.length) return sendJson(res, { error: 'Кошик порожній' }, 400);
  if (!String(fields.name || '').trim() || !String(fields.phone || '').trim())
    return sendJson(res, { error: 'Вкажіть імʼя та телефон' }, 400);

  const items = [];
  let total = 0;
  for (const raw of rawItems) {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(int(raw.id));
    if (!product) continue;
    const qty = Math.max(1, int(raw.qty, 1));
    items.push({ id: product.id, title: product.title, price: product.price, qty, image: product.image, slug: product.slug });
    total += product.price * qty;
  }
  if (!items.length) return sendJson(res, { error: 'Товари недоступні' }, 400);

  const info = db.prepare(`INSERT INTO orders (created_at, name, phone, email, city, delivery, payment, note, items, total, status)
    VALUES (?,?,?,?,?,?,?,?,?,?, 'new')`).run(
    new Date().toISOString(), String(fields.name).trim(), String(fields.phone).trim(),
    String(fields.email || ''), String(fields.city || ''), String(fields.delivery || ''),
    String(fields.payment || ''), String(fields.note || ''), JSON.stringify(items), total
  );

  for (const item of items)
    db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').run(item.qty, item.id);

  return sendJson(res, { id: Number(info.lastInsertRowid), total });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname.replace(/\/+$/, '') || '/';

  try {
    if (req.method === 'GET' && serveStatic(req, res, url.pathname)) return;

    if (p.startsWith('/admin')) return await handleAdmin(req, res, url, currentUser(req));

    if (p === '/api/order' && req.method === 'POST') return await createOrder(req, res);

    if (req.method !== 'GET') return html(res, shop.notFoundPage(), 405);

    if (p === '/') return html(res, shop.homePage());
    if (p === '/catalog') return html(res, shop.catalogPage(url.searchParams));
    if (p === '/cart') return html(res, shop.cartPage());
    if (p === '/checkout') return html(res, shop.checkoutPage());

    let m = p.match(/^\/product\/([\w-]+)$/);
    if (m) {
      const page = shop.productPage(m[1]);
      return page ? html(res, page) : html(res, shop.notFoundPage(), 404);
    }
    m = p.match(/^\/page\/([\w-]+)$/);
    if (m) {
      const page = shop.staticPage(m[1]);
      return page ? html(res, page) : html(res, shop.notFoundPage(), 404);
    }

    return html(res, shop.notFoundPage(), 404);
  } catch (error) {
    console.error(error);
    if (url.pathname.startsWith('/api/')) return sendJson(res, { error: error.message }, 500);
    html(res, `<h1>500</h1><pre>${error.message}</pre>`, 500);
  }
});

server.listen(PORT, () => {
  console.log(`\n  ${allSettings()['site.name'] || 'Магазин'} запущено`);
  console.log(`  Вітрина: http://localhost:${PORT}`);
  const who = process.env.ADMIN_USER || 'admin';
  const pass = process.env.ADMIN_PASSWORD ? 'пароль зі змінної ADMIN_PASSWORD' : 'admin123';
  console.log(`  Адмінка: http://localhost:${PORT}/admin  (${who} / ${pass})\n`);
});

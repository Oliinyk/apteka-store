(function () {
  const KEY = 'zerno.cart.v1';
  const money = (v) => new Intl.NumberFormat('uk-UA').format(Math.round(v)) + ' грн';

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const write = (items) => { localStorage.setItem(KEY, JSON.stringify(items)); paint(); };
  const total = (items) => items.reduce((sum, it) => sum + it.price * it.qty, 0);

  function paint() {
    const items = read();
    const count = items.reduce((n, it) => n + it.qty, 0);
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = count;
      el.style.display = count ? '' : 'none';
    });
    renderCart();
    renderSummary();
  }

  let toastTimer;
  function toast(text) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = text;
    requestAnimationFrame(() => el.classList.add('on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
  }

  function add(data, qty) {
    const items = read();
    const found = items.find((it) => it.id === data.id);
    if (found) found.qty += qty; else items.push({ ...data, qty });
    write(items);
    toast(data.title + ' — у кошику');
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.add-to-cart');
    if (btn) {
      const input = btn.dataset.qtyInput && document.getElementById(btn.dataset.qtyInput);
      const qty = Math.max(1, parseInt(input ? input.value : '1', 10) || 1);
      add({
        id: Number(btn.dataset.id), title: btn.dataset.title,
        price: Number(btn.dataset.price), image: btn.dataset.image, slug: btn.dataset.slug,
      }, qty);
      return;
    }
    const step = e.target.closest('[data-qty]');
    if (step) {
      const input = step.parentElement.querySelector('input');
      const next = (parseInt(input.value, 10) || 1) + Number(step.dataset.qty);
      input.value = Math.min(Math.max(1, next), Number(input.max) || 99);
      return;
    }
    const thumb = e.target.closest('.thumb');
    if (thumb) {
      document.getElementById('main-image').src = thumb.dataset.src;
      document.querySelectorAll('.thumb').forEach((t) => t.classList.toggle('thumb-on', t === thumb));
      return;
    }
    if (e.target.closest('[data-burger]')) document.querySelector('.nav').classList.toggle('open');
  });

  document.addEventListener('change', (e) => {
    const input = e.target.closest('[data-cart-qty]');
    if (!input) return;
    const items = read();
    const item = items.find((it) => it.id === Number(input.dataset.cartQty));
    if (item) item.qty = Math.max(1, parseInt(input.value, 10) || 1);
    write(items);
  });

  function shipping(sum, root) {
    const freeFrom = Number(root && root.dataset.freeFrom) || 0;
    if (!sum) return null;
    if (!freeFrom) return null;
    return sum >= freeFrom ? 'безкоштовно' : 'за тарифами перевізника';
  }

  function renderCart() {
    const root = document.getElementById('cart-root');
    if (!root) return;
    const items = read();
    if (!items.length) {
      root.innerHTML = `<p class="empty">${root.dataset.emptyText}</p><a class="btn" href="/catalog">До каталогу</a>`;
      return;
    }
    const sum = total(items);
    const ship = shipping(sum, root);
    root.innerHTML = `
      <table class="cart-table">
        <thead><tr><th>Товар</th><th>Ціна</th><th>Кількість</th><th>Сума</th><th></th></tr></thead>
        <tbody>${items.map((it) => `
          <tr>
            <td><div class="cart-item"><img src="${it.image}" alt=""><a href="/product/${it.slug}">${it.title}</a></div></td>
            <td>${money(it.price)}</td>
            <td><input type="number" min="1" value="${it.qty}" data-cart-qty="${it.id}" style="width:74px"></td>
            <td><b>${money(it.price * it.qty)}</b></td>
            <td><button class="link-danger" data-remove="${it.id}">Видалити</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="cart-foot">
        <button class="link-danger" data-clear>Очистити кошик</button>
        <div class="cart-total">
          ${ship ? `<div class="summary-row"><span>Доставка</span><span>${ship}</span></div>` : ''}
          <div class="sum">${money(sum)}</div>
          <a class="btn btn-lg" href="/checkout" style="margin-top:12px">Оформити замовлення</a>
        </div>
      </div>`;
    root.querySelectorAll('[data-remove]').forEach((b) =>
      b.addEventListener('click', () => write(read().filter((it) => it.id !== Number(b.dataset.remove)))));
    const clear = root.querySelector('[data-clear]');
    if (clear) clear.addEventListener('click', () => write([]));
  }

  function renderSummary() {
    const box = document.getElementById('checkout-summary');
    if (!box) return;
    const items = read();
    const sum = total(items);
    if (!items.length) {
      box.innerHTML = '<h3>Замовлення</h3><p class="empty">Кошик порожній.</p><a class="btn" href="/catalog">До каталогу</a>';
      const form = document.getElementById('checkout-form');
      if (form) form.querySelector('button[type=submit]').disabled = true;
      return;
    }
    const ship = shipping(sum, box);
    box.innerHTML = `<h3>Замовлення</h3>
      ${items.map((it) => `<div class="summary-row"><span>${it.title} × ${it.qty}</span><span>${money(it.price * it.qty)}</span></div>`).join('')}
      ${ship ? `<div class="summary-row"><span>Доставка</span><span>${ship}</span></div>` : ''}
      <div class="summary-row total"><span>Разом</span><span>${money(sum)}</span></div>`;
  }

  const form = document.getElementById('checkout-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const note = document.getElementById('form-note');
      const items = read();
      if (!items.length) return;
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.items = items;
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      note.className = 'form-note';
      note.textContent = 'Надсилаємо…';
      try {
        const res = await fetch('/api/order', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Помилка');
        const box = document.getElementById('checkout-summary');
        write([]);
        form.closest('.shell').innerHTML =
          `<div class="success"><h2>Замовлення №${data.id}</h2><p>${box.dataset.success}</p>
           <a class="btn" href="/catalog">Продовжити покупки</a></div>`;
      } catch (err) {
        note.className = 'form-note error';
        note.textContent = err.message;
        btn.disabled = false;
      }
    });
  }

  paint();
})();

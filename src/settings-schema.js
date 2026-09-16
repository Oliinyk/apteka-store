export const SETTINGS_SCHEMA = [
  {
    group: 'Загальне',
    hint: 'Назва магазину, контакти та верхній рядок оголошення.',
    fields: [
      { key: 'site.name', label: 'Назва магазину', type: 'text' },
      { key: 'site.tagline', label: 'Підпис під назвою', type: 'text' },
      { key: 'site.meta_title', label: 'SEO title головної', type: 'text' },
      { key: 'site.meta_description', label: 'SEO description головної', type: 'textarea' },
      { key: 'topbar.text', label: 'Текст у верхній смузі', type: 'text' },
      { key: 'site.phone', label: 'Телефон', type: 'text' },
      { key: 'site.email', label: 'E-mail', type: 'text' },
      { key: 'site.address', label: 'Адреса', type: 'text' },
      { key: 'site.telegram', label: 'Telegram', type: 'text' },
      { key: 'site.schedule', label: 'Графік роботи', type: 'text' },
      { key: 'site.disclaimer', label: 'Застереження (показується в підвалі й на картці товару; порожнє — приховано)', type: 'textarea' },
    ],
  },
  {
    group: 'Головний банер',
    hint: 'Перший екран головної сторінки.',
    fields: [
      { key: 'hero.eyebrow', label: 'Надзаголовок', type: 'text' },
      { key: 'hero.title', label: 'Заголовок', type: 'textarea' },
      { key: 'hero.subtitle', label: 'Опис', type: 'textarea' },
      { key: 'hero.cta', label: 'Текст кнопки', type: 'text' },
      { key: 'hero.cta_link', label: 'Посилання кнопки', type: 'text' },
      { key: 'hero.image', label: 'Зображення банера', type: 'image' },
      { key: 'hero.badge', label: 'Плашка на зображенні', type: 'text' },
    ],
  },
  {
    group: 'Переваги',
    hint: 'Чотири блоки під банером.',
    fields: [
      { key: 'usp.1.title', label: 'Перевага 1 — заголовок', type: 'text' },
      { key: 'usp.1.text', label: 'Перевага 1 — текст', type: 'textarea' },
      { key: 'usp.2.title', label: 'Перевага 2 — заголовок', type: 'text' },
      { key: 'usp.2.text', label: 'Перевага 2 — текст', type: 'textarea' },
      { key: 'usp.3.title', label: 'Перевага 3 — заголовок', type: 'text' },
      { key: 'usp.3.text', label: 'Перевага 3 — текст', type: 'textarea' },
      { key: 'usp.4.title', label: 'Перевага 4 — заголовок', type: 'text' },
      { key: 'usp.4.text', label: 'Перевага 4 — текст', type: 'textarea' },
    ],
  },
  {
    group: 'Блок каталогу',
    fields: [
      { key: 'catalog.title', label: 'Заголовок секції', type: 'text' },
      { key: 'catalog.subtitle', label: 'Підзаголовок секції', type: 'text' },
      { key: 'catalog.limit', label: 'Скільки товарів показати на головній', type: 'text' },
      { key: 'catalog.page_title', label: 'Заголовок сторінки каталогу', type: 'text' },
      { key: 'catalog.page_text', label: 'Текст сторінки каталогу', type: 'textarea' },
    ],
  },
  {
    group: 'Про магазин',
    fields: [
      { key: 'about.eyebrow', label: 'Надзаголовок', type: 'text' },
      { key: 'about.title', label: 'Заголовок', type: 'text' },
      { key: 'about.text', label: 'Текст (абзаци через порожній рядок)', type: 'textarea' },
      { key: 'about.stat1.value', label: 'Цифра 1', type: 'text' },
      { key: 'about.stat1.label', label: 'Підпис 1', type: 'text' },
      { key: 'about.stat2.value', label: 'Цифра 2', type: 'text' },
      { key: 'about.stat2.label', label: 'Підпис 2', type: 'text' },
      { key: 'about.stat3.value', label: 'Цифра 3', type: 'text' },
      { key: 'about.stat3.label', label: 'Підпис 3', type: 'text' },
      { key: 'about.link', label: 'Посилання «докладніше»', type: 'text' },
    ],
  },
  {
    group: 'Кошик і оформлення',
    fields: [
      { key: 'cart.title', label: 'Заголовок кошика', type: 'text' },
      { key: 'cart.empty', label: 'Текст порожнього кошика', type: 'text' },
      { key: 'checkout.title', label: 'Заголовок оформлення', type: 'text' },
      { key: 'checkout.note', label: 'Примітка біля форми', type: 'textarea' },
      { key: 'checkout.success', label: 'Повідомлення після замовлення', type: 'textarea' },
      { key: 'checkout.delivery_options', label: 'Способи доставки (по одному в рядок)', type: 'textarea' },
      { key: 'checkout.payment_options', label: 'Способи оплати (по одному в рядок)', type: 'textarea' },
      { key: 'checkout.free_from', label: 'Безкоштовна доставка від (грн, 0 — вимкнено)', type: 'text' },
    ],
  },
  {
    group: 'Підвал',
    fields: [
      { key: 'footer.about', label: 'Текст про магазин', type: 'textarea' },
      { key: 'footer.copyright', label: 'Копірайт', type: 'text' },
    ],
  },
];

export const SETTINGS_KEYS = SETTINGS_SCHEMA.flatMap((g) => g.fields.map((f) => f.key));

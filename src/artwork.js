const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function wrap(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > max && line) { lines.push(line.trim()); line = word; }
    else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

const cross = (cx, cy, size, fill) => {
  const arm = size / 3;
  return `<path d="M${cx - arm / 2} ${cy - size / 2} h${arm} v${(size - arm) / 2} h${(size - arm) / 2} v${arm}
    h-${(size - arm) / 2} v${(size - arm) / 2} h-${arm} v-${(size - arm) / 2} h-${(size - arm) / 2}
    v-${arm} h${(size - arm) / 2} z" fill="${fill}"/>`;
};

export function packArtwork({ title, kicker = '', accent = '#1f8a70', bg = '#e6f1ec', kind = 'box' }) {
  const label = wrap(title, 15)
    .map((line, i) => `<text x="400" y="${540 + i * 46}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#17302a">${esc(line)}</text>`)
    .join('');

  const shapes = {
    box: `<rect x="238" y="300" width="324" height="300" rx="18" fill="#fff" stroke="${accent}" stroke-width="8"/>
          <rect x="238" y="300" width="324" height="64" rx="18" fill="${accent}" opacity="0.16"/>
          <rect x="238" y="452" width="324" height="14" fill="${accent}" opacity="0.5"/>
          ${cross(400, 400, 74, accent)}`,
    jar: `<rect x="322" y="268" width="156" height="46" rx="12" fill="${accent}"/>
          <rect x="292" y="314" width="216" height="300" rx="26" fill="#fff" stroke="${accent}" stroke-width="8"/>
          <rect x="292" y="396" width="216" height="130" fill="${accent}" opacity="0.14"/>
          ${cross(400, 461, 62, accent)}`,
    tube: `<path d="M336 292 h128 l24 60 v250 a20 20 0 0 1 -20 20 h-136 a20 20 0 0 1 -20 -20 v-250 z" fill="#fff" stroke="${accent}" stroke-width="8"/>
           <rect x="352" y="252" width="96" height="44" rx="10" fill="${accent}"/>
           <rect x="336" y="420" width="128" height="12" fill="${accent}" opacity="0.5"/>
           ${cross(400, 372, 56, accent)}`,
    device: `<circle cx="400" cy="440" r="168" fill="${accent}" opacity="0.12"/>
             <rect x="286" y="330" width="228" height="220" rx="28" fill="#fff" stroke="${accent}" stroke-width="8"/>
             <rect x="322" y="368" width="156" height="78" rx="10" fill="${accent}" opacity="0.16"/>
             <path d="M330 486 h40 l16 -32 l22 60 l18 -40 h44" fill="none" stroke="${accent}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000" role="img" aria-label="${esc(title)}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#ffffff"/>
  </linearGradient></defs>
  <rect width="800" height="1000" fill="url(#g)"/>
  <circle cx="648" cy="170" r="122" fill="${accent}" opacity="0.10"/>
  <circle cx="150" cy="856" r="164" fill="${accent}" opacity="0.08"/>
  ${shapes[kind] || shapes.box}
  ${label}
  <text x="400" y="700" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="22" letter-spacing="5" fill="#7d8f89">${esc(kicker.toUpperCase())}</text>
</svg>`;
}

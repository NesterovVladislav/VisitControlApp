#!/usr/bin/env node
/**
 * Иконки ДоброВход: буквы «ДВ». Рисует их Chrome без интерфейса (нужен google-chrome),
 * потому что кириллицу в PNG без браузера нормально не отрисовать.
 *
 *   node scripts/brand/generate-icons.js
 *
 * Цвет и шрифт — константы ниже. После запуска — пересобрать приложение.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BRAND = '#007AFF';
const FONT = "'Noto Sans', 'DejaVu Sans', sans-serif";
const CHROME = process.env.CHROME || 'google-chrome';
const ROOT = path.resolve(__dirname, '..', '..');

/**
 * size — сторона картинки; fontSize — размер букв; background — заливка или null (прозрачный фон);
 * radius — скругление заливки в долях стороны; color — цвет букв.
 */
const icons = [
  // iOS, PWA, экран «Домой»: квадрат во весь размер, углы скругляет система. Прозрачность запрещена
  { file: 'assets/images/icon.png', size: 1024, fontSize: 420, background: BRAND, color: '#fff' },
  // Android: передний слой адаптивной иконки. Система обрезает края, буквы — в центральных 2/3
  { file: 'assets/images/android-icon-foreground.png', size: 1024, fontSize: 290, background: null, color: '#fff' },
  // Android 13+: тематическая иконка, система перекрашивает её в цвета обоев
  { file: 'assets/images/android-icon-monochrome.png', size: 1024, fontSize: 290, background: null, color: '#fff' },
  // Заставка при запуске: на белом и на чёрном фоне, поэтому со своей синей плашкой
  { file: 'assets/images/splash-icon.png', size: 1024, fontSize: 400, background: BRAND, radius: 0.22, color: '#fff' },
];

function html({ size, fontSize, background, radius = 0, color }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; width: ${size}px; height: ${size}px; background: transparent; overflow: hidden; }
    .tile {
      width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;
      background: ${background ?? 'transparent'}; border-radius: ${Math.round(size * radius)}px;
    }
    .mark {
      font-family: ${FONT}; font-weight: 700; font-size: ${fontSize}px; line-height: 1;
      letter-spacing: -0.04em; color: ${color};
      /* У «Д» хвосты вниз: визуальный центр чуть выше геометрического */
      transform: translateY(-0.04em);
    }
  </style></head><body><div class="tile"><div class="mark">ДВ</div></div></body></html>`;
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'dobrovhod-icons-'));
try {
  for (const icon of icons) {
    const page = path.join(work, 'icon.html');
    fs.writeFileSync(page, html(icon));
    const out = path.join(ROOT, icon.file);
    execFileSync(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--default-background-color=00000000',
      `--user-data-dir=${path.join(work, 'profile')}`,
      `--window-size=${icon.size},${icon.size}`,
      `--screenshot=${out}`,
      `file://${page}`,
    ], { stdio: 'ignore' });
    console.log(icon.file);
  }
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

// Уменьшенные копии: favicon и иконки PWA
const Jimp = require('jimp-compact');
(async () => {
  const icon = await Jimp.read(path.join(ROOT, 'assets/images/icon.png'));
  const copies = [
    ['assets/images/favicon.png', 48],
    ['public/icons/apple-touch-icon.png', 180],
    ['public/icons/icon-192.png', 192],
    ['public/icons/icon-512.png', 512],
  ];
  for (const [file, size] of copies) {
    await icon.clone().resize(size, size, Jimp.RESIZE_BICUBIC).writeAsync(path.join(ROOT, file));
    console.log(file);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

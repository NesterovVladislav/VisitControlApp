/**
 * Цвета приложения для светлой и тёмной темы. Экраны берут их через usePalette() и makeStyles(),
 * а не пишут hex в стилях: иначе тёмная тема перекрасит только шапку и таб-бар.
 */
export interface Palette {
  /** Фон экрана */
  background: string;
  /** Карточки, строки списков, поля ввода */
  card: string;
  /** Основной текст */
  text: string;
  /** Подписи и второстепенный текст */
  textSecondary: string;
  /** Совсем второстепенное: заголовки секций, счётчики, подсказки */
  textTertiary: string;
  /** Плейсхолдер в полях ввода */
  placeholder: string;
  /** Рамки полей и кнопок */
  border: string;
  /** Разделители между строками */
  separator: string;
  /** Заливка неактивного поля */
  fill: string;
  /** Стрелки «›» и неактивные иконки */
  iconMuted: string;
  /** Неактивная кнопка */
  disabled: string;
  /** Ссылки, кнопки, выбранное */
  primary: string;
  /** Текст на кнопке с заливкой primary или danger */
  onPrimary: string;
  /** Светлая подложка под primary: аватар в профиле */
  primarySoft: string;
  danger: string;
  /** Подложка баннера с ошибкой */
  dangerSoft: string;
  success: string;
  warning: string;
  shadow: string;
  /** Затемнение под шторкой */
  overlay: string;
  /** Экраны PIN-кода и биометрии: заголовки */
  ink: string;
  /** Экраны PIN-кода и биометрии: пояснения */
  inkSecondary: string;
  /** Экраны PIN-кода и биометрии: кнопки */
  accent: string;
  /** Клавиша PIN-клавиатуры */
  key: string;
  /** Нажатая клавиша PIN-клавиатуры */
  keyPressed: string;
  /** Заставка, которая скрывает данные при сворачивании: одинаково тёмная в обеих темах */
  shield: string;
  onShield: string;
}

export type ColorScheme = 'light' | 'dark';

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    background: '#f5f5f5',
    card: '#fff',
    text: '#333',
    textSecondary: '#666',
    textTertiary: '#888',
    placeholder: '#999',
    border: '#ddd',
    separator: '#e0e0e0',
    fill: '#f0f0f0',
    iconMuted: '#bbb',
    disabled: '#ccc',
    primary: '#007AFF',
    onPrimary: '#fff',
    primarySoft: '#E3F0FF',
    danger: '#C62828',
    dangerSoft: '#FDECEA',
    success: '#2E7D32',
    warning: '#B26A00',
    shadow: '#000',
    overlay: 'rgba(0,0,0,0.3)',
    ink: '#1D3557',
    inkSecondary: '#5D6B7A',
    accent: '#1D6FF2',
    key: '#F1F4F8',
    keyPressed: '#DCE6F2',
    shield: '#1D3557',
    onShield: '#fff',
  },
  dark: {
    background: '#000',
    card: '#1c1c1e',
    text: '#f2f2f7',
    textSecondary: '#aeaeb2',
    textTertiary: '#8e8e93',
    placeholder: '#636366',
    border: '#3a3a3c',
    separator: '#38383a',
    fill: '#2c2c2e',
    iconMuted: '#5a5a5e',
    disabled: '#3a3a3c',
    primary: '#0A84FF',
    onPrimary: '#fff',
    primarySoft: '#10304f',
    danger: '#FF6961',
    dangerSoft: '#3a1d1d',
    success: '#30D158',
    warning: '#FFB340',
    shadow: '#000',
    overlay: 'rgba(0,0,0,0.6)',
    ink: '#e6edf5',
    inkSecondary: '#9aa7b5',
    accent: '#4B8DF8',
    key: '#1c1c1e',
    keyPressed: '#2c2c2e',
    shield: '#1D3557',
    onShield: '#fff',
  },
};

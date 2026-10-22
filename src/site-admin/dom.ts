/**
 * DOM helpers for live text editing, ported from ICG. The page is React-rendered;
 * only text node values are touched, and a reload after publishing re-renders it cleanly.
 */

export const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

/** A config path, or one line of a multi-line text (rendered line by line). */
export interface TextRef {
  path: string;
  line?: number;
  /** The node shows a formatted price; the editor edits the bare amount. */
  price?: boolean;
}

const insideAdminUi = (node: Node) => Boolean(node.parentElement?.closest('[data-site-admin], script, style, noscript, title'));

/** Every text node on the page whose text equals `value` (whitespace-insensitive). */
export function findTextNodes(value: string): Text[] {
  const target = normalize(value);
  if (!target) return [];
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (normalize(node.nodeValue ?? '') === target && !insideAdminUi(node)) nodes.push(node as Text);
  }
  return nodes;
}

/** Replaces a node's text but keeps the whitespace JSX left around it. */
function setNodeText(node: Text, original: string, value: string) {
  const lead = /^\s*/.exec(original)?.[0] ?? '';
  const trail = /\s*$/.exec(original)?.[0] ?? '';
  node.nodeValue = `${lead}${value}${trail}`;
}

export type CapturedText = { node: Text; original: string }[];

/** Remembers the nodes showing `value` and their exact text, for preview and cancel. */
export const captureText = (value: string): CapturedText => findTextNodes(value).map((node) => ({ node, original: node.nodeValue ?? '' }));

export function previewText(captured: CapturedText, value: string) {
  for (const { node, original } of captured) setNodeText(node, original, value);
}

export function restoreText(captured: CapturedText) {
  for (const { node, original } of captured) node.nodeValue = original;
}

/** Swaps every on-page occurrence of `from` for `to`. */
export function replaceOnPage(from: string, to: string) {
  for (const node of findTextNodes(from)) setNodeText(node, node.nodeValue ?? '', to);
}

type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

/** The text node actually under the pointer (not merely the nearest caret position). */
export function textNodeAt(x: number, y: number): Text | null {
  const doc = document as CaretDocument;
  const node = doc.caretPositionFromPoint ? doc.caretPositionFromPoint(x, y)?.offsetNode : doc.caretRangeFromPoint?.(x, y)?.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE || insideAdminUi(node)) return null;
  const range = document.createRange();
  range.selectNodeContents(node);
  for (const rect of range.getClientRects()) {
    if (x >= rect.left - 2 && x <= rect.right + 2 && y >= rect.top - 2 && y <= rect.bottom + 2) return node as Text;
  }
  return null;
}

export function textRect(node: Text) {
  const range = document.createRange();
  range.selectNodeContents(node);
  return range.getBoundingClientRect();
}

export const SECTION_LABELS: Record<string, string> = {
  meta: 'Название и описание',
  hero: 'Первый экран',
  practitioner: 'Обо мне',
  topics: 'С чем прийти',
  gallery: 'Кадр из подкаста',
  services: 'Цены',
  process: 'Первые шаги',
  faq: 'Вопросы',
  booking: 'Запись',
  footer: 'Подвал',
  reflection: 'Минута для себя',
  principles: 'Принципы работы',
  method: 'Метод «Преображение»',
  reviews: 'Отзывы',
  location: 'Где проходят встречи',
  project: 'Проект «Протри Внутри»',
};

export const sectionLabel = (path: string) => SECTION_LABELS[path.split('.')[0]] ?? path.split('.')[0];

/** Human names for paths, shown in the editor instead of "services.items.1.summary". */
export function pathLabel(path: string) {
  const parts = path.split('.');
  const last = parts[parts.length - 1];
  const names: Record<string, string> = {
    brand: 'название практики',
    description: 'описание для поиска',
    accent: 'выделенная строка',
    imageAlt: 'описание изображения',
    detail: 'подробное описание',
    label: 'подпись',
    quote: 'цитата',
    caption: 'подпись к фото',
    category: 'рубрика',
    time: 'время чтения',
    minutes: 'длительность для календаря (минуты)',
    intro: 'вступление',
    handNote: 'строка над заголовком',
    headline: 'заголовок',
    lead: 'подзаголовок',
    note: 'примечание',
    primaryAction: 'кнопка',
    secondaryAction: 'вторая ссылка',
    name: 'имя',
    role: 'кто вы',
    aboutTitle: 'заголовок раздела',
    expectationsTitle: 'заголовок списка',
    title: 'заголовок',
    summary: 'описание',
    duration: 'длительность',
    format: 'формат',
    amount: 'цена',
    question: 'вопрос',
    answer: 'ответ',
    privacyNote: 'о личных данных',
    text: 'текст',
    meaning: 'значение',
    reading: 'толкование',
    reflection: 'вопрос для размышления',
    word: 'слово',
    alt: 'описание фото',
    badge: 'плашка',
    disclaimer: 'пояснение',
    prompt: 'подсказка',
    greeting: 'приветствие',
    closingNote: 'итоговая карточка',
    numeral: 'номер',
    context: 'подпись',
    disclaimerText: 'пояснение',
    accents: 'сменяющаяся строка',
    ring: 'текст по кругу',
    tagline: 'подпись под именем',
    short: 'коротко',
    entry: 'как начать',
    highlight: 'подсвеченная фраза',
    date: 'дата',
    award: 'награда',
    total: 'ссылка на все отзывы',
    source: 'источник',
    metro: 'станция',
    line: 'линии метро',
    online: 'про онлайн',
    motto: 'девиз',
    hint: 'подсказка',
    kind: 'вид',
    url: 'ссылка',
    author: 'автор',
    credentials: 'регалии',
    style: 'стиль работы',
    group: 'группа',
    meta: 'место и набор',
    small: 'мелкая подпись',
  };
  const label = names[last] ?? (/^\d+$/.test(last) ? `пункт ${Number(last) + 1}` : last);
  if (parts[0] === 'cards') return `карта «${parts[1]}» · ${label}`;
  const index = parts.findIndex((p) => /^\d+$/.test(p));
  if (index > 0 && index < parts.length - 1) {
    const list = parts[index - 1];
    const noun = list === 'readings' ? 'расклад' : parts[0] === 'services' ? 'тариф' : parts[0] === 'faq' ? 'вопрос' : parts[0] === 'process' ? 'шаг' : parts[0] === 'reviews' ? 'отзыв' : list === 'stages' ? 'этап' : list === 'videos' ? 'выпуск' : list === 'places' ? 'место' : parts[0] === 'principles' ? 'принцип' : 'пункт';
    return `${noun} ${Number(parts[index]) + 1} · ${label}`;
  }
  if (parts[1] === 'intro') return `абзац ${Number(last) + 1}`;
  return label;
}

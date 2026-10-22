import { useState } from 'react';
import { site } from '../../config/site.ts';
import { useAdmin } from '../store.tsx';

const SECTIONS = { topics: 'Запросы', about: 'Обо мне', principles: 'Принципы работы', method: 'Метод «Преображение»', process: 'Первые шаги', services: 'Форматы и цены', gallery: 'Кадр из подкаста', reviews: 'Отзывы', reflection: 'Минута для себя', location: 'Где проходят встречи', faq: 'Вопросы', project: 'Проект «Протри Внутри»' };
const COLORS = { background: 'Фон', surface: 'Поверхности', amethyst: 'Малахит', rose: 'Оранжевый акцент', gold: 'Золото: кнопки и акценты', ivory: 'Основной текст' };
const FIELDS = [ ['meta.brand', 'Название практики', site.meta.brand], ['practitioner.name', 'Имя специалиста', site.practitioner.name], ['practitioner.role', 'Специализация', site.practitioner.role], ['meta.title', 'Название вкладки', site.meta.title], ['meta.description', 'Описание для поиска', site.meta.description] ];

export function TemplateSettings() {
  const { overrides, saveOverrides, toast } = useAdmin();
  const [texts, setTexts] = useState<Record<string,string>>({});
  const [sections, setSections] = useState<Record<string,boolean>>({});
  const [theme, setTheme] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false);
  const changed = Object.keys(texts).length + Object.keys(sections).length + Object.keys(theme).length > 0;
  const save = async () => {
    setBusy(true);
    try {
      const ok = await saveOverrides({ ...overrides, texts: { ...overrides.texts, ...texts }, design: { sections: { ...overrides.design.sections, ...sections }, theme: { ...overrides.design.theme, ...theme } } });
      if (ok) { setTexts({}); setSections({}); setTheme({}); toast('Шаблон сохранён. Изменения видны после обновления сайта.'); }
    } finally { setBusy(false); }
  };
  return <section className="a-panel">
    <h3 className="a-block__title">Профиль и оформление сайта</h3>
    <p className="a-meta">Настройте практику под себя. Все тексты, цены и фотографии доступны в редакторе прямо на сайте.</p>
    <div className="a-grid3">{FIELDS.map(([path, label, fallback]) => <label className="a-field" key={path}><span>{label}</span><input className="a-input" value={texts[path] ?? String(overrides.texts[path] ?? fallback)} onChange={e => setTexts({ ...texts, [path]: e.target.value })} maxLength={path === 'meta.description' ? 300 : 120} /></label>)}</div>
    <h4 className="a-template-subtitle">Разделы страницы</h4>
    <div className="a-template-sections">{Object.entries(SECTIONS).map(([key, label]) => <label className="a-switch" key={key}><input type="checkbox" checked={sections[key] ?? overrides.design.sections[key] ?? site.sections[key as keyof typeof site.sections]} onChange={e => setSections({ ...sections, [key]: e.target.checked })} /><span className="a-switch__track" aria-hidden="true" />{label}</label>)}</div>
    <h4 className="a-template-subtitle">Цветовая палитра</h4>
    <div className="a-template-colors">{Object.entries(COLORS).map(([key, label]) => <label key={key}><input aria-label={label} type="color" value={theme[key] ?? overrides.design.theme[key] ?? site.theme[key as keyof typeof site.theme]} onChange={e => setTheme({ ...theme, [key]: e.target.value })} /><span>{label}</span></label>)}</div>
    <div className="a-row"><button className="a-btn a-btn--primary a-btn--sm" disabled={!changed || busy} onClick={save}>{busy ? 'Сохраняю…' : 'Сохранить шаблон'}</button><a className="a-btn a-btn--ghost a-btn--sm" href="/?edit">Открыть редактор сайта ↗</a></div>
  </section>;
}

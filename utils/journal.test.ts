import { VisitEntry } from '@/store/types/visits';
import { confirmationLabel, intervalLabels, journalSections, representativesLabel } from './journal';

// Время задаём в местной зоне: журнал показывает местные часы
const at = (day: number, hours: number, minutes = 0) =>
  new Date(2026, 8, day, hours, minutes).toISOString();

const sun = { id: 'g-sun', name: 'Солнышко', branchName: 'Центральный' };
const romashka = { id: 'g-rom', name: 'Ромашка', branchName: 'Центральный' };

function entry(childId: string, childName: string, status: 'IN' | 'OUT', datetime: string, group: VisitEntry['group'], rep = 'Иванова А.'): VisitEntry {
  return { key: `${childId}|${datetime}|${status}`, childId, childName, representativeName: rep, status, datetime, group };
}

const now = new Date(2026, 8, 29, 18, 0);

// Лента, как с сервера: новые сверху
const items: VisitEntry[] = [
  entry('maria', 'Мария Иванова', 'OUT', at(29, 17, 30), romashka, 'Иванов С.'),
  entry('oleg', 'Олег Кузнецов', 'IN', at(29, 9, 10), sun, 'Кузнецова Е.'),
  entry('petr', 'Пётр Смирнов', 'IN', at(29, 8, 55), romashka, 'Смирнова О.'),
  entry('vera', 'Вера Орлова', 'IN', at(29, 8, 50), null),
  entry('maria', 'Мария Иванова', 'IN', at(29, 8, 40), romashka),
  entry('anna', 'Анна Петрова', 'IN', at(28, 9, 0), sun),
];

describe('journal by groups', () => {
  it('splits every day into groups by name with «Без группы» last, one row per child', () => {
    const sections = journalSections(items, false, now);
    expect(sections.map((section) => [section.dayTitle, section.title, section.data.map((row) => row.childName)])).toEqual([
      ['Сегодня', 'Ромашка · 2 ребёнка', ['Мария Иванова', 'Пётр Смирнов']],
      [null, 'Солнышко · 1 ребёнок', ['Олег Кузнецов']],
      [null, 'Без группы · 1 ребёнок', ['Вера Орлова']],
      ['Вчера, 28 сентября', 'Солнышко · 1 ребёнок', ['Анна Петрова']],
    ]);
  });

  it('shows when a child came and left and who brought and picked them up', () => {
    const [romashkaToday] = journalSections(items, false, now);
    const [maria, petr] = romashkaToday.data;
    expect(intervalLabels(maria)).toEqual(['08:40 → 17:30']);
    expect(representativesLabel(maria)).toBe('Приход — Иванова А. · Уход — Иванов С.');
    expect(maria.inNow).toBe(false);
    expect(intervalLabels(petr)).toEqual(['08:55 → ещё в саду']);
    expect(petr.inNow).toBe(true);
  });

  it('marks a missing exit on a past day and a missing arrival cut off by paging', () => {
    const sections = journalSections(
      [...items, entry('ivan', 'Иван Сидоров', 'OUT', at(27, 17, 0), sun)],
      false,
      now
    );
    const anna = sections.find((section) => section.dayTitle === 'Вчера, 28 сентября')!.data[0];
    expect(intervalLabels(anna)).toEqual(['09:00 → уход не отмечен']);
    expect(anna.inNow).toBe(false);
    const ivan = sections[sections.length - 1].data[0];
    expect(intervalLabels(ivan)).toEqual(['? → 17:00']);
    expect(representativesLabel(ivan)).toBe('Уход — Иванова А.');
  });

  it('shows several stays of one day on separate lines, each with its own adults', () => {
    const twice = [
      entry('maria', 'Мария Иванова', 'IN', at(29, 14, 0), romashka, 'Иванова Н.'),
      entry('maria', 'Мария Иванова', 'OUT', at(29, 12, 0), romashka, 'Иванов С.'),
      entry('maria', 'Мария Иванова', 'IN', at(29, 8, 40), romashka),
    ];
    const [section] = journalSections(twice, true, now);
    // Филиал в заголовке — когда филиалов несколько
    expect(section.title).toBe('Ромашка · Центральный · 1 ребёнок');
    const [maria] = section.data;
    expect(intervalLabels(maria)).toEqual(['08:40 → 12:00', '14:00 → ещё в саду']);
    expect(maria.intervals.map(representativesLabel)).toEqual([
      'Приход — Иванова А. · Уход — Иванов С.',
      'Приход — Иванова Н.',
    ]);
  });

  it('does not count marks the kindergarten rejected or the parent cancelled', () => {
    const rejected: VisitEntry = { ...entry('maria', 'Мария Иванова', 'IN', at(29, 8, 0), sun), confirmation: 'REJECTED' };
    const cancelled: VisitEntry = { ...entry('maria', 'Мария Иванова', 'OUT', at(29, 12, 0), sun), confirmation: 'CANCELLED' };
    const accepted: VisitEntry = {
      ...entry('maria', 'Мария Иванова', 'IN', at(29, 8, 10), sun),
      confirmation: 'CONFIRMED',
      decidedBy: 'Петрова О.',
      comment: 'Привела бабушка',
    };

    const [section] = journalSections([cancelled, accepted, rejected], false, now);

    expect(section.data).toHaveLength(1);
    expect(intervalLabels(section.data[0])).toEqual(['08:10 → ещё в саду']);
    expect(confirmationLabel(section.data[0])).toBe('Принял(а) — Петрова О.');
    expect(section.data[0].comments).toEqual(['Привела бабушка']);
  });

  it('marks a visit the kindergarten never confirmed', () => {
    const arrival: VisitEntry = { ...entry('maria', 'Мария Иванова', 'IN', at(28, 8, 10), sun), confirmation: 'PENDING' };
    const departure: VisitEntry = {
      ...entry('maria', 'Мария Иванова', 'OUT', at(28, 17, 30), sun),
      confirmation: 'CONFIRMED',
      decidedBy: 'Петрова О.',
    };

    const [section] = journalSections([departure, arrival], false, now);

    expect(confirmationLabel(section.data[0])).toBe('Отдал(а) — Петрова О. · не подтверждён');
    // Отметки без подтверждения (сад его не включал) подписи не дают
    expect(confirmationLabel(journalSections(items, false, now)[0].data[0])).toBeNull();
  });
});

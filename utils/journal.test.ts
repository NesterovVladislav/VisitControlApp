import { VisitEntry } from '@/store/types/visits';
import { intervalsLabel, journalSections, representativesLabel } from './journal';

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
    expect(intervalsLabel(maria)).toBe('08:40 → 17:30');
    expect(representativesLabel(maria)).toBe('Приход — Иванова А. · Уход — Иванов С.');
    expect(maria.inNow).toBe(false);
    expect(intervalsLabel(petr)).toBe('08:55 → ещё в саду');
    expect(petr.inNow).toBe(true);
  });

  it('marks a missing exit on a past day and a missing arrival cut off by paging', () => {
    const sections = journalSections(
      [...items, entry('ivan', 'Иван Сидоров', 'OUT', at(27, 17, 0), sun)],
      false,
      now
    );
    const anna = sections.find((section) => section.dayTitle === 'Вчера, 28 сентября')!.data[0];
    expect(intervalsLabel(anna)).toBe('09:00 → уход не отмечен');
    expect(anna.inNow).toBe(false);
    const ivan = sections[sections.length - 1].data[0];
    expect(intervalsLabel(ivan)).toBe('? → 17:00');
    expect(representativesLabel(ivan)).toBe('Уход — Иванова А.');
  });

  it('lists several stays of one day and adds the branch when there are several branches', () => {
    const twice = [
      entry('maria', 'Мария Иванова', 'IN', at(29, 14, 0), romashka),
      entry('maria', 'Мария Иванова', 'OUT', at(29, 12, 0), romashka),
      entry('maria', 'Мария Иванова', 'IN', at(29, 8, 40), romashka),
    ];
    const [section] = journalSections(twice, true, now);
    expect(section.title).toBe('Ромашка · Центральный · 1 ребёнок');
    expect(intervalsLabel(section.data[0])).toBe('08:40 → 12:00, 14:00 → ещё в саду');
  });
});

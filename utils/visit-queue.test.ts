import { VisitQueueItem } from '@/store/types/visits';
import { filterLabel, queueSections, queueWhoLabel } from './visit-queue';

const at = (hours: number, minutes: number) => new Date(2026, 9, 12, hours, minutes).toISOString();

function item(id: string, status: 'IN' | 'OUT', datetime: string, group: VisitQueueItem['group']): VisitQueueItem {
  return {
    id,
    status,
    childName: `Ребёнок ${id}`,
    representativeId: 'mother',
    representativeName: 'Иванова А.',
    linkRole: 'PARENT',
    datetime,
    comment: null,
    group,
  };
}

const sun = { id: 'g-sun', name: 'Солнышко' };
const romashka = { id: 'g-rom', name: 'Ромашка' };

describe('visit queue', () => {
  it('groups marks by group name, puts children without a group last and sorts by time', () => {
    const sections = queueSections([
      item('late', 'IN', at(8, 50), sun),
      item('none', 'OUT', at(8, 30), null),
      item('early', 'IN', at(8, 40), sun),
      item('rom', 'IN', at(8, 45), romashka),
    ]);

    expect(sections.map((section) => section.title)).toEqual(['Ромашка', 'Солнышко', 'Без группы']);
    expect(sections[1].data.map((mark) => mark.id)).toEqual(['early', 'late']);
  });

  it('says who brings or picks up the child and who they are to the child', () => {
    expect(queueWhoLabel({ status: 'IN', representativeName: 'Иванова А.', linkRole: 'PARENT' }))
      .toBe('Привёл(а) — Иванова А. (родитель)');
    expect(queueWhoLabel({ status: 'OUT', representativeName: 'Сидоров И.', linkRole: null }))
      .toBe('Забирает — Сидоров И.');
  });

  it('names the chosen groups', () => {
    const groups = [sun, romashka];

    expect(filterLabel(null, groups)).toBe('Все группы');
    expect(filterLabel({ groupIds: [], withoutGroup: false }, groups)).toBe('Все группы');
    expect(filterLabel({ groupIds: ['g-rom'], withoutGroup: true }, groups)).toBe('Ромашка, без группы');
    expect(filterLabel({ groupIds: ['deleted'], withoutGroup: false }, groups)).toBe('Выбранные группы');
  });
});

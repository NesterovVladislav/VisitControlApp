import { Presence } from '@/store/types/visits';
import {
  branchSubtitle,
  gardenBranches,
  gardenErrorMessage,
  groupSubtitle,
  isNameTaken,
  notEmptyMessage,
  takenNames,
} from './garden';
import { OTHER_GROUPS_ID } from './presence';

const child = (id: string) => ({ id, firstName: id, surname: 'Иванов' });

const presence: Presence = {
  total: 2,
  branches: [
    { id: 'b-center', name: 'Центральный' },
    { id: 'b-new', name: 'Новый корпус' },
  ],
  groups: [
    { id: 'g-rom', name: 'Ромашка', branchId: 'b-center', totalChildren: 18, present: [child('a')] },
    { id: 'g-new', name: 'Новая', branchId: 'b-center', totalChildren: 0, present: [] },
    { id: 'g-old', name: 'Старая', branchId: 'b-closed', totalChildren: 3, present: [] },
  ],
  withoutGroup: [child('b')],
};

describe('garden', () => {
  it('lists branches with their groups and keeps groups of a closed branch, without the present-only row', () => {
    expect(gardenBranches(presence).map((item) => [item.id, branchSubtitle(item)])).toEqual([
      ['b-center', '2 группы · 18 детей'],
      ['b-new', 'Групп пока нет'],
      [OTHER_GROUPS_ID, '1 группа · 3 ребёнка'],
    ]);
  });

  it('describes a group by its children', () => {
    expect(groupSubtitle(presence.groups![0])).toBe('18 детей · в саду 1');
    expect(groupSubtitle(presence.groups![1])).toBe('Детей пока нет');
  });

  it('checks names like the server: trimmed, any case, only within the branch and not against itself', () => {
    const groupNames = takenNames(presence, 'group', 'b-center', 'g-new');
    expect(groupNames).toEqual(['Ромашка']);
    expect(isNameTaken(' РОМАШКА ', groupNames)).toBe(true);
    expect(isNameTaken('Новая', groupNames)).toBe(false);
    expect(isNameTaken('Ромашка', takenNames(presence, 'group', 'b-new', null))).toBe(false);
    expect(isNameTaken('центральный', takenNames(presence, 'branch', null, null))).toBe(true);
  });

  it('explains why a branch or group cannot be deleted', () => {
    expect(notEmptyMessage('branch', 'Центральный', 4)).toBe(
      'В филиале «Центральный» 4 группы. Сначала удалите их или перенесите в другой филиал'
    );
    expect(notEmptyMessage('group', 'Ромашка', 18)).toBe(
      'В группе «Ромашка» 18 детей. Сначала переведите их в другие группы или уберите из группы'
    );
    expect(gardenErrorMessage({ kind: 'notEmpty', count: null }, 'group', 'Ромашка')).toBe(
      'В группе «Ромашка» есть дети. Сначала переведите их в другие группы или уберите из группы'
    );
    expect(gardenErrorMessage({ kind: 'gone' }, 'group', 'Ромашка')).toBe('Группа уже удалена');
  });
});

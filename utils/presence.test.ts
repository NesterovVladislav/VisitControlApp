import { Presence } from '@/store/types/visits';
import {
  OTHER_GROUPS_ID,
  WITHOUT_GROUP_ID,
  branchName,
  branchSections,
  branchSummaries,
  findGroup,
  singleBranchId,
  pendingSuffix,
} from './presence';

const child = (id: string) => ({ id, firstName: id, surname: 'Иванов' });

const presence: Presence = {
  total: 4,
  branches: [
    { id: 'b-center', name: 'Центральный' },
    { id: 'b-north', name: 'Северный' },
  ],
  groups: [
    { id: 'g-romashka', name: 'Ромашка', branchId: 'b-center', totalChildren: 18, present: [child('a'), child('b')] },
    { id: 'g-sun', name: 'Солнышко', branchId: 'b-center', totalChildren: 15, present: [] },
    { id: 'g-empty', name: 'Новая', branchId: 'b-center', totalChildren: 0, present: [] },
    { id: 'g-bee', name: 'Пчёлка', branchId: 'b-north', totalChildren: 10, present: [child('c')] },
  ],
  withoutGroup: [child('d')],
};

describe('presence by branch', () => {
  it('counts children of each branch and adds children without a group', () => {
    expect(branchSummaries(presence)).toEqual([
      { id: 'b-center', name: 'Центральный', present: 2, total: 33, groupCount: 3 },
      { id: 'b-north', name: 'Северный', present: 1, total: 10, groupCount: 1 },
      { id: WITHOUT_GROUP_ID, name: 'Без группы', present: 1, total: null, groupCount: 0 },
    ]);
  });

  it('shows every group of the branch, including groups where nobody is present and empty groups', () => {
    expect(branchSections(presence, 'b-center')).toEqual([
      {
        key: 'g-romashka',
        title: 'Ромашка · 2 из 18',
        group: { id: 'g-romashka', name: 'Ромашка' },
        emptyText: null,
        data: [child('a'), child('b')],
      },
      {
        key: 'g-sun',
        title: 'Солнышко · 0 из 15',
        group: { id: 'g-sun', name: 'Солнышко' },
        emptyText: 'Сейчас никого нет',
        data: [],
      },
      { key: 'g-empty', title: 'Новая', group: { id: 'g-empty', name: 'Новая' }, emptyText: 'Детей пока нет', data: [] },
    ]);
  });

  it('lists children without a group as one untitled section', () => {
    expect(branchSections(presence, WITHOUT_GROUP_ID)).toEqual([
      { key: WITHOUT_GROUP_ID, title: '', group: null, emptyText: null, data: [child('d')] },
    ]);
  });

  it('finds a group with its branch name for the group members screen', () => {
    expect(findGroup(presence, 'g-empty')).toEqual({
      id: 'g-empty',
      name: 'Новая',
      branchId: 'b-center',
      branchName: 'Центральный',
    });
    expect(findGroup(presence, 'g-gone')).toBeNull();
  });

  it('keeps groups of an unknown branch under «Другие группы»', () => {
    const withClosed: Presence = {
      ...presence,
      groups: [...presence.groups!, { id: 'g-old', name: 'Старая', branchId: 'b-closed', totalChildren: 3, present: [child('e')] }],
    };
    expect(branchSummaries(withClosed)).toContainEqual(
      { id: OTHER_GROUPS_ID, name: 'Другие группы', present: 1, total: 3, groupCount: 1 },
    );
    expect(branchSections(withClosed, OTHER_GROUPS_ID).map((section) => section.key)).toEqual(['g-old']);
  });

  it('skips the branch choice when there is one branch and every child has a group', () => {
    expect(singleBranchId(presence)).toBeNull();
    const single: Presence = {
      ...presence,
      branches: [presence.branches[0]],
      groups: presence.groups!.filter((group) => group.branchId === 'b-center'),
      withoutGroup: [],
    };
    expect(singleBranchId(single)).toBe('b-center');
  });

  it('names a branch by id and reports a vanished one', () => {
    expect(branchName(presence, 'b-north')).toBe('Северный');
    expect(branchName(presence, 'b-gone')).toBeNull();
  });

  it('adds marks waiting for the kindergarten to the group title', () => {
    expect(pendingSuffix({ pendingIn: 2, pendingOut: 1 })).toBe(' · ждут приёма: 2 · ждут выдачи: 1');
    expect(pendingSuffix({ pendingIn: 0, pendingOut: 3 })).toBe(' · ждут выдачи: 3');
    // Бэкенд без подтверждения посещений этих полей не отдаёт
    expect(pendingSuffix({})).toBe('');
  });
});

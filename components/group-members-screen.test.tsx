import { fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

import GroupMembersScreen from './group-members-screen';
import { useAppDispatch, useAppSelector } from '../store';
import { putChildInGroup, removeChildFromGroup } from '../store/reducers/group-membership';
import { Person } from '../store/types/people';

const mockDispatch = jest.fn();

jest.mock('../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('../components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ groupId: 'g-sun' }),
  Stack: { Screen: () => null },
}));

const sun = { id: 'g-sun', name: 'Солнышко', branchId: 'b-1', branchName: 'Центральный' };
const romashka = { id: 'g-rom', name: 'Ромашка', branchId: 'b-1', branchName: 'Центральный' };
const person = (id: string, firstName: string, group: typeof sun | null) =>
  ({ id, firstName, surname: 'Иванова', group, birthDate: null }) as Person;

const maria = person('c1', 'Мария', sun);
const anna = person('c2', 'Анна', romashka);
const olga = person('c3', 'Ольга', null);

function givenScreen(role = 'ADMIN') {
  (useAppDispatch as jest.Mock).mockReturnValue(mockDispatch);
  (useAppSelector as jest.Mock).mockImplementation((selector) =>
    selector({
      auth: { user: { role } },
      visits: {
        present: {
          data: {
            total: 0,
            branches: [{ id: 'b-1', name: 'Центральный' }],
            groups: [
              { id: 'g-sun', name: 'Солнышко', branchId: 'b-1', totalChildren: 1, present: [] },
              { id: 'g-rom', name: 'Ромашка', branchId: 'b-1', totalChildren: 1, present: [] },
            ],
            withoutGroup: [],
          },
        },
      },
      groupMembership: {
        group: sun,
        filter: 'all',
        q: '',
        items: [maria, anna, olga],
        status: 'loaded',
        last: true,
        loadingMore: false,
        loadMoreFailed: false,
        saving: {},
        failed: {},
      },
    }),
  );
}

describe('group members', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('opens a group with children on «В группе»', async () => {
    givenScreen();
    await render(<GroupMembersScreen />);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { group: sun, filter: 'inGroup', q: '' } }),
    );
  });

  it('removes a child only after the confirmation', async () => {
    givenScreen();
    const screen = await render(<GroupMembersScreen />);
    mockDispatch.mockClear();

    // Касание самой строки ребёнка группы ничего не делает
    await fireEvent.press(screen.getByText('Иванова Мария'));
    expect(Alert.alert).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('Убрать из группы: Иванова Мария'));
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);

    const [title, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe('Убрать из группы «Солнышко»?');
    const cancel = buttons.find((button: { text: string }) => button.text === 'Отмена');
    const confirm = buttons.find((button: { text: string }) => button.text === 'Убрать');
    expect(confirm.style).toBe('destructive');

    cancel.onPress?.();
    expect(mockDispatch).not.toHaveBeenCalled();

    confirm.onPress();
    expect(mockDispatch).toHaveBeenCalledWith(removeChildFromGroup(maria));
  });

  it('adds a child without a group right away and asks before moving one from another group', async () => {
    givenScreen();
    const screen = await render(<GroupMembersScreen />);
    mockDispatch.mockClear();

    await fireEvent.press(screen.getByLabelText('Добавить: Иванова Ольга'));
    expect(mockDispatch).toHaveBeenCalledWith(putChildInGroup(olga));

    mockDispatch.mockClear();
    await fireEvent.press(screen.getByLabelText('Добавить: Иванова Анна'));
    expect(mockDispatch).not.toHaveBeenCalled();
    expect((Alert.alert as jest.Mock).mock.calls[0][0]).toBe('Перевести в «Солнышко»?');
  });

  it('is closed to an employee', async () => {
    givenScreen('EMPLOYEE');
    const screen = await render(<GroupMembersScreen />);
    expect(screen.getByText('Менять состав группы может администратор')).toBeTruthy();
    expect(screen.queryByText('Убрать')).toBeNull();
  });
});

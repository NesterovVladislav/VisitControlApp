import { fireEvent, render } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';

import GardenScreen from '../app/(admin)/garden';
import GardenGroupScreen from '../app/(admin)/garden/group/[id]';
import GardenNameScreen from '../app/(admin)/garden/name';
import { useAppDispatch, useAppSelector } from '../store';
import { startGardenEdit } from '../store/reducers/garden';
import { Presence } from '../store/types/visits';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('../store', () => ({ useAppDispatch: jest.fn(), useAppSelector: jest.fn() }));
jest.mock('../components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockParams,
  // Кнопки шапки («⋯», «Сохранить») рисуем прямо в экране, чтобы их нажимать
  Stack: {
    Screen: ({ options }: { options?: { headerRight?: () => React.ReactNode } }) => options?.headerRight?.() ?? null,
  },
}));

const dispatch = jest.fn();
const kid = (id: string) => ({ id, firstName: id, surname: 'Иванова' });

const presence: Presence = {
  total: 1,
  branches: [
    { id: 'b-center', name: 'Центральный' },
    { id: 'b-forest', name: 'На Лесной' },
  ],
  groups: [
    { id: 'g-rom', name: 'Ромашка', branchId: 'b-center', totalChildren: 18, present: [kid('a')] },
    { id: 'g-new', name: 'Новая', branchId: 'b-center', totalChildren: 0, present: [] },
  ],
  withoutGroup: [],
};

function givenState(withoutGroupCount: number | null = 3) {
  (useAppDispatch as jest.Mock).mockReturnValue(dispatch);
  (useAppSelector as jest.Mock).mockImplementation((selector) =>
    selector({
      auth: { user: { role: 'ADMIN' } },
      visits: { present: { data: presence, status: 'loaded', refreshing: false } },
      garden: { withoutGroupCount, edit: { status: 'idle', action: null, error: null, createdId: null } },
      groupPeople: {
        query: { kind: 'group', groupId: mockParams.id, category: 'CHILD' },
        items: [],
        total: 0,
        status: 'loaded',
        refreshing: false,
        last: true,
        loadingMore: false,
        loadMoreFailed: false,
        saving: {},
        failed: {},
      },
    })
  );
}

async function openMenuItem(screen: Awaited<ReturnType<typeof render>>, label: string) {
  await fireEvent.press(screen.getByLabelText('Меню группы'));
  await fireEvent.press(screen.getByText(label));
}

describe('garden', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    // На iOS пункт шторки срабатывает после закрытия Modal (onDismiss), в тестовом рендере его нет
    jest.replaceProperty(Platform, 'OS', 'android');
    mockParams = {};
  });

  it('lists branches with groups and children and shows children without a group', async () => {
    givenState();
    const screen = await render(<GardenScreen />);

    expect(screen.getByText('2 группы · 18 детей')).toBeTruthy();
    expect(screen.getByText('Групп пока нет')).toBeTruthy();
    expect(screen.getByLabelText('Дети без группы: 3 ребёнка')).toBeTruthy();

    await fireEvent.press(screen.getByText('На Лесной'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/garden/branch/[id]', params: { id: 'b-forest' } });
  });

  it('does not delete a group with children and offers to change its children instead', async () => {
    mockParams = { id: 'g-rom' };
    givenState();
    const screen = await render(<GardenGroupScreen />);

    await openMenuItem(screen, 'Удалить группу');

    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: startGardenEdit.type }));
    const [title, message, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe('Нельзя удалить группу');
    expect(message).toBe('В группе «Ромашка» 18 детей. Сначала переведите их в другие группы или уберите из группы');
    buttons.find((button: { text: string }) => button.text === 'Изменить состав').onPress();
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/garden/group-members', params: { groupId: 'g-rom' } });
  });

  it('deletes an empty group only after the confirmation', async () => {
    mockParams = { id: 'g-new' };
    givenState();
    const screen = await render(<GardenGroupScreen />);

    await openMenuItem(screen, 'Удалить группу');
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: startGardenEdit.type }));

    const [title, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe('Удалить группу «Новая»?');
    buttons.find((button: { text: string }) => button.text === 'Удалить').onPress();
    expect(dispatch).toHaveBeenCalledWith(startGardenEdit({ type: 'deleteGroup', id: 'g-new' }));
  });

  it('moves a group to another branch keeping its name', async () => {
    mockParams = { id: 'g-rom' };
    givenState();
    const screen = await render(<GardenGroupScreen />);

    await openMenuItem(screen, 'Перенести в другой филиал');
    await fireEvent.press(screen.getByText('На Лесной'));

    expect(dispatch).toHaveBeenCalledWith(
      startGardenEdit({ type: 'saveGroup', id: 'g-rom', name: 'Ромашка', branchId: 'b-forest' })
    );
  });

  it('does not let a new group repeat a name in the same branch', async () => {
    mockParams = { kind: 'group', branchId: 'b-center' };
    givenState();
    const screen = await render(<GardenNameScreen />);

    await fireEvent.changeText(screen.getByLabelText('Название'), ' ромашка ');
    expect(screen.getByText('Такое название уже есть')).toBeTruthy();

    await fireEvent.press(screen.getByText('Сохранить'));
    expect(dispatch).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Название'), '  Звёздочка ');
    await fireEvent.press(screen.getByText('Сохранить'));
    expect(dispatch).toHaveBeenCalledWith(
      startGardenEdit({ type: 'saveGroup', id: null, name: 'Звёздочка', branchId: 'b-center' })
    );
  });
});

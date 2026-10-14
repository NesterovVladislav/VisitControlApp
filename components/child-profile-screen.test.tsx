import { fireEvent, render } from '@testing-library/react-native';

import ChildProfileScreen from '../app/profile/child/[id]';
import ChildChangesList from './child-changes-list';
import ProfileChildren from './profile-children';
import { useAppDispatch, useAppSelector } from '../store';
import { ChildChange, OwnChild } from '../store/types/child-requests';
import { changeDiff, ownChangeLabel } from '../utils/child-requests';

const mockPush = jest.fn();

jest.mock('../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('./ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 0 }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  useLocalSearchParams: () => ({ id: 'c1' }),
}));

const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;

const petya: OwnChild = {
  id: 'c1',
  surname: 'Иванов',
  firstName: 'Петя',
  patronymic: null,
  birthDate: '2021-03-12',
  gender: 'MALE',
  linkRole: 'PARENT',
  canEdit: true,
  change: null,
};

const change: ChildChange = {
  id: 'ch1',
  status: 'PENDING',
  childId: 'c1',
  previous: { surname: 'Иванов', firstName: 'Петя', patronymic: null, birthDate: '2021-03-12' },
  next: { surname: 'Петров', firstName: 'Петя', patronymic: 'Сергеевич', birthDate: '2021-03-13' },
  reason: null,
  applicantName: 'Иванова А.',
};

function givenState(role: string, childRequests: object) {
  mockUseAppSelector.mockImplementation((selector) =>
    selector({
      auth: { user: { role } },
      children: { items: [], listStatus: 'loaded' },
      photos: { own: [], pending: [], busyUserIds: [], cancellingIds: [], decidingIds: [], error: null },
      childRequests: {
        own: [],
        ownChildren: null,
        cancellingIds: [],
        changeSubmitting: false,
        changeResult: null,
        changeError: null,
        changes: [],
        decidingChangeIds: [],
        error: null,
        ...childRequests,
      },
    } as never),
  );
}

describe('child data in the profile', () => {
  let dispatch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    dispatch = jest.fn();
    mockUseAppDispatch.mockReturnValue(dispatch);
  });

  it('opens the child from the profile', async () => {
    givenState('PARENT', { ownChildren: [petya] });
    const screen = await render(<ProfileChildren />);

    await fireEvent.press(screen.getByText('Иванов Петя'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/profile/child/[id]', params: { id: 'c1' } });
  });

  it('sends a parent change for the kindergarten to confirm', async () => {
    givenState('PARENT', { ownChildren: [petya] });
    const screen = await render(<ChildProfileScreen />);

    expect(screen.getByText(/Изменение проверит администратор сада/)).toBeTruthy();
    expect(screen.getByDisplayValue('12.03.2021')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Фамилия'), 'Петров ');
    await fireEvent.press(screen.getByText('Отправить на подтверждение'));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'childRequests/changeChildStart',
      payload: { childId: 'c1', data: { surname: 'Петров', first_name: 'Петя', birth_date: '2021-03-12' } },
    });
  });

  it('does not send unchanged data', async () => {
    givenState('PARENT', { ownChildren: [petya] });
    const screen = await render(<ChildProfileScreen />);

    await fireEvent.press(screen.getByText('Отправить на подтверждение'));

    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'childRequests/changeChildStart' }));
  });

  it('shows the waiting change, locks the form and lets the parent withdraw it', async () => {
    givenState('PARENT', { ownChildren: [{ ...petya, change }] });
    const screen = await render(<ChildProfileScreen />);

    expect(screen.getByText('Изменение ждёт подтверждения сада')).toBeTruthy();
    expect(screen.getByText('Фамилия: Иванов → Петров')).toBeTruthy();
    expect(screen.getByText('Отозвать изменение')).toBeTruthy();
    expect(screen.queryByText('Отправить на подтверждение')).toBeNull();
  });

  it('shows why the kindergarten rejected the change and lets the parent try again', async () => {
    givenState('PARENT', { ownChildren: [{ ...petya, change: { ...change, status: 'REJECTED', reason: 'Нужен документ' } }] });
    const screen = await render(<ChildProfileScreen />);

    expect(screen.getByText('Сад отклонил изменение')).toBeTruthy();
    expect(screen.getByText('Причина: Нужен документ')).toBeTruthy();
    expect(screen.getByText('Отправить на подтверждение')).toBeTruthy();
  });

  it('saves at once for an administrator or a director', async () => {
    givenState('DIRECTOR', { ownChildren: [petya] });
    const screen = await render(<ChildProfileScreen />);

    expect(screen.getByText('Изменение применится сразу.')).toBeTruthy();
    expect(screen.getByText('Сохранить')).toBeTruthy();
  });

  it('only shows the data to a relative', async () => {
    givenState('PARENT', { ownChildren: [{ ...petya, linkRole: 'RELATIVE', canEdit: false }] });
    const screen = await render(<ChildProfileScreen />);

    expect(screen.getByText(/может его родитель или администратор сада/)).toBeTruthy();
    expect(screen.queryByText('Отправить на подтверждение')).toBeNull();
  });
});

describe('child data changes for the administrator', () => {
  it('shows what changes and who asked, and confirms the change', async () => {
    const dispatch = jest.fn();
    mockUseAppDispatch.mockReturnValue(dispatch);
    givenState('ADMIN', { changes: [change] });
    const screen = await render(<ChildChangesList />);

    expect(screen.getByText('ИЗМЕНЕНИЕ ДАННЫХ ДЕТЕЙ')).toBeTruthy();
    expect(screen.getByText('Иванов Петя')).toBeTruthy();
    expect(screen.getByText('Отчество: — → Сергеевич')).toBeTruthy();
    expect(screen.getByText('Дата рождения: 12.03.2021 → 13.03.2021')).toBeTruthy();
    expect(screen.getByText('Предложил(а): Иванова А.')).toBeTruthy();

    await fireEvent.press(screen.getByText('Подтвердить'));

    expect(dispatch).toHaveBeenCalledWith({ type: 'childRequests/approveChildChangeStart', payload: 'ch1' });
  });

  it('lists only the fields that change', () => {
    expect(changeDiff(change)).toEqual([
      'Фамилия: Иванов → Петров',
      'Отчество: — → Сергеевич',
      'Дата рождения: 12.03.2021 → 13.03.2021',
    ]);
    expect(ownChangeLabel({ status: 'PENDING', reason: null })).toBe('Изменение ждёт подтверждения сада');
    expect(ownChangeLabel({ status: 'REJECTED', reason: 'Нужен документ' }))
      .toBe('Сад отклонил изменение: Нужен документ');
    expect(ownChangeLabel({ status: 'APPROVED', reason: null })).toBeNull();
  });
});

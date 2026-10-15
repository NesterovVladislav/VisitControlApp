import { fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

import PersonCardScreen from '../app/(admin)/people/[id]';
import { useAppDispatch, useAppSelector } from '../store';
import { openChildLink } from '../store/reducers/child-link';
import { changePersonRole, clearDeactivation, deactivatePerson, resetPersonPassword } from '../store/reducers/people';
import { PeopleState, Person } from '../store/types/people';

jest.mock('../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('../components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('../components/link-child-sheet', () => () => null);
const mockBack = jest.fn();
let mockId = 'anna';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ id: mockId }),
}));

const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;
const dispatch = jest.fn();

const person = (id: string, firstName: string, role: string, extra: Partial<Person> = {}): Person => ({
  id,
  surname: 'Иванова',
  firstName,
  patronymic: null,
  role,
  gender: 'FEMALE',
  birthDate: null,
  phone: null,
  email: null,
  group: null,
  present: null,
  children: null,
  ...extra,
});

const anna = person('anna', 'Анна', 'PARENT', {
  email: 'anna@example.com',
  children: [{ id: 'maria', firstName: 'Мария', surname: 'Иванова', linkRole: 'PARENT' }],
});
const olga = person('olga', 'Ольга', 'ADMIN', { email: 'olga@example.com' });
const maria = person('maria', 'Мария', 'VISITOR');
const ivan = person('ivan', 'Иван', 'EMPLOYEE', { email: 'ivan@example.com' });

function given(people: Partial<PeopleState>, viewerRole = 'ADMIN') {
  const state = {
    items: [anna, olga, maria, ivan],
    passwordReset: null,
    deactivation: null,
    roleChange: null,
    filterOptions: { status: 'loaded', groups: [], branches: [] },
    ...people,
  };
  const auth = { user: { id: 'me', role: viewerRole } };
  mockUseAppSelector.mockImplementation((selector) => selector({ people: state, auth } as never));
}

function press(alert: jest.SpyInstance, text: string) {
  const buttons = alert.mock.calls[alert.mock.calls.length - 1][2];
  buttons.find((button: { text: string }) => button.text === text).onPress();
}

describe('PersonCardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(dispatch);
    mockId = 'anna';
  });

  it('shows the parent with children and every admin action', async () => {
    given({});
    const screen = await render(<PersonCardScreen />);

    expect(screen.getByText('Иванова Анна')).toBeTruthy();
    expect(screen.getByText('anna@example.com')).toBeTruthy();
    expect(screen.getByText('мама')).toBeTruthy();

    await fireEvent.press(screen.getByText('Привязать ребёнка'));
    expect(dispatch).toHaveBeenCalledWith(openChildLink(anna));
    expect(screen.getByText('Сбросить пароль')).toBeTruthy();
    expect(screen.getByText('Деактивировать')).toBeTruthy();
  });

  it('resets the password and deactivates only after confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    given({});
    const screen = await render(<PersonCardScreen />);

    await fireEvent.press(screen.getByText('Сбросить пароль'));
    expect(dispatch).not.toHaveBeenCalledWith(resetPersonPassword('anna'));
    press(alert, 'Сбросить');
    expect(dispatch).toHaveBeenCalledWith(resetPersonPassword('anna'));

    await fireEvent.press(screen.getByText('Деактивировать'));
    expect(alert.mock.calls[1][1]).toContain('больше не сможет войти');
    expect(dispatch).not.toHaveBeenCalledWith(deactivatePerson('anna'));
    press(alert, 'Деактивировать');
    expect(dispatch).toHaveBeenCalledWith(deactivatePerson('anna'));
  });

  it('offers a child only deactivation', async () => {
    mockId = 'maria';
    given({});
    const screen = await render(<PersonCardScreen />);

    expect(screen.getByText('Деактивировать')).toBeTruthy();
    expect(screen.queryByText('Сбросить пароль')).toBeNull();
    expect(screen.queryByText('Привязать ребёнка')).toBeNull();
  });

  it('does not let an admin manage another admin', async () => {
    mockId = 'olga';
    given({});
    const screen = await render(<PersonCardScreen />);

    expect(screen.getByText('Привязать ребёнка')).toBeTruthy();
    expect(screen.queryByText('Сбросить пароль')).toBeNull();
    expect(screen.queryByText('Деактивировать')).toBeNull();
  });

  it('shows no actions to an employee', async () => {
    given({}, 'EMPLOYEE');
    const screen = await render(<PersonCardScreen />);
    expect(screen.queryByText('ДЕЙСТВИЯ')).toBeNull();
  });

  it('goes back after the person is deactivated', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    given({ deactivation: { personId: 'anna', status: 'done', message: null } });
    await render(<PersonCardScreen />);

    expect(alert.mock.calls[0][0]).toBe('Пользователь деактивирован');
    expect(dispatch).toHaveBeenCalledWith(clearDeactivation());
    press(alert, 'OK');
    expect(mockBack).toHaveBeenCalled();
  });

  it('lets the director make an employee an admin after confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockId = 'ivan';
    given({}, 'DIRECTOR');
    const screen = await render(<PersonCardScreen />);

    await fireEvent.press(screen.getByText('Сделать администратором'));
    expect(alert.mock.calls[0][1]).toContain('полный доступ');
    expect(dispatch).not.toHaveBeenCalledWith(changePersonRole({ personId: 'ivan', role: 'ADMIN' }));
    press(alert, 'Сделать администратором');
    expect(dispatch).toHaveBeenCalledWith(changePersonRole({ personId: 'ivan', role: 'ADMIN' }));
  });

  it('lets the director make an admin an employee', async () => {
    mockId = 'olga';
    given({}, 'DIRECTOR');
    const screen = await render(<PersonCardScreen />);
    expect(screen.getByText('Сделать сотрудником')).toBeTruthy();
    expect(screen.queryByText('Сделать администратором')).toBeNull();
  });

  it('does not offer role changes to an admin or for a parent', async () => {
    mockId = 'ivan';
    given({});
    const admin = await render(<PersonCardScreen />);
    expect(admin.queryByText('Сделать администратором')).toBeNull();

    mockId = 'anna';
    given({}, 'DIRECTOR');
    const parent = await render(<PersonCardScreen />);
    expect(parent.queryByText('Сделать администратором')).toBeNull();
    expect(parent.queryByText('Сделать сотрудником')).toBeNull();
  });
});

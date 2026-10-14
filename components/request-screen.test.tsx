import { fireEvent, render } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';

import RequestScreen from '../app/(admin)/requests/[id]';
import { useAppDispatch, useAppSelector } from '../store';

jest.mock('../store', () => ({ useAppDispatch: jest.fn(), useAppSelector: jest.fn() }));
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 56 }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'r-1' }),
}));

const request = {
  id: 'r-1',
  surname: 'Иванова',
  firstName: 'Анна',
  patronymic: 'Петровна',
  birthDate: '1990-05-03',
  gender: 'FEMALE' as const,
  email: 'anna@example.com',
  phone: '+79123456789',
  created: '2026-09-29T07:40:00.000Z',
  role: 'PARENT',
  children: [] as unknown[],
};

const masha = {
  id: 'c-1',
  surname: 'Иванова',
  firstName: 'Маша',
  patronymic: null,
  birthDate: '2022-05-01',
  gender: 'FEMALE' as const,
  matches: [] as unknown[],
};

const existingMasha = {
  id: 'u-9',
  surname: 'Петрова',
  firstName: 'Маша',
  patronymic: null,
  birthDate: '2022-05-01',
};

const roles = [
  { id: 'role-parent', name: 'PARENT' },
  { id: 'role-employee', name: 'EMPLOYEE' },
  { id: 'role-visitor', name: 'VISITOR' },
];

const mockDispatch = jest.fn();

function given(item: Record<string, unknown>) {
  (useAppDispatch as jest.Mock).mockReturnValue(mockDispatch);
  (useAppSelector as jest.Mock).mockImplementation((selector) =>
    selector({ requests: { items: [item], outcomes: {}, processing: null, actionError: null, roles } })
  );
}

/** Нажимает «Подтвердить» в диалоге и возвращает отправленное действие */
async function approve(screen: Awaited<ReturnType<typeof render>>) {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await fireEvent.press(screen.getByRole('button', { name: 'Подтвердить' }));
  const buttons = alert.mock.calls[0][2] ?? [];
  buttons.find((button) => button.text === 'Подтвердить')?.onPress?.();
  const message = alert.mock.calls[0][1];
  alert.mockRestore();
  return { message, action: mockDispatch.mock.calls.map(([action]) => action).find((action) =>
    action.type === 'requests/approveRequest') };
}

describe('registration request screen', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('shows the applicant', async () => {
    given(request);
    const screen = await render(<RequestScreen />);
    expect(screen.getByText('Иванова Анна Петровна')).toBeTruthy();
    expect(screen.getByText('03.05.1990 (36 лет)')).toBeTruthy();
    expect(screen.getByText('+7 (912) 345-67-89')).toBeTruthy();
  });

  it('survives a request without optional fields', async () => {
    given({ ...request, patronymic: null, birthDate: null, gender: null, phone: null });
    const screen = await render(<RequestScreen />);
    expect(screen.getByText('Иванова Анна')).toBeTruthy();
  });

  it('loads roles that can be given', async () => {
    given(request);
    await render(<RequestScreen />);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'requests/loadRolesStart', payload: undefined });
  });

  it('creates a child without similar children of the kindergarten by default', async () => {
    given({ ...request, children: [masha] });
    const screen = await render(<RequestScreen />);

    expect(screen.getByText('1 ребёнок в заявке')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Маша: Новый ребёнок — добавить в сад' }).props.accessibilityState)
      .toMatchObject({ checked: true });

    const { action } = await approve(screen);
    expect(action.payload).toEqual({ request: { ...request, children: [masha] }, roleId: null,
      decisions: { 'c-1': { kind: 'CREATE' } } });
  });

  it('asks to choose when a similar child is already in the kindergarten', async () => {
    given({ ...request, children: [{ ...masha, matches: [existingMasha] }] });
    const screen = await render(<RequestScreen />);

    expect(screen.getByRole('button', { name: 'Подтвердить' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await fireEvent.press(screen.getByRole('radio', { name: 'Маша: Это Петрова Маша, 01.05.2022 — уже в саду' }));

    const { action, message } = await approve(screen);
    expect(action.payload.decisions).toEqual({ 'c-1': { kind: 'LINK', childId: 'u-9' } });
    expect(message).toContain('Дети: связать с записанными в сад — 1.');
  });

  it('can leave a child out', async () => {
    given({ ...request, children: [masha] });
    const screen = await render(<RequestScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Маша: Не добавлять' }));

    const { action } = await approve(screen);
    expect(action.payload.decisions).toEqual({ 'c-1': { kind: 'SKIP' } });
  });

  it('gives the role of the request unless the admin changes it', async () => {
    given({ ...request, role: 'EMPLOYEE' });
    const screen = await render(<RequestScreen />);

    expect(screen.getByText('Сотрудник')).toBeTruthy();
    const { action, message } = await approve(screen);
    expect(action.payload.roleId).toBeNull();
    expect(message).toContain('получит роль «Сотрудник»');
  });

  it('sends another role chosen by the admin', async () => {
    // На iOS пункт шторки срабатывает после закрытия Modal (onDismiss), в тестовом рендере его нет
    jest.replaceProperty(Platform, 'OS', 'android');
    given({ ...request, role: 'EMPLOYEE' });
    const screen = await render(<RequestScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Сменить роль' }));
    await fireEvent.press(screen.getByText('Родитель'));

    const { action } = await approve(screen);
    expect(action.payload.roleId).toBe('role-parent');
  });
});

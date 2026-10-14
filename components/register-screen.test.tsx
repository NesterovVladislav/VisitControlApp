import { fireEvent, render } from '@testing-library/react-native';

import RegisterScreen from '../app/register';
import { useAppDispatch, useAppSelector } from '../store';

jest.mock('../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 0 }));
const mockSetOptions = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ setOptions: mockSetOptions, dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
}));
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

const sunshine = {
  id: 'org-1',
  name: 'Солнышко',
  address: 'ул. Ленина, 1',
  logoUrl: null,
  registrationAvailable: true,
};
const chamomile = { ...sunshine, id: 'org-2', name: 'Ромашка', address: null };
const closed = { ...sunshine, id: 'org-3', name: 'Закрытый', address: null, registrationAvailable: false };

const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;

function renderScreen(registration: Record<string, unknown> = {}) {
  mockUseAppSelector.mockImplementation((selector) =>
    selector({
      registration: {
        organizations: [sunshine, chamomile],
        organizationsStatus: 'loaded',
        organization: sunshine,
        policy: { version: '1', url: 'https://example.com/policy' },
        policyStatus: 'loaded',
        status: 'idle',
        fieldErrors: {},
        formError: null,
        consentResetCount: 0,
        sentToEmail: null,
        ...registration,
      },
    } as never),
  );
  return render(<RegisterScreen />);
}

describe('RegisterScreen', () => {
  const mockDispatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(mockDispatch);
  });

  it('loads the kindergartens on open', async () => {
    await renderScreen();

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'registration/resetRegistration' });
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'registration/loadOrganizationsStart' });
  });

  it('asks to choose a kindergarten before the form', async () => {
    const screen = await renderScreen({ organization: null, organizations: [sunshine, closed] });

    expect(screen.getByText('Выберите детский сад')).toBeTruthy();
    expect(screen.getByText('ул. Ленина, 1')).toBeTruthy();
    expect(screen.getByText('Регистрация пока недоступна')).toBeTruthy();
    expect(screen.queryByText('Отправить заявку')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Солнышко' }));

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'registration/selectOrganization', payload: sunshine });
  });

  it('does not let the parent choose a kindergarten that does not accept requests', async () => {
    const screen = await renderScreen({ organization: null, organizations: [sunshine, closed] });

    expect(screen.getByRole('button', { name: 'Закрытый' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('offers to retry when the list did not load', async () => {
    const screen = await renderScreen({ organization: null, organizations: [], organizationsStatus: 'failed' });

    await fireEvent.press(screen.getByText('Повторить'));

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'registration/loadOrganizationsStart' });
  });

  it('shows the chosen kindergarten above the form and lets the parent change it', async () => {
    const screen = await renderScreen();

    expect(screen.getByText('Солнышко')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Выбрать другой сад' }));

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'registration/selectOrganization', payload: null });
  });

  it('does not offer to change the only kindergarten', async () => {
    const screen = await renderScreen({ organizations: [sunshine, closed] });

    expect(screen.queryByRole('button', { name: 'Выбрать другой сад' })).toBeNull();
  });

  it('shows the form while the request is not sent', async () => {
    const screen = await renderScreen();

    expect(screen.getByText('Отправить заявку')).toBeTruthy();
    expect(mockSetOptions).toHaveBeenCalledWith({ headerShown: true });
  });

  it('replaces the form with the confirmation in place, without navigating', async () => {
    const screen = await renderScreen({ status: 'sent', sentToEmail: 'maria@mail.ru' });

    expect(screen.getByText('Заявка отправлена')).toBeTruthy();
    expect(
      screen.getByText('Ваша заявка направлена администратору и будет рассмотрена в ближайшее время.'),
    ).toBeTruthy();
    expect(screen.getByText('maria@mail.ru')).toBeTruthy();
    expect(screen.queryByText('Отправить заявку')).toBeNull();
    expect(mockSetOptions).toHaveBeenCalledWith({ headerShown: false });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('returns to sign-in from the confirmation', async () => {
    const screen = await renderScreen({ status: 'sent', sentToEmail: 'maria@mail.ru' });

    await fireEvent.press(screen.getByRole('button', { name: 'Понятно' }));

    expect(mockBack).toHaveBeenCalled();
  });

  it('offers to add children to a parent and hides them for an employee', async () => {
    const screen = await renderScreen();

    expect(screen.getByText('ДЕТИ')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '+ Добавить ребёнка' }));
    expect(screen.getByText('Ребёнок 1')).toBeTruthy();
    expect(screen.getByLabelText(
      'Даю согласие на обработку моих персональных данных и персональных данных моих детей')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Сотрудник' }));
    expect(screen.queryByText('ДЕТИ')).toBeNull();
    expect(screen.queryByText('Ребёнок 1')).toBeNull();
  });

  it('removes a child', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: '+ Добавить ребёнка' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Убрать: Ребёнок 1' }));

    expect(screen.queryByText('Ребёнок 1')).toBeNull();
  });
});

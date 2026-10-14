import { fireEvent, render } from '@testing-library/react-native';

import AddChildScreen from '../app/profile/add-child';
import ChildRequestsList from './child-requests-list';
import { useAppDispatch, useAppSelector } from '../store';

jest.mock('../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('./ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 0 }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));

const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;

function givenState(role: string, childRequests: object = {}) {
  mockUseAppSelector.mockImplementation((selector) =>
    selector({
      auth: { user: { role } },
      childRequests: {
        submitting: false,
        submitResult: null,
        submitError: null,
        pending: [],
        changes: [],
        decidingChangeIds: [],
        ownChildren: null,
        changeSubmitting: false,
        changeResult: null,
        changeError: null,
        decidingIds: [],
        error: null,
        ...childRequests,
      },
    } as never),
  );
}

describe('add a child from the profile', () => {
  let dispatch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    dispatch = jest.fn();
    mockUseAppDispatch.mockReturnValue(dispatch);
  });

  it('sends a parent request to the kindergarten administrator', async () => {
    givenState('PARENT');
    const screen = await render(<AddChildScreen />);

    expect(screen.getByText(/Администратор сада проверит/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Фамилия'), ' Иванов ');
    await fireEvent.changeText(screen.getByLabelText('Имя'), 'Петя');
    await fireEvent.changeText(screen.getByLabelText('Дата рождения'), '12032021');
    await fireEvent.press(screen.getByText('Мальчик'));
    await fireEvent.press(screen.getByText('Отправить заявку'));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'childRequests/submitChildStart',
      payload: { surname: 'Иванов', first_name: 'Петя', birth_date: '2021-03-12', gender: 'MALE' },
    });
  });

  it('does not send an incomplete form', async () => {
    givenState('PARENT');
    const screen = await render(<AddChildScreen />);

    await fireEvent.changeText(screen.getByLabelText('Имя'), 'Петя');
    await fireEvent.press(screen.getByText('Отправить заявку'));

    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'childRequests/submitChildStart' }));
  });

  it('tells an administrator or a director that the child is added at once', async () => {
    givenState('DIRECTOR');
    const screen = await render(<AddChildScreen />);

    expect(screen.getByText(/Ребёнок сразу появится в списке ваших детей/)).toBeTruthy();
    expect(screen.getByText('Добавить')).toBeTruthy();
  });
});

describe('child requests of the kindergarten for the administrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(jest.fn());
  });

  it('shows who asks to add which child and warns about a similar child', async () => {
    givenState('ADMIN', {
      pending: [
        {
          id: 'r1',
          status: 'PENDING',
          surname: 'Иванов',
          firstName: 'Петя',
          patronymic: null,
          birthDate: '2021-03-12',
          gender: 'MALE',
          applicantName: 'Иванова А.',
          applicantRole: 'PARENT',
          matches: [{ id: 'k1', surname: 'Иванов', firstName: 'Пётр', patronymic: null, birthDate: '2021-03-12' }],
        },
      ],
    });
    const screen = await render(<ChildRequestsList />);

    expect(screen.getByText('ДОБАВЛЕНИЕ ДЕТЕЙ')).toBeTruthy();
    expect(screen.getByText('Иванов Петя · 12.03.2021')).toBeTruthy();
    expect(screen.getByText('Просит добавить: Иванова А. · Родитель')).toBeTruthy();
    expect(screen.getByText('Похожий ребёнок уже есть в саду')).toBeTruthy();

    await fireEvent.press(screen.getByText('Решить'));
    expect(screen.getByText('Уже в саду: Иванов Пётр, 12.03.2021')).toBeTruthy();
    expect(screen.getByText('Новый ребёнок — добавить в сад')).toBeTruthy();
    expect(screen.getByText('Не добавлять')).toBeTruthy();
  });

  it('shows nothing when no one asked', async () => {
    givenState('ADMIN');
    const screen = await render(<ChildRequestsList />);

    expect(screen.queryByText('ДОБАВЛЕНИЕ ДЕТЕЙ')).toBeNull();
  });
});

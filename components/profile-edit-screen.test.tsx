import { fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

import ProfileEditScreen from '../app/profile/edit';
import { useAppDispatch, useAppSelector } from '../store';
import { saveProfileStart } from '../store/reducers/profile';
import { User } from '../store/types/auth';

const mockBack = jest.fn();
jest.mock('../store', () => ({ useAppDispatch: jest.fn(), useAppSelector: jest.fn() }));
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 0 }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));

const user: User = {
  id: 'parent-1', role: 'PARENT', email: 'parent@example.test', surname: 'Иванова', firstName: 'Анна',
  patronymic: null, gender: 'FEMALE', birthDate: '1990-03-14', phone: '+79123456789',
  organization: { id: 'garden-1', name: 'Тестовый сад' },
};
const dispatch = jest.fn();
let profile: Record<string, unknown>;

describe('own profile form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    profile = { saveStatus: 'idle', saveFieldErrors: {}, saveError: null };
    (useAppDispatch as jest.Mock).mockReturnValue(dispatch);
    (useAppSelector as jest.Mock).mockImplementation((selector) => selector({ auth: { user }, profile }));
  });

  it('saves gender immediately with only allowed personal fields', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const screen = await render(<ProfileEditScreen />);
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Нет отчества' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Мужской' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Сохранить' }));
    expect(dispatch).toHaveBeenCalledWith(saveProfileStart({
      surname: 'Иванова', first_name: 'Анна', patronymic: null, birth_date: '1990-03-14',
      phone: '+79123456789', gender: 'MALE',
    }));
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('keeps edited values when the server rejects the phone', async () => {
    const screen = await render(<ProfileEditScreen />);
    await fireEvent.changeText(screen.getByLabelText('Фамилия'), 'Смирнова');
    profile = { ...profile, saveFieldErrors: { phone: 'Этот номер уже привязан к другому аккаунту' } };
    await screen.rerender(<ProfileEditScreen />);
    expect(screen.getByLabelText('Фамилия')).toHaveDisplayValue('Смирнова');
    expect(screen.getByText('Этот номер уже привязан к другому аккаунту')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('blocks additional taps while saving and closes after success', async () => {
    const screen = await render(<ProfileEditScreen />);
    await fireEvent.changeText(screen.getByLabelText('Фамилия'), 'Смирнова');
    await fireEvent.press(screen.getByRole('button', { name: 'Сохранить' }));
    profile = { ...profile, saveStatus: 'saving' };
    await screen.rerender(<ProfileEditScreen />);
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Сохранить' }));
    expect(dispatch.mock.calls.filter(([action]) => action.type === saveProfileStart.type)).toHaveLength(1);
    profile = { ...profile, saveStatus: 'saved' };
    await screen.rerender(<ProfileEditScreen />);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

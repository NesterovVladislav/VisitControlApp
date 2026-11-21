import { fireEvent, render, waitFor } from '@testing-library/react-native';
import DeleteAccount from '../app/profile/delete-account';
import { deleteOwnAccount, getDeletionPreview } from '../services/api/account-deletion';
import { ApiError } from '../services/errors/api-error';

const mockDispatch = jest.fn();
jest.mock('../store', () => ({ useAppDispatch: () => mockDispatch,
  useAppSelector: (select: Function) => select({ auth: { user: { id: 'u', role: 'PARENT' } } }) }));
jest.mock('../services/api/account-deletion');
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 48 }));
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({}) }));

it('blocks children in the garden and shared children cannot be selected', async () => {
  const child = { external_key: 'a', surname: 'Пример', first_name: 'Анна', has_other_representatives: false, in_kindergarten: true };
  jest.mocked(getDeletionPreview).mockResolvedValue({ can_delete: true, children: [child,
    { ...child, external_key: 'b', has_other_representatives: true }] });
  const screen = await render(<DeleteAccount />);
  const checkbox = await screen.findByRole('checkbox');
  const submit = screen.getByRole('button', { name: 'Удалить аккаунт' });
  await fireEvent.changeText(screen.getByLabelText('Текущий пароль'), 'fixture');
  expect(submit).toBeDisabled();
  await fireEvent.press(checkbox);
  expect(submit).toBeEnabled();
  jest.mocked(deleteOwnAccount).mockRejectedValueOnce(new ApiError('wrong', 400, '', {code:'WRONG_PASSWORD'}));
  await fireEvent.press(submit);
  expect(await screen.findByText('Неверный пароль')).toBeVisible();
  expect(mockDispatch).not.toHaveBeenCalled();
  jest.mocked(deleteOwnAccount).mockResolvedValueOnce(undefined);
  await fireEvent.press(submit);
  expect(deleteOwnAccount).toHaveBeenLastCalledWith('fixture', []);
  await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith({ type: 'auth/logoutRequested', payload: { reason: 'accountDeleted' } }));
});

it('hides children and password when preview denies deletion', async () => {
  jest.mocked(getDeletionPreview).mockResolvedValue({ can_delete: false, children: [] });
  const screen = await render(<DeleteAccount />);
  expect(await screen.findByText('Аккаунт сотрудника удаляет администратор сада')).toBeVisible();
  expect(screen.queryByLabelText('Текущий пароль')).toBeNull();
});

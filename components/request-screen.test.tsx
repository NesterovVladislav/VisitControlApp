import { render } from '@testing-library/react-native';

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
};

function given(item: Record<string, unknown>) {
  (useAppDispatch as jest.Mock).mockReturnValue(jest.fn());
  (useAppSelector as jest.Mock).mockImplementation((selector) =>
    selector({ requests: { items: [item], outcomes: {}, processing: null, actionError: null } })
  );
}

describe('registration request screen', () => {
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
});

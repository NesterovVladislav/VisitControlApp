import { fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

import LinkChildSheet from './link-child-sheet';
import { useAppDispatch, useAppSelector } from '../store';
import { closeChildLink, linkChild } from '../store/reducers/child-link';
import { ChildLinkState } from '../store/types/child-link';
import { Person } from '../store/types/people';

jest.mock('../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('./ui/icon-symbol', () => ({ IconSymbol: () => null }));

const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;
const dispatch = jest.fn();

const person = (id: string, firstName: string, role: string): Person => ({
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
});

const maria = person('maria', 'Мария', 'VISITOR');
const petya = person('petya', 'Петя', 'VISITOR');
const mother: Person = {
  ...person('mother', 'Анна', 'PARENT'),
  children: [{ id: 'petya', firstName: 'Петя', surname: 'Иванова', linkRole: 'PARENT' }],
};

function given(childLink: Partial<ChildLinkState>) {
  const state: ChildLinkState = {
    adult: mother,
    q: '',
    candidates: [maria, petya],
    status: 'loaded',
    requestId: 1,
    link: null,
    ...childLink,
  };
  mockUseAppSelector.mockImplementation((selector) => selector({ childLink: state } as never));
}

describe('LinkChildSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(dispatch);
  });

  it('links a chosen child as mother after confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    given({});
    const screen = await render(<LinkChildSheet showBranch={false} />);

    expect(screen.getByText('Уже привязан')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Выбрать: Иванова Мария'));
    await fireEvent.press(screen.getByText('Мама'));
    expect(dispatch).not.toHaveBeenCalledWith(linkChild({ child: maria, linkRole: 'PARENT' }));

    const buttons = alert.mock.calls[0][2]!;
    buttons.find((button) => button.text === 'Привязать')!.onPress!();
    expect(dispatch).toHaveBeenCalledWith(linkChild({ child: maria, linkRole: 'PARENT' }));
  });

  it('closes after the child is linked', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    given({ link: { childId: 'maria', status: 'linked', message: null } });
    await render(<LinkChildSheet showBranch={false} />);
    expect(alert).toHaveBeenCalledWith('Ребёнок привязан', expect.any(String));
    expect(dispatch).toHaveBeenCalledWith(closeChildLink());
  });

  it('renders nothing when closed', async () => {
    given({ adult: null });
    const screen = await render(<LinkChildSheet showBranch={false} />);
    expect(screen.toJSON()).toBeNull();
  });
});

import { render, waitFor } from '@testing-library/react-native';

import ChildGroupSheet from './child-group-sheet';
import { visitControlApi } from '../services/api';
import { Child } from '../store/types/children';

jest.mock('../services/api', () => ({ visitControlApi: { getChildGroup: jest.fn() } }));

const getChildGroup = visitControlApi.getChildGroup as jest.MockedFunction<typeof visitControlApi.getChildGroup>;
const petya: Child = { id: 'c1', firstName: 'Петя', surname: 'Яковлев', linkRole: 'PARENT' };

describe('group of own child', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('lists children of the group by surname with who is in the kindergarten now', async () => {
    getChildGroup.mockResolvedValue({
      name: 'Ромашка',
      children: [
        { surname: 'Борисова', firstName: 'Анна', present: false, own: false },
        { surname: 'Яковлев', firstName: 'Петя', present: true, own: true },
      ],
    });
    const screen = await render(<ChildGroupSheet child={petya} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Группа «Ромашка»')).toBeTruthy());
    expect(getChildGroup).toHaveBeenCalledWith('c1');
    expect(screen.getByText('В саду 1 из 2')).toBeTruthy();
    expect(screen.getByText('Борисова Анна')).toBeTruthy();
    expect(screen.getByText('Яковлев Петя')).toBeTruthy();
    expect(screen.getAllByLabelText('В саду')).toHaveLength(1);
    expect(screen.getAllByLabelText('Не в саду')).toHaveLength(1);
  });

  it('says so when the child is not in any group yet', async () => {
    getChildGroup.mockResolvedValue({ name: null, children: [] });
    const screen = await render(<ChildGroupSheet child={petya} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Сад ещё не определил ребёнка в группу')).toBeTruthy());
  });

  it('offers to retry when the group failed to load', async () => {
    getChildGroup.mockRejectedValue(new Error('offline'));
    const screen = await render(<ChildGroupSheet child={petya} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Не удалось загрузить группу')).toBeTruthy());
    expect(screen.getByText('Повторить')).toBeTruthy();
  });

  it('renders nothing while closed', async () => {
    const screen = await render(<ChildGroupSheet child={null} onClose={jest.fn()} />);

    expect(screen.toJSON()).toBeNull();
    expect(getChildGroup).not.toHaveBeenCalled();
  });
});

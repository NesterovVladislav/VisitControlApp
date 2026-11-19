import { act, render, waitFor } from '@testing-library/react-native';

import ChildGroupSheet, { ChildGroupPanel } from './child-group-sheet';
import { visitControlApi } from '../services/api';
import { Child, ChildGroup } from '../store/types/children';

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => () => void) => {
    const focused = mockFocused;
    jest.requireActual('react').useEffect(() => focused ? effect() : undefined, [effect, focused]);
  },
}));

jest.mock('../services/api', () => ({ visitControlApi: { getChildGroup: jest.fn() } }));

const getChildGroup = visitControlApi.getChildGroup as jest.MockedFunction<typeof visitControlApi.getChildGroup>;
const petya: Child = { id: 'c1', firstName: 'Петя', surname: 'Яковлев', linkRole: 'PARENT' };

describe('group of own child', () => {
  beforeEach(() => {
    mockFocused = true;
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

  it('keeps only the selected child’s group when an earlier response arrives later', async () => {
    let resolvePrevious!: (value: ChildGroup) => void;
    getChildGroup.mockImplementationOnce(() => new Promise((resolve) => { resolvePrevious = resolve; }));
    getChildGroup.mockResolvedValueOnce({ name: 'Лучики', children: [] });
    const screen = await render(<ChildGroupPanel child={petya} />);
    await screen.rerender(<ChildGroupPanel child={{ ...petya, id: 'c2' }} />);

    await waitFor(() => expect(screen.getByText('Группа «Лучики»')).toBeVisible());
    await act(async () => resolvePrevious({ name: 'Ромашка', children: [] }));
    expect(screen.queryByText('Группа «Ромашка»')).toBeNull();
    expect(screen.getByText('Группа «Лучики»')).toBeVisible();
  });

  it('reloads on return from the profile and hides the previous roster until the response', async () => {
    getChildGroup.mockResolvedValueOnce({ name: 'Ромашка', children: [] });
    let resolveNew!: (value: ChildGroup) => void;
    getChildGroup.mockImplementationOnce(() => new Promise(resolve => { resolveNew = resolve; }));
    const screen = await render(<ChildGroupPanel child={petya} />);
    await screen.findByText('Группа «Ромашка»');

    mockFocused = false;
    await screen.rerender(<ChildGroupPanel child={petya} />);
    mockFocused = true;
    await screen.rerender(<ChildGroupPanel child={petya} />);
    expect(getChildGroup).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Группа «Ромашка»')).toBeNull();
    await act(async () => resolveNew({ name: 'Лучики', children: [] }));
    expect(screen.getByText('Группа «Лучики»')).toBeVisible();
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

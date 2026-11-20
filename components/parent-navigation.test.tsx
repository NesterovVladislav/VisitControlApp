import { fireEvent, render } from '@testing-library/react-native';
import { ParentChildSelector, ParentSectionBar } from './parent-navigation';
import type { Child } from '../store/types/children';

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const children: Child[] = ['Алиса', 'Михаил', 'Анна'].map((firstName, i) => ({
  id: String(i), firstName, surname: 'Пример', linkRole: 'PARENT',
}));

it('shows no selector for one child, and selects a sibling when there are two', async () => {
  const onSelect = jest.fn();
  const props = { selected: children[0], statuses: {}, onSelect };
  const screen = await render(<ParentChildSelector {...props} items={[children[0]]} />);
  expect(screen.toJSON()).toBeNull();
  await screen.rerender(<ParentChildSelector {...props} items={children.slice(0, 2)} />);
  await fireEvent.press(screen.getByLabelText(/Пример Михаил/));
  expect(onSelect).toHaveBeenCalledWith(children[1]);
});

it('announces the selected child in the chooser and lets the parent select the third child', async () => {
  const onSelect = jest.fn();
  const screen = await render(<ParentChildSelector selected={children[0]} items={children} statuses={{}} onSelect={onSelect} />);
  await fireEvent.press(screen.getByLabelText(/Выбрать ребёнка: Пример Алиса/));
  await fireEvent.press(screen.getByLabelText(/Пример Анна/));
  expect(onSelect).toHaveBeenCalledWith(children[2]);
});

it('keeps the group accessible when calendar access is unavailable', async () => {
  const onSelect = jest.fn();
  const screen = await render(<ParentSectionBar selected="home" showCalendar={false} onSelect={onSelect} />);
  expect(screen.queryByText('Календарь')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'Группа' }));
  expect(onSelect).toHaveBeenCalledWith('group');
});

it('opens the parent account even without linked children', async () => {
  const onSelect = jest.fn();
  const screen = await render(<ParentSectionBar selected="home" showCalendar={false} showGroup={false} onSelect={onSelect} />);
  expect(screen.queryByText('Группа')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'Профиль' }));
  expect(onSelect).toHaveBeenCalledWith('profile');
});

import { fireEvent, render } from '@testing-library/react-native';

import ChildCard, { commentLabel, decidedLabel, rejectedLabel } from './child-card';
import { ChildStatus, ChildVisit } from '../store/types/children';

const child = { id: 'c1', firstName: 'Мария', surname: 'Иванова', linkRole: 'PARENT' };
// Время задаём в местной зоне: карточка показывает местные часы
const at = (hours: number, minutes: number) => new Date(2026, 9, 12, hours, minutes).toISOString();

function status(visit: ChildVisit): ChildStatus {
  return { value: visit.status, visit, loading: false, error: false, notice: null };
}

const idle: ChildVisit = { status: 'OUT', decidedBy: null, decidedAt: null, pending: null, rejected: null };

async function renderCard(
  visit: ChildVisit,
  handlers: { onMark?: () => void; onCancel?: () => void; onShowQr?: () => void } = {},
) {
  return render(
    <ChildCard
      child={child}
      status={status(visit)}
      gender="FEMALE"
      marking={false}
      onMark={handlers.onMark ?? jest.fn()}
      onCancel={handlers.onCancel ?? jest.fn()}
      onShowQr={handlers.onShowQr}
      onRetryStatus={jest.fn()}
    />,
  );
}

describe('child card and kindergarten confirmation', () => {
  it('offers to mark arrival when nothing is waiting', async () => {
    const onMark = jest.fn();
    const screen = await renderCard(idle, { onMark });

    expect(screen.getByText('Не в саду')).toBeTruthy();
    await fireEvent.press(screen.getByText('Привела в сад'));
    expect(onMark).toHaveBeenCalled();
  });

  it('shows that arrival waits for the kindergarten and lets the parent cancel it', async () => {
    const onMark = jest.fn();
    const onCancel = jest.fn();
    const screen = await renderCard(
      { ...idle, pending: { id: 'm1', status: 'IN', datetime: at(8, 40) } },
      { onMark, onCancel },
    );

    expect(screen.getByText('Ждёт приёма в саду')).toBeTruthy();
    expect(screen.getByText('отмечено в 08:40')).toBeTruthy();
    expect(screen.queryByText('Привела в сад')).toBeNull();
    await fireEvent.press(screen.getByText('Отменить'));
    expect(onCancel).toHaveBeenCalled();
    expect(onMark).not.toHaveBeenCalled();
  });

  it('keeps the child in the kindergarten while pick-up waits for the employee', async () => {
    const screen = await renderCard({
      ...idle,
      status: 'IN',
      pending: { id: 'm2', status: 'OUT', datetime: at(17, 30) },
    });

    expect(screen.getByText('В саду, ждёт выдачи')).toBeTruthy();
  });

  it('shows who accepted the child', async () => {
    const screen = await renderCard({ ...idle, status: 'IN', decidedBy: 'Петрова О.', decidedAt: at(8, 42) });

    expect(screen.getByText('В саду')).toBeTruthy();
    expect(screen.getByText('принял(а) Петрова О. в 08:42')).toBeTruthy();
    expect(screen.getByText('Забрала из сада')).toBeTruthy();
  });

  it('shows why the kindergarten rejected the mark and lets the parent mark again', async () => {
    const screen = await renderCard({ ...idle, rejected: { status: 'IN', reason: 'Ребёнка нет' } });

    expect(screen.getByText('Сад не подтвердил приход: «Ребёнка нет»')).toBeTruthy();
    expect(screen.getByText('Привела в сад')).toBeTruthy();
  });

  it('builds the labels', () => {
    expect(decidedLabel({ ...idle, decidedBy: 'Петрова О.', decidedAt: at(17, 32) })).toBe('отдал(а) Петрова О. в 17:32');
    expect(decidedLabel(idle)).toBeNull();
    expect(rejectedLabel({ status: 'OUT', reason: null })).toBe('Сад не подтвердил уход');
    expect(commentLabel(false)).toBe('Если ребёнка привели не лично Вы, укажите данные представителя');
    expect(commentLabel(true)).toBe('Если ребёнка забрали не лично Вы, укажите данные представителя');
  });

  it('offers the QR code only where the kindergarten confirms visits and nothing is waiting', async () => {
    const onShowQr = jest.fn();
    const withQr = await renderCard(idle, { onShowQr });
    await fireEvent.press(withQr.getByText('Показать QR-код сотруднику'));
    expect(onShowQr).toHaveBeenCalled();

    const waiting = await renderCard(
      { ...idle, pending: { id: 'm1', status: 'IN', datetime: at(8, 40) } },
      { onShowQr },
    );
    expect(waiting.queryByText('Показать QR-код сотруднику')).toBeNull();

    const withoutQr = await renderCard(idle);
    expect(withoutQr.queryByText('Показать QR-код сотруднику')).toBeNull();
  });
});

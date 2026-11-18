import { decodeAbsenceDay, getNeighboringAbsenceDay } from './absence-day';
import { visitControlApi } from './visit-control-api';

jest.mock('./visit-control-api', () => ({
  ...jest.requireActual('./visit-control-api'),
  visitControlApi: { get: jest.fn() },
}));

const sample = {
  date: [2026, 11, 17],
  working: true,
  deadline_at: [2026, 11, 16, 20, 0],
  total_children: 5,
  absent_children: 1,
  absent_late: 1,
  branches: [{
    external_key: 'north',
    name: 'Северный',
    groups: [{
      external_key: null,
      name: 'Без группы',
      total_children: 5,
      absences: [{
        external_key: 'notice',
        child: { full_name: 'Тестовый ребёнок' },
        from: [2026, 11, 16],
        to: '2026-11-18',
        reason: 'ILLNESS',
        comment: null,
        created_by: { full_name: 'Тестовый родитель' },
        created: '2026-11-16T20:10:00',
        remaining_working_days: 2,
        paid_days: [{ date: [2026, 11, 17], waived: true }],
      }],
    }],
  }],
};

describe('absence day report', () => {
  const get = jest.mocked(visitControlApi.get);
  beforeEach(() => get.mockReset());

  it('normalizes calendar dates and shows garden time and waived payment separately', () => {
    const report = decodeAbsenceDay(sample);
    expect(report.date).toBe('2026-11-17');
    expect(report.deadline).toBe('16.11.2026 в 20:00');
    expect(report.branches[0].groups[0]).toMatchObject({
      name: 'Без группы',
      absences: [{
        from: '2026-11-16',
        to: '2026-11-18',
        reason: 'Болезнь',
        created: '16.11.2026 в 20:10',
        late: true,
        charged: false,
      }],
    });
  });

  it('skips the weekend and checks the holiday with the server before showing the next working day', async () => {
    get.mockResolvedValueOnce({ ...sample, date: [2026, 11, 16], working: false });
    get.mockResolvedValueOnce(sample);
    const signal = new AbortController().signal;

    await expect(getNeighboringAbsenceDay('2026-11-13', 1, signal)).resolves.toMatchObject({ date: '2026-11-17' });

    expect(get.mock.calls).toEqual([
      ['/absence/day', expect.objectContaining({ params: { date: '2026-11-16' }, skipLogging: true, signal })],
      ['/absence/day', expect.objectContaining({ params: { date: '2026-11-17' }, skipLogging: true, signal })],
    ]);
  });
});

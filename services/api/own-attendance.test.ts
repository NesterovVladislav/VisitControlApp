import { getOwnAttendance } from './own-attendance';
import { visitControlApi } from './visit-control-api';

jest.mock('./visit-control-api', () => ({
  ...jest.requireActual('./visit-control-api'),
  visitControlApi: { get: jest.fn() },
}));

const range = { from: '2026-11-16', to: '2026-11-21' };
const report = {
  from: [2026, 11, 16],
  to: range.to,
  days: [16, 17, 18, 19, 20, 21].map((day) => ({
    date: [2026, 11, day], working: day !== 21, future: day === 19,
  })),
  children: [{
    external_key: 'child',
    full_name: 'Ребёнок Примеров',
    groups: [{ name: 'Ромашка', from: [2026, 11, 1], to: null }],
    days: ['NONE', 'FULL', 'NONE', 'NONE', 'NOT_IN_GROUP', 'NONE'],
    absence_reasons: [null, 'FAMILY', 'FAMILY', 'FAMILY', 'FAMILY', 'FAMILY'],
    absence_paid: [true, true, true, false, true, true],
    absence_notices: [{ reason: 'FAMILY', from: [2026, 11, 17], to: '2026-11-20' }],
    full_days: 1,
    half_days: 0,
    absences: 2,
    absences_by_reason: { FAMILY: 1 },
    paid_absences: 1,
    visits: [{ brought_by: 'Данные вне текущего этапа' }],
  }],
};

describe('parent attendance API', () => {
  const get = jest.mocked(visitControlApi.get);
  beforeEach(() => get.mockReset());

  it('uses the authenticated child filter and assigns payment only to the actual absence date', async () => {
    get.mockResolvedValueOnce(report);
    const signal = new AbortController().signal;
    const [child] = await getOwnAttendance(range, 'child', signal);

    expect(get).toHaveBeenCalledWith('/user/me/children/attendance', expect.objectContaining({
      params: { ...range, child: 'child' }, signal, skipLogging: true,
    }));
    expect(child.days.filter((day) => day.paid).map((day) => day.date)).toEqual(['2026-11-18']);
    expect(child.days[3]).toMatchObject({
      future: true, reason: 'FAMILY', paid: false, absencePeriod: { from: '2026-11-17', to: '2026-11-20' },
    });
    expect(child.days[1].absencePeriod).toBeUndefined();
    expect(child.summary).toEqual({
      full: 1, half: 0, absent: 2, paid: 1, reasons: [{ reason: 'FAMILY', count: 1 }],
    });
    expect(child).not.toHaveProperty('visits');
  });

  it('rejects a misaligned response before assigning payment to any date', async () => {
    get.mockResolvedValueOnce({ ...report, days: [...report.days].reverse() });
    await expect(getOwnAttendance(range)).rejects.toThrow('Некорректный табель посещений');
  });

  it('rejects a row for a different child from a filtered request', async () => {
    get.mockResolvedValueOnce(report);
    await expect(getOwnAttendance(range, 'other')).rejects.toThrow('Некорректный табель посещений');
  });
  it('rejects structured data in a holiday label before it can reach the day sheet', async () => {
    get.mockResolvedValueOnce({
      ...report, days: [{ ...report.days[0], holiday: {} }, ...report.days.slice(1)],
    });
    await expect(getOwnAttendance(range)).rejects.toThrow('Некорректный табель посещений');
  });

  it('rejects a malformed absence period in the report', async () => {
    get.mockResolvedValueOnce({
      ...report, children: [{ ...report.children[0], absence_notices: [{ from: '2026-11-21', to: '2026-11-19', reason: 'FAMILY' }] }],
    });
    await expect(getOwnAttendance(range)).rejects.toThrow('Некорректный табель посещений');
  });

});

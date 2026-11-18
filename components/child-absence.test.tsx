import { act, fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import type { AbsenceNotice, AbsenceRules } from '../services/api/absence';
import { getAbsenceRules } from '../services/api/absence';
import ChildAbsence from './child-absence';
import AbsenceSheet from './absence-sheet';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]),
}));
jest.mock('../services/api/absence', () => ({ getAbsenceRules: jest.fn() }));
jest.mock('./absence-sheet', () => ({ __esModule: true, default: jest.fn() }));

const child = { id: 'child', firstName: 'Мария', surname: 'Алексеева', linkRole: 'PARENT' };
const earlier: AbsenceNotice = {
  external_key: 'earlier', from: '2026-11-17', to: '2026-11-17',
  status: 'ACTIVE', reason: 'ILLNESS', editable: true, cancellable: true, return_date: null, paid_days: [],
};
const submitted: AbsenceNotice = {
  ...earlier, external_key: 'submitted', from: '2026-11-23', to: '2026-11-24',
  paid_days: [{ date: '2026-11-23', waived: false }, { date: '2026-11-24', waived: true }],
};
const rules: AbsenceRules = {
  today_date: '2026-11-17', earliest_from: '2026-11-17', max_days: 31,
  can_report: true, deadline_enabled: true, deadline: '20:00', time_zone: 'Asia/Novosibirsk',
  today: null, tomorrow: null, period: null, current: earlier, reasons: [],
};

describe('parent absence card', () => {
  beforeEach(() => {
    jest.mocked(getAbsenceRules).mockResolvedValue(rules);
  });

  it.each(['Сад уведомлён', 'Изменения сохранены', 'Период сокращён'])(
    'shows the saved period and edits that exact record after «%s»',
    async (message) => {
      jest.mocked(AbsenceSheet).mockImplementation(({ onSaved }) => (
        <Pressable accessibilityRole="button" onPress={() => onSaved(submitted, message)}>
          <Text>Сохранить уведомление</Text>
        </Pressable>
      ));
      jest.useFakeTimers();
      try {
        const screen = await render(<ChildAbsence child={child} refresh="initial" />);
        expect(screen.getByText('17.11.2026')).toBeVisible();
        expect(screen.queryByRole('button', { name: /Сообщить о другом периоде/ })).toBeNull();
        await fireEvent.press(screen.getByRole('button', { name: /Изменить 17\.11\.2026/ }));
        await fireEvent.press(screen.getByRole('button', { name: 'Сохранить уведомление' }));

        const submittedRange = '23.11.2026 — 24.11.2026';
        expect(screen.getAllByText(submittedRange)).toHaveLength(1);
        expect(screen.getByLabelText(`${message} · ${submittedRange}`)).toBeVisible();
        expect(screen.getByLabelText('Оплата за 23.11.2026')).toBeVisible();
        expect(screen.queryByLabelText(/Оплата за .*24\.11/)).toBeNull();
        await fireEvent.press(screen.getByRole('button', { name: /Изменить 23\.11\.2026/ }));
        expect(jest.mocked(AbsenceSheet).mock.lastCall?.[0].initialEntry).toEqual(submitted);

        await act(() => { jest.advanceTimersByTime(5000); });
        expect(screen.getByText('17.11.2026')).toBeVisible();
        expect(screen.queryByText(message)).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    },
  );
});

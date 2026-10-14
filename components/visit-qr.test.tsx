import { act, fireEvent, render } from '@testing-library/react-native';

import QrScannerSheet from './qr-scanner-sheet';
import VisitQrSheet from './visit-qr-sheet';
import { visitControlApi } from '../services/api';
import { ApiError } from '../services/errors/api-error';

let mockPermission: { granted: boolean; canAskAgain: boolean } | null = { granted: true, canAskAgain: true };
const mockRequestPermission = jest.fn();
let mockOnScanned: ((event: { data: string }) => void) | undefined;

jest.mock('../services/api', () => ({
  visitControlApi: { issueHandover: jest.fn(), redeemHandover: jest.fn() },
}));
jest.mock('expo-camera', () => ({
  CameraView: (props: { onBarcodeScanned?: (event: { data: string }) => void }) => {
    mockOnScanned = props.onBarcodeScanned;
    return null;
  },
  useCameraPermissions: () => [mockPermission, mockRequestPermission],
}));
jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  notificationAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn(() => Promise.resolve(0.4)),
  setBrightnessAsync: jest.fn(() => Promise.resolve()),
  restoreSystemBrightnessAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('react-native-qrcode-svg', () => {
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ value }: { value: string }) => <Text>{`QR:${value}`}</Text> };
});

const mockApi = visitControlApi as jest.Mocked<typeof visitControlApi>;
const maria = { id: 'c1', firstName: 'Мария', surname: 'Иванова', linkRole: 'PARENT' };
const petr = { id: 'c2', firstName: 'Пётр', surname: 'Иванов', linkRole: 'PARENT' };

describe('child QR code for the kindergarten employee', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function sheet(status: 'IN' | 'OUT', handlers: { onNext?: jest.Mock; onClose?: jest.Mock } = {}) {
    return (
      <VisitQrSheet
        child={maria}
        status={status}
        next={petr}
        onPoll={jest.fn()}
        onNext={handlers.onNext ?? jest.fn()}
        onClose={handlers.onClose ?? jest.fn()}
      />
    );
  }

  it('asks for a comment first and then shows a code of this child only', async () => {
    mockApi.issueHandover.mockResolvedValue({ token: 'vc1:abc', expiresIn: 90 });
    const screen = await render(sheet('OUT'));

    expect(screen.getByText('Мария Иванова')).toBeTruthy();
    expect(screen.getByText('Привожу в сад')).toBeTruthy();
    expect(screen.getByText('Если ребёнка привели не лично Вы, укажите данные представителя')).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText('Необязательно'), 'Привела бабушка');
    await fireEvent.press(screen.getByText('Показать QR-код'));

    expect(mockApi.issueHandover).toHaveBeenCalledWith('c1', 'IN', 'Привела бабушка');
    expect(await screen.findByText('QR:vc1:abc')).toBeTruthy();
    expect(screen.getByText('Код обновится через 1:30')).toBeTruthy();
    expect(screen.getByText('Следующий: Пётр ›')).toBeTruthy();
  });

  it('asks for a pick-up code when the child is in the kindergarten', async () => {
    mockApi.issueHandover.mockResolvedValue({ token: 'vc1:out', expiresIn: 90 });
    const screen = await render(sheet('IN'));

    expect(screen.getByText('Забираю из сада')).toBeTruthy();
    await fireEvent.press(screen.getByText('Показать QR-код'));

    expect(mockApi.issueHandover).toHaveBeenCalledWith('c1', 'OUT', '');
  });

  it('reports that the employee scanned the code and offers the next child', async () => {
    mockApi.issueHandover.mockResolvedValue({ token: 'vc1:abc', expiresIn: 90 });
    const onNext = jest.fn();
    const screen = await render(sheet('OUT', { onNext }));
    await fireEvent.press(screen.getByText('Показать QR-код'));
    await screen.findByText('QR:vc1:abc');

    // Сотрудник отсканировал: статус ребёнка в сторе сменился
    await screen.rerender(sheet('IN', { onNext }));

    expect(await screen.findByText('Сад принял ребёнка')).toBeTruthy();
    expect(screen.queryByText('QR:vc1:abc')).toBeNull();
    await fireEvent.press(screen.getByText('Следующий: Пётр ›'));
    expect(onNext).toHaveBeenCalledWith(petr);
  });

  it('explains why the code was not issued and keeps the comment', async () => {
    mockApi.issueHandover.mockRejectedValue(new ApiError('conflict', 409, '', { code: 'VISIT_ALREADY_PENDING' }));
    const screen = await render(sheet('OUT'));
    await fireEvent.changeText(screen.getByPlaceholderText('Необязательно'), 'Привела бабушка');
    await fireEvent.press(screen.getByText('Показать QR-код'));

    expect(await screen.findByText('Отметка уже ждёт подтверждения сада')).toBeTruthy();
    expect(screen.getByDisplayValue('Привела бабушка')).toBeTruthy();
  });
});

describe('QR scanner of the kindergarten employee', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermission = { granted: true, canAskAgain: true };
    mockOnScanned = undefined;
  });

  async function scan(data: string) {
    await act(async () => {
      mockOnScanned?.({ data });
    });
  }

  it('accepts the child with one scan and ignores repeated frames of the same code', async () => {
    mockApi.redeemHandover.mockResolvedValue({
      status: 'IN',
      childName: 'Мария Иванова',
      representativeName: 'Иванова А.',
      linkRole: 'PARENT',
      groupName: 'Солнышко',
    });
    const onScanned = jest.fn();
    const screen = await render(<QrScannerSheet visible onScanned={onScanned} onClose={jest.fn()} />);

    await scan('vc1:abc');
    await scan('vc1:abc');

    expect(mockApi.redeemHandover).toHaveBeenCalledTimes(1);
    expect(mockApi.redeemHandover).toHaveBeenCalledWith('vc1:abc');
    expect(await screen.findByText('Принято: Мария Иванова')).toBeTruthy();
    expect(screen.getByText('Солнышко · привёл(а) Иванова А. (родитель)')).toBeTruthy();
    expect(onScanned).toHaveBeenCalledTimes(1);
  });

  it('does not send a foreign QR code to the server', async () => {
    const screen = await render(<QrScannerSheet visible onScanned={jest.fn()} onClose={jest.fn()} />);

    await scan('https://example.com');

    expect(mockApi.redeemHandover).not.toHaveBeenCalled();
    expect(await screen.findByText(/Это не код Visit Control/)).toBeTruthy();
  });

  it('explains an expired code and lets the employee scan again', async () => {
    mockApi.redeemHandover.mockRejectedValue(new ApiError('gone', 410, '', { code: 'HANDOVER_TOKEN_EXPIRED' }));
    const onScanned = jest.fn();
    const screen = await render(<QrScannerSheet visible onScanned={onScanned} onClose={jest.fn()} />);

    await scan('vc1:old');

    expect(await screen.findByText('Код устарел — попросите родителя обновить его')).toBeTruthy();
    expect(onScanned).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Сканировать ещё раз'));
    expect(screen.getByText('Наведите камеру на QR-код на телефоне родителя')).toBeTruthy();
  });

  it('asks for the camera and falls back to the settings when access was refused', async () => {
    mockPermission = { granted: false, canAskAgain: true };
    const screen = await render(<QrScannerSheet visible onScanned={jest.fn()} onClose={jest.fn()} />);

    await fireEvent.press(screen.getByText('Разрешить камеру'));
    expect(mockRequestPermission).toHaveBeenCalled();

    mockPermission = { granted: false, canAskAgain: false };
    await screen.rerender(<QrScannerSheet visible onScanned={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Открыть настройки')).toBeTruthy();
    expect(screen.getByText(/можно принимать и отдавать кнопками/)).toBeTruthy();
  });
});

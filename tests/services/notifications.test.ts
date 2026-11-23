import { notifyPlanUpdated, requestNotificationPermission } from '../../src/services/notifications';
import { Platform } from 'react-native';

const mockGetPermissions = jest.fn(async () => ({ granted: true, canAskAgain: true }));
const mockRequestPermissions = jest.fn(async () => ({ granted: true, canAskAgain: true }));
const mockSchedule = jest.fn(async (_notification: unknown) => 'notification-1');
const mockChannel = jest.fn(async (_id: string, _options: unknown) => {});
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockGetPermissions(),
  requestPermissionsAsync: () => mockRequestPermissions(),
  scheduleNotificationAsync: (notification: unknown) => mockSchedule(notification),
  setNotificationChannelAsync: (id: string, options: unknown) => mockChannel(id, options),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
}));

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.clearAllMocks();
  mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
  mockRequestPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
  mockSchedule.mockResolvedValue('notification-1');
});
afterEach(() => jest.restoreAllMocks());

it('uses an existing system permission without prompting again', async () => {
  expect(await requestNotificationPermission()).toBe(true);
  expect(mockRequestPermissions).not.toHaveBeenCalled();
});

it('requests system consent when the first plan update needs a notification', async () => {
  mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
  expect(await notifyPlanUpdated('Tuesday now uses curry.')).toBe(true);
  expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
  expect(mockChannel).toHaveBeenCalledWith('plan-updates', { name: 'Plan updates', importance: 3 });
  expect(mockSchedule).toHaveBeenCalledWith({
    content: { title: 'Banana updated your plan', body: 'Tuesday now uses curry.', sound: false }, trigger: null,
  });
});

it('does not have an in-app opt-out for plan-update notifications', async () => {
  expect(await notifyPlanUpdated('Plan updated.')).toBe(true);
  expect(mockSchedule).toHaveBeenCalledTimes(1);
});

it('respects denied OS permission without attempting to deliver a notification', async () => {
  mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
  mockRequestPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
  expect(await notifyPlanUpdated('Plan updated.')).toBe(false);
  expect(mockSchedule).not.toHaveBeenCalled();
  expect(mockChannel).not.toHaveBeenCalled();
});

it('does not repeatedly prompt when Android has blocked permission requests', async () => {
  mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
  expect(await notifyPlanUpdated('Plan updated.')).toBe(false);
  expect(mockRequestPermissions).not.toHaveBeenCalled();
  expect(mockSchedule).not.toHaveBeenCalled();
});

it('keeps permission and delivery failures from failing the completed plan action', async () => {
  mockGetPermissions.mockRejectedValueOnce(new Error('Permission API unavailable'));
  expect(await notifyPlanUpdated('Plan updated.')).toBe(false);
  mockSchedule.mockRejectedValueOnce(new Error('Delivery unavailable'));
  expect(await notifyPlanUpdated('Plan updated.')).toBe(false);
});

it('does not create an Android channel on other native platforms', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  expect(await notifyPlanUpdated('Plan updated.')).toBe(true);
  expect(mockChannel).not.toHaveBeenCalled();
  expect(mockSchedule).toHaveBeenCalledTimes(1);
});


import { registerPlugin, Capacitor } from '@capacitor/core';

export interface RingtonePickerPlugin {
  openPicker(): Promise<{
    cancelled?: boolean;
    uri?: string;
    title?: string;
  }>;

  getSelectedRingtone(): Promise<{
    uri?: string | null;
    title?: string;
  }>;

  playSelectedRingtone(): Promise<{
    success?: boolean;
  }>;

  stopRingtone(): Promise<{
    success?: boolean;
  }>;
}

export const RingtonePicker =
  registerPlugin<RingtonePickerPlugin>('RingtonePicker');

export const isNativeRingtonePickerAvailable = (): boolean => {
  return Capacitor.isNativePlatform();
};

export async function playIncomingRingtone(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await RingtonePicker.playSelectedRingtone();
  } catch (error) {
    console.warn('ChatNova: Unable to play incoming ringtone', error);
  }
}

export async function stopIncomingRingtone(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await RingtonePicker.stopRingtone();
  } catch (error) {
    console.warn('ChatNova: Unable to stop incoming ringtone', error);
  }
}

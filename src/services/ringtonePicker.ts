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
}

export const RingtonePicker = registerPlugin<RingtonePickerPlugin>(
  'RingtonePicker'
);

export const isNativeRingtonePickerAvailable = (): boolean => {
  return Capacitor.isNativePlatform();
};

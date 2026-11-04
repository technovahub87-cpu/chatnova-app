import { Capacitor } from '@capacitor/core';
import { AudioToggle } from '@anuradev/capacitor-audio-toggle';

/**
 * Native Android call audio routing.
 * speakerOn = true  -> Loudspeaker
 * speakerOn = false -> Earpiece
 */

export async function setNativeCallSpeaker(
  speakerOn: boolean
): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') {
    return false;
  }

  try {
    const result = await AudioToggle.setSpeakerOn({ speakerOn });
    return result.status === speakerOn;
  } catch (error) {
    console.warn('[ChatNova Audio] Could not change audio route:', error);
    return false;
  }
}

export async function resetNativeCallAudio(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') {
    return;
  }

  try {
    await AudioToggle.reset();
  } catch (error) {
    console.warn('[ChatNova Audio] Could not reset audio route:', error);
  }
}

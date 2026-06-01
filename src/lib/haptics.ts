import { Haptics, ImpactStyle } from '@capacitor/haptics';

/** Trigger success haptic vibration pattern */
export async function triggerHapticSuccess() {
  try {
    // Web API Fallback
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 40, 40]);
    }
    // Capacitor Haptics
    await Haptics.vibrate({ duration: 80 });
  } catch {
    // Fail silently if unsupported
  }
}

/** Trigger light tick haptic vibration pattern */
export async function triggerHapticLight() {
  try {
    // Web API Fallback
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
    // Capacitor Haptics
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Fail silently if unsupported
  }
}

/** Trigger warning/error haptic vibration pattern */
export async function triggerHapticWarning() {
  try {
    // Web API Fallback
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    // Capacitor Haptics
    await Haptics.vibrate({ duration: 150 });
  } catch {
    // Fail silently if unsupported
  }
}

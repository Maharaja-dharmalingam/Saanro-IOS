import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '../lib/supabase';

/**
 * Registers the device for push notifications and stores the token on the
 * user's profile. On platforms where push is unavailable (web, simulator)
 * this silently no-ops so the rest of the app is unaffected.
 *
 * NOTE: actual OS delivery requires:
 *   - iOS: an Apple Push key configured in Supabase + a real (signed) device
 *   - Android: a Firebase project with google-services.json + FCM
 * Those credentials live outside this repo and must be provided at build time.
 */
export async function initPushNotifications(userId: string) {
  // Without Firebase config on Android, the plugin crashes on register().
  // Skip silently until google-services.json / FCM is added.
  const platform = Capacitor.getPlatform();
  if (platform === 'android') {
    console.info('[Push] Android Firebase not configured; skipping native push init.');
    return;
  }

  try {
    if (!('PushNotifications' in window || (window as any).Capacitor?.isNativePlatform?.())) {
      // Not a native shell — skip (e.g. local web dev, simulators without push).
      return;
    }
  } catch {
    return;
  }

  try {
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') {
      const req = await PushNotifications.requestPermissions();
      if (req.receive !== 'granted') return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token: { value: string }) => {
      await supabase
        .from('profiles')
        .update({ device_token: token.value })
        .eq('id', userId);
    });

    PushNotifications.addListener('registrationError', (err: any) => {
      console.warn('Push registration failed', err);
    });
  } catch (e) {
    console.warn('Push init skipped', e);
  }
}

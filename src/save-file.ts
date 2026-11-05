import { detectPlatform } from './platform';
import { h } from './ui/dom';

/**
 * Saves a file the player made (a photo, a clip, a backup). Browsers and the desktop app download it. The
 * Android app's WebView ignores `<a download>`, so there the file is written to the app's cache and the
 * system share sheet opens, where the player picks "Save to Files", Drive, Photos, a chat, and so on.
 */
export async function saveBlob(blob: Blob, name: string): Promise<void> {
  if (isAndroidApp()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const { uri } = await Filesystem.writeFile({ path: name, data: await toBase64(blob), directory: Directory.Cache });
    try {
      await Share.share({ title: name, dialogTitle: 'Save or share', url: uri });
    } catch {
      /* the player closed the share sheet */
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

/** True inside the Capacitor Android app, where downloads need the native path above. */
export function isAndroidApp(): boolean {
  const p = detectPlatform();
  return p.native && p.os === 'android';
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

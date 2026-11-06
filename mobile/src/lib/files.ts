// Native stand-ins for the HTML planner's downloads, print and file picker:
// files are written to the cache and handed to the system share sheet
// (save to Files, send to a laptop, open in Calendar or Excel).
import { Asset } from 'expo-asset';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

function webDownload(name: string, data: BlobPart, mime: string) {
  const blob = new Blob([data], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1500);
}

/** Writes text to a file and opens the share sheet for it. */
export async function shareText(name: string, text: string, mime: string, uti?: string) {
  if (Platform.OS === 'web') return webDownload(name, text, mime);
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: mime, UTI: uti, dialogTitle: name });
}

/** Shares a file bundled with the app (the Excel trackers). */
export async function shareAsset(moduleId: number, name: string, mime: string) {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = uri;
    a.download = name;
    a.click();
    return;
  }
  // Give the copy its real name so it saves as e.g. BRACU-CSE-Planner_Tracker.xlsx.
  const named = new File(Paths.cache, name);
  if (named.exists) named.delete();
  new File(uri).copy(named);
  await Sharing.shareAsync(named.uri, { mimeType: mime, dialogTitle: name });
}

export async function printHtml(html: string) {
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    return;
  }
  await Print.printAsync({ html });
}

/** Lets the user pick a JSON file; returns its text, or null if they cancelled. */
export async function pickJsonText(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  if (Platform.OS === 'web' && a.file) return a.file.text();
  return new File(a.uri).text();
}

export const MIME = {
  csv: 'text/csv',
  ics: 'text/calendar',
  json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

import * as Linking from "expo-linking";

const tapUrls = new Map<string, string>();
let listening = false;

export async function openOnTap(source: string, url: string | undefined) {
  if (url) tapUrls.set(source, url);
  else tapUrls.delete(source);
  if (listening) return;
  listening = true;
  const { addUserInteractionListener } = await import("expo-widgets");
  addUserInteractionListener((event) => {
    const tapUrl = tapUrls.get(event.source);
    if (tapUrl) void Linking.openURL(tapUrl);
  });
}

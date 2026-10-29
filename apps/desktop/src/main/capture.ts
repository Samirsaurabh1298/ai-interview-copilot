import { desktopCapturer, type DesktopCapturerSource } from "electron";

export interface SerializableSource {
  id: string;
  name: string;
  thumbnailUrl: string;
  displayId?: string | undefined;
  appIconUrl?: string | undefined;
}

export async function getCaptureSources(): Promise<SerializableSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  });

  return sources.map((source: DesktopCapturerSource) => ({
    id: source.id,
    name: source.name,
    thumbnailUrl: source.thumbnail.toDataURL(),
    displayId: source.display_id,
    appIconUrl: source.appIcon ? source.appIcon.toDataURL() : undefined,
  }));
}

export async function captureSourceImage(sourceId: string): Promise<string> {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 1920, height: 1080 },
  });

  const target = sources.find((s) => s.id === sourceId);
  if (!target) {
    throw new Error(`Target capture source '${sourceId}' not found.`);
  }

  return target.thumbnail.toDataURL();
}


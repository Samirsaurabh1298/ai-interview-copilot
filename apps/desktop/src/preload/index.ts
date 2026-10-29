import { contextBridge, ipcRenderer } from "electron";
import type { SerializableSource } from "../main/capture.js";

export interface ElectronAPI {
  getSources: () => Promise<SerializableSource[]>;
  captureSourceImage: (sourceId: string) => Promise<string>;
}

const api: ElectronAPI = {
  getSources: () => ipcRenderer.invoke("capture:get-sources"),
  captureSourceImage: (sourceId: string) => ipcRenderer.invoke("capture:source-image", sourceId),
};

contextBridge.exposeInMainWorld("electronAPI", api);


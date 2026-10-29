import React, { useState, useEffect } from "react";
import { X, Monitor, Upload, FileText, Check, Loader2 } from "lucide-react";
import type { SerializableSource } from "../../main/capture.js";

interface CaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureCompleted: (data: {
    imageBase64?: string;
    pastedText?: string;
  }) => void;
}

export const CaptureModal: React.FC<CaptureModalProps> = ({
  isOpen,
  onClose,
  onCaptureCompleted,
}) => {
  const [activeTab, setActiveTab] = useState<"screen" | "paste" | "upload">("screen");
  const [sources, setSources] = useState<SerializableSource[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [pastedQuestion, setPastedQuestion] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === "screen") {
      loadSources();
    }
  }, [isOpen, activeTab]);

  const loadSources = async () => {
    if (!window.electronAPI) {
      console.warn("Electron API unavailable. Running in browser preview mode.");
      return;
    }
    setIsLoadingSources(true);
    try {
      const items = await window.electronAPI.getSources();
      setSources(items);
      if (items.length > 0 && items[0]) {
        setSelectedSourceId(items[0].id);
      }
    } catch (err) {
      console.error("Failed to load screen sources", err);
    } finally {
      setIsLoadingSources(false);
    }
  };

  const handleCaptureSelectedSource = async () => {
    if (!selectedSourceId || !window.electronAPI) return;
    setIsProcessing(true);
    try {
      const highResData = await window.electronAPI.captureSourceImage(selectedSourceId);
      setCapturedImage(highResData);
    } catch (err) {
      console.error("Failed to capture image", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCapturedImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmAndProceed = () => {
    if (activeTab === "paste") {
      if (!pastedQuestion.trim()) return;
      onCaptureCompleted({ pastedText: pastedQuestion });
    } else {
      if (!capturedImage) return;
      onCaptureCompleted({ imageBase64: capturedImage });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-3xl rounded-xl border border-gray-800 bg-[#111827] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <div>
            <h2 id="modal-title" className="text-base font-semibold text-white">
              Capture or Input Problem Context
            </h2>
            <p className="text-xs text-gray-400">
              Only authorized selected content is processed. No background recording.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 px-6 bg-[#0d131f]">
          <button
            onClick={() => {
              setActiveTab("screen");
              setCapturedImage(null);
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "screen"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Screen / Window Capture</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("paste");
              setCapturedImage(null);
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "paste"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Paste Question Text</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("upload");
              setCapturedImage(null);
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "upload"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Image</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === "screen" && (
            <div>
              {!capturedImage ? (
                <>
                  <p className="text-xs text-gray-400 mb-3">
                    Choose a display or application window to capture:
                  </p>
                  {isLoadingSources ? (
                    <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mb-2" />
                      <span className="text-sm">Detecting screen sources...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {sources.map((src) => (
                        <div
                          key={src.id}
                          onClick={() => setSelectedSourceId(src.id)}
                          className={`group cursor-pointer rounded-lg border p-2 transition-all ${
                            selectedSourceId === src.id
                              ? "border-indigo-500 bg-indigo-950/20 ring-1 ring-indigo-500"
                              : "border-gray-800 bg-gray-900/50 hover:border-gray-700"
                          }`}
                        >
                          <div className="aspect-video w-full rounded bg-gray-950 overflow-hidden mb-2 border border-gray-800">
                            <img
                              src={src.thumbnailUrl}
                              alt={src.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-xs font-medium text-gray-300 truncate" title={src.name}>
                            {src.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> Screenshot Captured Successfully
                    </span>
                    <button
                      onClick={() => setCapturedImage(null)}
                      className="text-xs text-indigo-400 hover:underline"
                    >
                      Re-take capture
                    </button>
                  </div>
                  <div className="max-h-80 overflow-hidden rounded-lg border border-gray-800 bg-black flex items-center justify-center">
                    <img
                      src={capturedImage}
                      alt="Captured Preview"
                      className="max-h-80 w-auto object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "paste" && (
            <div className="space-y-2">
              <label htmlFor="pasted-text" className="block text-xs font-medium text-gray-300">
                Question, problem statement, or error log:
              </label>
              <textarea
                id="pasted-text"
                rows={10}
                value={pastedQuestion}
                onChange={(e) => setPastedQuestion(e.target.value)}
                placeholder="Paste code snippet, LeetCode question, stack trace, or instructions here..."
                className="w-full rounded-lg border border-gray-800 bg-gray-900/80 p-3 font-mono text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          {activeTab === "upload" && (
            <div className="space-y-3">
              {!capturedImage ? (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-800 rounded-lg p-10 cursor-pointer hover:border-indigo-500/50 hover:bg-gray-900/50 transition-colors">
                  <Upload className="w-8 h-8 text-indigo-400 mb-2" />
                  <span className="text-sm font-medium text-gray-300">
                    Click to select screenshot or image
                  </span>
                  <span className="text-xs text-gray-500 mt-1">PNG, JPG, WebP supported</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-400 font-medium">Image Loaded</span>
                    <button
                      onClick={() => setCapturedImage(null)}
                      className="text-xs text-indigo-400 hover:underline"
                    >
                      Select another image
                    </button>
                  </div>
                  <div className="max-h-80 overflow-hidden rounded-lg border border-gray-800 bg-black flex items-center justify-center">
                    <img
                      src={capturedImage}
                      alt="Uploaded image"
                      className="max-h-80 w-auto object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-gray-800 px-6 py-4 bg-[#0d131f]">
          <span className="text-xs text-gray-500">
            Preview and edit is always presented before cloud AI submission.
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            {activeTab === "screen" && !capturedImage ? (
              <button
                onClick={handleCaptureSelectedSource}
                disabled={!selectedSourceId || isProcessing}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Capture Snapshot</span>
              </button>
            ) : (
              <button
                onClick={handleConfirmAndProceed}
                disabled={
                  (activeTab === "paste" && !pastedQuestion.trim()) ||
                  (activeTab !== "paste" && !capturedImage)
                }
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <span>Proceed to Review</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


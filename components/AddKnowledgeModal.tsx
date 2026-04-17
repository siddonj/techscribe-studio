"use client";

import { useRef, useState } from "react";

export type ResearchItemType = "url" | "text" | "file";

export interface ResearchItem {
  id: string;
  type: ResearchItemType;
  label: string;
  content: string;
}

interface AddKnowledgeModalProps {
  onClose: () => void;
  onAdd: (item: ResearchItem) => void;
}

type Tab = "url" | "upload" | "text";

export default function AddKnowledgeModal({ onClose, onAdd }: AddKnowledgeModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("url");
  const [urlValue, setUrlValue] = useState("");
  const [textValue, setTextValue] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileError("");

    const isTextBased =
      file.type.startsWith("text/") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".csv");

    const reader = new FileReader();
    reader.onerror = () => setFileError("Failed to read file.");

    if (isTextBased) {
      reader.onload = (ev) => setFileContent(ev.target?.result as string);
      reader.readAsText(file);
    } else {
      // For non-text files (e.g. PDF) record metadata only — actual content
      // cannot be extracted client-side without a parser library.
      setFileContent(`[File: ${file.name} — binary format, content not extracted. Reference this file by name when generating.]`);
    }
  };

  const canAdd =
    (activeTab === "url" && urlValue.trim().length > 0) ||
    (activeTab === "upload" && fileName.length > 0 && fileContent.length > 0) ||
    (activeTab === "text" && textValue.trim().length > 0);

  const handleAdd = () => {
    if (!canAdd) return;

    const id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    if (activeTab === "url") {
      onAdd({ id, type: "url", label: urlValue.trim(), content: urlValue.trim() });
    } else if (activeTab === "upload") {
      onAdd({ id, type: "file", label: fileName, content: fileContent });
    } else {
      const preview = textValue.trim().slice(0, 60) + (textValue.trim().length > 60 ? "…" : "");
      onAdd({ id, type: "text", label: preview, content: textValue.trim() });
    }

    onClose();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "url", label: "URL" },
    { id: "upload", label: "Upload" },
    { id: "text", label: "Text" },
  ];

  const inputBase =
    "w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60 transition-colors";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#0f1018] border border-border rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-white font-semibold text-base">Add Knowledge Source</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-white transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-mono border transition-colors ${
                activeTab === tab.id
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-muted hover:text-white hover:border-white/20"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-6 py-5 min-h-[180px]">
          {activeTab === "url" && (
            <>
              <p className="text-muted text-sm mb-4">
                Extract knowledge from a URL to a webpage, blog post, YouTube video, image, spreadsheet, or PDF document.
              </p>
              <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
                Knowledge Source URL
              </label>
              <input
                type="url"
                className={inputBase}
                placeholder="example.com/my-article"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && canAdd) handleAdd(); }}
                autoFocus
              />
            </>
          )}

          {activeTab === "upload" && (
            <>
              <p className="text-muted text-sm mb-4">
                Upload a file to use as a research source. Supported formats: <span className="text-white/70">.txt, .md, .csv, .pdf</span>
              </p>
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-accent/40 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".txt,.md,.csv,.pdf"
                  onChange={handleFileChange}
                />
                {fileName ? (
                  <div>
                    <p className="text-white text-sm font-medium">{fileName}</p>
                    <p className="text-muted text-xs mt-1">Click to change file</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-muted text-sm">Click to select a file</p>
                    <p className="text-muted text-xs mt-1">.txt · .md · .csv · .pdf</p>
                  </div>
                )}
              </div>
              {fileError && <p className="text-red-400 text-xs mt-2">{fileError}</p>}
            </>
          )}

          {activeTab === "text" && (
            <>
              <p className="text-muted text-sm mb-4">
                Paste or type research notes, quotes, or any relevant context directly.
              </p>
              <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
                Knowledge Text
              </label>
              <textarea
                className={`${inputBase} resize-none`}
                rows={6}
                placeholder="Paste your research, notes, or any relevant text here…"
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                autoFocus
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted border border-border rounded-lg hover:text-white hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="px-4 py-2 text-sm font-semibold bg-accent text-bg rounded-lg hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Knowledge
          </button>
        </div>
      </div>
    </div>
  );
}

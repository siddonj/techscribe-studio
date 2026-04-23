"use client";

import { useCallback, useState } from "react";

export interface KnowledgeEntry {
  id: string;
  title: string;
  type: "text" | "url";
  content: string;
  createdAt: string;
}

const STORAGE_KEY = "techscribe_knowledge_base";

function load(): KnowledgeEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(entries: KnowledgeEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

export function useKnowledgeBase() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>(load);

  const addEntry = useCallback((entry: Omit<KnowledgeEntry, "id" | "createdAt">) => {
    const newEntry: KnowledgeEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setEntries((prev) => {
      const next = [newEntry, ...prev];
      save(next);
      return next;
    });
    return newEntry;
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      save(next);
      return next;
    });
  }, []);

  return { entries, addEntry, removeEntry };
}

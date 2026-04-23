"use client";

import { useCallback, useState } from "react";

export interface ToneConfig {
  preset: string;
  formality: number;
  sentenceLength: number;
  voiceType: number;
  customInstructions: string;
}

export const DEFAULT_TONE: ToneConfig = {
  preset: "conversational",
  formality: 2,
  sentenceLength: 1,
  voiceType: 0,
  customInstructions: "",
};

const FORMALITY_LABELS = ["Very Formal", "Formal", "Neutral", "Casual", "Very Casual"];
const SENTENCE_LABELS = ["Short & Punchy", "Balanced", "Long & Detailed"];
const VOICE_LABELS = ["Active", "Passive", "Mixed"];
const PRESET_DESCRIPTIONS: Record<string, string> = {
  professional: "Clear, authoritative, and polished.",
  conversational: "Warm, approachable, and easy to read.",
  educational: "Structured and informative.",
  persuasive: "Compelling and action-oriented.",
  storytelling: "Narrative-driven and engaging.",
};

const STORAGE_KEY = "techscribe_my_tone";

export function buildToneInstruction(config: ToneConfig): string {
  const parts: string[] = [
    `Tone/style: ${config.preset} — ${PRESET_DESCRIPTIONS[config.preset] ?? ""}`,
    `Formality: ${FORMALITY_LABELS[config.formality] ?? "Neutral"}`,
    `Sentence length: ${SENTENCE_LABELS[config.sentenceLength] ?? "Balanced"}`,
    `Voice: ${VOICE_LABELS[config.voiceType] ?? "Active"}`,
  ];
  if (config.customInstructions.trim()) {
    parts.push(`Additional instructions: ${config.customInstructions.trim()}`);
  }
  return `\n\nApply these tone and style preferences throughout:\n${parts.map((p) => `- ${p}`).join("\n")}`;
}

export function loadToneConfig(): ToneConfig {
  if (typeof window === "undefined") return DEFAULT_TONE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_TONE, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_TONE;
}

export function useMyTone() {
  const [config, setConfig] = useState<ToneConfig>(loadToneConfig);

  const save = useCallback((next: ToneConfig) => {
    setConfig(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  return { config, save, loaded: true };
}

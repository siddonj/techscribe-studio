"use client";

import { useEffect, useState } from "react";
import { Mic2, Save } from "lucide-react";
import { PageHeader, SectionCard, SurfaceNotice } from "@/components/DashboardPrimitives";
import { useMyTone, type ToneConfig } from "@/lib/use-my-tone";
import { useToast } from "@/components/Toast";

const TONE_PRESETS = [
  { id: "professional", label: "Professional", description: "Clear, authoritative, and polished. Ideal for business and technical content." },
  { id: "conversational", label: "Conversational", description: "Warm, approachable, and easy to read. Great for blogs and social content." },
  { id: "educational", label: "Educational", description: "Structured and informative. Guides readers step-by-step through concepts." },
  { id: "persuasive", label: "Persuasive", description: "Compelling and action-oriented. Built for marketing copy and CTAs." },
  { id: "storytelling", label: "Storytelling", description: "Narrative-driven and engaging. Keeps readers hooked from intro to conclusion." },
];

const FORMALITY_LEVELS = ["Very Formal", "Formal", "Neutral", "Casual", "Very Casual"];
const SENTENCE_LENGTHS = ["Short & Punchy", "Balanced", "Long & Detailed"];
const VOICE_TYPES = ["Active", "Passive", "Mixed"];

export default function MyTonePage() {
  const { config, save, loaded } = useMyTone();
  const { toast } = useToast();

  const [selectedPreset, setSelectedPreset] = useState(config.preset);
  const [formality, setFormality] = useState(config.formality);
  const [sentenceLength, setSentenceLength] = useState(config.sentenceLength);
  const [voiceType, setVoiceType] = useState(config.voiceType);
  const [customInstructions, setCustomInstructions] = useState(config.customInstructions);

  // Sync local state once localStorage has loaded
  useEffect(() => {
    if (loaded) {
      setSelectedPreset(config.preset);
      setFormality(config.formality);
      setSentenceLength(config.sentenceLength);
      setVoiceType(config.voiceType);
      setCustomInstructions(config.customInstructions);
    }
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    const next: ToneConfig = { preset: selectedPreset, formality, sentenceLength, voiceType, customInstructions };
    save(next);
    toast("Tone settings saved — applied to all future generations");
  };

  const inputClassName =
    "shell-input w-full rounded-2xl px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors";

  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-5 md:p-8 max-w-5xl w-full mx-auto space-y-6">
        <PageHeader
          eyebrow="Customization"
          title="MyTone"
          description="Define your writing voice so every piece of generated content sounds authentically like you. Set your tone, formality, and style preferences once and apply them across all tools."
          backHref="/"
          backLabel="Back to dashboard"
          icon={<Mic2 className="h-8 w-8 text-accent" />}
        />

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-6">
            <SectionCard className="space-y-5">
              <div>
                <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-1">Tone Preset</p>
                <p className="text-sm text-slate-400">Choose a starting point for your writing style.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {TONE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset.id)}
                    className={`text-left rounded-2xl border p-4 transition-colors ${
                      selectedPreset === preset.id
                        ? "border-accent bg-accent/10 text-white"
                        : "border-white/10 text-slate-300 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <p className="font-medium text-sm">{preset.label}</p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{preset.description}</p>
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard className="space-y-5">
              <p className="font-mono text-xs text-slate-500 uppercase tracking-wider">Style Settings</p>

              <div>
                <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">
                  Formality — {FORMALITY_LEVELS[formality]}
                </label>
                <input
                  type="range"
                  min={0}
                  max={4}
                  value={formality}
                  onChange={(e) => setFormality(Number(e.target.value))}
                  className="w-full accent-teal-400"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>Very Formal</span>
                  <span>Very Casual</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
                  Sentence Length
                </label>
                <div className="flex gap-2">
                  {SENTENCE_LENGTHS.map((opt, i) => (
                    <button
                      key={opt}
                      onClick={() => setSentenceLength(i)}
                      className={`flex-1 rounded-xl border py-2 text-xs font-medium transition-colors ${
                        sentenceLength === i
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
                  Voice
                </label>
                <div className="flex gap-2">
                  {VOICE_TYPES.map((opt, i) => (
                    <button
                      key={opt}
                      onClick={() => setVoiceType(i)}
                      className={`flex-1 rounded-xl border py-2 text-xs font-medium transition-colors ${
                        voiceType === i
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard className="space-y-4">
              <div>
                <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-1">Custom Instructions</p>
                <p className="text-sm text-slate-400">Add any specific guidance that should always apply to your content.</p>
              </div>
              <textarea
                className={`${inputClassName} resize-none`}
                value={customInstructions}
                placeholder="e.g. Always use Oxford commas. Avoid jargon. Reference data with sources..."
                rows={4}
                onChange={(e) => setCustomInstructions(e.target.value)}
              />
            </SectionCard>

            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 bg-accent text-white font-semibold px-5 py-3 rounded-2xl text-sm hover:bg-accent-dim transition-colors"
            >
              <Save className="h-4 w-4" />
              Save Tone Settings
            </button>
          </div>

          <div className="space-y-4">
            <SectionCard className="space-y-4 h-fit">
              <p className="font-mono text-xs text-slate-500 uppercase tracking-wider">Current Profile</p>
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1">Preset</p>
                  <p className="text-slate-900 text-sm capitalize">{selectedPreset}</p>
                </div>
                <div>
                  <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1">Formality</p>
                  <p className="text-slate-900 text-sm">{FORMALITY_LEVELS[formality]}</p>
                </div>
                <div>
                  <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1">Sentence Length</p>
                  <p className="text-slate-900 text-sm">{SENTENCE_LENGTHS[sentenceLength]}</p>
                </div>
                <div>
                  <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1">Voice</p>
                  <p className="text-slate-900 text-sm">{VOICE_TYPES[voiceType]}</p>
                </div>
                {customInstructions && (
                  <div>
                    <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1">Custom Instructions</p>
                    <p className="text-slate-900 text-sm leading-relaxed line-clamp-4">{customInstructions}</p>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard className="space-y-3 h-fit">
              <p className="font-mono text-xs text-slate-500 uppercase tracking-wider">How it works</p>
              <div className="space-y-2 text-sm text-slate-500">
                <p>Your tone profile is injected into every generation automatically — no need to set it per-tool.</p>
                <p>Custom instructions are appended to the system prompt for every request.</p>
                <p>Settings are stored in your browser and travel with you across sessions.</p>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}

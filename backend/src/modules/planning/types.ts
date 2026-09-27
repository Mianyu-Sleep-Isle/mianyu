export type InputMode = 'choices' | 'sentence';
export type Mood = 'calm' | 'annoyed' | 'tired';
export type VoicePreference = 'wanted' | 'either' | 'avoid';
export type PlanType = 'soundscape' | 'story' | 'breath' | 'mix';
export type PlanStatus = 'draft' | 'confirmed' | 'started' | 'completed' | 'cancelled';
export type ContentKind = 'audio' | 'story' | 'breath';
export type LoopMode = 'once' | 'loop';
export type AgeMode = 'adult' | 'child';

export interface ComposePlanRequest {
  inputMode: InputMode;
  mood: Mood;
  voicePreference: VoicePreference;
  avoidTags: string[];
  durationSec: number;
  selectedContentIds: string[];
  freeText?: string | null | undefined;
}

export interface StructuredIntent {
  inputMode: InputMode;
  mood: Mood;
  voicePreference: VoicePreference;
  avoidTags: string[];
  durationSec: number;
  selectedContentIds: string[];
}

export interface ContentCandidate {
  contentId: string;
  contentKind: ContentKind;
  tags: string[];
  ageMode: AgeMode | 'all';
  hasVoice: boolean;
  reviewStatus: 'approved' | 'pending_review' | 'rejected' | 'disabled';
  copyrightStatus: 'owned' | 'licensed' | 'public_domain' | 'pending_review' | 'restricted' | 'expired';
  enabled: boolean;
}

export interface PlanTrack {
  trackId: string;
  contentId: string;
  contentKind: ContentKind;
  startOffsetSec: number;
  volume: number;
  loopMode: LoopMode;
  sequenceNo: number;
}

export interface SleepPlan {
  planId: string;
  userId: string;
  inputMode: InputMode;
  mood: Mood;
  voicePreference: VoicePreference;
  avoidTags: string[];
  selectedContentIds: string[];
  status: PlanStatus;
  planType: PlanType;
  durationSec: number;
  fadeOutSec: number;
  reason: string;
  source: 'rule' | 'llm';
  sourceLabel: string;
  tracks: PlanTrack[];
  createdAt: string;
  confirmedAt?: string | null;
  startedSessionId?: string | null;
}

export interface PlanningMeta { degraded?: boolean }

export class PlanningError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number, public readonly details: unknown[] = []) { super(message); }
}

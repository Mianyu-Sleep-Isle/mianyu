export type AgeMode = 'adult' | 'child';
export type VoicePreference = 'want' | 'avoid' | 'unspecified';
export type Transport = 'mock' | 'http';

export interface ContentItemDto { id: string; name: string; meta: string; category: string; art?: string; image?: string; action: string; detail?: boolean; age_mode: AgeMode; asset_path?: string; enabled: boolean }
export interface SleepIntentDto { emotion: 'excited' | 'anxious' | 'wants_company' | 'calm' | 'unspecified'; voice_preference: VoicePreference; available_minutes: number; forbidden_tags: string[]; preset_sentence?: string }
export interface TrackRefDto { asset_id: string; name: string; asset_path?: string; default_space?: 'indoor' | 'outdoor' | 'either'; volume?: number; pan?: number; distance?: number }
export interface SleepPlanDto { id: string; type: 'soundscape' | 'story' | 'breath' | 'mix'; reason: string; source: 'rule' | 'llm'; status: 'draft' | 'confirmed' | 'cancelled'; duration_minutes: number; fade_out_minutes: number; tracks: TrackRefDto[] }
export interface SceneAudioSourceDto { id: string; track: TrackRefDto; space: 'indoor' | 'outdoor'; x: number; y: number; volume: number; enabled: boolean }
export interface SceneConfigDto { id: string; name: string; status: 'draft' | 'handed_off' | 'retired'; sources: SceneAudioSourceDto[]; version: number }
export interface SleepSessionDto { id: string; plan_id: string; scene_id: string; status: 'preparing' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed'; started_at: string; playback_minutes: number }
export interface MorningFeedbackInput { session_id: string; fall_asleep_ease: 'easy' | 'normal' | 'difficult' | 'unknown'; sound_comfort: 'comfortable' | 'acceptable' | 'uncomfortable'; voice_next_time: VoicePreference; story_effect_rating?: number; disliked_content?: string; note?: string }
export interface PreferenceProfileDto { voice_preference: VoicePreference; preferred_voice_id?: string; forbidden_sound_tags: string[]; story_themes: string[]; breath_templates: string[]; scenes: string[] }
export interface PointsEntryDto { id: string; event_type: 'plan_started' | 'feedback_submitted' | 'knowledge_completed'; points_delta: number; balance_after: number; occurred_at: string; remark: string }
export interface UserContextDto { user_id: string; age_mode: AgeMode; pin_configured: boolean; non_medical_accepted: boolean }

export interface MianyuPortsContract {
  catalog: { list(category: string, ageMode: AgeMode): Promise<ContentItemDto[]>; setFavorite(assetId: string, favorite: boolean): Promise<unknown> };
  resourceResolver: { resolve(assetId: string): Promise<{ asset_id: string; url: string; expires_at: string | null } | null> };
  planComposer: { compose(intent: SleepIntentDto): Promise<SleepPlanDto>; regenerate(intent: SleepIntentDto): Promise<SleepPlanDto>; confirm(planId: string): Promise<SleepPlanDto> };
  planQuery: { current(): Promise<SleepPlanDto | null> };
  sceneQuery: { current(): Promise<SceneConfigDto | null>; saveDraft(scene: SceneConfigDto): Promise<SceneConfigDto>; freeze(scene: SceneConfigDto): Promise<SceneConfigDto>; copy(sceneId: string): Promise<SceneConfigDto> };
  sleepSession: { start(input: { plan_id: string; scene_id: string }): Promise<SleepSessionDto>; pause(): Promise<SleepSessionDto>; resume(): Promise<SleepSessionDto>; appendEvent(type: string, payload?: object): Promise<unknown>; stop(): Promise<SleepSessionDto>; history(): Promise<SleepSessionDto[]> };
  audioEngine: { preview(assetId: string): Promise<unknown>; stopPreview(): Promise<unknown> };
  feedback: { pending(): Promise<unknown>; submit(input: MorningFeedbackInput): Promise<{ feedback: unknown; points_awarded: number; balance: number }> };
  preferences: { current(): Promise<PreferenceProfileDto> };
  points: { entries(): Promise<{ balance: number; entries: PointsEntryDto[] }> };
  archive: { query(period: '7d' | '30d'): Promise<unknown> };
  auth: { currentUser(): Promise<UserContextDto>; updateUser(input: Partial<UserContextDto>): Promise<UserContextDto>; verifyPin(pin: string): Promise<boolean> };
  erasure: { eraseAll(): Promise<{ erased: boolean }> };
  config: { transports: Record<string, Transport>; apiBaseUrl: string };
}

declare global {
  interface Window { MianyuPorts: MianyuPortsContract; __MIANYU_API_BASE_URL__?: string; __MIANYU_TRANSPORTS__?: Partial<Record<'content' | 'planning' | 'scene' | 'session' | 'growth' | 'common', Transport>> }
}

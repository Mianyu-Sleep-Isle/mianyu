import type { ContentCandidate } from './types.ts';

// Independent-demo fixtures only. The team integration must inject the real
// ContentCatalogService; these display IDs are not module 2 business keys.
export const demoCandidates: ContentCandidate[] = [
  { contentId: 'A01', contentKind: 'audio', tags: ['rain'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'licensed', enabled: true },
  { contentId: 'A03', contentKind: 'audio', tags: ['fire'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
  { contentId: 'A04', contentKind: 'audio', tags: ['page'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
  { contentId: 'A07', contentKind: 'audio', tags: ['room'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
  { contentId: 'A10', contentKind: 'audio', tags: ['keyboard'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
  { contentId: 'A12', contentKind: 'audio', tags: ['thunder'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'licensed', enabled: true },
  { contentId: 'S01', contentKind: 'story', tags: ['gentle'], ageMode: 'adult', hasVoice: true, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
  { contentId: 'S02', contentKind: 'story', tags: ['gentle'], ageMode: 'child', hasVoice: true, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
  { contentId: 'B01', contentKind: 'breath', tags: ['calm'], ageMode: 'all', hasVoice: true, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
];

import type { CatchTheHeartContent, ChooseOurDateContent, DateOption, EnvelopeItem, HeartItem, MemoryQuizContent, OpenWhenContent, PhotoPuzzleContent, QuizQuestion, SurpriseData, SurpriseDelight, SurpriseAppearance, SurpriseMusic, OurStorybookContent, WishUponAStarContent, CozyPlaylistContent, StarWish, PlaylistTrack, ImagePresentation } from '../types'
export type ExportMediaKind = 'image' | 'audio' | 'video'
export interface ExportMediaContribution {
  kind: ExportMediaKind
  /** Internal source id used to return an oversized editable video to its owner. */
  mediaId?: string
  label: string
  name: string
  originalBytes: number
  embeddedBytes: number
}
export interface ExportResult { blob: Blob; html: string; bytes: number; filename: string; mediaContributions: ExportMediaContribution[] }
export interface ExportEstimate { photoCount: number; sourceBytes: number; estimatedBytes: number; contributors: ExportMediaContribution[]; level: 'good'|'large'|'warning' }
export type ExportBudgetConfidence = "exact-local" | "approximate" | "unknown";
export type ExportBudgetState = "safe" | "large" | "near-limit" | "over-limit" | "calculating" | "unknown";
export interface ExportBudgetEstimate extends ExportEstimate {
  limitBytes: number;
  originalBytes: number;
  predictedBytes: number;
  conservativeBytes: number;
  confidence: ExportBudgetConfidence;
  state: ExportBudgetState;
  unknownCount?: number;
}
export interface EmbeddedImage { id: string; previewUrl: string; name: string; mimeType: string; size: number; width?: number; height?: number; presentation?: ImagePresentation }
export interface EmbeddedAudio { name: string; mimeType: string; size: number; dataUrl: string; durationSeconds?: number }
export interface EmbeddedVideo { id: string; previewUrl: string; name: string; mimeType: string; size: number }
export interface EmbeddedHeartItem extends Omit<HeartItem, 'photo'> { photo?: EmbeddedImage }
export interface EmbeddedEnvelopeItem extends Omit<EnvelopeItem, 'photo'|'video'> { photo?: EmbeddedImage; video?: EmbeddedVideo }
export interface EmbeddedHeartContent extends Omit<CatchTheHeartContent, 'hearts'|'songFile'> { hearts: EmbeddedHeartItem[]; songFile?: EmbeddedAudio }
export interface EmbeddedPuzzleContent extends Omit<PhotoPuzzleContent, 'photo'> { photo?: EmbeddedImage }
export interface EmbeddedOpenWhenContent extends Omit<OpenWhenContent, 'envelopes'|'musicFile'> { envelopes: EmbeddedEnvelopeItem[]; musicFile?: EmbeddedAudio }
export interface EmbeddedDateOption extends Omit<DateOption, 'photo'> { photo?: EmbeddedImage }
export interface EmbeddedQuizQuestion extends Omit<QuizQuestion, 'photo'> { photo?: EmbeddedImage }
export interface EmbeddedDateContent extends Omit<ChooseOurDateContent, 'rounds'|'options'> { rounds: Array<Omit<ChooseOurDateContent['rounds'][number],'options'> & {options:EmbeddedDateOption[]}>; options?: EmbeddedDateOption[] }
export interface EmbeddedQuizContent extends Omit<MemoryQuizContent, 'questions'> { questions: EmbeddedQuizQuestion[] }
export interface EmbeddedStoryPage extends Omit<OurStorybookContent['pages'][number], 'photo'> { photo?: EmbeddedImage }
export interface EmbeddedStorybookContent extends Omit<OurStorybookContent, 'pages'> { pages: EmbeddedStoryPage[] }
export interface EmbeddedStarWish extends Omit<StarWish,'photo'> { photo?: EmbeddedImage }
export interface EmbeddedStarContent extends Omit<WishUponAStarContent,'stars'> { stars: EmbeddedStarWish[] }
export interface EmbeddedPlaylistTrack extends Omit<PlaylistTrack,'photo'|'audio'> { photo?: EmbeddedImage; audio?: EmbeddedAudio }
export interface EmbeddedPlaylistContent extends Omit<CozyPlaylistContent,'tracks'> { tracks: EmbeddedPlaylistTrack[] }
export type EmbeddedDelight = Omit<SurpriseDelight, 'coverPhoto'> & { coverPhoto?: EmbeddedImage }
export type EmbeddedAppearance = Omit<SurpriseAppearance, 'backgroundImage'|'customBackgroundImage'> & { backgroundImage?: EmbeddedImage }
export type EmbeddedMusic = Omit<SurpriseMusic, 'file'> & { file?: EmbeddedAudio }
export type ExportableData = Omit<SurpriseData, 'content'|'delight'|'appearance'|'music'> & { appearance: EmbeddedAppearance; delight?: EmbeddedDelight; music?: EmbeddedMusic; content: EmbeddedHeartContent | EmbeddedPuzzleContent | EmbeddedOpenWhenContent | EmbeddedDateContent | EmbeddedQuizContent | EmbeddedStorybookContent | EmbeddedStarContent | EmbeddedPlaylistContent }
export interface ImageConversionProgress { completed: number; total: number; imageName?: string }

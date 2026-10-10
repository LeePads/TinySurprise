import { TEXT_LIMITS, countText } from "./text-limits";
import type { CatchTheHeartContent, ChooseOurDateContent, CozyPlaylistContent, MemoryQuizContent, OpenWhenContent, OurStorybookContent, PhotoPuzzleContent, SurpriseAppearance, SurpriseBasics, SurpriseData, SurpriseDelight, SurpriseMusic, TemplateType, ExpirationOption, WishUponAStarContent } from './types'
import { parseYouTubeUrl } from './youtube'
import { normalizeHttpUrl } from './safe-url'
import { MAX_PLAYLIST_AUDIO_BYTES, audioValidationMessage } from './music'
import {
  type ContentLimitPolicy,
  getTemplateExperienceDefinition,
} from './template-experience-definitions'
import { getMemoryQuizPlayableIssues } from './memory-quiz'
import { hasRasterImageSignature } from './photo-puzzle-validation'

export interface ValidationError { field: string; message: string }
export interface ValidationResult { valid: boolean; errors: ValidationError[] }
const result = (errors: ValidationError[]): ValidationResult => ({ valid: errors.length === 0, errors })
const required = (errors: ValidationError[], field: string, label: string, value?: string) => { if (!value?.trim()) errors.push({ field, message: `Add ${label} before continuing.` }) }

export function validateBasics(v: Partial<SurpriseBasics>): ValidationResult { const e: ValidationError[] = []; required(e, 'senderName', 'your name', v.senderName); required(e, 'recipientName', 'the recipient name', v.recipientName); required(e, 'openingMessage', 'a short opening message', v.openingMessage); if (countText(v.senderName || "") > TEXT_LIMITS.name) e.push({ field: 'senderName', message: 'Keep your name under 60 characters.' }); if (countText(v.recipientName || "") > TEXT_LIMITS.name) e.push({ field: 'recipientName', message: 'Keep the recipient name under 60 characters.' }); if (countText(v.openingMessage || "") > TEXT_LIMITS.opening) e.push({ field: 'openingMessage', message: 'Keep the opening message under 500 characters.' }); return result(e) }
export function validateCatchTheHeart(v: Partial<CatchTheHeartContent>, policy: ContentLimitPolicy = "recommended"): ValidationResult { const e: ValidationError[] = []; const hearts = v.hearts || []; const max = getTemplateExperienceDefinition("catch-the-heart").limits[policy === "recommended" ? "recommendedMax" : "compatibilityMax"] || 20; if (hearts.length < 1 || hearts.length > max) e.push({ field: 'hearts', message: `Add between 1 and ${max} heart memories before continuing.` }); hearts.forEach((heart,index)=>{ if (!heart.message?.trim() && !heart.photo) e.push({ field: `hearts.${index}.message`, message: `Add a note or photo for heart ${index+1}.` }) }); required(e, 'finalMessage', 'the final reveal message', v.finalMessage); if (v.songUrl && !parseYouTubeUrl(v.songUrl)) e.push({ field: 'songUrl', message: 'Use a valid YouTube watch, short, embed, or youtu.be link.' }); return result(e) }
export function validatePhotoPuzzle(v: Partial<PhotoPuzzleContent>): ValidationResult { const e: ValidationError[] = []; const legacyPhoto = normalizeHttpUrl(v.photoUrl) || /^data:image\/(jpeg|png|webp|gif);base64,/i.test(v.photoUrl || ''); if (!v.photo && !legacyPhoto) e.push({ field: 'photo', message: 'Choose the original photo for the puzzle.' }); required(e, 'completionMessage', 'the puzzle completion message', v.completionMessage); required(e, 'finalMessage', 'the final reveal message', v.finalMessage === undefined ? v.completionMessage : v.finalMessage); return result(e) }
export function validateOpenWhen(v: Partial<OpenWhenContent>, policy: ContentLimitPolicy = "recommended"): ValidationResult { const e: ValidationError[] = []; const items = v.envelopes || []; const max = getTemplateExperienceDefinition("open-when").limits[policy === "recommended" ? "recommendedMax" : "compatibilityMax"] || 6; if (items.length < 2 || items.length > max) e.push({ field: 'envelopes', message: `Keep between 2 and ${max} notes.` }); items.forEach((item, i) => { required(e, `envelopes.${i}.title`, `a title for note ${i + 1}`, item.title); required(e, `envelopes.${i}.message`, `the message for note ${i + 1}`, item.message) }); required(e, 'finalMessage', 'the final message', v.finalMessage); return result(e) }
export function validateAppearance(v: Partial<SurpriseAppearance>): ValidationResult { const e: ValidationError[] = []; if (!v.theme) e.push({ field: 'theme', message: 'Choose a feeling for the surprise.' }); if (!v.animationIntensity) e.push({ field: 'animationIntensity', message: 'Choose how much motion you want.' }); return result(e) }
export function validateChooseOurDate(v: Partial<ChooseOurDateContent>, policy: ContentLimitPolicy = "recommended"): ValidationResult { const e: ValidationError[] = []; required(e,'introMessage','the date adventure intro',v.introMessage);const rounds=v.rounds||[];const limits=getTemplateExperienceDefinition("choose-our-date").limits.nested?.rounds;const max=policy === "recommended" ? limits?.recommendedMax : limits?.compatibilityMax;if(rounds.length<2||rounds.length>(max||5))e.push({field:'rounds',message:`Add between 2 and ${max || 5} question rounds.`});rounds.forEach((round,i)=>{required(e,`rounds.${i}.question`,`a question for round ${i+1}`,round.question);if(round.options.length<2||round.options.length>4)e.push({field:`rounds.${i}.options`,message:`Add 2 to 4 choices for round ${i+1}.`});round.options.forEach((option,n)=>{required(e,`rounds.${i}.options.${n}.title`,`a label for round ${i+1}, option ${n+1}`,option.title)})});required(e,'result.invitation','the final invitation',v.result?.invitation);return result(e) }
export function validateMemoryQuiz(
  v: Partial<MemoryQuizContent>,
  policy: ContentLimitPolicy = "recommended",
): ValidationResult {
  return result(getMemoryQuizPlayableIssues(v, policy));
}
export function validateStorybook(
  v: Partial<OurStorybookContent>,
  policy: ContentLimitPolicy = "recommended",
): ValidationResult {
  const e: ValidationError[] = [];
  const pages = v.pages || [];
  pages.forEach((page, i) => {
    required(
      e,
      `pages.${i}.title`,
      `a title for chapter ${i + 1}`,
      page.title,
    );
    required(
      e,
      `pages.${i}.body`,
      `the message for chapter ${i + 1}`,
      page.body,
    );
  });
  const max = getTemplateExperienceDefinition("our-storybook").limits[policy === "recommended" ? "recommendedMax" : "compatibilityMax"] || 20;
  if (pages.length < 2 || pages.length > max) {
    e.push({
      field: "pages",
      message: `Add between 2 and ${max} chapters.`,
    });
  }
  required(e, "finalMessage", "the closing story message", v.finalMessage);
  return result(e);
}
export function validateStars(v: Partial<WishUponAStarContent>): ValidationResult { const e: ValidationError[] = []; (v.stars || []).forEach((s, i) => { required(e, `stars.${i}.wish`, `wish ${i + 1}`, s.wish); required(e, `stars.${i}.message`, `the note for wish ${i + 1}`, s.message) }); if ((v.stars || []).length < 3 || (v.stars || []).length > 9) e.push({ field: 'stars', message: 'Add between 3 and 9 stars.' }); required(e, 'finalMessage', 'the constellation message', v.finalMessage); return result(e) }
export function validatePlaylist(v: Partial<CozyPlaylistContent>, policy: ContentLimitPolicy = "recommended"): ValidationResult { const e: ValidationError[] = []; const tracks = v.tracks || []; const max = getTemplateExperienceDefinition("cozy-playlist").limits[policy === "recommended" ? "recommendedMax" : "compatibilityMax"] || 12; tracks.forEach((t, i) => { required(e, `tracks.${i}.title`, `song ${i + 1}`, t.title); required(e, `tracks.${i}.artist`, `the artist for song ${i + 1}`, t.artist); required(e, `tracks.${i}.why`, `why song ${i + 1} belongs`, t.why); if (policy === "recommended" && !t.audio && !normalizeHttpUrl(t.link)) e.push({ field: `tracks.${i}.link`, message: `Add audio or a complete song link for song ${i + 1}.` }); if (t.link && !normalizeHttpUrl(t.link)) e.push({ field: `tracks.${i}.link`, message: `Use a complete http:// or https:// song link for song ${i + 1}.` }); if (t.audio?.file) { const message = audioValidationMessage(t.audio.file); if (message) e.push({ field: `tracks.${i}.audio`, message: `Song ${i + 1}: ${message}` }); } }); if (tracks.length < 2 || tracks.length > max) e.push({ field: 'tracks', message: `Add between 2 and ${max} songs.` }); const audioBytes = tracks.reduce((sum, track) => sum + (track.audio?.size || 0), 0); if (audioBytes > MAX_PLAYLIST_AUDIO_BYTES) e.push({ field: 'tracks.audio', message: 'Keep playlist audio under 12 MB so the surprise can be shared as a standalone file.' }); required(e, 'finalMessage', 'the playlist closing message', v.finalMessage); return result(e) }
export function validateMusic(v?: Partial<SurpriseMusic>): ValidationResult { const e: ValidationError[] = []; if (!v) return result(e); if (v.file?.file) { const message = audioValidationMessage(v.file.file); if (message) e.push({ field: 'music.file', message }); } if (v.youtubeUrl && !parseYouTubeUrl(v.youtubeUrl)) e.push({ field: 'music.youtubeUrl', message: 'Use a valid YouTube watch, short, embed, or youtu.be link.' }); if (v.volume !== undefined && (v.volume < 0 || v.volume > 100)) e.push({ field: 'music.volume', message: 'Choose a volume between 0 and 100.' }); return result(e) }
export function validateDelight(v?:Partial<SurpriseDelight>):ValidationResult{const e:ValidationError[]=[];if(v?.passphraseEnabled){required(e,'passphraseQuestion','the playful secret question',v.passphraseQuestion);if(v.passphraseMode==='choice'){const allChoices=v.passphraseChoices||[],choices=allChoices.map(choice=>choice.trim()).filter(Boolean),correctIndex=v.passphraseCorrectChoiceIndex??0,correctChoice=allChoices[correctIndex]?.trim()||'';if(choices.length<2)e.push({field:'passphraseChoices',message:'Add at least two choices for the playful question.'});if(new Set(choices.map(choice=>choice.toLocaleLowerCase())).size!==choices.length)e.push({field:'passphraseChoices',message:'Make each playful answer choice different.'});if(!correctChoice)e.push({field:'passphrase',message:'Choose a filled-in choice as the correct answer.'})}else{const answers=[...(v.passphraseAnswers||[]),v.passphrase||''];const accepted=answers.find(answer=>answer.trim())?.trim()||'';if(!accepted)e.push({field:'passphrase',message:'Add at least one accepted answer for the playful secret question.'})}}return result(e)}
export function validateContent(t: TemplateType, c: SurpriseDataContent, policy: ContentLimitPolicy = "recommended"): ValidationResult { if (t === 'catch-the-heart') return validateCatchTheHeart(c as CatchTheHeartContent, policy); if (t === 'photo-puzzle') return validatePhotoPuzzle(c as PhotoPuzzleContent); if (t === 'open-when') return validateOpenWhen(c as OpenWhenContent, policy); if (t === 'choose-our-date') return validateChooseOurDate(c as ChooseOurDateContent, policy); if (t === 'memory-quiz') return validateMemoryQuiz(c as MemoryQuizContent, policy); if (t === 'our-storybook') return validateStorybook(c as OurStorybookContent, policy); if (t === 'wish-upon-a-star') return validateStars(c as WishUponAStarContent); return validatePlaylist(c as CozyPlaylistContent, policy) }
type SurpriseDataContent = CatchTheHeartContent | ChooseOurDateContent | CozyPlaylistContent | MemoryQuizContent | OpenWhenContent | OurStorybookContent | PhotoPuzzleContent | WishUponAStarContent

/**
 * Compatibility validation for data crossing a finalized/imported boundary.
 * Builder and edit-session autosaves deliberately use the normal draft path,
 * while packages and recipient data must satisfy the compatibility range.
 */
export function validateImportedContent(
  template: TemplateType,
  content: SurpriseData["content"],
): ValidationResult {
  return validateContent(template, content, "compatibility");
}

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const allowedImageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
export function validateImageFile(file: File): ValidationResult { const e: ValidationError[] = []; const extension = file.name.split('.').pop()?.toLowerCase() || ''; if (!allowedImageTypes.has(file.type) || !allowedImageExtensions.has(extension)) e.push({ field: 'file', message: 'That photo format is not supported. Try JPG, PNG, WebP, or GIF.' }); if (file.size > 5 * 1024 * 1024) e.push({ field: 'file', message: 'That photo is over 5 MB. Choose a smaller copy.' }); return result(e) }
export async function validateImageSignature(file: File): Promise<ValidationResult> { const basic = validateImageFile(file); if (!basic.valid) return basic; const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer()); return hasRasterImageSignature(file.type, bytes) ? result([]) : result([{ field: 'file', message: 'That photo could not be read. Try saving it again or choose another photo.' }]) }
export function parseExpiration(value: string): ExpirationOption { return ['none', '24h', '3d', '7d'].includes(value) ? value as ExpirationOption : 'none' }
export const calculateExpiration = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d }
export const isExpired = (date: Date | string) => new Date() > new Date(date)
export const formatExpiration = (date: Date | string) => `Display-only reminder: ${new Date(date).toLocaleString()}`

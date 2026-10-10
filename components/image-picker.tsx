'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle2, Crop, Globe2, ImagePlus, LoaderCircle } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { InlineFieldMessage } from './ui/inline-field-message'
import { PhotoSourceSheet } from './photo-source-sheet'
import { createLocalImageWithMetadata, createStableId, revokeLocalImage } from '@/lib/local-media'
import type { LocalImage } from '@/lib/types'
import { validateImageSignature } from '@/lib/validation'
import { normalizeHttpUrl } from '@/lib/safe-url'
import { isNativePlatform } from '@/lib/platform'
import { hapticTap } from '@/lib/native/haptics'
import { ImageFramingEditor } from './image-framing-editor'
import { PresentationImage } from './presentation-image'
import { formatBytes } from '@/lib/format-bytes'

interface LocalImagePickerProps {
  value?: LocalImage
  onChange: (value?: LocalImage) => void
  label?: string
  disabled?: boolean
  helperText?: string
  metaLabel?: string
  frameAspect?: number | string
  adjustLabel?: string
  adjustAriaLabel?: string
  actionLayout?: 'standard' | 'featured'
  addLabel?: string
  hideLabel?: boolean
  compactEmpty?: boolean
  invalid?: boolean
  errorId?: string
  focusId?: string
}

const formatFileSize = (bytes: number) => formatBytes(bytes, bytes >= 1048576 ? 1 : 2)

export function LocalImagePicker({ value, onChange, label = 'Photo', disabled = false, helperText, metaLabel, frameAspect = '4 / 3', adjustLabel, adjustAriaLabel, actionLayout = 'standard', addLabel, hideLabel = false, compactEmpty = false, invalid = false, errorId, focusId }: LocalImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const urlId = useId()
  const [urlValue,setUrlValue]=useState(value?.source==='url'?value.previewUrl:'')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [native, setNative] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const valueRef = useRef(value)
  const choiceRef = useRef(0)
  useEffect(() => { valueRef.current = value }, [value])
  useEffect(() => () => { choiceRef.current++ }, [])
  useEffect(()=>{setNative(isNativePlatform())},[])
  useEffect(()=>{if(value?.source==='url')setUrlValue(value.previewUrl);else if(!value)setUrlValue('')},[value])

  const internalErrorId = error ? `${inputId}-error` : undefined
  const describedBy = [invalid ? errorId : undefined, internalErrorId].filter(Boolean).join(' ') || undefined
  const invalidState = invalid || Boolean(error)

  const choose = async (file?: File) => {
    if (!file) return
    const choice = ++choiceRef.current
    const previous = valueRef.current
    setLoading(true); setSuccess('')
    try {
      const result = await validateImageSignature(file)
      if (choice !== choiceRef.current) return
      if (!result.valid) { setError(result.errors[0].message); return }
      setError('');setUrlValue('')
      const prepared = await createLocalImageWithMetadata(file)
      if (choice !== choiceRef.current || valueRef.current !== previous) { revokeLocalImage(prepared); return }
      onChange(prepared)
      void hapticTap('light')
      setSuccess(`${file.name} is ready.`)
    } catch {
      if (choice === choiceRef.current) setError('This photo could not be read. Try another copy; your existing photo is kept.')
    } finally {
      if (choice === choiceRef.current) setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }
  const applyUrlValue=()=>{
    const source=normalizeHttpUrl(urlValue)
    if(!source){setError('Enter a public image link starting with http:// or https://.');return false}
    let name='Linked image'
    try{name=decodeURIComponent(new URL(source).pathname.split('/').filter(Boolean).at(-1)||new URL(source).hostname)}catch{}
    const remote:LocalImage={id:createStableId('linked-image'),previewUrl:source,name,mimeType:'image/remote',size:0,source:'url'}
    setError('');setSuccess(native?'Photo link added.':'Image link added. It will be included when the image host allows access.');onChange(remote)
    return true
  }
  const remove = () => { onChange(); setSuccess('');setError('');setUrlValue(''); if (inputRef.current) inputRef.current.value = '' }
  const openPicker = () => { if (!disabled && !loading) inputRef.current?.click() }
  const drop = (event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); if (!disabled && !loading) void choose(event.dataTransfer.files[0]) }
  const framingLabel = adjustLabel || `Adjust ${label.toLowerCase()}`
  const framingAriaLabel = adjustAriaLabel || framingLabel
  const displayName = value ? (value.source === 'url' ? 'Linked image' : value.name) : ''
  const displayMeta = value?.unavailable
    ? 'Photo unavailable — choose it again'
    : metaLabel || (value?.source === 'url' ? 'Image link ready' : 'Photo ready')
  const imageDetails = value && (
    <div className="builder-image-card__details min-w-0">
      <p className="builder-image-card__name text-sm font-medium text-foreground [overflow-wrap:anywhere]">{displayName}</p>
      <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{displayMeta}</span>
        {value.size > 0 && <span>{formatFileSize(value.size)}</span>}
        {value.width && value.height ? <span>{value.width} × {value.height} px</span> : null}
      </p>
    </div>
  )

  if (native) {
    return <div id={focusId} tabIndex={focusId ? -1 : undefined} className="min-w-0 max-w-full space-y-2">
      {!hideLabel && <label className="builder-field-label block font-medium text-foreground">{label}</label>}
      {helperText&&<p className="text-xs text-muted-foreground">{helperText}</p>}
      {value ? <div className="min-w-0 max-w-full rounded-xl border border-border bg-card p-3">
      <button type="button" className="group block w-full cursor-pointer rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed" onClick={()=>setEditorOpen(true)} disabled={disabled||loading||Boolean(value.unavailable)} aria-label={framingAriaLabel} title={framingAriaLabel}>
        <PresentationImage image={value} alt={`Selected ${label.toLowerCase()}: ${value.name}`} aspectRatio={frameAspect} frameClassName="rounded-lg transition-transform group-hover:scale-[1.01]" />
      </button>
        <div className="builder-image-card__footer mt-3 grid min-w-0 gap-3">
          {imageDetails}
          <div className={`builder-image-card__actions ${actionLayout === 'featured' ? 'builder-image-card__actions--featured' : ''} flex min-w-0 flex-wrap gap-2`}>
            <Button className="h-auto min-h-12 min-w-[5.5rem] flex-1 gap-2 whitespace-normal py-3" type="button" variant="outline" size="sm" aria-label={framingAriaLabel} onClick={()=>setEditorOpen(true)} disabled={disabled||loading||Boolean(value.unavailable)}><Crop className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 [overflow-wrap:anywhere]">{framingLabel}</span></Button>
            <Button className="min-h-12 min-w-[5.5rem] flex-1 whitespace-normal" type="button" variant="outline" size="sm" onClick={()=>setSheetOpen(true)} disabled={disabled||loading}>{loading?<LoaderCircle className="mr-1 h-3.5 w-3.5 animate-spin"/>:null}Replace</Button>
            <Button className="min-h-12 min-w-[5.5rem] flex-1 whitespace-normal" type="button" variant="ghost" size="sm" onClick={remove} disabled={disabled||loading}>Remove</Button>
          </div>
        </div>
      </div> : <Button type="button" variant="outline" className="min-h-12 w-full justify-center" onClick={()=>setSheetOpen(true)} disabled={disabled||loading} data-invalid={invalidState ? "true" : undefined} aria-describedby={describedBy}>
        {loading?<LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>:<ImagePlus className="mr-2 h-4 w-4"/>}
        {loading?'Preparing photo…':addLabel || 'Add photo'}
      </Button>}
      {linkOpen && <div className="border-t pt-3">
      <label htmlFor={urlId} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Globe2 className="h-3.5 w-3.5"/>Image link</label>
        <div className="mt-2 flex min-w-0 gap-2"><Input className="min-w-0 flex-1" id={urlId} inputMode="url" placeholder="https://example.com/photo.jpg" value={urlValue} onChange={event=>setUrlValue(event.target.value)} disabled={disabled}/><Button className="shrink-0" type="button" variant="outline" onClick={()=>{if(applyUrlValue())setLinkOpen(false)}} disabled={disabled||!urlValue.trim()}>Use</Button></div>
      </div>}
      {error&&<InlineFieldMessage id={`${inputId}-error`} tone="error" message={error}/>} {success&&!error&&<p className="flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="h-3.5 w-3.5"/>{success}</p>}
      <PhotoSourceSheet
        open={sheetOpen}
        onClose={()=>setSheetOpen(false)}
        onChoosePhoto={(file)=>{void choose(file);setSheetOpen(false)}}
        onTakePhoto={(file)=>{void choose(file);setSheetOpen(false)}}
        onChooseFile={(file)=>{void choose(file);setSheetOpen(false)}}
        onAddFromLink={()=>{setLinkOpen(true);setSheetOpen(false)}}
      />
      <ImageFramingEditor open={editorOpen} image={value} label={label} aspectRatio={frameAspect} onCancel={()=>setEditorOpen(false)} onDone={(presentation)=>{onChange(value ? {...value, presentation} : value);setEditorOpen(false)}} />
    </div>
  }

  return <div id={focusId} tabIndex={focusId ? -1 : undefined} className="min-w-0 max-w-full space-y-3" onDragOver={(event) => event.preventDefault()} onDrop={drop}>
      {!hideLabel && <label htmlFor={inputId} className="builder-field-label block font-medium text-foreground">{label}</label>}
    {helperText&&<p className="text-xs text-muted-foreground">{helperText}</p>}
    {value ? <div className="min-w-0 max-w-full rounded-xl border border-border bg-card p-3 transition-shadow hover:shadow-sm">
      <button type="button" className="group block w-full cursor-pointer rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed" onClick={()=>setEditorOpen(true)} disabled={disabled||loading||Boolean(value.unavailable)} aria-label={framingAriaLabel} title={framingAriaLabel}>
        <PresentationImage image={value} alt={`Selected ${label.toLowerCase()}: ${value.name}`} aspectRatio={frameAspect} frameClassName={`${frameAspect === '1 / 1' ? 'mx-auto max-w-56' : 'max-h-56'} rounded-lg transition-transform group-hover:scale-[1.01]`} />
      </button>
      <div className="builder-image-card__footer mt-3 grid min-w-0 gap-3">{imageDetails}<div className={`builder-image-card__actions ${actionLayout === 'featured' ? 'builder-image-card__actions--featured' : ''} flex min-w-0 flex-wrap gap-2`}>
        <Button className="h-auto min-h-12 min-w-0 gap-2 whitespace-normal py-3" type="button" variant="outline" size="sm" aria-label={framingAriaLabel} onClick={()=>setEditorOpen(true)} disabled={disabled||loading||Boolean(value.unavailable)}><Crop className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 [overflow-wrap:anywhere]">{framingLabel}</span></Button>
        <Button className="min-h-12 min-w-0 whitespace-normal" type="button" variant="outline" size="sm" onClick={openPicker} disabled={disabled||loading}>{loading?<LoaderCircle className="mr-1 animate-spin"/>:null}Replace</Button>
        <Button className="min-h-12 min-w-0 whitespace-normal" type="button" variant="ghost" size="sm" onClick={remove} disabled={disabled||loading}>Remove</Button>
      </div></div>
    </div> : <button type="button" className={`${compactEmpty ? 'min-h-12 px-3 py-3' : 'px-5 py-5'} w-full rounded-xl border border-dashed border-border bg-card text-sm text-foreground transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary data-[invalid=true]:border-destructive data-[invalid=true]:ring-2 data-[invalid=true]:ring-destructive/30 disabled:cursor-not-allowed disabled:opacity-50`} onClick={openPicker} disabled={disabled||loading} data-invalid={invalidState ? "true" : undefined} aria-describedby={describedBy}>{loading?<LoaderCircle className="mx-auto mb-2 animate-spin"/>:<ImagePlus className={`${compactEmpty ? 'mr-2 inline-block' : 'mx-auto mb-2'} text-primary`}/>} {loading?'Preparing preview…':addLabel || 'Choose from your device'}{!compactEmpty&&<span className="mt-1 block text-xs text-muted-foreground">or drag and drop · JPEG, PNG, WebP, or GIF up to 5 MB</span>}</button>}
    <input id={inputId} ref={inputRef} className="hidden" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" disabled={disabled} aria-invalid={invalidState || undefined} aria-describedby={describedBy} onChange={(event) => { void choose(event.target.files?.[0]) }} />
    {!native && <Button type="button" variant="ghost" size="sm" className="px-0 text-muted-foreground" onClick={()=>setLinkOpen(value=>!value)}><Globe2 className="mr-1.5 h-3.5 w-3.5"/>{linkOpen?'Hide image URL':'Use an image URL'}</Button>}
    {linkOpen && <div className="border-t pt-3"><label htmlFor={urlId} className="builder-field-label flex items-center gap-2 font-semibold text-muted-foreground"><Globe2 className="h-3.5 w-3.5"/>Image link</label><div className="mt-2 flex min-w-0 gap-2"><Input className="min-w-0 flex-1" id={urlId} inputMode="url" placeholder="https://example.com/photo.jpg" value={urlValue} onChange={event=>setUrlValue(event.target.value)} disabled={disabled}/><Button className="shrink-0" type="button" variant="outline" onClick={applyUrlValue} disabled={disabled||!urlValue.trim()}>Use URL</Button></div><p className="mt-2 text-xs text-muted-foreground">Linked images need a public URL. Upload the photo if the host blocks access.</p></div>}
    {error&&<InlineFieldMessage id={`${inputId}-error`} tone="error" message={error}/>} {success&&!error&&<p className="flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="h-3.5 w-3.5"/>{success}</p>}
    <ImageFramingEditor open={editorOpen} image={value} label={label} aspectRatio={frameAspect} onCancel={()=>setEditorOpen(false)} onDone={(presentation)=>{onChange(value ? {...value, presentation} : value);setEditorOpen(false)}} />
  </div>
}

export { LocalImagePicker as ImagePicker }

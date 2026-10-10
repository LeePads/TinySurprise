import type { HeartStyle } from './types'
import { getBackgroundStyle } from './background-styles'

export const HEART_STYLES: Record<HeartStyle,{label:string;description:string;src:string}>={
  classic:{label:'Soft heart',description:'Smooth and sweet',src:'/hearts/heart_1.png'},
  doodle:{label:'Doodle heart',description:'Hand-drawn and personal',src:'/hearts/heart_drawing.png'},
  pixel:{label:'Pixel heart',description:'Tiny retro-game energy',src:'/hearts/heart_pixel.png'},
}

export const heartAssetPath=(style:HeartStyle='classic')=>HEART_STYLES[style].src

export const TEMPLATE_CARD_ART: Readonly<Record<string, string>> = {
  'catch-the-heart': '/art/cards/catch-the-heart.jpg',
  'choose-our-date': '/art/cards/choose-our-date.jpg',
  'open-when': '/art/cards/open-when.jpg',
  'photo-puzzle': '/art/cards/photo-puzzle.jpg',
  'memory-quiz': '/art/cards/memory-quiz.jpg',
  'our-storybook': '/art/cards/our-storybook.jpg',
  'cozy-playlist': '/art/cards/cozy-playlist.jpg',
  // "Coming soon" templates borrow mood-matched curated background art
  // instead of the generic placeholder gradient.
  'love-coupons': getBackgroundStyle('cotton-candy-sky')!.path,
  'memory-capsule': getBackgroundStyle('vintage-botanical-paper')!.path,
  'treasure-hunt': getBackgroundStyle('pixel-adventure')!.path,
}

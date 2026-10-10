import { describe, expect, it } from 'vitest'
import { calculateImageRect } from './puzzle-image'

describe('puzzle image framing',()=>{
  it.each([
    [600,1200,{x:300,y:0,width:600,height:1200}],
    [1200,600,{x:0,y:300,width:1200,height:600}],
    [1200,1200,{x:0,y:0,width:1200,height:1200}],
    [2400,300,{x:0,y:525,width:1200,height:150}],
    [300,2400,{x:525,y:0,width:150,height:1200}],
  ])('contains %s×%s inside the same square',(width,height,expected)=>expect(calculateImageRect(width as number,height as number,1200)).toEqual(expected))
  it('centers a cover crop when explicitly requested',()=>expect(calculateImageRect(600,1200,1200,'cover')).toEqual({x:0,y:-600,width:1200,height:2400}))
})

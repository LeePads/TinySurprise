export interface CatchHeartSpawn {
  left: number;
  top: number;
  initialTop: number;
  duration: number;
  delay: number;
}

const LANES = 5;
const LANE_STEP = 2;
const ROW_STEP = 2;
const DELAY_STEP = 11;
const DELAY_CYCLE = 17;
const DELAY_WINDOW = 4.8;
const DURATION_CYCLE = 7;
const DURATION_BASE = 5.8;
const DURATION_SPAN = 2.4;

function catchHash(index: number, seed: number) {
  return ((index * 2654435761 + seed * 40503) >>> 0) / 4294967296;
}

export function getCatchHeartSpawn(index: number, cycle = 0): CatchHeartSpawn {
  const lane = (index * LANE_STEP + cycle) % LANES;
  const laneWidth = 100 / LANES;
  const left =
    laneWidth * lane +
    laneWidth / 2 +
    (catchHash(index, 17 + cycle * 3) - 0.5) * laneWidth * 0.6;
  const row = (index * ROW_STEP + cycle * 3) % LANES;
  const rowHeight = 74 / LANES;
  const top =
    10 +
    rowHeight * row +
    rowHeight / 2 +
    (catchHash(index, 97 + cycle * 7) - 0.5) * rowHeight * 0.6;
  const delaySlot = (index * DELAY_STEP + cycle * 5) % DELAY_CYCLE;
  const durationSlot = (index * 3 + cycle * 2) % DURATION_CYCLE;

  return {
    left,
    top,
    // All initial positions remain above the clipped playfield, but their
    // different offsets keep the first visible hearts from sharing a phase.
    initialTop: -38 + catchHash(index, 211 + cycle * 11) * 22,
    duration: DURATION_BASE + durationSlot * (DURATION_SPAN / (DURATION_CYCLE - 1)),
    delay: delaySlot * (DELAY_WINDOW / (DELAY_CYCLE - 1)),
  };
}

/** Vanilla runtime equivalent embedded into standalone HTML at build time. */
export const CATCH_HEART_SPAWN_RUNTIME = String.raw`
const CATCH_SPAWN_LANES=5,CATCH_SPAWN_LANE_STEP=2,CATCH_SPAWN_ROW_STEP=2,
  CATCH_SPAWN_DELAY_STEP=11,CATCH_SPAWN_DELAY_CYCLE=17,CATCH_SPAWN_DELAY_WINDOW=4.8,
  CATCH_SPAWN_DURATION_CYCLE=7,CATCH_SPAWN_DURATION_BASE=5.8,CATCH_SPAWN_DURATION_SPAN=2.4;
function catchSpawnHash(index,seed){return ((index*2654435761+seed*40503)>>>0)/4294967296;}
function catchHeartSpawn(index,cycle){
  cycle=cycle||0;
  const lane=(index*CATCH_SPAWN_LANE_STEP+cycle)%CATCH_SPAWN_LANES;
  const laneWidth=100/CATCH_SPAWN_LANES;
  const left=laneWidth*lane+laneWidth/2+(catchSpawnHash(index,17+cycle*3)-.5)*laneWidth*.6;
  const row=(index*CATCH_SPAWN_ROW_STEP+cycle*3)%CATCH_SPAWN_LANES;
  const rowHeight=74/CATCH_SPAWN_LANES;
  const top=10+rowHeight*row+rowHeight/2+(catchSpawnHash(index,97+cycle*7)-.5)*rowHeight*.6;
  const delaySlot=(index*CATCH_SPAWN_DELAY_STEP+cycle*5)%CATCH_SPAWN_DELAY_CYCLE;
  const durationSlot=(index*3+cycle*2)%CATCH_SPAWN_DURATION_CYCLE;
  return {
    left,
    top,
    initialTop:-38+catchSpawnHash(index,211+cycle*11)*22,
    duration:CATCH_SPAWN_DURATION_BASE+durationSlot*(CATCH_SPAWN_DURATION_SPAN/(CATCH_SPAWN_DURATION_CYCLE-1)),
    delay:delaySlot*(CATCH_SPAWN_DELAY_WINDOW/(CATCH_SPAWN_DELAY_CYCLE-1))
  };
}
`;

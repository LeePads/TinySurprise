/**
 * Puzzle utility functions for sliding tile puzzles
 * Supports 3x3, 4x4, and 5x5 grids with guaranteed solvability
 */

export interface PuzzleState {
  tiles: number[]
  gridSize: number
  emptyIndex: number
}

// Re-export Difficulty from types for convenience
export type Difficulty = 'easy' | 'medium' | 'hard'

// Also export from here so imports can be from puzzle-utils
export type { Difficulty as PuzzleDifficulty }

const DIFFICULTY_GRID_MAP: Record<Difficulty, number> = {
  easy: 3,
  medium: 4,
  hard: 5,
}

/**
 * Creates an initial solved puzzle state
 * For a 3x3 grid: [0, 1, 2, 3, 4, 5, 6, 7, 8]
 * where each number represents which tile image section is at that position
 * and emptyIndex tracks where the empty space is (initially 0)
 */
export function createSolvedPuzzle(difficulty: Difficulty): PuzzleState {
  const gridSize = DIFFICULTY_GRID_MAP[difficulty]
  const totalTiles = gridSize * gridSize
  // Tiles are numbered 1 to totalTiles-1, with 0 representing the empty space
  const tiles = Array.from({ length: totalTiles }, (_, i) => (i === 0 ? 0 : i))
  
  return {
    tiles,
    gridSize,
    emptyIndex: 0, // Empty space is at position 0 initially
  }
}

/**
 * Checks if a puzzle state is in the solved configuration
 */
export function isSolved(state: PuzzleState): boolean {
  const { tiles, gridSize } = state
  const totalTiles = gridSize * gridSize
  return tiles.every((tile, index) => tile === index)
}

/**
 * Gets valid moves (tiles adjacent to empty space)
 * Returns indices of tiles that can be moved
 */
export function getValidMoves(state: PuzzleState): number[] {
  if (!state || typeof state.emptyIndex !== 'number') {
    return []
  }
  
  const { emptyIndex, gridSize } = state
  const validMoves: number[] = []
  
  const row = Math.floor(emptyIndex / gridSize)
  const col = emptyIndex % gridSize
  
  // Up
  if (row > 0) validMoves.push(emptyIndex - gridSize)
  // Down
  if (row < gridSize - 1) validMoves.push(emptyIndex + gridSize)
  // Left
  if (col > 0) validMoves.push(emptyIndex - 1)
  // Right
  if (col < gridSize - 1) validMoves.push(emptyIndex + 1)
  
  return validMoves
}

/**
 * Moves a tile into the empty space if it's adjacent
 * Returns new state or null if move is invalid
 */
export function moveTile(state: PuzzleState, tileIndex: number): PuzzleState | null {
  if (!state || typeof state.emptyIndex !== 'number') {
    return null
  }
  
  const validMoves = getValidMoves(state)
  
  if (!validMoves.includes(tileIndex)) {
    return null // Invalid move
  }
  
  const newTiles = [...state.tiles]
  const emptyIdx = state.emptyIndex ?? 0
  
  // Swap tiles - ensure indices are valid
  if (typeof emptyIdx === 'number' && emptyIdx >= 0 && emptyIdx < newTiles.length && 
      typeof tileIndex === 'number' && tileIndex >= 0 && tileIndex < newTiles.length) {
    const temp = newTiles[emptyIdx]
    newTiles[emptyIdx] = newTiles[tileIndex]
    newTiles[tileIndex] = temp
  } else {
    return null
  }
  
  return {
    tiles: newTiles,
    gridSize: state.gridSize,
    emptyIndex: tileIndex,
  }
}

/**
 * Generates a solvable shuffled puzzle state
 * Uses random valid moves from the solved state
 * This guarantees solvability
 */
export function generateSolvableShuffle(difficulty: Difficulty, minMoves: number = 50): PuzzleState {
  let state = createSolvedPuzzle(difficulty)
  
  // Perform random valid moves to create a shuffled but solvable state
  let movesApplied = 0
  for (let i = 0; i < minMoves * 2 && movesApplied < minMoves; i++) {
    const validMoves = getValidMoves(state)
    if (validMoves.length === 0) break
    
    const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)]
    const newState = moveTile(state, randomMove)
    if (newState) {
      state = newState
      movesApplied++
    }
  }
  
  // Ensure we didn't accidentally end up with the solved state
  if (isSolved(state)) {
    // Just do one more move to ensure it's different
    const validMoves = getValidMoves(state)
    if (validMoves.length > 0) {
      const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)]
      const newState = moveTile(state, randomMove)
      if (newState) {
        state = newState
      }
    }
  }
  
  return state
}

/**
 * Finds which tile is at a specific grid position
 */
export function getTileAtIndex(state: PuzzleState, index: number): number {
  return state.tiles[index]
}

/**
 * Gets tile grid position from index
 */
export function getGridPosition(index: number, gridSize: number): { row: number; col: number } {
  return {
    row: Math.floor(index / gridSize),
    col: index % gridSize,
  }
}

/**
 * Checks if a move would solve the puzzle
 */
export function wouldSolvePuzzle(state: PuzzleState, tileIndex: number): boolean {
  const newState = moveTile(state, tileIndex)
  return newState ? isSolved(newState) : false
}

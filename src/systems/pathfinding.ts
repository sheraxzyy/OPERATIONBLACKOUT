export interface NavGrid {
  cols: number;
  rows: number;
  tile: number;
  /** blocked[row][col] */
  blocked: boolean[][];
}

export interface Point {
  x: number;
  y: number;
}

export function worldToCell(nav: NavGrid, x: number, y: number): { col: number; row: number } {
  return {
    col: Math.max(0, Math.min(nav.cols - 1, Math.floor(x / nav.tile))),
    row: Math.max(0, Math.min(nav.rows - 1, Math.floor(y / nav.tile))),
  };
}

export function cellToWorld(nav: NavGrid, col: number, row: number): Point {
  return { x: col * nav.tile + nav.tile / 2, y: row * nav.tile + nav.tile / 2 };
}

export function isBlocked(nav: NavGrid, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= nav.cols * nav.tile || y >= nav.rows * nav.tile) return true;
  const { col, row } = worldToCell(nav, x, y);
  return nav.blocked[row]?.[col] ?? true;
}

/** Find the nearest walkable cell using a bounded ring search. */
export function nearestOpenCell(nav: NavGrid, x: number, y: number, maxRadius = 8): { col: number; row: number } | null {
  const start = worldToCell(nav, x, y);
  if (!nav.blocked[start.row]?.[start.col]) return start;
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const col = start.col + dx;
        const row = start.row + dy;
        if (col < 0 || row < 0 || col >= nav.cols || row >= nav.rows) continue;
        if (!nav.blocked[row][col]) return { col, row };
      }
    }
  }
  return null;
}

export function nearestOpenWorld(nav: NavGrid, x: number, y: number, maxRadius = 8): Point | null {
  const cell = nearestOpenCell(nav, x, y, maxRadius);
  if (!cell) return null;
  return cellToWorld(nav, cell.col, cell.row);
}

const DIRS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, 1.4142],
  [1, -1, 1.4142],
  [-1, 1, 1.4142],
  [-1, -1, 1.4142],
];

/**
 * A* pathfinding on the tile nav grid. Returns simplified waypoints in world
 * coordinates, excluding the starting cell. Corner cutting through diagonally
 * adjacent blocked cells is disallowed.
 */
export function findPath(nav: NavGrid, from: Point, to: Point, maxIterations = 9000): Point[] | null {
  const startCell = nearestOpenCell(nav, from.x, from.y);
  const goalCell = nearestOpenCell(nav, to.x, to.y);
  if (!startCell || !goalCell) return null;
  if (startCell.col === goalCell.col && startCell.row === goalCell.row) return [];

  const total = nav.cols * nav.rows;
  const gScore = new Float32Array(total).fill(Infinity);
  const fScore = new Float32Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const inOpen = new Uint8Array(total);
  const index = (col: number, row: number) => row * nav.cols + col;
  const startIndex = index(startCell.col, startCell.row);
  const goalIndex = index(goalCell.col, goalCell.row);
  const heuristic = (col: number, row: number) => {
    const dx = Math.abs(col - goalCell.col);
    const dy = Math.abs(row - goalCell.row);
    return dx + dy + (1.4142 - 2) * Math.min(dx, dy);
  };

  gScore[startIndex] = 0;
  fScore[startIndex] = heuristic(startCell.col, startCell.row);
  const open: number[] = [startIndex];
  inOpen[startIndex] = 1;
  let iterations = 0;

  while (open.length > 0 && iterations < maxIterations) {
    iterations += 1;
    let bestIdx = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (fScore[open[i]] < fScore[open[bestIdx]]) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    inOpen[current] = 0;
    if (current === goalIndex) {
      return reconstruct(cameFrom, current, nav);
    }
    closed[current] = 1;
    const col = current % nav.cols;
    const row = Math.floor(current / nav.cols);
    for (const [dx, dy, cost] of DIRS) {
      const nc = col + dx;
      const nr = row + dy;
      if (nc < 0 || nr < 0 || nc >= nav.cols || nr >= nav.rows) continue;
      if (nav.blocked[nr][nc]) continue;
      if (dx !== 0 && dy !== 0) {
        // Prevent cutting through wall corners.
        if (nav.blocked[row][nc] || nav.blocked[nr][col]) continue;
      }
      const ni = index(nc, nr);
      if (closed[ni]) continue;
      const tentative = gScore[current] + cost;
      if (tentative < gScore[ni]) {
        cameFrom[ni] = current;
        gScore[ni] = tentative;
        fScore[ni] = tentative + heuristic(nc, nr);
        if (!inOpen[ni]) {
          open.push(ni);
          inOpen[ni] = 1;
        }
      }
    }
  }
  return null;
}

function reconstruct(cameFrom: Int32Array, current: number, nav: NavGrid): Point[] {
  const cells: number[] = [];
  let node = current;
  let guard = 0;
  while (node !== -1 && guard < 20000) {
    cells.push(node);
    node = cameFrom[node];
    guard += 1;
  }
  cells.reverse();
  // Drop first cell (current position) and simplify collinear runs.
  const points: Point[] = [];
  for (let i = 1; i < cells.length; i += 1) {
    const cell = cells[i];
    const col = cell % nav.cols;
    const row = Math.floor(cell / nav.cols);
    if (points.length >= 1) {
      const prevCell = cells[i - 1];
      const prevPrev = cells[i - 2];
      if (prevPrev !== undefined) {
        const pc = prevCell % nav.cols;
        const pr = Math.floor(prevCell / nav.cols);
        const ppc = prevPrev % nav.cols;
        const ppr = Math.floor(prevPrev / nav.cols);
        if (col - pc === pc - ppc && row - pr === pr - ppr) continue;
      }
    }
    points.push(cellToWorld(nav, col, row));
  }
  return points;
}

/**
 * Line-of-sight test by dense sampling. Returns false when a blocked cell
 * interrupts the segment. Start/end cells are ignored near their sample edges.
 */
export function hasLineOfSight(nav: NavGrid, ax: number, ay: number, bx: number, by: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return true;
  const steps = Math.ceil(dist / (nav.tile * 0.28));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = ax + dx * t;
    const y = ay + dy * t;
    if (x < 0 || y < 0 || x > nav.cols * nav.tile || y > nav.rows * nav.tile) return false;
    const { col, row } = worldToCell(nav, x, y);
    if (nav.blocked[row][col]) return false;
  }
  return true;
}

/** Resolve the closest point on a walkable grid near a target. */
export function walkablePoint(nav: NavGrid, x: number, y: number, fallback: Point): Point {
  return nearestOpenWorld(nav, x, y, 10) ?? fallback;
}

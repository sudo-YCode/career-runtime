// Isometric projection. World axes: x and y lie on the floor, z points up.
// Screen X = (x - y)·cos30°, screen Y = (x + y)·sin30° - z.

export const C = Math.cos(Math.PI / 6);
export const S = 0.5;

export type P2 = [number, number];

export function iso(x: number, y: number, z = 0): P2 {
  return [(x - y) * C, (x + y) * S - z];
}

export function pts(list: P2[]): string {
  return list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

/**
 * SVG transform that maps flat 2D drawing coordinates onto the floor plane at height z,
 * with the drawing origin placed at world point (x, y). Anything drawn inside lies flat in the scene.
 */
export function plane(z = 0, x = 0, y = 0): string {
  const [ox, oy] = iso(x, y, z);
  return `matrix(${C} ${S} ${-C} ${S} ${ox.toFixed(2)} ${oy.toFixed(2)})`;
}

/** Screen radii of a floor circle of world radius r. */
export function isoRadii(r: number) {
  return { rx: r * Math.SQRT2 * C, ry: r * Math.SQRT2 * S };
}

export const deg = (d: number) => (d * Math.PI) / 180;

/**
 * World-plane angle whose projection points in screen direction `screenDeg`
 * (0° = right, 90° = down). Derived by inverting the projection.
 */
export const worldAngleFor = (screenDeg: number) => deg(screenDeg - 45);

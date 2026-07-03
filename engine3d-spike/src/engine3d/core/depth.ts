// Explicit Z-depth layer system (world units in the R3F scene). The camera physically moves
// through these planes, so parallax is real, not faked. Content sits toward the front; ambient
// recedes. (Cards/text content is a DOM layer over the canvas with matching CSS perspective.)
export const DEPTH = {
  background: -14,   // gradient ground / far glow
  particles: -9,     // constellation field + connecting lines
  shapes: -5,        // orbital rings, wireframe motifs
  cards: 0,          // primary content plane
  text: 1.5,         // headline / labels (slightly forward → crisp, parallaxes)
  foreground: 4,     // accent streaks / vignette bloom
} as const;

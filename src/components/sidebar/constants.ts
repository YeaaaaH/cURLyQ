// Collections is the sidebar's priority section — it takes all the leftover
// height once the fixed-size sections below it (Environments, and any future
// section following the same pattern) reserve their own space. Rather than
// letting a short list grow to fill whatever's left, those sections cap
// themselves to about 7 visible rows (~236px) and scroll internally beyond
// that — so a near-empty Environments list doesn't stretch to swallow space
// Collections could otherwise use, and a long one doesn't push Collections
// down to nothing.
export const CAPPED_LIST_MAX_HEIGHT_PX = 236;

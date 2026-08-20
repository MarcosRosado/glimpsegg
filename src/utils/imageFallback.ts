import React from 'react';

// Sleek dark SVG placeholder for heroes
export const HERO_PLACEHOLDER_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="72" viewBox="0 0 128 72"><rect width="128" height="72" fill="%23131b28"/><path d="M64 24a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-20 34c0-6.6 9-12 20-12s20 5.4 20 12z" fill="%23334155"/></svg>`;

// Sleek dark SVG placeholder for items
export const ITEM_PLACEHOLDER_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48" viewBox="0 0 64 48"><rect width="64" height="48" fill="%230f172a"/><path d="M32 16l8 8-8 8-8-8z" fill="%23475569"/></svg>`;

// Sleek avatar placeholder
export const AVATAR_PLACEHOLDER_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="%231e293b"/><circle cx="32" cy="24" r="12" fill="%2364748b"/><path d="M12 56c0-11 9-20 20-20s20 9 20 20z" fill="%2364748b"/></svg>`;

// Sleek dark SVG placeholder for abilities
export const ABILITY_PLACEHOLDER_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="%230f172a"/><polygon points="32,14 48,46 16,46" fill="%2306b6d4" opacity="0.6"/><circle cx="32" cy="34" r="5" fill="%2322d3ee"/></svg>`;

export function handleHeroImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = e.currentTarget;
  target.onerror = null; // Prevent infinite loop
  target.src = HERO_PLACEHOLDER_SVG;
}

export function handleItemImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = e.currentTarget;
  target.onerror = null;
  target.src = ITEM_PLACEHOLDER_SVG;
}

export function handleAbilityImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = e.currentTarget;
  target.onerror = null;
  target.src = ABILITY_PLACEHOLDER_SVG;
}

export function handleAvatarError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = e.currentTarget;
  target.onerror = null;
  target.src = AVATAR_PLACEHOLDER_SVG;
}

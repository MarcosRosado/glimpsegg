import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Compõe classes condicionais resolvendo conflitos de utilitário Tailwind. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

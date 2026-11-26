import React, { useState } from 'react';
import { ShoppingBag } from 'lucide-react';

export function BrandLogo({
  light = false,
  size = 'md',
}: {
  light?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const textSize = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-lg' : 'text-xl';
  const boxSize = size === 'lg' ? 'w-10 h-10' : size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
  const iconSize = size === 'lg' ? 20 : size === 'sm' ? 14 : 16;

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <span
        className={`${boxSize} rounded-lg flex items-center justify-center transition-colors shadow-xs ${
          light ? 'bg-[#E11D48] text-white' : 'bg-[#1E1B4B] text-white'
        }`}
      >
        <ShoppingBag size={iconSize} strokeWidth={2.2} />
      </span>
      <span
        className={`${textSize} font-bold tracking-[0.06em] font-['Poppins'] ${
          light ? 'text-white' : 'text-[#0F0D2E]'
        }`}
      >
        SHAIK<span className={light ? 'text-[#FB7185]' : 'text-[#E11D48]'}>CART</span>
      </span>
    </span>
  );
}

export function SafeImage({
  src,
  alt,
  className = '',
  fallbackTitle,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#E6EAF2] text-[#1E1B4B]/60 p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <ShoppingBag size={28} strokeWidth={1.5} className="mb-2 opacity-60" />
        <span className="text-xs font-medium line-clamp-2 max-w-[160px]">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

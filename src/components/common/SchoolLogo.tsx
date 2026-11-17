import React from 'react';

export const SCHOOL_LOGO_SRC = '/assets/aistudio/1_2524a41f.png';
export const SCHOOL_LOGO_ALT = 'Sangurur Comprehensive School Official Logo';

interface SchoolLogoProps {
  className?: string;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({ className = 'w-10 h-10' }) => {
  return (
    <img
      src={SCHOOL_LOGO_SRC}
      alt={SCHOOL_LOGO_ALT}
      className={`object-contain select-none ${className}`}
      draggable={false}
    />
  );
};

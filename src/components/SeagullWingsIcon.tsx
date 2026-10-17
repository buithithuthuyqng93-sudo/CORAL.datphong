import React from 'react';

interface SeagullWingsIconProps {
  className?: string;
}

/**
 * Biểu tượng Cánh Chim Biển Hải Âu (Seagull Wings in Flight)
 * Thiết kế cách điệu sải cánh chim biển lượn trên ngọn sóng đại dương Lý Sơn
 */
export const SeagullWingsIcon: React.FC<SeagullWingsIconProps> = ({ className = 'w-6 h-6' }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Cánh chim biển Seagull"
    >
      {/* Sải cánh chính chim hải âu vút cao */}
      <path
        d="M24 18.5C21.2 13 15.6 9 7.5 9C3.8 9 1.2 10.2 0 11C4.9 13.6 9.4 18.2 12 22.8C15 20.5 19.5 19 24 20.5C28.5 19 33 20.5 36 22.8C38.6 18.2 43.1 13.6 48 11C46.8 10.2 44.2 9 40.5 9C32.4 9 26.8 13 24 18.5Z"
      />
      {/* Thân và đuôi lượn khí động học */}
      <path
        d="M24 22.5C21 27 18 30.2 13.5 32.5C17.3 31.8 21.1 29.5 24 26.5C26.9 29.5 30.7 31.8 34.5 32.5C30 30.2 27 27 24 22.5Z"
        opacity="0.9"
      />
      {/* Gợn sóng đại dương biển đảo */}
      <path
        d="M14 37C17 35.5 20.5 35.5 23.5 37C26.5 38.5 30 38.5 33 37"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.75"
      />
      <path
        d="M18 41.5C20.2 40.4 22.8 40.4 25 41.5C27.2 42.6 29.8 42.6 32 41.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </svg>
  );
};

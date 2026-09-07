import React from 'react';

export default function SchoolLogo({ className, size = 32 }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 200 200" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M50 150 C 0 100, 100 0, 150 50 C 200 100, 100 200, 50 150" stroke="currentColor" strokeWidth="16" strokeLinecap="round" fill="none" />
      <path d="M150 150 C 200 100, 100 0, 50 50 C 0 100, 100 200, 150 150" stroke="currentColor" strokeWidth="16" strokeLinecap="round" fill="none" />
      <circle cx="50" cy="150" r="16" fill="currentColor" />
      <circle cx="150" cy="50" r="16" fill="currentColor" />
      <circle cx="150" cy="150" r="16" fill="currentColor" />
      <circle cx="50" cy="50" r="16" fill="currentColor" />
    </svg>
  );
}

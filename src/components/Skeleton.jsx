import React from 'react';

export default function Skeleton({ className, count = 1 }) {
  const skeletons = Array(count).fill(0);
  
  return (
    <>
      {skeletons.map((_, i) => (
        <div 
          key={i} 
          className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-lg ${className}`}
        ></div>
      ))}
    </>
  );
}

export const TableSkeleton = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="w-full">
        <div className="flex border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 gap-4">
          {Array(columns).fill(0).map((_, i) => (
            <Skeleton key={`h-${i}`} className="h-4 flex-1" />
          ))}
        </div>
        {Array(rows).fill(0).map((_, i) => (
          <div key={`r-${i}`} className="flex py-3 gap-4 border-b border-slate-50 last:border-0">
             {Array(columns).fill(0).map((_, j) => (
              <Skeleton key={`c-${i}-${j}`} className="h-6 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

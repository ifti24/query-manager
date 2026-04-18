import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface StatCarouselProps {
  children: React.ReactNode[];
  autoPlayInterval?: number;
  visibleCount?: number;
}

export default function StatCarousel({
  children,
  autoPlayInterval = 3500,
  visibleCount = 3,
}: StatCarouselProps) {
  const total = children.length;
  // Cloned: [...original, ...original, ...original]
  // Start at index = total so we're in the middle clone set
  const cloned = [...children, ...children, ...children];
  const [idx, setIdx] = useState(total);
  const [animated, setAnimated] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);
  const idxRef = useRef(idx);
  idxRef.current = idx;

  const shiftTo = (next: number, animate: boolean) => {
    setAnimated(animate);
    setIdx(next);
  };

  // After sliding past the end or before the start, silently jump to equivalent middle position
  useEffect(() => {
    if (!animated) return;
    if (idx >= total * 2) {
      const id = setTimeout(() => shiftTo(idx - total, false), 620);
      return () => clearTimeout(id);
    }
    if (idx < total) {
      const id = setTimeout(() => shiftTo(idx + total, false), 620);
      return () => clearTimeout(id);
    }
  }, [idx, animated, total]);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) {
        setAnimated(true);
        setIdx((i) => i + 1);
      }
    }, autoPlayInterval);
  };

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoPlayInterval]);

  const handlePrev = () => {
    setAnimated(true);
    setIdx((i) => i - 1);
    startTimer();
  };

  const handleNext = () => {
    setAnimated(true);
    setIdx((i) => i + 1);
    startTimer();
  };

  const handleDot = (dotIdx: number) => {
    setAnimated(true);
    setIdx(total + dotIdx);
    startTimer();
  };

  // Each tile occupies 1/visibleCount of the viewport
  // The strip is cloned.length tiles wide
  // translateX moves by one tile = 100% / cloned.length of the strip
  const tilePct = 100 / cloned.length;
  const translateX = -(idx * tilePct);
  const stripWidthPct = (cloned.length / visibleCount) * 100;

  const activeDot = ((idx - total) % total + total) % total;

  return (
    <div
      className="relative select-none"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div className="overflow-hidden">
        <div
          style={{
            display: 'flex',
            width: `${stripWidthPct}%`,
            transform: `translateX(${translateX}%)`,
            transition: animated ? 'transform 600ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
            willChange: 'transform',
          }}
        >
          {cloned.map((child, i) => (
            <div
              key={i}
              style={{ width: `${100 / cloned.length}%` }}
              className="px-2"
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* Prev button */}
      <button
        onClick={handlePrev}
        className="absolute left-0 top-1/2 -translate-y-6 -translate-x-5 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all z-10"
        aria-label="Previous"
      >
        <ChevronLeft className="w-5 h-5 text-slate-600" />
      </button>

      {/* Next button */}
      <button
        onClick={handleNext}
        className="absolute right-0 top-1/2 -translate-y-6 translate-x-5 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all z-10"
        aria-label="Next"
      >
        <ChevronRight className="w-5 h-5 text-slate-600" />
      </button>

      {/* Dot indicators */}
      <div className="flex justify-center items-center gap-2 mt-5">
        {children.map((_, i) => (
          <button
            key={i}
            onClick={() => handleDot(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === activeDot ? 'w-7 bg-slate-800' : 'w-2 bg-slate-300 hover:bg-slate-400'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

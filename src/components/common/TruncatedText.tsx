import { useState, useRef, useEffect } from 'react';

interface TruncatedTextProps {
  text: string;
  className?: string;
  maxLines?: number;
  spanFullRow?: boolean;
}

export function TruncatedText({ text, className = '', maxLines = 2, spanFullRow = false }: TruncatedTextProps) {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = textRef.current;
    if (element) {
      const checkOverflow = () => {
        setIsOverflowing(element.scrollHeight > element.clientHeight);
      };
      checkOverflow();

      const resizeObserver = new ResizeObserver(checkOverflow);
      resizeObserver.observe(element);

      return () => resizeObserver.disconnect();
    }
  }, [text]);

  const handleMouseEnter = () => {
    if (isOverflowing) {
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  const getTooltipStyle = () => {
    if (!spanFullRow || !containerRef.current) {
      return {};
    }

    const cell = containerRef.current.closest('td');
    const row = cell?.closest('tr');

    if (!cell || !row) {
      return {};
    }

    const cellRect = cell.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();

    const leftOffset = cellRect.left - rowRect.left;
    const adjustedWidth = rowRect.width - 12;

    return {
      left: `-${leftOffset - 6}px`,
      width: `${adjustedWidth}px`,
    };
  };

  return (
    <div
      ref={containerRef}
      className="relative group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={textRef}
        className={`${className}`}
        style={{
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {text}
      </div>
      {showTooltip && isOverflowing && (
        <div
          className="absolute top-0 z-[100] bg-white border-2 border-slate-400 shadow-2xl rounded-lg p-3 pointer-events-auto"
          style={spanFullRow ? getTooltipStyle() : { left: 0, minWidth: '100%' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className={`text-slate-900 break-words ${className}`}>
            {text}
          </div>
        </div>
      )}
    </div>
  );
}

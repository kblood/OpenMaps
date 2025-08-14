import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

interface MobileBottomSheetProps {
  children: React.ReactNode;
  title?: string;
  initialHeight?: 'collapsed' | 'half' | 'full';
  className?: string;
}

const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  children,
  title,
  initialHeight = 'collapsed',
  className
}) => {
  const [height, setHeight] = useState<'collapsed' | 'half' | 'full'>(initialHeight);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  const getHeightClass = () => {
    switch (height) {
      case 'collapsed':
        return 'h-16';
      case 'half':
        return 'h-1/2';
      case 'full':
        return 'h-5/6';
      default:
        return 'h-16';
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
    setStartHeight(sheetRef.current?.offsetHeight || 0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !sheetRef.current) return;

    const currentY = e.touches[0].clientY;
    const deltaY = startY - currentY;
    const windowHeight = window.innerHeight;
    
    // Calculate new height based on drag
    const newHeight = Math.min(
      Math.max(64, startHeight + deltaY), // Minimum 64px (collapsed)
      windowHeight * 0.83 // Maximum 83% of screen height
    );

    // Determine which state we should snap to
    if (newHeight < windowHeight * 0.2) {
      setHeight('collapsed');
    } else if (newHeight < windowHeight * 0.6) {
      setHeight('half');
    } else {
      setHeight('full');
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const toggleHeight = () => {
    if (height === 'collapsed') {
      setHeight('half');
    } else if (height === 'half') {
      setHeight('full');
    } else {
      setHeight('collapsed');
    }
  };

  useEffect(() => {
    const preventScroll = (e: TouchEvent) => {
      if (isDragging) {
        e.preventDefault();
      }
    };

    if (isDragging) {
      document.addEventListener('touchmove', preventScroll, { passive: false });
    }

    return () => {
      document.removeEventListener('touchmove', preventScroll);
    };
  }, [isDragging]);

  return (
    <div
      ref={sheetRef}
      className={clsx(
        "fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl transition-all duration-300 ease-out z-[1000]",
        getHeightClass(),
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Handle */}
      <div
        className="flex flex-col items-center py-2 cursor-pointer"
        onClick={toggleHeight}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full mb-2" />
        {title && (
          <div className="flex items-center">
            <h3 className="text-lg font-semibold text-gray-900 mr-2">{title}</h3>
            {height === 'collapsed' ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export default MobileBottomSheet;
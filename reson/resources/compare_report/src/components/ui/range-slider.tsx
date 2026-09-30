import * as React from "react";
import { cn } from "./utils";

export interface RangeSliderProps {
  className?: string;
  value?: [number, number];
  defaultValue?: [number, number];
  onValueChange?: (value: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

function RangeSlider({
  className,
  value: controlledValue,
  defaultValue = [0, 100],
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
}: RangeSliderProps) {
  const [internalValue, setInternalValue] = React.useState<[number, number]>(defaultValue);
  const value = controlledValue !== undefined ? controlledValue : internalValue;
  
  const sliderRef = React.useRef<HTMLDivElement>(null);
  const [activeThumb, setActiveThumb] = React.useState<'min' | 'max' | null>(null);

  const handleValueChange = React.useCallback((newValue: [number, number]) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  }, [controlledValue, onValueChange]);

  const calculateValue = React.useCallback((clientX: number) => {
    if (!sliderRef.current) return min;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawValue = min + percentage * (max - min);
    const steppedValue = Math.round(rawValue / step) * step;
    
    return Math.max(min, Math.min(max, steppedValue));
  }, [min, max, step]);

  const handleMouseDown = React.useCallback((thumb: 'min' | 'max') => (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setActiveThumb(thumb);
  }, [disabled]);

  React.useEffect(() => {
    if (!activeThumb) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newValue = calculateValue(e.clientX);
      
      if (activeThumb === 'min') {
        handleValueChange([Math.min(newValue, value[1]), value[1]]);
      } else {
        handleValueChange([value[0], Math.max(newValue, value[0])]);
      }
    };

    const handleMouseUp = () => {
      setActiveThumb(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activeThumb, calculateValue, handleValueChange, value]);

  const minPercentage = ((value[0] - min) / (max - min)) * 100;
  const maxPercentage = ((value[1] - min) / (max - min)) * 100;

  return (
    <div
      ref={sliderRef}
      className={cn(
        "relative flex w-full touch-none items-center select-none h-6",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
        <div
          className="absolute h-full bg-primary transition-all"
          style={{ 
            left: `${minPercentage}%`,
            width: `${maxPercentage - minPercentage}%` 
          }}
        />
      </div>
      <div
        className="absolute block size-5 shrink-0 rounded-full border-2 border-primary bg-background shadow-md ring-ring/50 transition-[color,box-shadow] hover:ring-4 hover:scale-110 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 cursor-pointer z-10"
        style={{ left: `calc(${minPercentage}% - 10px)` }}
        onMouseDown={handleMouseDown('min')}
      />
      <div
        className="absolute block size-5 shrink-0 rounded-full border-2 border-primary bg-background shadow-md ring-ring/50 transition-[color,box-shadow] hover:ring-4 hover:scale-110 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 cursor-pointer z-10"
        style={{ left: `calc(${maxPercentage}% - 10px)` }}
        onMouseDown={handleMouseDown('max')}
      />
    </div>
  );
}

export { RangeSlider };

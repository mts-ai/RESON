import { useTheme } from "../../contexts/ThemeContext";
import { useRef, useEffect } from "react";

interface DualRangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  className?: string;
}

export function DualRangeSlider({
  min,
  max,
  value,
  onChange,
  className = "",
}: DualRangeSliderProps) {
  const { theme } = useTheme();
  const minRef = useRef<HTMLInputElement>(null);
  const maxRef = useRef<HTMLInputElement>(null);

  const safeMax = Math.max(min, max);
  const clampedMin = Math.min(Math.max(value[0], min), safeMax);
  const clampedMax = Math.min(Math.max(value[1], min), safeMax);
  const rangeValue: [number, number] =
    clampedMin <= clampedMax ? [clampedMin, clampedMax] : [clampedMax, clampedMin];

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = parseInt(e.target.value, 10);
    onChange([Math.min(newMin, rangeValue[1]), rangeValue[1]]);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = parseInt(e.target.value, 10);
    onChange([rangeValue[0], Math.max(newMax, rangeValue[0])]);
  };

  const getPercentage = (val: number) => {
    if (safeMax === min) return 0;
    return ((val - min) / (safeMax - min)) * 100;
  };

  useEffect(() => {
    // Bring the active slider to front
    const handleMinMouseDown = () => {
      if (minRef.current && maxRef.current) {
        minRef.current.style.zIndex = "5";
        maxRef.current.style.zIndex = "4";
      }
    };

    const handleMaxMouseDown = () => {
      if (minRef.current && maxRef.current) {
        minRef.current.style.zIndex = "4";
        maxRef.current.style.zIndex = "5";
      }
    };

    const minInput = minRef.current;
    const maxInput = maxRef.current;

    minInput?.addEventListener("mousedown", handleMinMouseDown);
    maxInput?.addEventListener("mousedown", handleMaxMouseDown);
    minInput?.addEventListener("touchstart", handleMinMouseDown);
    maxInput?.addEventListener("touchstart", handleMaxMouseDown);

    return () => {
      minInput?.removeEventListener("mousedown", handleMinMouseDown);
      maxInput?.removeEventListener("mousedown", handleMaxMouseDown);
      minInput?.removeEventListener("touchstart", handleMinMouseDown);
      maxInput?.removeEventListener("touchstart", handleMaxMouseDown);
    };
  }, []);

  return (
    <div className={`relative h-10 flex items-center overflow-hidden px-0.5 ${className}`}>
      {/* Track Background */}
      <div
        className={`absolute w-full h-1.5 rounded-full ${
          theme === "dark" ? "bg-[#2A2D35]" : "bg-gray-300"
        }`}
        style={{ top: "50%", transform: "translateY(-50%)" }}
      />

      {/* Active Range */}
      <div
        className="absolute h-1.5 rounded-full bg-[#8B5CF6]"
        style={{
          left: `${getPercentage(rangeValue[0])}%`,
          right: `${100 - getPercentage(rangeValue[1])}%`,
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />

      {/* Min Range Input */}
      <input
        ref={minRef}
        type="range"
        min={min}
        max={safeMax}
        value={rangeValue[0]}
        onChange={handleMinChange}
        className="dual-range-slider"
        style={{
          position: "absolute",
          width: "100%",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 5,
        }}
      />

      {/* Max Range Input */}
      <input
        ref={maxRef}
        type="range"
        min={min}
        max={safeMax}
        value={rangeValue[1]}
        onChange={handleMaxChange}
        className="dual-range-slider"
        style={{
          position: "absolute",
          width: "100%",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 4,
        }}
      />

      <style>{`
        .dual-range-slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          pointer-events: none;
          height: 1.5px;
          margin: 0;
          padding: 0;
        }

        .dual-range-slider::-webkit-slider-runnable-track {
          width: 100%;
          height: 1.5px;
          cursor: pointer;
          background: transparent;
        }

        .dual-range-slider::-moz-range-track {
          width: 100%;
          height: 1.5px;
          cursor: pointer;
          background: transparent;
        }

        .dual-range-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          border: 3px solid #8B5CF6;
          cursor: pointer;
          pointer-events: auto;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          transition: transform 0.1s ease;
          margin-top: -8px;
        }

        .dual-range-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          border: 3px solid #8B5CF6;
          cursor: pointer;
          pointer-events: auto;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          transition: transform 0.1s ease;
        }

        .dual-range-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 2px 6px rgba(139, 92, 246, 0.4);
        }

        .dual-range-slider::-moz-range-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 2px 6px rgba(139, 92, 246, 0.4);
        }

        .dual-range-slider::-webkit-slider-thumb:active {
          transform: scale(1.2);
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.5);
        }

        .dual-range-slider::-moz-range-thumb:active {
          transform: scale(1.2);
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.5);
        }

        .dual-range-slider:focus {
          outline: none;
        }
      `}</style>
    </div>
  );
}
"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export function InteractiveGridPattern({
  width = 40,
  height = 40,
  squares = [24, 24],
  className,
  squaresClassName,
  ...props
}) {
  const [horizontal, vertical] = squares;
  const [hoveredSquare, setHoveredSquare] = useState(null);
  const cells = useMemo(() => Array.from({ length: horizontal * vertical }), [horizontal, vertical]);

  return (
    <svg
      width={width * horizontal}
      height={height * vertical}
      className={cn(
        "absolute inset-0 h-full w-full border border-gray-400/30",
        className
      )}
      {...props}
    >
      {cells.map((_, index) => {
        const x = (index % horizontal) * width;
        const y = Math.floor(index / horizontal) * height;
        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={width}
            height={height}
            className={cn(
              "stroke-gray-400/30 transition-colors duration-100 ease-in-out not-[&:hover]:duration-500",
              hoveredSquare === index ? "fill-gray-300/30" : "fill-transparent",
              squaresClassName
            )}
            onMouseEnter={() => setHoveredSquare(index)}
            onMouseLeave={() => setHoveredSquare(null)}
          />
        );
      })}
    </svg>
  );
}

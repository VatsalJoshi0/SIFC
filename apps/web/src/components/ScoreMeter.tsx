import React from "react";

interface ScoreMeterProps {
  score: number;
  category: "FAIR" | "GOOD" | "VERY_GOOD";
  pointsNeeded?: number;
  nextCategory?: string;
  size?: number;
}

export const ScoreMeter: React.FC<ScoreMeterProps> = ({
  score,
  category,
  pointsNeeded,
  nextCategory,
  size = 280,
}) => {
  // Clamped score between 500 and 900
  const clampedScore = Math.max(500, Math.min(900, score));
  const fraction = (clampedScore - 500) / 400;

  // Geometry
  const radius = 95;
  const strokeWidth = 14;
  const center = 140;
  // 270 degree arc of circle: 2 * PI * radius * (270 / 360)
  const fullCircumference = 2 * Math.PI * radius;
  const arcLength = fullCircumference * 0.75; // ~447.67
  const filledLength = fraction * arcLength;

  // Category styling
  const config = {
    FAIR: {
      color: "#d97706", // amber
      bgClass: "text-amber-600 bg-amber-50 border-amber-200",
      label: "Fair",
      bandClass: "border-amber-500",
    },
    GOOD: {
      color: "#0d9488", // teal
      bgClass: "text-teal-700 bg-teal-50 border-teal-200",
      label: "Good",
      bandClass: "border-teal-500",
    },
    VERY_GOOD: {
      color: "#16a34a", // green
      bgClass: "text-green-700 bg-green-50 border-green-200",
      label: "Very Good",
      bandClass: "border-green-500",
    },
  }[category] || {
    color: "#0d9488",
    bgClass: "text-teal-700 bg-teal-50 border-teal-200",
    label: "Good",
    bandClass: "border-teal-500",
  };

  const accessibleText = `VAI Score ${score}, ${config.label} category${
    pointsNeeded && nextCategory ? `, ${pointsNeeded} points to ${nextCategory === "VERY_GOOD" ? "Very Good" : nextCategory}` : ""
  }`;

  // Tick positions on the 270 degree arc (from 135 deg to 405 deg)
  const getAngle = (sc: number) => {
    const f = (sc - 500) / 400;
    return 135 + f * 270;
  };

  const getCoordinates = (angleInDegrees: number, r: number) => {
    const rad = (angleInDegrees * Math.PI) / 180;
    return {
      x: center + r * Math.cos(rad),
      y: center + r * Math.sin(rad),
    };
  };

  const tick650 = getCoordinates(getAngle(650), radius);
  const tick750 = getCoordinates(getAngle(750), radius);

  return (
    <div
      className="flex flex-col items-center justify-center p-4"
      role="img"
      aria-label={accessibleText}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox="0 0 280 280"
          className="w-full h-full transform"
          aria-hidden="true"
        >
          {/* Background Arc (270 degrees) */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${fullCircumference}`}
            strokeLinecap="round"
            transform={`rotate(135 ${center} ${center})`}
          />

          {/* Active Score Arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={config.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${filledLength} ${fullCircumference}`}
            strokeLinecap="round"
            transform={`rotate(135 ${center} ${center})`}
            className="transition-all duration-1000 ease-out"
          />

          {/* Band Divider Markers at 650 (Fair/Good) and 750 (Good/Very Good) */}
          <circle
            cx={tick650.x}
            cy={tick650.y}
            r="3.5"
            fill="#ffffff"
            stroke="#64748b"
            strokeWidth="2"
          />
          <circle
            cx={tick750.x}
            cy={tick750.y}
            r="3.5"
            fill="#ffffff"
            stroke="#64748b"
            strokeWidth="2"
          />

          {/* Range Labels */}
          <text
            x="48"
            y="235"
            fill="#64748b"
            fontSize="12"
            fontWeight="600"
            textAnchor="middle"
          >
            500
          </text>
          <text
            x="232"
            y="235"
            fill="#64748b"
            fontSize="12"
            fontWeight="600"
            textAnchor="middle"
          >
            900
          </text>
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2 select-none">
          <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">
            VAI Score
          </span>
          <span className="text-5xl font-extrabold tracking-tight text-slate-900">
            {score}
          </span>
          <span
            className={`mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${config.bgClass}`}
          >
            {config.label}
          </span>
        </div>
      </div>

      {/* Visually hidden paragraph for screen readers per TRD 4.4 */}
      <p className="sr-only">{accessibleText}</p>

      {/* Band Guide */}
      <div className="flex items-center gap-4 text-xs font-medium text-slate-600 mt-2">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" aria-hidden="true" />
          Fair (500–649)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-600" aria-hidden="true" />
          Good (650–749)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-600" aria-hidden="true" />
          Very Good (750–900)
        </span>
      </div>
    </div>
  );
};

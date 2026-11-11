import React from 'react';
import { Platform } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, Segoe UI, sans-serif' : undefined;

interface Props {
  values: number[];
  labels: string[];
  width: number;
  height?: number;
  /** Text shown for the top gridline (e.g. "12 000 kg"). */
  maxLabel?: string;
  color?: string;
}

/** Simple bar chart. The latest bar is full colour, earlier ones are dimmed so "now" reads first. */
export default function BarChart({ values, labels, width, height = 150, maxLabel, color = colors.accent }: Props) {
  const padTop = 16, padBottom = 20, padX = 4;
  const max = Math.max(1, ...values);
  const plotH = height - padTop - padBottom;
  const n = Math.max(1, values.length);
  const slot = (width - padX * 2) / n;
  const barW = Math.max(3, Math.min(34, slot * 0.68));
  const last = values.length - 1;
  const tickIdx = new Set([0, Math.floor(last / 2), last]);

  return (
    <Svg width={width} height={height}>
      <Line x1={0} x2={width} y1={padTop} y2={padTop} stroke={colors.border} strokeDasharray="3 4" />
      <Line x1={0} x2={width} y1={padTop + plotH} y2={padTop + plotH} stroke={colors.border} />
      {maxLabel && (
        <SvgText x={width} y={padTop - 4} fill={colors.textDim} fontSize={10} fontFamily={FONT} textAnchor="end">{maxLabel}</SvgText>
      )}
      {values.map((v, i) => {
        const h = v <= 0 ? 0 : Math.max(2, (v / max) * plotH);
        const x = padX + i * slot + (slot - barW) / 2;
        return (
          <Rect
            key={i}
            x={x}
            y={padTop + plotH - h}
            width={barW}
            height={h}
            rx={3}
            fill={color}
            opacity={i === last ? 1 : 0.5}
          />
        );
      })}
      {labels.map((l, i) =>
        tickIdx.has(i) ? (
          <SvgText
            key={i}
            x={padX + i * slot + slot / 2}
            y={height - 5}
            fill={colors.textDim}
            fontSize={10} fontFamily={FONT}
            textAnchor={i === 0 && n > 2 ? 'start' : i === last && n > 2 ? 'end' : 'middle'}
          >
            {l}
          </SvgText>
        ) : null,
      )}
    </Svg>
  );
}

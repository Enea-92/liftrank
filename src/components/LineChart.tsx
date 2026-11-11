import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

interface Props {
  values: number[];
  labels?: string[];
  width: number;
  height?: number;
  color?: string;
  unitLabel?: string;
}

export default function LineChart({ values, labels, width, height = 180, color = colors.accent, unitLabel }: Props) {
  if (values.length === 0) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>No data yet</Text>
      </View>
    );
  }
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(1, max * 0.1);
  const lo = min - span * 0.1;
  const hi = max + span * 0.1;

  const x = (i: number) => padL + (values.length === 1 ? w / 2 : (i / (values.length - 1)) * w);
  const y = (v: number) => padT + h - ((v - lo) / (hi - lo)) * h;

  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const ticks = [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1];

  return (
    <Svg width={width} height={height}>
      {ticks.map((t, i) => (
        <React.Fragment key={i}>
          <Line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
          <SvgText x={padL - 6} y={y(t) + 4} fill={colors.textDim} fontSize={10} textAnchor="end">
            {Math.round(t)}
          </SvgText>
        </React.Fragment>
      ))}
      {values.length > 1 && <Polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} />}
      {values.map((v, i) => (
        <Circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={color} />
      ))}
      {labels && labels.length > 0 && (
        <>
          <SvgText x={x(0)} y={height - 6} fill={colors.textDim} fontSize={10} textAnchor={values.length === 1 ? 'middle' : 'start'}>
            {labels[0]}
          </SvgText>
          {values.length > 1 && (
            <SvgText x={x(values.length - 1)} y={height - 6} fill={colors.textDim} fontSize={10} textAnchor="end">
              {labels[labels.length - 1]}
            </SvgText>
          )}
        </>
      )}
      {unitLabel && (
        <SvgText x={width - padR} y={padT} fill={colors.textDim} fontSize={10} textAnchor="end">
          {unitLabel}
        </SvgText>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textDim },
});

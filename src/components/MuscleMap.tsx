import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { Chip } from './ui';
import { colors } from '../theme';
import type { Muscle } from '../data/exercises';
import { RANK_COLORS, RankName } from '../data/ranks';

type Side = 'front' | 'back';
export type MuscleColors = Partial<Record<Muscle, RankName | null>>;

const BASE = '#34343B';
const NEUTRAL = '#1B1B1E';

interface Props {
  ranks: MuscleColors;
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
}

/** Stylised front/back body. Each ranked muscle is filled with its rank colour; tap to select. */
export default function MuscleMap({ ranks, selected, onSelect }: Props) {
  const [side, setSide] = useState<Side>('front');

  const fill = (m: Muscle) => {
    const r = ranks[m];
    return r ? RANK_COLORS[r] : BASE;
  };
  const stroke = (m: Muscle) => (selected === m ? colors.text : colors.bg);
  const sw = (m: Muscle) => (selected === m ? 2.5 : 1.5);
  const p = (m: Muscle) => ({
    fill: fill(m),
    stroke: stroke(m),
    strokeWidth: sw(m),
    onPress: () => onSelect(m),
  });

  // Draw the left half; the same shapes are mirrored for the right half.
  const half = (mirror: boolean) => (
    <G key={mirror ? 'r' : 'l'} transform={mirror ? 'translate(200,0) scale(-1,1)' : undefined}>
      {/* neutral limb bases so the figure reads as one body */}
      <Ellipse cx={50} cy={116} rx={11} ry={25} fill={NEUTRAL} />
      <Ellipse cx={40} cy={164} rx={9} ry={28} fill={NEUTRAL} />
      <Circle cx={37} cy={196} r={7} fill={NEUTRAL} />
      <Rect x={66} y={190} width={34} height={36} rx={12} fill={NEUTRAL} />
      <Ellipse cx={83} cy={254} rx={19} ry={55} fill={NEUTRAL} />
      <Circle cx={81} cy={306} r={11} fill={NEUTRAL} />
      <Ellipse cx={80} cy={356} rx={13} ry={37} fill={NEUTRAL} />
      <Ellipse cx={80} cy={392} rx={11} ry={6} fill={NEUTRAL} />
      {side === 'front' ? (
        <>
          <Ellipse cx={62} cy={76} rx={16} ry={14} {...p('Shoulders')} />
          <Path d="M98 70 L98 106 Q78 112 66 98 Q64 80 80 72 Z" {...p('Chest')} />
          <Ellipse cx={48} cy={114} rx={9} ry={21} {...p('Biceps')} />
          <Ellipse cx={82} cy={252} rx={17} ry={50} {...p('Quads')} />
          <Ellipse cx={80} cy={356} rx={11} ry={34} {...p('Calves')} />
        </>
      ) : (
        <>
          <Ellipse cx={62} cy={76} rx={16} ry={14} {...p('Shoulders')} />
          <Path d="M100 64 Q76 68 68 92 Q66 126 84 150 L100 154 Z" {...p('Back')} />
          <Ellipse cx={48} cy={114} rx={9} ry={21} {...p('Triceps')} />
          <Ellipse cx={86} cy={206} rx={15} ry={18} {...p('Glutes')} />
          <Ellipse cx={82} cy={268} rx={16} ry={40} {...p('Hamstrings')} />
          <Ellipse cx={80} cy={356} rx={11} ry={34} {...p('Calves')} />
        </>
      )}
    </G>
  );

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row' }}>
        <Chip label="Front" active={side === 'front'} onPress={() => setSide('front')} />
        <Chip label="Back" active={side === 'back'} onPress={() => setSide('back')} />
      </View>
      <Svg width={220} height={420} viewBox="0 0 200 400">
        {/* head, neck and torso base */}
        <Circle cx={100} cy={28} r={20} fill={NEUTRAL} />
        <Rect x={92} y={46} width={16} height={16} fill={NEUTRAL} />
        <Rect x={68} y={64} width={64} height={134} rx={16} fill={NEUTRAL} />
        {half(false)}
        {half(true)}
        {side === 'front' && <Rect x={85} y={112} width={30} height={68} rx={8} {...p('Abs')} />}
      </Svg>
    </View>
  );
}

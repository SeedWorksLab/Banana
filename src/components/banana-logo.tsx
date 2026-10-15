import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { useAppTheme } from '../theme';

interface BananaLogoProps {
  size?: number;
}

export function BananaLogo({ size = 40 }: BananaLogoProps) {
  const theme = useAppTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path
        d="M8 20 C12 48 52 48 56 20 C50 38 14 38 8 20 Z"
        fill={theme.brand.primary.base}
      />
    </Svg>
  );
}

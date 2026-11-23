import React from 'react';
import { Image } from 'react-native';

interface BananaLogoProps {
  size?: number;
}

export function BananaLogo({ size = 40 }: BananaLogoProps) {
  return (
    <Image source={require('../../assets/banana-logo.jpg')}
      style={{ width: size, height: size }} resizeMode="contain"
      accessible accessibilityRole="image" accessibilityLabel="Banana logo" testID="banana-logo" />
  );
}

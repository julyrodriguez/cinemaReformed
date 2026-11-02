import React from 'react';
import { StyleSheet } from './react-native';

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: any;
  className?: string;
  onPress?: (e: any) => void;
};

const glyphMapProxy = new Proxy(
  {},
  {
    get: (_target, prop) => String(prop),
    has: () => true,
  }
);

function flattenStyle(style: any): React.CSSProperties {
  if (!style) return {};
  try {
    const flat = StyleSheet.flatten(style) || {};
    return flat as React.CSSProperties;
  } catch {
    if (Array.isArray(style)) {
      return Object.assign({}, ...style.filter(Boolean));
    }
    return typeof style === 'object' ? style : {};
  }
}

export const MaterialCommunityIcons: React.FC<IconProps> & { glyphMap: Record<string, string> } = ({
  name,
  size = 20,
  color = 'currentColor',
  style,
  className = '',
  onPress,
}) => {
  const flat = flattenStyle(style);
  return (
    <i
      onClick={onPress}
      className={`mdi mdi-${name} inline-flex items-center justify-center select-none leading-none ${className}`}
      style={{
        fontSize: typeof size === 'number' ? `${size}px` : size,
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size,
        color,
        ...flat,
      }}
      aria-hidden="true"
    />
  );
};

MaterialCommunityIcons.glyphMap = glyphMapProxy as Record<string, string>;

export const Ionicons = MaterialCommunityIcons;
export const Feather = MaterialCommunityIcons;
export const FontAwesome = MaterialCommunityIcons;
export const MaterialIcons = MaterialCommunityIcons;

export default {
  MaterialCommunityIcons,
  Ionicons,
  Feather,
  FontAwesome,
  MaterialIcons,
};

import React from 'react';
// @ts-ignore
import * as RNW from 'react-native-web';

export const View = RNW.View;
export const Text = RNW.Text;
export const ScrollView = RNW.ScrollView;
export const FlatList = RNW.FlatList;
export const Image = RNW.Image;
export const StyleSheet = RNW.StyleSheet;
export const Animated = RNW.Animated;
export const Easing = RNW.Easing;
export const Switch = RNW.Switch;
export const ActivityIndicator = RNW.ActivityIndicator;
export const Pressable = RNW.Pressable;
export const TouchableOpacity = RNW.TouchableOpacity;
export const TouchableWithoutFeedback = RNW.TouchableWithoutFeedback;
export const KeyboardAvoidingView = RNW.KeyboardAvoidingView;
export const Keyboard = RNW.Keyboard;
export const useWindowDimensions = RNW.useWindowDimensions;
export const Modal = RNW.Modal;
export const TextInput = RNW.TextInput;

export const Platform = {
  OS: 'web' as const,
  Version: 1,
  isTV: false,
  isTesting: false,
  select: (obj: Record<string, any>) => ('web' in obj ? obj.web : obj.default),
};

export interface AlertButton {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export const Alert = {
  alert: (title: string, message?: string, buttons?: AlertButton[]) => {
    const fullText = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length === 0) {
      window.alert(fullText);
      return;
    }
    if (buttons.length === 1) {
      window.alert(fullText);
      buttons[0]?.onPress?.();
      return;
    }
    const cancelBtn = buttons.find((b) => b.style === 'cancel') || buttons[0];
    const confirmBtn = buttons.find((b) => b !== cancelBtn) || buttons[1];
    const confirmed = window.confirm(fullText);
    if (confirmed) {
      confirmBtn?.onPress?.();
    } else {
      cancelBtn?.onPress?.();
    }
  },
};

export type ViewStyle = any;
export type TextStyle = any;
export type ImageStyle = any;

export default {
  View,
  Text,
  ScrollView,
  FlatList,
  Image,
  StyleSheet,
  Animated,
  Easing,
  Switch,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Keyboard,
  useWindowDimensions,
  Modal,
  TextInput,
  Platform,
  Alert,
};

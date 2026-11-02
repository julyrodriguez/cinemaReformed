import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { THEME } from "@/lib/theme";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
};

export default function SectionCard({ children, style }: Props) {
  return (
    <View style={[styles.base, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.035,
    shadowRadius: 3,
    elevation: 1,
  },
});

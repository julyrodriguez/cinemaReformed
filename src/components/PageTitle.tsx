import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { THEME } from "@/lib/theme";
import { useAppLayout } from "@/lib/useAppLayout";

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  center?: boolean;
};

export default function PageTitle({ title, subtitle, right, center }: Props) {
  const { isDesktop } = useAppLayout();

  return (
    <View
      style={[
        styles.wrap,
        isDesktop && styles.wrapDesktop,
        center && { alignItems: "center", justifyContent: "center" },
      ]}
    >
      <View style={[styles.left, center && { alignItems: "center" }]}>
        <Text
          style={[
            styles.title,
            center && { textAlign: "center" },
          ]}
        >
          {title}
        </Text>

        {!!subtitle && (
          <Text style={[styles.subtitle, center && { textAlign: "center" }]}>
            {subtitle}
          </Text>
        )}
      </View>

      {!!right && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    marginBottom: 18,
    gap: 8,
  },

  wrapDesktop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  left: {
    flexShrink: 1,
  },

  right: {
    marginTop: 4,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: THEME.colors.text,
    letterSpacing: -0.5,
  },

  subtitle: {
    marginTop: 3,
    fontSize: 13.5,
    color: THEME.colors.textSoft,
    lineHeight: 20,
  },
});

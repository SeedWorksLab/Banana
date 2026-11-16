import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { useAppTheme } from '../theme';
import type { BananaTheme } from '../theme';
import { useI18n } from '../i18n';

const TAB_ICONS: Record<string, ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  index: 'calendar-week-outline',
  recipes: 'silverware-fork-knife',
  shopping: 'cart-outline',
  deals: 'sale-outline',
  settings: 'cog-outline',
};

function TabItem({
  icon,
  label,
  isFocused,
  onPress,
  onLongPress,
  theme,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  theme: BananaTheme;
}) {
  const color = isFocused ? theme.colors.primary : theme.colors.onSurfaceVariant;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
    >
      <View
        style={[
          styles.indicator,
          {
            backgroundColor: isFocused ? theme.colors.primaryContainer : 'transparent',
             borderRadius: theme.radii.pill,
            paddingHorizontal: theme.spacing[4],
            paddingVertical: theme.spacing[1],
          },
        ]}
      >
        <MaterialCommunityIcons name={icon} color={color} size={24} />
      </View>
      <Text variant="labelSmall" style={{ color }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function CustomTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useAppTheme();
  const { t } = useI18n();
  return (
    <View
      style={[
        styles.bar,
          {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.borders.border,
            paddingTop: theme.spacing[1],
             paddingBottom: insets.bottom + theme.spacing[2],
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const label = route.name === 'index' ? t('nav.plan')
          : route.name === 'recipes' ? t('nav.recipes')
          : route.name === 'shopping' ? t('nav.shopping')
          : route.name === 'deals' ? t('nav.deals')
          : route.name === 'settings' ? t('nav.settings')
          : options.title ?? route.name;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };
        const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });
        return (
          <TabItem
            key={route.key}
            icon={TAB_ICONS[route.name] ?? 'circle-outline'}
            label={label}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
            theme={theme}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

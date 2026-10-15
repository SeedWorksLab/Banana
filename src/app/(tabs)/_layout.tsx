import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { CustomTabBar } from '../../components/custom-tab-bar';
import { useAppTheme } from '../../theme';

export default function TabsLayout() {
  const theme = useAppTheme();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          sceneStyle: { backgroundColor: theme.colors.background },
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.onSurface,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
        tabBar={(props) => <CustomTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: 'Plan' }} />
        <Tabs.Screen name="recipes" options={{ title: 'Recipes' }} />
        <Tabs.Screen name="shopping" options={{ title: 'Shopping' }} />
        <Tabs.Screen name="deals" options={{ title: 'Deals' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

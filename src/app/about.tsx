import React from 'react';
import { Image, Linking, StyleSheet } from 'react-native';
import { List, Text } from 'react-native-paper';

import { ScreenFade } from '../components/screen-fade';
import { KeyboardAwareScrollView } from '../components/keyboard-aware-scroll-view';
import { useAppTheme } from '../theme';
import { releaseInfo } from '../config/release-info';
import { GITHUB_REPO_URL } from '../config/repository';

export default function AboutScreen() {
  const theme = useAppTheme();

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={[styles.container, { padding: theme.spacing[4] }]}>
        <Image
          source={require('../../assets/banana-banner.jpg')}
          style={[styles.banner, { borderRadius: theme.radii.large }]}
          resizeMode="cover"
          accessibilityLabel="Banana banner"
        />
        <Text variant="headlineSmall">
          Banana
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Plans your next week of meals, tells you what to buy, and spends your budget where the deals are.
        </Text>

        <Text variant="titleSmall" style={styles.section}>
          Version
        </Text>
        <Text variant="bodyMedium">{releaseInfo.version}</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Build {releaseInfo.versionCode}
        </Text>

        <Text variant="titleSmall" style={styles.section}>
          Privacy
        </Text>
        <Text variant="bodyMedium" style={styles.body}>
          Everything is stored in one SQLite database on this device. There is no account, no server,
          no advertising, no analytics and no crash reporting.
        </Text>
        <Text variant="bodyMedium" style={styles.body}>
          The only network requests the app makes are to the public offers pages at the stores you
          enable, and to an AI provider you configure yourself. Your API key is stored only on this
          device and is stripped from every backup.
        </Text>

        <Text variant="titleSmall" style={styles.section}>
          Source
        </Text>
        <List.Item
          title="View the repository"
          description={GITHUB_REPO_URL}
          left={(props) => <List.Icon {...props} icon="source-branch" />}
          right={(props) => <List.Icon {...props} icon="open-in-new" />}
          onPress={() => void Linking.openURL(GITHUB_REPO_URL)}
        />
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  banner: {
    width: '100%',
    height: 160,
    marginBottom: 16,
  },
  section: {
    marginTop: 24,
    marginBottom: 4,
  },
  body: {
    marginBottom: 12,
  },
});

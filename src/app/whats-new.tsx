import React from 'react';
import { Card, Text, ActivityIndicator, Button } from 'react-native-paper';

import { KeyboardAwareScrollView } from '../components/keyboard-aware-scroll-view';
import { ScreenFade } from '../components/screen-fade';
import { whatsNew } from '../config/whats-new';
import { formatDate } from '../utils/date';
import { releaseInfo } from '../config/release-info';
import { useReleaseNotes } from '../updates/use-release-notes';
import { mergeReleaseNotes } from '../updates/release-notes';
import { ReleaseNoteText } from '../components/release-note-text';
import { useAppTheme } from '../theme';
import { useI18n } from '../i18n';

export default function WhatsNewScreen() {
  const theme = useAppTheme();
  const { t, language } = useI18n();
  const feed = useReleaseNotes('Banana', releaseInfo.version, language);
  const entries = mergeReleaseNotes(feed.entries, whatsNew.map((entry) => ({
    version: entry.version, releasedAt: entry.releasedAt,
    notes: entry.items.map((item) => `- ${item}`).join('\n'),
  })), releaseInfo.version);
  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: theme.spacing[4] }}>
        {feed.loading ? <ActivityIndicator accessibilityLabel={t('whatsNew.loading')} /> : null}
        {feed.failed ? <Text accessibilityRole="alert">{t('whatsNew.offline')}</Text> : null}
        {!feed.loading && !entries.length ? <Text>{t('whatsNew.empty')}</Text> : null}
        <Button onPress={feed.refresh} disabled={feed.loading} accessibilityLabel={t('whatsNew.refresh')}>
          {t('whatsNew.refresh')}
        </Button>
        {entries.map((entry) => (
          <Card key={entry.version} mode="contained" style={{ marginBottom: theme.spacing[3] }}>
            <Card.Content>
              <Text variant="titleMedium">Version {entry.version}</Text>
              <Text variant="bodySmall" style={{ marginBottom: theme.spacing[3] }}>
                {formatDate(entry.releasedAt, 'D MMM YYYY')}
              </Text>
              <ReleaseNoteText notes={entry.notes} />
            </Card.Content>
          </Card>
        ))}
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}

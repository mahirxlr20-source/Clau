import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextStyle, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { Card, Lockup, MarkerUnderline, Small } from './tabula';

/** The sign-in and sign-up frame: lockup, serif title with the marker underline, a card. */
export function AuthScreen({ title, lead, children, footer }: { title: string; lead: string; children: ReactNode; footer: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.parchment }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 28, gap: 6, maxWidth: 520, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
          <Lockup height={30} />
          <View style={{ height: 28 }} />
          <Text style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 35, color: colors.ink, letterSpacing: -0.4 }}>{title}</Text>
          <MarkerUnderline width={120} />
          <Text style={{ fontFamily: fonts.serifItalic, fontSize: 17, lineHeight: 24, color: colors.ink, marginBottom: 14 }}>{lead}</Text>
          <Card>{children}</Card>
          {footer}
          <Small style={{ marginTop: 18 }}>Planners by Tabula - independent and unofficial; not affiliated with any university.</Small>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export const authInput: TextStyle = {
  borderWidth: 1,
  borderColor: colors.rule,
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  fontSize: 16,
  fontFamily: fonts.sans,
  color: colors.ink,
  backgroundColor: colors.paper,
};

import { StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseBlocks, type Block, type Inline } from '@/lib/rich-text';

function Runs({ inline }: { inline: Inline[] }) {
  const theme = useTheme();
  return (
    <>
      {inline.map((run, i) => (
        <Text
          key={i}
          style={[
            run.bold && styles.bold,
            run.italic && styles.italic,
            run.code && [styles.code, { backgroundColor: theme.backgroundSelected }],
          ]}>
          {run.text}
        </Text>
      ))}
    </>
  );
}

/** Texto del entrenador con formato: negritas, cursiva, listas y títulos en vez de asteriscos. */
export function RichText({ text, themeColor }: { text: string; themeColor?: ThemeColor }) {
  const blocks: Block[] = parseBlocks(text);
  return (
    <View style={styles.root}>
      {blocks.map((block, i) => {
        if (block.type === 'bullet' || block.type === 'number') {
          return (
            <View key={i} style={styles.item}>
              <ThemedText themeColor={themeColor} style={styles.marker}>
                {block.type === 'bullet' ? '•' : `${block.n}.`}
              </ThemedText>
              <ThemedText themeColor={themeColor} style={styles.itemText}>
                <Runs inline={block.inline} />
              </ThemedText>
            </View>
          );
        }
        return (
          <ThemedText key={i} themeColor={themeColor} style={block.type === 'heading' ? styles.heading : undefined}>
            <Runs inline={block.inline} />
          </ThemedText>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: Fonts.mono, fontSize: 14 },
  heading: { fontWeight: '700' },
  item: { flexDirection: 'row', gap: Spacing.two, paddingLeft: Spacing.one },
  marker: { minWidth: 18 },
  itemText: { flex: 1 },
});

// The planner book's blocks as interactive pages: headings, text, lists, checklists,
// callouts, tables with writable cells, fill-in cards and writing lines. Whatever the
// student types is kept under the same keys as the HTML planner, so backups move both ways.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePlanner } from '../context/PlannerContext';
import { Section, sections } from '../planners/model';
import type { Block } from '../planners/types';
import { colors, fonts } from '../theme';
import { Btn, Btns, Callout, CheckBox, Details, H2, H3, Inline, t, useAccent } from './tabula';

const cellText = (c: any): string => (Array.isArray(c) ? c.map((x) => (typeof x === 'string' ? x : x.t)).join('\n') : c && typeof c === 'object' ? c.t : c == null ? '' : String(c));

function blockState(st: any, key: string) {
  return st.blocks[key] || (st.blocks[key] = {});
}

function EditCell({ store, r, c, width, flex }: { store: any; r: string; c: number; width?: number; flex?: number }) {
  const { commitSoon } = usePlanner();
  return (
    <View style={[b.td, { backgroundColor: colors.editBg }, width ? { width } : { flex }]}>
      <TextInput
        defaultValue={(store[r] && store[r][c]) || ''}
        multiline
        accessibilityLabel="Write here"
        onChangeText={(v) =>
          commitSoon(() => {
            store[r] = store[r] || {};
            if (v) store[r][c] = v;
            else delete store[r][c];
          })
        }
        style={b.cellIn}
      />
    </View>
  );
}

export function BookTable({ block, k }: { block: Block; k: string }) {
  const { st, commit } = usePlanner();
  const { accent } = useAccent();
  const state = blockState(st, k);
  state.cells = state.cells || {};
  state.extra = state.extra || 0;
  const cols: any[] = block.columns;
  const wide = cols.length > 3;
  const totalW = cols.reduce((n, c) => n + (c.w || 20), 0);
  const widthOf = (c: any) => Math.max(80, Math.round((c.w || 20) * 6.2));
  const sz = (c: any) => (wide ? { width: widthOf(c) } : { flex: (c.w || 20) / totalW });
  const rows: any[][] = block.rows || [];
  const nBlank = (block.blank || 0) + state.extra;

  const table = (
    <View style={wide ? { minWidth: '100%' } : { width: '100%' }}>
      <View style={[b.tr, { backgroundColor: accent }]}>
        {cols.map((c, i) => (
          <View key={i} style={[b.th, sz(c)]}>
            <Inline text={c.h} style={[b.thT, c.center && { textAlign: 'center' }]} />
          </View>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={[b.tr, b.rowLine, block.zebra && ri % 2 ? { backgroundColor: colors.zebra } : null]}>
          {row.map((cell, ci) => {
            const blank = cell === '' || cell == null;
            if (blank) return <EditCell key={ci} store={state.cells} r={'p' + ri} c={ci} {...sz(cols[ci] || {})} />;
            const fill = cell && typeof cell === 'object' && !Array.isArray(cell) && cell.fill;
            const ital = cell && typeof cell === 'object' && !Array.isArray(cell) && cell.italics;
            return (
              <View key={ci} style={[b.td, sz(cols[ci] || {}), fill && { backgroundColor: colors.linen }]}>
                <Inline
                  text={cellText(cell)}
                  style={[b.tdT, cols[ci]?.center && { textAlign: 'center' }, fill && { fontFamily: fonts.sansSemi }, ital && { color: colors.clay, fontStyle: 'italic' }, block.small && { fontSize: 12.5 }]}
                />
              </View>
            );
          })}
        </View>
      ))}
      {Array.from({ length: nBlank }).map((_, i) => (
        <View key={'b' + i} style={[b.tr, b.rowLine]}>
          {cols.map((c, ci) => (
            <EditCell key={ci} store={state.cells} r={'b' + i} c={ci} {...sz(c)} />
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <View>
      {block.caption ? <Inline text={block.caption} style={[t.small, { marginBottom: 6 }]} /> : null}
      <View style={b.tw}>
        {wide ? (
          <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
            {table}
          </ScrollView>
        ) : (
          table
        )}
      </View>
      {block.blank || state.extra || !rows.length ? (
        <Btns>
          <Btn small variant="secondary" title="+ Add row" onPress={() => commit(() => (state.extra += 1))} />
          <Btn
            small
            variant="ghost"
            title="Clear"
            onPress={() =>
              commit(() => {
                state.cells = {};
                state.extra = 0;
              })
            }
          />
        </Btns>
      ) : null}
    </View>
  );
}

function KV({ block, k }: { block: Block; k: string }) {
  const { st, commitSoon } = usePlanner();
  const { tint } = useAccent();
  const state = blockState(st, k);
  state.v = state.v || {};
  return (
    <View style={b.tw}>
      {block.rows.map((row: any[], i: number) => {
        const printed = row[1] && String(cellText(row[1])).trim();
        return (
          <View key={i} style={[b.kvRow, i > 0 && b.rowLine]}>
            <View style={[b.kvK, { backgroundColor: tint }]}>
              <Inline text={cellText(row[0])} style={b.kvKT} />
            </View>
            <View style={b.kvV}>
              {printed ? (
                <Inline text={cellText(row[1])} style={b.tdT} />
              ) : (
                <TextInput
                  defaultValue={state.v[i] || ''}
                  multiline
                  accessibilityLabel={cellText(row[0])}
                  placeholder="Write here"
                  placeholderTextColor={colors.placeholder}
                  onChangeText={(v) =>
                    commitSoon(() => {
                      if (v) state.v[i] = v;
                      else delete state.v[i];
                    })
                  }
                  style={b.cellIn}
                />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Lines({ block, k }: { block: Block; k: string }) {
  const { st, commitSoon } = usePlanner();
  const state = blockState(st, k);
  const n = Math.max(3, Math.min(10, block.n || 5));
  return (
    <TextInput
      multiline
      defaultValue={state.text || ''}
      placeholder="Write here"
      placeholderTextColor={colors.placeholder}
      accessibilityLabel="Writing lines"
      onChangeText={(v) => commitSoon(() => (state.text = v))}
      style={[b.lines, { minHeight: n * 26 }]}
    />
  );
}

export function Checklist({ block, k }: { block: Block; k: string }) {
  const { st, commit } = usePlanner();
  const state = blockState(st, k);
  state.done = state.done || {};
  return (
    <View style={{ marginBottom: 10 }}>
      {block.items.map((item: string, i: number) => {
        const done = !!state.done[i];
        const toggle = () =>
          commit(() => {
            if (done) delete state.done[i];
            else state.done[i] = true;
          });
        return (
          <View key={i} style={[b.check, i < block.items.length - 1 && b.checkLine]}>
            <CheckBox checked={done} onPress={toggle} label={item.replace(/\*/g, '')} />
            <Inline text={item} style={[t.body, { flex: 1, marginBottom: 0 }, done && { color: colors.clay, textDecorationLine: 'line-through' }]} />
          </View>
        );
      })}
    </View>
  );
}

function List({ items, numbered }: { items: string[]; numbered?: boolean }) {
  return (
    <View style={{ marginBottom: 10 }}>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 5 }}>
          <Text style={[t.body, { color: numbered ? colors.ink : colors.gold, fontFamily: fonts.sansBold, marginBottom: 0, minWidth: numbered ? 18 : 8 }]}>{numbered ? `${i + 1}.` : '•'}</Text>
          <Inline text={it} style={[t.body, { flex: 1, marginBottom: 0 }]} />
        </View>
      ))}
    </View>
  );
}

/** Renders a run of book blocks. scope keys their saved state. */
export function Blocks({ blocks, scope, skipTables }: { blocks: Block[]; scope: string; skipTables?: boolean }) {
  const out: ReactNode[] = [];
  blocks.forEach((bl, i) => {
    const key = scope + '#' + i;
    switch (bl.type) {
      case 'h1':
        out.push(<Text key={i} style={t.h1}>{bl.text}</Text>);
        break;
      case 'h2':
        out.push(<H2 key={i}><Inline text={bl.text} /></H2>);
        break;
      case 'h3':
        out.push(<H3 key={i}><Inline text={bl.text} /></H3>);
        break;
      case 'p':
        out.push(<Inline key={i} text={bl.text} style={bl.style === 'lead' ? t.lead : bl.style === 'small' ? [t.small, { marginBottom: 8 }] : bl.style === 'label' ? [t.label, { marginTop: 6, marginBottom: 6 }] : t.body} />);
        break;
      case 'bullets':
        out.push(<List key={i} items={bl.items} />);
        break;
      case 'numbered':
        out.push(<List key={i} items={bl.items} numbered />);
        break;
      case 'checklist':
        out.push(<Checklist key={i} block={bl} k={key} />);
        break;
      case 'callout':
        out.push(
          <Callout key={i} title={bl.title} tone={bl.tone === 'warn' ? 'warn' : bl.tone === 'gold' ? 'gold' : undefined}>
            {bl.items.map((x: string, j: number) => (
              <Inline key={j} text={x} style={[t.body, j === bl.items.length - 1 && { marginBottom: 0 }]} />
            ))}
          </Callout>,
        );
        break;
      case 'table':
        if (!skipTables) out.push(<BookTable key={i} block={bl} k={key} />);
        break;
      case 'kv':
        if (!skipTables) out.push(<KV key={i} block={bl} k={key} />);
        break;
      case 'lines':
        out.push(<Lines key={i} block={bl} k={key} />);
        break;
      case 'code':
        out.push(<Text key={i} style={b.mono}>{(bl.lines || []).join('\n')}</Text>);
        break;
      default:
        break;
    }
  });
  return <View>{out}</View>;
}

/** A part of the book as collapsible sections (one per H2); the intro shows open. */
export function SectionsAsDetails({ blocks, scope, filter }: { blocks: Block[]; scope: string; filter?: (s: Section) => boolean }) {
  const secs = sections(blocks);
  return (
    <View>
      {secs.map((sec, i) => {
        if (!sec.title) return <Blocks key={i} blocks={sec.blocks} scope={scope + '/intro'} />;
        if (filter && !filter(sec)) return null;
        return (
          <Details key={i} title={sec.title}>
            {() => <Blocks blocks={sec.blocks} scope={scope + '/' + i} />}
          </Details>
        );
      })}
    </View>
  );
}

const b = StyleSheet.create({
  tw: { borderWidth: 1, borderColor: colors.rule, borderRadius: 12, backgroundColor: colors.paper, overflow: 'hidden', marginTop: 6, marginBottom: 14 },
  tr: { flexDirection: 'row' },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.linen },
  th: { paddingVertical: 8, paddingHorizontal: 9 },
  thT: { fontFamily: fonts.sansSemi, fontSize: 11.5, color: '#fff' },
  td: { paddingVertical: 7, paddingHorizontal: 9 },
  tdT: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19, color: colors.ink },
  cellIn: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink, minHeight: 24, padding: 0, textAlignVertical: 'top' },
  kvRow: { flexDirection: 'row', alignItems: 'stretch' },
  kvK: { width: '38%', paddingVertical: 8, paddingHorizontal: 9 },
  kvKT: { fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.ink },
  kvV: { flex: 1, paddingVertical: 8, paddingHorizontal: 9 },
  lines: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 10,
    backgroundColor: colors.paper,
    padding: 10,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 26,
    color: colors.ink,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  check: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 8 },
  checkLine: { borderBottomWidth: 1, borderBottomColor: colors.linen },
  mono: { fontFamily: 'monospace', fontSize: 13, backgroundColor: colors.linen, padding: 10, borderRadius: 8, marginBottom: 10 },
});

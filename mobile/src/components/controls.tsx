// Form controls in the Tabula style: text and number inputs, a picker sheet (for the
// HTML planner's <select>s), date and time pickers, a text prompt, and toasts.
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtDate } from '../planners/formula';
import { colors, fonts, radius } from '../theme';
import { Btn, Label } from './tabula';

export function Field({ label, children, style }: { label: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 4, marginBottom: 10 }, style]}>
      <Label>{label}</Label>
      {children}
    </View>
  );
}

/**
 * A text input that keeps its own text while typing and reports it:
 *  - onCommit when editing ends (like the HTML planner's "change" event),
 *  - onLive on every keystroke (for notes and writing lines).
 */
export function Input({
  value,
  onCommit,
  onLive,
  style,
  compact,
  ...rest
}: Omit<TextInputProps, 'value' | 'onChange'> & { value?: string | number | null; onCommit?: (v: string) => void; onLive?: (v: string) => void; compact?: boolean }) {
  const external = value == null ? '' : String(value);
  const [text, setText] = useState(external);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(external);
  }, [external]);
  return (
    <TextInput
      {...rest}
      value={text}
      placeholderTextColor={colors.placeholder}
      onFocus={() => (editing.current = true)}
      onChangeText={(v) => {
        setText(v);
        onLive?.(v);
      }}
      onEndEditing={() => {
        editing.current = false;
        if (text !== external) onCommit?.(text);
      }}
      onBlur={() => {
        if (editing.current) {
          editing.current = false;
          if (text !== external) onCommit?.(text);
        }
      }}
      style={[c.input, compact && c.compact, rest.multiline && { minHeight: 80, textAlignVertical: 'top' }, style]}
    />
  );
}

export type Option = string | [string, string];
const optValue = (o: Option) => (Array.isArray(o) ? o[0] : o);
const optLabel = (o: Option) => (Array.isArray(o) ? o[1] : o);

/** A select: shows the value, opens a sheet with the options. */
export function Select({
  options,
  value,
  onChange,
  placeholder = '-',
  compact,
  allowClear = true,
  label,
  tone,
}: {
  options: Option[];
  value?: string | null;
  onChange(v: string): void;
  placeholder?: string;
  compact?: boolean;
  allowClear?: boolean;
  label?: string;
  tone?: { bg: string; fg: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = options.find((o) => optValue(o) === value);
  const shown = current ? optLabel(current) : value || placeholder;
  const list: Option[] = allowClear ? [['', placeholder], ...options] : options;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${shown}` : shown}
        onPress={() => setOpen(true)}
        style={[c.input, compact && c.compact, c.select, tone && { backgroundColor: tone.bg, borderColor: tone.bg }]}
      >
        <Text numberOfLines={1} style={[c.inputText, compact && { fontSize: 13.5 }, !value && { color: colors.placeholder }, tone && { color: tone.fg, fontFamily: fonts.sansSemi }]}>
          {shown}
        </Text>
        <Text style={c.caret}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={c.backdrop} onPress={() => setOpen(false)} />
        <View style={[c.sheet, { paddingBottom: insets.bottom + 8 }]}>
          {label ? <Text style={c.sheetTitle}>{label}</Text> : null}
          <FlatList
            data={list}
            keyExtractor={(o, i) => optValue(o) + '|' + i}
            initialScrollIndex={Math.max(0, list.findIndex((o) => optValue(o) === value))}
            getItemLayout={(_, i) => ({ length: 48, offset: 48 * i, index: i })}
            renderItem={({ item }) => {
              const on = optValue(item) === (value || '');
              return (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setOpen(false);
                    onChange(optValue(item));
                  }}
                  style={[c.opt, on && { backgroundColor: colors.linen }]}
                >
                  <Text numberOfLines={1} style={[c.optT, on && { fontFamily: fonts.sansBold }]}>
                    {optLabel(item)}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toHM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Date (YYYY-MM-DD) or time (HH:MM) field with the platform picker. Web falls back to typing. */
export function DateField({ value, onChange, mode = 'date', compact, placeholder }: { value?: string; onChange(v: string): void; mode?: 'date' | 'time'; compact?: boolean; placeholder?: string }) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(new Date());
  const shown = value ? (mode === 'date' ? fmtDate(value) : value) : placeholder || (mode === 'date' ? 'Pick a date' : 'Pick a time');

  if (Platform.OS === 'web') {
    return (
      <Input
        value={value}
        compact={compact}
        placeholder={mode === 'date' ? 'YYYY-MM-DD' : 'HH:MM'}
        onCommit={(v) => {
          const ok = mode === 'date' ? /^\d{4}-\d{2}-\d{2}$/.test(v) : /^\d{1,2}:\d{2}$/.test(v);
          onChange(ok || v === '' ? v : value || '');
        }}
      />
    );
  }

  const initial = () => {
    if (!value) return new Date(2000, 0, 1, 9, 0);
    if (mode === 'date') {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
      return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
    }
    const m = /^(\d{1,2}):(\d{2})/.exec(value);
    const d = new Date();
    if (m) d.setHours(+m[1], +m[2], 0, 0);
    return d;
  };
  const open = () => {
    const start = value ? initial() : mode === 'date' ? new Date() : initial();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: start,
        mode,
        is24Hour: true,
        onChange: (e, d) => {
          if (e.type === 'set' && d) onChange(mode === 'date' ? toISO(d) : toHM(d));
        },
      });
    } else {
      setDraft(start);
      setIosOpen(true);
    }
  };
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable accessibilityRole="button" onPress={open} style={[c.input, compact && c.compact, c.select, { flex: 1 }]}>
          <Text style={[c.inputText, compact && { fontSize: 13.5 }, !value && { color: colors.placeholder }]}>{shown}</Text>
        </Pressable>
        {value ? (
          <Pressable accessibilityLabel="Clear" onPress={() => onChange('')} hitSlop={8}>
            <Text style={{ color: colors.clay, fontSize: 16 }}>×</Text>
          </Pressable>
        ) : null}
      </View>
      {Platform.OS === 'ios' && (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <Pressable style={c.backdrop} onPress={() => setIosOpen(false)} />
          <View style={[c.sheet, { paddingBottom: 28, alignItems: 'stretch' }]}>
            <DateTimePicker value={draft} mode={mode} display={mode === 'date' ? 'inline' : 'spinner'} onChange={(_, d) => d && setDraft(d)} />
            <View style={{ paddingHorizontal: 16 }}>
              <Btn
                title="Done"
                onPress={() => {
                  setIosOpen(false);
                  onChange(mode === 'date' ? toISO(draft) : toHM(draft));
                }}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------- app-wide prompt and toast
type PromptReq = { title: string; placeholder?: string; resolve(v: string | null): void };
type Feedback = { toast(msg: string): void; prompt(title: string, placeholder?: string): Promise<string | null> };
const FeedbackContext = createContext<Feedback>({ toast: () => {}, prompt: async () => null });
export const useFeedback = () => useContext(FeedbackContext);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [req, setReq] = useState<PromptReq | null>(null);
  const [text, setText] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const toast = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2200);
  }, []);
  const prompt = useCallback(
    (title: string, placeholder?: string) =>
      new Promise<string | null>((resolve) => {
        setText('');
        setReq({ title, placeholder, resolve });
      }),
    [],
  );
  const close = (v: string | null) => {
    req?.resolve(v);
    setReq(null);
  };
  return (
    <FeedbackContext.Provider value={{ toast, prompt }}>
      {children}
      {msg ? (
        <View pointerEvents="none" style={[c.toast, { bottom: insets.bottom + 84 }]} accessibilityLiveRegion="polite">
          <Text style={c.toastT}>{msg}</Text>
        </View>
      ) : null}
      <Modal visible={!!req} transparent animationType="fade" onRequestClose={() => close(null)}>
        <View style={c.center}>
          <View style={c.dialog}>
            <Text style={c.sheetTitle}>{req?.title}</Text>
            <TextInput autoFocus value={text} onChangeText={setText} placeholder={req?.placeholder} placeholderTextColor={colors.placeholder} style={c.input} onSubmitEditing={() => close(text)} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <Btn small variant="secondary" title="Cancel" onPress={() => close(null)} />
              <Btn small title="OK" onPress={() => close(text)} />
            </View>
          </View>
        </View>
      </Modal>
    </FeedbackContext.Provider>
  );
}

const c = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.field,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    minHeight: 42,
    backgroundColor: colors.paper,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink,
  },
  compact: { minHeight: 34, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, fontSize: 13.5 },
  inputText: { fontFamily: fonts.sans, fontSize: 15, color: colors.ink, flexShrink: 1 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  caret: { color: colors.clay, fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(43,37,32,0.35)' },
  sheet: { backgroundColor: colors.parchment, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '70%', paddingTop: 10 },
  sheetTitle: { fontFamily: fonts.serif, fontSize: 17, color: colors.ink, paddingHorizontal: 16, paddingBottom: 8 },
  opt: { height: 48, justifyContent: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
  optT: { fontFamily: fonts.sans, fontSize: 15.5, color: colors.ink },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: colors.ink, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 10, maxWidth: '90%' },
  toastT: { color: '#fff', fontFamily: fonts.sansSemi, fontSize: 13.5 },
  center: { flex: 1, backgroundColor: 'rgba(43,37,32,0.35)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  dialog: { backgroundColor: colors.parchment, borderRadius: 16, padding: 16, width: '100%', maxWidth: 420 },
});

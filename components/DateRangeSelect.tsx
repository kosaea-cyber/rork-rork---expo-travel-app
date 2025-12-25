import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Colors from '@/constants/colors';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}

type Props = {
  labelFrom: string;
  labelTo: string;
  valueFrom: string | null; // YYYY-MM-DD
  valueTo: string | null;   // YYYY-MM-DD
  onChangeFrom: (iso: string) => void;
  onChangeTo: (iso: string) => void;
};

export default function DateRangeSelect({
  labelFrom,
  labelTo,
  valueFrom,
  valueTo,
  onChangeFrom,
  onChangeTo,
}: Props) {
  const now = new Date();

  // next 12 months (current month included)
  const months = useMemo(() => {
    const arr: { y: number; m: number; key: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      arr.push({
        y,
        m,
        key: `${y}-${pad2(m)}`,
        label: `${y}-${pad2(m)}`,
      });
    }
    return arr;
  }, []);

  function splitISO(v: string | null) {
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const [yy, mm, dd] = v.split('-').map((x) => parseInt(x, 10));
    return { y: yy, m: mm, d: dd };
  }

  const fromParts = splitISO(valueFrom) ?? { y: months[0]!.y, m: months[0]!.m, d: now.getDate() };
  const toParts = splitISO(valueTo) ?? { y: months[0]!.y, m: months[0]!.m, d: now.getDate() };

  const fromMonthKey = `${fromParts.y}-${pad2(fromParts.m)}`;
  const toMonthKey = `${toParts.y}-${pad2(toParts.m)}`;

  const fromDays = useMemo(() => daysInMonth(fromParts.y, fromParts.m), [fromParts.y, fromParts.m]);
  const toDays = useMemo(() => daysInMonth(toParts.y, toParts.m), [toParts.y, toParts.m]);

  const fromDay = Math.min(Math.max(fromParts.d, 1), fromDays);
  const toDay = Math.min(Math.max(toParts.d, 1), toDays);

  const fromIso = `${fromParts.y}-${pad2(fromParts.m)}-${pad2(fromDay)}`;
  const toIso = `${toParts.y}-${pad2(toParts.m)}-${pad2(toDay)}`;

  // ensure callbacks get valid iso on first render if empty
  React.useEffect(() => {
    if (!valueFrom) onChangeFrom(fromIso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!valueTo) onChangeTo(toIso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{labelFrom}</Text>

      <View style={styles.row}>
        <View style={styles.pickerBox}>
          <Picker
            selectedValue={fromMonthKey}
            onValueChange={(val) => {
              const [yy, mm] = String(val).split('-');
              const y = parseInt(yy, 10);
              const m = parseInt(mm, 10);
              const dim = daysInMonth(y, m);
              const d = Math.min(fromDay, dim);
              onChangeFrom(`${y}-${pad2(m)}-${pad2(d)}`);
            }}
            style={styles.picker}
            dropdownIconColor={Colors.text}
          >
            {months.map((x) => (
              <Picker.Item key={x.key} label={x.label} value={x.key} />
            ))}
          </Picker>
        </View>

        <View style={styles.pickerBox}>
          <Picker
            selectedValue={String(fromDay)}
            onValueChange={(val) => {
              const d = parseInt(String(val), 10);
              onChangeFrom(`${fromParts.y}-${pad2(fromParts.m)}-${pad2(d)}`);
            }}
            style={styles.picker}
            dropdownIconColor={Colors.text}
          >
            {Array.from({ length: fromDays }, (_, i) => i + 1).map((d) => (
              <Picker.Item key={d} label={String(d)} value={String(d)} />
            ))}
          </Picker>
        </View>
      </View>

      <Text style={[styles.label, { marginTop: 16 }]}>{labelTo}</Text>

      <View style={styles.row}>
        <View style={styles.pickerBox}>
          <Picker
            selectedValue={toMonthKey}
            onValueChange={(val) => {
              const [yy, mm] = String(val).split('-');
              const y = parseInt(yy, 10);
              const m = parseInt(mm, 10);
              const dim = daysInMonth(y, m);
              const d = Math.min(toDay, dim);
              onChangeTo(`${y}-${pad2(m)}-${pad2(d)}`);
            }}
            style={styles.picker}
            dropdownIconColor={Colors.text}
          >
            {months.map((x) => (
              <Picker.Item key={x.key} label={x.label} value={x.key} />
            ))}
          </Picker>
        </View>

        <View style={styles.pickerBox}>
          <Picker
            selectedValue={String(toDay)}
            onValueChange={(val) => {
              const d = parseInt(String(val), 10);
              onChangeTo(`${toParts.y}-${pad2(toParts.m)}-${pad2(d)}`);
            }}
            style={styles.picker}
            dropdownIconColor={Colors.text}
          >
            {Array.from({ length: toDays }, (_, i) => i + 1).map((d) => (
              <Picker.Item key={d} label={String(d)} value={String(d)} />
            ))}
          </Picker>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  pickerBox: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  picker: { color: Colors.text },
});

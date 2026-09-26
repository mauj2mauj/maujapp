import React from 'react';
import { StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  style?: StyleProp<TextStyle>;
}

const DOT = '●';

// secureTextEntry draws the password in a font that has no visible bullet on
// this app's Android build, so the field looks empty while typing. The real
// password stays in state; the field shows a black dot per character.
export default function PasswordField({ value, onChangeText, placeholder, style }: Props) {
  const hidden = DOT.repeat(value.length);

  const handleChange = (next: string) => {
    if (next.length < hidden.length && next === DOT.repeat(next.length)) {
      onChangeText(value.slice(0, next.length));
      return;
    }
    if (next.startsWith(hidden)) {
      onChangeText(value + next.slice(hidden.length).split(DOT).join(''));
      return;
    }
    let kept = 0;
    while (kept < next.length && kept < hidden.length && next[kept] === DOT) kept += 1;
    onChangeText(value.slice(0, kept) + next.slice(kept).split(DOT).join(''));
  };

  return (
    <TextInput
      style={[styles.input, style]}
      placeholder={placeholder}
      placeholderTextColor="#999"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="off"
      importantForAutofill="no"
      value={hidden}
      onChangeText={handleChange}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    color: '#111',
  },
});

import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ConfettiBurst from './ConfettiBurst';

interface Props {
  visible: boolean;
  punjabi: string;
  english: string;
  onClose: () => void;
}

export default function CelebrationModal({ visible, punjabi, english, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {visible ? <ConfettiBurst /> : null}
        <View style={styles.card}>
          <Text style={styles.punjabi}>{punjabi}</Text>
          <Text style={styles.english}>{english}</Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>ਧੰਨਵਾਦ</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 15, 40, 0.55)',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  punjabi: {
    alignSelf: 'stretch',
    fontSize: 22,
    fontWeight: '400',
    color: '#dc2626',
    textAlign: 'center',
    lineHeight: 36,
    paddingTop: 4,
  },
  english: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  button: {
    marginTop: 22,
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  buttonText: { color: '#fff', fontWeight: '400', fontSize: 18, lineHeight: 28 },
});

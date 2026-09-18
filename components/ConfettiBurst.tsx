import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';

const COLORS = ['#dc2626', '#4f46e5', '#16a34a', '#ea580c', '#eab308', '#7c3aed'];
const PIECE_COUNT = 36;

// Lightweight confetti that doesn't pull in a native module — so it works
// in Expo Go, on web, and in a built APK alike.
export default function ConfettiBurst() {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, index) => ({
        left: Math.random() * width,
        color: COLORS[index % COLORS.length],
        delay: Math.random() * 350,
        duration: 1800 + Math.random() * 1200,
        spin: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 280),
        drift: (Math.random() - 0.5) * 80,
        size: 6 + Math.random() * 8,
      })),
    [width]
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, index) => (
        <ConfettiPiece key={index} piece={piece} fallDistance={height + 40} />
      ))}
    </View>
  );
}

function ConfettiPiece({
  piece,
  fallDistance,
}: {
  piece: {
    left: number;
    color: string;
    delay: number;
    duration: number;
    spin: number;
    drift: number;
    size: number;
  };
  fallDistance: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: piece.duration,
      delay: piece.delay,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [piece.delay, piece.duration, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, fallDistance],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, piece.drift],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${piece.spin}deg`],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.75, 1],
    outputRange: [1, 1, 0],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: piece.left,
        width: piece.size,
        height: piece.size * 1.6,
        borderRadius: 2,
        backgroundColor: piece.color,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate }],
      }}
    />
  );
}

import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";

export interface Detection {
  label: string;
  confidence: number;
  /** [x1, y1, x2, y2] normalised 0..1 of the image dimensions. */
  box: [number, number, number, number];
}

const BOX_COLOR = "#22D3EE";

/**
 * Draws the uploaded photo with YOLO bounding boxes overlaid. While `scanning`
 * is true, an animated scan line sweeps the image (the "vision running" cue).
 */
export function DetectionOverlay({
  uri,
  detections,
  width,
  scanning = false,
}: {
  uri: string;
  detections: Detection[];
  width: number;
  scanning?: boolean;
}) {
  const [aspect, setAspect] = useState(4 / 3);
  const scan = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let ok = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (ok && w > 0 && h > 0) setAspect(w / h);
      },
      () => {},
    );
    return () => {
      ok = false;
    };
  }, [uri]);

  useEffect(() => {
    if (!scanning) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(scan, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanning, scan]);

  const height = width / aspect;
  const translateY = scan.interpolate({ inputRange: [0, 1], outputRange: [0, height] });

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Image source={{ uri }} style={{ width, height }} resizeMode="cover" />

      {detections.map((d, i) => {
        const [x1, y1, x2, y2] = d.box;
        return (
          <View
            key={i}
            style={[
              styles.box,
              {
                left: x1 * width,
                top: y1 * height,
                width: Math.max(2, (x2 - x1) * width),
                height: Math.max(2, (y2 - y1) * height),
              },
            ]}
          >
            <View style={styles.labelChip}>
              <Text style={styles.labelText} numberOfLines={1}>
                {d.label} {Math.round(d.confidence * 100)}%
              </Text>
            </View>
          </View>
        );
      })}

      {scanning && (
        <Animated.View
          pointerEvents="none"
          style={[styles.scanLine, { width, transform: [{ translateY }] }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 14, overflow: "hidden", backgroundColor: "#0B0F19" },
  box: {
    position: "absolute",
    borderWidth: 2,
    borderColor: BOX_COLOR,
    borderRadius: 4,
  },
  labelChip: {
    position: "absolute",
    top: -18,
    left: -2,
    backgroundColor: BOX_COLOR,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    maxWidth: 160,
  },
  labelText: { fontSize: 10, fontWeight: "800" as const, color: "#06222A" },
  scanLine: {
    position: "absolute",
    top: 0,
    height: 2,
    backgroundColor: BOX_COLOR,
    shadowColor: BOX_COLOR,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});

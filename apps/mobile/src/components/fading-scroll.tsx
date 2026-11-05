import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

const FADE_HEIGHT = 28;
const EDGE_PX = 4;

/**
 * Scroll vertical con un ligero difuminado en el borde de arriba y en el de abajo, solo cuando
 * hay más contenido por ese lado: al empezar no se ve el de arriba, y al llegar al final se
 * quita el de abajo. Pensado para listas sobre fondo liso (el degradado es del color de fondo).
 */
export function FadingScroll({ children, ...props }: ScrollViewProps & { children: ReactNode }) {
  const theme = useTheme();
  const [top, setTop] = useState(false);
  const [bottom, setBottom] = useState(false);
  const size = useRef({ view: 0, content: 0, y: 0 });

  const update = () => {
    const { view, content, y } = size.current;
    setTop(y > EDGE_PX);
    setBottom(content - view - y > EDGE_PX);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    size.current.y = e.nativeEvent.contentOffset.y;
    update();
    props.onScroll?.(e);
  };
  const onLayout = (e: LayoutChangeEvent) => {
    size.current.view = e.nativeEvent.layout.height;
    update();
    props.onLayout?.(e);
  };
  const onContentSizeChange = (w: number, h: number) => {
    size.current.content = h;
    update();
    props.onContentSizeChange?.(w, h);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        {...props}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        onLayout={onLayout}
        onContentSizeChange={onContentSizeChange}>
        {children}
      </ScrollView>
      <Fade edge="top" visible={top} color={theme.background} />
      <Fade edge="bottom" visible={bottom} color={theme.background} />
    </View>
  );
}

function Fade({ edge, visible, color }: { edge: 'top' | 'bottom'; visible: boolean; color: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [visible, opacity]);

  const id = `fade-${edge}`;
  const [from, to] = edge === 'top' ? [0, 1] : [1, 0];
  return (
    <Animated.View pointerEvents="none" style={[styles.fade, edge === 'top' ? styles.top : styles.bottom, { opacity }]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1={from} x2="0" y2={to}>
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fade: { position: 'absolute', left: 0, right: 0, height: FADE_HEIGHT },
  top: { top: 0 },
  bottom: { bottom: 0 },
});

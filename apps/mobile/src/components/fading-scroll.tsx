import { useEffect, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  Animated,
  Platform,
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
 *
 * Con `mask`, en la web el difuminado es una máscara que vuelve transparente el propio contenido, así
 * que vale también sobre las ondas u otro fondo que no sea liso. En nativo sigue siendo el degradado.
 */
export function FadingScroll({
  children,
  scrollRef,
  mask = false,
  ...props
}: ScrollViewProps & {
  children: ReactNode;
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
  mask?: boolean;
}) {
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

  const masked = mask && Platform.OS === 'web';

  return (
    <View style={[styles.root, masked ? maskStyle(top, bottom) : null]}>
      <ScrollView
        {...props}
        ref={scrollRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        onLayout={onLayout}
        onContentSizeChange={onContentSizeChange}>
        {children}
      </ScrollView>
      {!masked && <Fade edge="top" visible={top} color={theme.background} />}
      {!masked && <Fade edge="bottom" visible={bottom} color={theme.background} />}
    </View>
  );
}

/** Máscara CSS: transparente en los bordes con más contenido detrás, opaca en el resto. */
function maskStyle(top: boolean, bottom: boolean) {
  const from = top ? `transparent 0, #000 ${FADE_HEIGHT}px` : '#000 0';
  const to = bottom ? `#000 calc(100% - ${FADE_HEIGHT}px), transparent 100%` : '#000 100%';
  const image = `linear-gradient(to bottom, ${from}, ${to})`;
  return { maskImage: image, WebkitMaskImage: image } as object;
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

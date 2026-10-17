import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import PlayerScreen from '../../../packages/shared-ui/src/screens/PlayerScreen';
import { SupportedKeys } from '../../../packages/shared-ui/src/app/remote-control/SupportedKeys';

type PlayerProps = { onLoad: (duration: number) => void; onProgress: (currentTime: number) => void };

const mockSeek = jest.fn();
const mockNavigation = { goBack: jest.fn() };
let mockPlayerProps: PlayerProps;
let mockKeyDown: (key: SupportedKeys) => void;

// Android TV and Fire OS draw their own controls and drive seeking from the remote.
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  StyleSheet: { create: (styles: object) => styles, absoluteFillObject: {} },
  View: 'View',
}));

jest.mock('react-tv-space-navigation', () => ({
  SpatialNavigationRoot: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { movie: 'movie.mp4', headerImage: 'header.jpg' } }),
}));

jest.mock('../../../packages/shared-ui/src/app/remote-control/RemoteControlManager', () => ({
  __esModule: true,
  default: {
    addKeydownListener: (listener: (key: SupportedKeys) => void) => {
      mockKeyDown = listener;
      return listener;
    },
    removeKeydownListener: jest.fn(),
  },
}));

jest.mock('../../../packages/shared-ui/src/components/player/VideoPlayer', () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual('react');
  return {
    __esModule: true,
    default: forwardRef((props: PlayerProps, ref: unknown) => {
      useImperativeHandle(ref, () => ({ seek: mockSeek }));
      mockPlayerProps = props;
      return null;
    }),
  };
});

jest.mock('../../../packages/shared-ui/src/components/player/VideoOverlay', () => ({
  __esModule: true,
  default: () => null,
}));

describe('PlayerScreen remote seeking', () => {
  let renderer: TestRenderer.ReactTestRenderer;

  const playTo = (seconds: number) => act(() => mockPlayerProps.onProgress(seconds));
  const press = (key: SupportedKeys) => act(() => mockKeyDown(key));

  beforeEach(() => {
    jest.useFakeTimers();
    mockSeek.mockClear();
    act(() => {
      renderer = TestRenderer.create(<PlayerScreen />);
    });
    act(() => mockPlayerProps.onLoad(600));
  });

  afterEach(() => {
    act(() => renderer.unmount());
    jest.useRealTimers();
  });

  it.each([
    [SupportedKeys.FastForward, 70],
    [SupportedKeys.Right, 70],
    [SupportedKeys.Rewind, 50],
    [SupportedKeys.Left, 50],
  ])('seeks 10 s from the playhead on %s', (key, expected) => {
    playTo(60);
    press(key);

    expect(mockSeek).toHaveBeenLastCalledWith(expected);
  });

  it('keeps following playback after a seek', () => {
    playTo(60);
    press(SupportedKeys.Right);
    playTo(95);
    press(SupportedKeys.Left);

    expect(mockSeek.mock.calls).toEqual([[70], [85]]);
  });
});

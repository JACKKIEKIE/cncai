import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { connectLive, OmniRealtimeConfig } from '../services/modelService';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface BlobPayload {
  data: string;
  mimeType: string;
}

interface LiveSessionHandle {
  sendRealtimeInput: (payload: { audio: { data: string; mimeType: string } }) => void;
  sendRealtimeVideo: (payload: { video: { data: string; mimeType: string } }) => void;
  signalAudioStreamEnd: () => void;
  close: () => void;
}

interface LiveSessionProps {
  onClose: () => void;
  initialVideoEnabled?: boolean;
}

const LIVE_URL_STORAGE_KEY = 'GEMINI_LIVE_URL';
const DEFAULT_OUTPUT_SAMPLE_RATE = 24000;
const DEFAULT_OUTPUT_CHANNELS = 1;

type PcmBitDepth = 8 | 16 | 24 | 32;

interface AudioFormatHints {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: PcmBitDepth;
  isFloat: boolean;
  littleEndian: boolean;
}

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }
  return bytes;
}

function cloneArrayBuffer(data: Uint8Array) {
  const clone = new Uint8Array(data.byteLength);
  clone.set(data);
  return clone.buffer;
}

function parseMimeNumber(mimeType: string, names: string[], fallback: number) {
  for (const name of names) {
    const match = mimeType.match(new RegExp(`${name}=([0-9]+)`));
    if (match) {
      return Number.parseInt(match[1], 10);
    }
  }
  return fallback;
}

function looksLikeRawPcm(mimeType: string) {
  return (
    mimeType.startsWith('audio/pcm')
    || mimeType.startsWith('audio/raw')
    || mimeType.includes('pcm_s16')
    || mimeType.includes('pcm_s24')
    || mimeType.includes('pcm_f32')
    || mimeType.includes('l16')
    || mimeType.includes('l24')
    || mimeType.includes('linear16')
    || mimeType.includes('linear24')
  );
}

function inferBitsPerSample(mimeType: string, preferredBitDepth: PcmBitDepth) {
  if (
    mimeType.includes('pcm24')
    || mimeType.includes('s24')
    || mimeType.includes('l24')
    || mimeType.includes('24bit')
    || mimeType.includes('linear24')
    || mimeType.includes('depth=24')
    || mimeType.includes('bits=24')
  ) {
    return 24;
  }

  if (
    mimeType.includes('pcm32')
    || mimeType.includes('f32')
    || mimeType.includes('float32')
    || mimeType.includes('depth=32')
    || mimeType.includes('bits=32')
  ) {
    return 32;
  }

  if (
    mimeType.includes('pcm8')
    || mimeType.includes('u8')
    || mimeType.includes('depth=8')
    || mimeType.includes('bits=8')
  ) {
    return 8;
  }

  if (
    mimeType.includes('pcm16')
    || mimeType.includes('s16')
    || mimeType.includes('l16')
    || mimeType.includes('linear16')
    || mimeType.includes('depth=16')
    || mimeType.includes('bits=16')
  ) {
    return 16;
  }

  return preferredBitDepth;
}

function getAudioFormatHints(mimeType: string | undefined, preferredBitDepth: PcmBitDepth): AudioFormatHints {
  const normalizedMimeType = (mimeType || '').toLowerCase();
  return {
    sampleRate: parseMimeNumber(normalizedMimeType, ['rate', 'sample-rate', 'samplerate'], DEFAULT_OUTPUT_SAMPLE_RATE),
    numChannels: parseMimeNumber(normalizedMimeType, ['channels', 'channel-count', 'channelcount'], DEFAULT_OUTPUT_CHANNELS),
    bitsPerSample: inferBitsPerSample(normalizedMimeType, preferredBitDepth),
    isFloat: normalizedMimeType.includes('float') || normalizedMimeType.includes('f32'),
    littleEndian: !(
      normalizedMimeType.includes('endian=big')
      || normalizedMimeType.includes('s16be')
      || normalizedMimeType.includes('s24be')
      || normalizedMimeType.includes('f32be')
      || normalizedMimeType.includes('l16be')
      || normalizedMimeType.includes('l24be')
    )
  };
}

function decodePcmToAudioBuffer(
  data: Uint8Array,
  context: AudioContext,
  format: AudioFormatHints
): AudioBuffer {
  const bytesPerSample = format.bitsPerSample / 8;
  const bytesPerFrame = bytesPerSample * format.numChannels;

  if (bytesPerFrame <= 0 || data.byteLength < bytesPerFrame) {
    throw new Error('Gemini 返回的音频数据为空。');
  }

  const frameCount = Math.floor(data.byteLength / bytesPerFrame);
  const buffer = context.createBuffer(format.numChannels, frameCount, format.sampleRate);
  const view = new DataView(data.buffer, data.byteOffset, frameCount * bytesPerFrame);

  for (let channel = 0; channel < format.numChannels; channel += 1) {
    const channelData = buffer.getChannelData(channel);
    for (let frame = 0; frame < frameCount; frame += 1) {
      const offset = frame * bytesPerFrame + channel * bytesPerSample;

      if (format.isFloat && format.bitsPerSample === 32) {
        channelData[frame] = view.getFloat32(offset, format.littleEndian);
        continue;
      }

      if (format.bitsPerSample === 8) {
        channelData[frame] = (view.getInt8(offset) / 128);
        continue;
      }

      if (format.bitsPerSample === 16) {
        channelData[frame] = view.getInt16(offset, format.littleEndian) / 32768;
        continue;
      }

      if (format.bitsPerSample === 24) {
        let sample: number;
        if (format.littleEndian) {
          sample = (view.getUint8(offset)) | (view.getUint8(offset + 1) << 8) | (view.getInt8(offset + 2) << 16);
        } else {
          sample = (view.getInt8(offset) << 16) | (view.getUint8(offset + 1) << 8) | view.getUint8(offset + 2);
        }
        channelData[frame] = sample / 8388608;
        continue;
      }

      channelData[frame] = view.getInt32(offset, format.littleEndian) / 2147483648;
    }
  }

  return buffer;
}

async function decodeAudioData(
  data: Uint8Array,
  context: AudioContext,
  mimeType: string | undefined,
  preferredBitDepth: PcmBitDepth
): Promise<AudioBuffer> {
  const normalizedMimeType = (mimeType || '').toLowerCase();
  const pcmFormats: AudioFormatHints[] = [];
  const preferredFormat = getAudioFormatHints(normalizedMimeType, preferredBitDepth);
  pcmFormats.push(preferredFormat);

  if (preferredFormat.bitsPerSample !== 16) {
    pcmFormats.push({ ...preferredFormat, bitsPerSample: 16, isFloat: false });
  }
  if (preferredFormat.bitsPerSample !== 24) {
    pcmFormats.push({ ...preferredFormat, bitsPerSample: 24, isFloat: false });
  }
  if (preferredFormat.bitsPerSample !== 32) {
    pcmFormats.push({ ...preferredFormat, bitsPerSample: 32, isFloat: preferredFormat.isFloat });
  }

  if (!looksLikeRawPcm(normalizedMimeType)) {
    try {
      return await context.decodeAudioData(cloneArrayBuffer(data));
    } catch {
      // 某些 Gemini Live 代理会回传无容器的 PCM，这里继续走 PCM 回退。
    }
  }

  for (const format of pcmFormats) {
    try {
      return decodePcmToAudioBuffer(data, context, format);
    } catch {
      // Try the next candidate format.
    }
  }

  return context.decodeAudioData(cloneArrayBuffer(data));
}

function getAudioChunks(message: unknown) {
  const parts = (message as { serverContent?: { modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } } })?.serverContent?.modelTurn?.parts;
  if (!Array.isArray(parts)) {
    return [];
  }

  return parts
    .filter((part) => part?.inlineData?.data)
    .map((part) => ({
      data: part!.inlineData!.data!,
      mimeType: part!.inlineData!.mimeType || 'audio/pcm;rate=24000;channels=1'
    }));
}

function isInterruptedMessage(message: unknown) {
  return Boolean((message as { serverContent?: { interrupted?: boolean } })?.serverContent?.interrupted);
}

const LiveSession: React.FC<LiveSessionProps> = ({ onClose, initialVideoEnabled = false }) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'permission-denied'>('connecting');
  const [errorMessage, setErrorMessage] = useState('');
  const [volume, setVolume] = useState(0);
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialVideoEnabled);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [showSettings, setShowSettings] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [connectionNonce, setConnectionNonce] = useState(0);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const videoIntervalRef = useRef<number | null>(null);
  const preferredOutputBitDepthRef = useRef<PcmBitDepth>(16);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<LiveSessionHandle | null>(null);
  const mountedRef = useRef(true);
  const intentionalCloseRef = useRef(false);
  const suppressCloseEventRef = useRef(false);
  const connectionReadyRef = useRef(false);

  useEffect(() => {
    const savedUrl = window.localStorage.getItem(LIVE_URL_STORAGE_KEY);
    if (savedUrl) {
      setCustomUrl(savedUrl);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const initSession = async () => {
      try {
        connectionReadyRef.current = false;
        suppressCloseEventRef.current = false;
        setStatus('connecting');
        setErrorMessage('');

        const AudioContextClass = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext
          || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error('当前浏览器不支持 Web Audio。');
        }

        const inputContext = new AudioContextClass({ sampleRate: 16000 });
        const outputContext = new AudioContextClass({ sampleRate: 24000 });
        inputAudioContextRef.current = inputContext;
        outputAudioContextRef.current = outputContext;

        if (inputContext.state === 'suspended') {
          await inputContext.resume();
        }
        if (outputContext.state === 'suspended') {
          await outputContext.resume();
        }

        const analyser = outputContext.createAnalyser();
        analyser.fftSize = 256;
        const outputGain = outputContext.createGain();
        outputGain.gain.value = 1;
        outputGain.connect(outputContext.destination);
        analyserRef.current = analyser;
        outputGainRef.current = outputGain;

        const config: OmniRealtimeConfig = {
          modalities: ['AUDIO', 'TEXT'],
          voice: 'Aoede',
          inputAudioFormat: 'PCM_16000HZ_MONO_16BIT',
          outputAudioFormat: 'pcm16',
          enableTurnDetection: true,
          enableInputAudioTranscription: true,
          enableOutputAudioTranscription: true,
          silenceDurationMs: 700,
          smooth_output: true,
          instructions: '你是 LinguaCNC 的实时语音数控助手，请用中文帮助用户理解图纸、工艺和 G 代码。'
        };
        preferredOutputBitDepthRef.current = config.outputAudioFormat === 'pcm24' ? 24 : 16;

        sessionRef.current = await connectLive(
          {
            onopen: () => {
              connectionReadyRef.current = true;
              if (mountedRef.current) {
                setStatus('connected');
                setErrorMessage('');
              }
            },
            onmessage: (message: unknown) => {
              void handleLiveMessage(message);
            },
            onerror: (error: unknown) => {
              connectionReadyRef.current = false;
              console.error('Gemini Live 连接失败', error);
              if (mountedRef.current) {
                setErrorMessage((error as { message?: string })?.message || 'Gemini Live 连接失败。');
                setStatus('error');
              }
            },
            onclose: (event?: CloseEvent) => {
              connectionReadyRef.current = false;
              sessionRef.current = null;
              if (!mountedRef.current || suppressCloseEventRef.current) {
                return;
              }
              if (intentionalCloseRef.current) {
                onClose();
                return;
              }

              const code = typeof event?.code === 'number' ? ` (Code ${event.code})` : '';
              const reason = event?.reason?.trim() || `语音连接已中断${code}，请重试。`;
              if (mountedRef.current) {
                setErrorMessage(reason);
                setStatus('error');
              }
            }
          },
          config
        );

        animateVolume();
      } catch (error) {
        console.error('初始化实时语音失败', error);
        if (!mountedRef.current) {
          return;
        }

        const name = (error as { name?: string })?.name;
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setStatus('permission-denied');
        } else {
          setErrorMessage((error as { message?: string })?.message || '实时会话初始化失败。');
          setStatus('error');
        }
      }
    };

    async function handleLiveMessage(message: unknown) {
      const outputContext = outputAudioContextRef.current;
      const chunks = getAudioChunks(message);

      if (isInterruptedMessage(message)) {
        stopPlaybackQueue(outputContext?.currentTime || 0);
      }

      if (chunks.length > 0 && outputContext) {
        for (const chunk of chunks) {
          try {
            if (outputContext.state === 'suspended') {
              await outputContext.resume();
            }

            const audioData = decodeBase64(chunk.data);
            const audioBuffer = await decodeAudioData(
              audioData,
              outputContext,
              chunk.mimeType,
              preferredOutputBitDepthRef.current
            );
            const source = outputContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputGainRef.current || outputContext.destination);
            if (analyserRef.current) {
              source.connect(analyserRef.current);
            }

            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputContext.currentTime);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            sourcesRef.current.add(source);
            source.onended = () => {
              sourcesRef.current.delete(source);
            };
          } catch (error) {
            console.error('音频解码失败', error);
          }
        }
      }
    }

    void initSession();

    return () => {
      mountedRef.current = false;
      cleanupSession();
    };
  }, [connectionNonce]);

  useEffect(() => {
    let localStream: MediaStream | null = null;
    let audioSource: MediaStreamAudioSourceNode | null = null;
    let processor: ScriptProcessorNode | null = null;

    const setupMedia = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('当前环境无法访问麦克风或摄像头，请确认使用 HTTPS 或桌面容器。');
        }

        const constraints: MediaStreamConstraints = isVideoEnabled
          ? {
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              },
              video: {
                facingMode,
                width: { ideal: 640 },
                height: { ideal: 480 }
              }
            }
          : {
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              }
            };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStream = stream;
        mediaStreamRef.current = stream;

        const inputContext = inputAudioContextRef.current;
        if (inputContext) {
          if (inputContext.state === 'suspended') {
            await inputContext.resume();
          }

          audioSource = inputContext.createMediaStreamSource(stream);
          processor = inputContext.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (event) => {
            if (!mountedRef.current || !connectionReadyRef.current) {
              return;
            }

            const inputData = event.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            sessionRef.current?.sendRealtimeInput({ audio: pcmBlob });
          };

          audioSource.connect(processor);
          processor.connect(inputContext.destination);
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(console.warn);
          };
        }

        if (videoIntervalRef.current) {
          window.clearInterval(videoIntervalRef.current);
        }
        videoIntervalRef.current = window.setInterval(captureAndSendFrame, 1000);
      } catch (error) {
        console.error('媒体权限失败', error);
        if (!mountedRef.current) {
          return;
        }

        const name = (error as { name?: string })?.name;
        setErrorMessage((error as { message?: string })?.message || '无法访问麦克风或摄像头。');
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setStatus('permission-denied');
        } else {
          setStatus('error');
        }
      }
    };

    void setupMedia();

    return () => {
      if (sessionRef.current) {
        try {
          sessionRef.current.signalAudioStreamEnd();
        } catch {
          // noop
        }
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (audioSource) {
        audioSource.disconnect();
      }
      if (processor) {
        processor.disconnect();
        processor.onaudioprocess = null;
      }
      if (videoIntervalRef.current) {
        window.clearInterval(videoIntervalRef.current);
        videoIntervalRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [connectionNonce, facingMode, isVideoEnabled]);

  function cleanupSession() {
    suppressCloseEventRef.current = true;
    connectionReadyRef.current = false;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    stopPlaybackQueue();
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    outputGainRef.current?.disconnect();
    outputGainRef.current = null;
    void inputAudioContextRef.current?.close();
    void outputAudioContextRef.current?.close();
    if (sessionRef.current) {
      try {
        sessionRef.current.signalAudioStreamEnd();
      } catch {
        // noop
      }
      try {
        sessionRef.current.close();
      } catch {
        // noop
      }
    }
    sessionRef.current = null;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (videoIntervalRef.current) {
      window.clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
  }

  function handleSaveSettings() {
    if (customUrl.trim()) {
      window.localStorage.setItem(LIVE_URL_STORAGE_KEY, customUrl.trim());
    } else {
      window.localStorage.removeItem(LIVE_URL_STORAGE_KEY);
    }
    window.location.reload();
  }

  function toggleCamera() {
    setFacingMode((current) => (current === 'user' ? 'environment' : 'user'));
  }

  function handleDismiss() {
    intentionalCloseRef.current = true;
    onClose();
  }

  function handleRetryConnection() {
    intentionalCloseRef.current = false;
    cleanupSession();
    setConnectionNonce((value) => value + 1);
  }

  function captureAndSendFrame() {
    if (!isVideoEnabled || !videoRef.current || !canvasRef.current || !sessionRef.current?.sendRealtimeVideo || !connectionReadyRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context || video.videoWidth <= 0) {
      return;
    }

    canvas.width = 320;
    canvas.height = 240;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
    const base64Data = dataUrl.split(',')[1];
    sessionRef.current.sendRealtimeVideo({
      video: { data: base64Data, mimeType: 'image/jpeg' }
    });
  }

  function animateVolume() {
    if (!mountedRef.current) {
      return;
    }

    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / Math.max(dataArray.length, 1);
      setVolume(average / 128);
    }

    animationFrameRef.current = requestAnimationFrame(animateVolume);
  }

  function createBlob(data: Float32Array): BlobPayload {
    const int16 = new Int16Array(data.length);
    for (let index = 0; index < data.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, data[index]));
      int16[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    return {
      data: encodeBase64(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000'
    };
  }

  function encodeBase64(bytes: Uint8Array) {
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  function stopPlaybackQueue(resetTime = 0) {
    sourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // noop
      }
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = resetTime;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-hidden bg-[#020617] text-white animate-fade-in"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 24px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)',
        paddingLeft: '24px',
        paddingRight: '24px'
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-[60%] w-[60%] animate-pulse rounded-full bg-blue-600/20 blur-[120px]" style={{ animationDuration: '9s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] h-[60%] w-[60%] animate-pulse rounded-full bg-cyan-500/15 blur-[120px]" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,transparent_70%)]" />
      </div>

      <div className={cn('absolute inset-0 transition-opacity duration-1000 z-0', isVideoEnabled ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
        <video
          ref={videoRef}
          className={cn('h-full w-full object-cover', facingMode === 'user' ? 'scale-x-[-1]' : '')}
          muted
          playsInline
          autoPlay
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/90" />
        <div className="absolute left-8 top-24 flex items-center gap-2 rounded-full border border-white/20 bg-red-500/90 px-4 py-1.5 text-[10px] font-bold tracking-[0.2em] shadow-lg shadow-red-500/20">
          <div className="h-2 w-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
          LIVE
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-800 p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-medium">Gemini Live 代理设置</h3>
            <p className="mb-2 text-xs leading-6 text-white/60">
              如果你有自己的语音代理转发地址，可以在这里覆盖默认的 Live 地址。填入 `https://...` 也可以，应用会自动处理为 WebSocket 连接。
            </p>
            <input
              type="text"
              value={customUrl}
              onChange={(event) => setCustomUrl(event.target.value)}
              placeholder="https://geminiv.oikpig.top"
              className="mb-4 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowSettings(false)} className="flex-1 rounded-lg bg-white/5 py-2 text-sm hover:bg-white/10">
                取消
              </button>
              <button onClick={handleSaveSettings} className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium hover:bg-blue-500">
                保存并重启
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="z-10 flex w-full items-center justify-between px-2">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 shadow-sm backdrop-blur-xl">
          <div className={`h-2.5 w-2.5 rounded-full ${status === 'connected' ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)] animate-pulse' : 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]'}`} />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">Gemini Live</span>
        </div>

        <div className="flex items-center gap-3">
          {isVideoEnabled && (
            <button
              onClick={toggleCamera}
              title="切换摄像头"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-all hover:bg-white/15 active:scale-90 backdrop-blur-xl"
            >
              <i className="fa-solid fa-camera-rotate text-sm" />
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            title="代理设置"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-all hover:bg-white/15 active:scale-90 backdrop-blur-xl"
          >
            <i className="fa-solid fa-gear text-sm" />
          </button>
          <button
            onClick={handleDismiss}
            title="关闭"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-all hover:bg-white/15 active:scale-90 backdrop-blur-xl"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>
      </div>

      <div className="relative z-10 my-4 flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4">
        <div className={cn('relative flex flex-shrink-0 items-center justify-center transition-all duration-1000', isVideoEnabled ? 'h-32 scale-75 opacity-45' : 'h-72 scale-100 opacity-100')}>
          <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-[60px] transition-all duration-150" style={{ transform: `scale(${1.2 + volume * 1.2})` }} />
          <div
            className="relative h-40 w-40 overflow-hidden rounded-full bg-gradient-to-br from-blue-400 via-indigo-500 to-cyan-500 shadow-[0_0_80px_rgba(59,130,246,0.35)]"
            style={{ transform: `scale(${1 + volume * 0.6})` }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.38)_0%,transparent_50%)]" />
            <div className="absolute inset-0 animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent,rgba(255,255,255,0.18),transparent)] opacity-30" />
          </div>
          <div className="absolute h-56 w-56 scale-150 animate-[spin_15s_linear_infinite] rounded-full border border-white/10 opacity-20" />
          <div className="absolute h-48 w-48 rounded-full border border-blue-400/20 opacity-40 transition-all duration-150" style={{ transform: `scale(${1.1 + volume * 0.4})` }} />
          <div className="absolute h-64 w-64 animate-[spin_25s_linear_infinite_reverse] rounded-full border-2 border-dashed border-cyan-400/10" />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {status === 'connecting' && <i className="fa-solid fa-circle-notch fa-spin text-4xl text-white/90 drop-shadow-lg" />}
            {(status === 'error' || status === 'permission-denied') && <i className="fa-solid fa-triangle-exclamation text-4xl text-red-400 drop-shadow-lg" />}
          </div>
        </div>

        <div className="z-10 flex-shrink-0 space-y-2 text-center">
          <div className="text-2xl font-light tracking-widest text-white/95">
            {status === 'connecting' && '正在连接…'}
            {status === 'connected' && (isVideoEnabled ? '视频已开启' : '语音已开启')}
            {status === 'error' && '连接失败'}
            {status === 'permission-denied' && '权限被拒绝'}
          </div>
          {status === 'connected' && (
            <p className="animate-pulse text-[10px] font-bold uppercase tracking-[0.3em] text-blue-300/50">
              Gemini Live 正在实时聆听
            </p>
          )}
          {errorMessage && <p className="max-w-md text-sm leading-6 text-red-200/80">{errorMessage}</p>}
          {status === 'error' && (
            <button
              onClick={handleRetryConnection}
              className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:bg-white/15"
            >
              <i className="fa-solid fa-rotate-right" />
              重新连接
            </button>
          )}
        </div>
      </div>

      <div className="z-10 mb-8 flex shrink-0 rounded-[2rem] border border-white/10 bg-white/5 p-1.5 shadow-2xl backdrop-blur-2xl">
        <button
          onClick={() => setIsVideoEnabled(false)}
          className={`flex items-center gap-3 rounded-[1.5rem] px-8 py-3.5 text-xs font-bold uppercase tracking-widest transition-all ${
            !isVideoEnabled ? 'scale-105 bg-white text-slate-900 shadow-xl' : 'text-white/60 hover:bg-white/5 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-microphone" /> 语音
        </button>
        <button
          onClick={() => setIsVideoEnabled(true)}
          className={`flex items-center gap-3 rounded-[1.5rem] px-8 py-3.5 text-xs font-bold uppercase tracking-widest transition-all ${
            isVideoEnabled ? 'scale-105 bg-white text-slate-900 shadow-xl' : 'text-white/60 hover:bg-white/5 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-video" /> 视频
        </button>
      </div>

      <div className="z-10 mb-4 flex shrink-0 items-center gap-10">
        <button
          title="静音（暂未实现）"
          className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-white shadow-lg backdrop-blur-xl transition-all hover:bg-white/15 active:scale-90"
        >
          <i className="fa-solid fa-microphone-slash text-xl opacity-60" />
        </button>

        <button
          onClick={handleDismiss}
          className="flex h-24 w-24 items-center justify-center rounded-[2.5rem] border border-white/20 bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-[0_20px_50px_rgba(244,63,94,0.3)] transition-all hover:scale-105 hover:from-rose-400 hover:to-red-500 active:scale-90"
        >
          <i className="fa-solid fa-phone-slash text-4xl" />
        </button>

        <button
          onClick={toggleCamera}
          className={cn(
            'flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-white shadow-lg backdrop-blur-xl transition-all hover:bg-white/15 active:scale-90',
            !isVideoEnabled && 'pointer-events-none opacity-0'
          )}
        >
          <i className="fa-solid fa-camera-rotate text-xl" />
        </button>
      </div>
    </div>
  );
};

export default LiveSession;

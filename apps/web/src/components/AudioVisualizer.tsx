import { useEffect, useRef } from "react";

type AudioVisualizerProps = {
  readonly stream: MediaStream | null;
};

export const AudioVisualizer = ({ stream }: AudioVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Create audio context and analyser
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.7;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    analyserRef.current = analyser;
    audioContextRef.current = audioContext;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const barCount = 20;
    const barWidth = (rect.width - (barCount - 1) * 2) / barCount;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, rect.width, rect.height);

      const centerY = rect.height / 2;

      for (let i = 0; i < barCount; i++) {
        // Sample from the waveform data
        const dataIndex = Math.floor((i / barCount) * bufferLength);
        const value = dataArray[dataIndex] || 128;
        const amplitude = Math.abs(value - 128) / 128;
        const barHeight = Math.max(4, amplitude * rect.height * 0.9);

        const x = i * (barWidth + 2);

        // Gradient color based on amplitude
        const hue = 185 + amplitude * 30; // cyan to blue
        const lightness = 50 + amplitude * 20;
        ctx.fillStyle = `hsl(${hue}, 80%, ${lightness}%)`;

        // Draw bar centered vertically
        const y = centerY - barHeight / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      source.disconnect();
      analyser.disconnect();
      audioContext.close();
    };
  }, [stream]);

  return (
    <div className="flex items-center justify-center h-16 w-full rounded-xl bg-slate-950/60 border border-line p-3">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        aria-label="Audio waveform visualization"
      />
    </div>
  );
};

export type AudioCaptureOptions = {
  readonly deviceId?: string;
  readonly onLevel?: (level: number) => void;
};

export class AudioCapture {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private chunks: Float32Array[] = [];
  private levelInterval: ReturnType<typeof setInterval> | null = null;

  async start(options: AudioCaptureOptions = {}): Promise<void> {
    const { deviceId, onLevel } = options;

    const constraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000,
      channelCount: 1,
    };
    if (deviceId) {
      constraints.deviceId = { exact: deviceId };
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.sourceNode.connect(this.analyserNode);

    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.analyserNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);

    this.chunks = [];
    this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
      const inputData = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(inputData));
    };

    if (onLevel) {
      const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.levelInterval = setInterval(() => {
        if (this.analyserNode) {
          this.analyserNode.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          onLevel(avg / 255);
        }
      }, 100);
    }
  }

  stop(): Float32Array {
    if (this.levelInterval) {
      clearInterval(this.levelInterval);
      this.levelInterval = null;
    }

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    const totalLength = this.chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunks = [];
    return result;
  }

  get isActive(): boolean {
    return this.stream !== null;
  }
}

export const listMicrophones = async (): Promise<MediaDeviceInfo[]> => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "audioinput");
};

import Decoder from './Decoder';
import Size from '../Size';
import YUVCanvas from '../h264-live-player/YUVCanvas';
import YUVWebGLCanvas from '../h264-live-player/YUVWebGLCanvas';
// @ts-ignore
import * as Avc from '../Decoder';
import { StreamInfo } from '../StreamInfo';
import Canvas from '../h264-live-player/Canvas';

export const CANVAS_TYPE: Record<string, string> = {
    WEBGL: 'webgl',
    YUV: 'YUVWebGLCanvas',
    CANVAS: 'YUVCanvas'
};

export class BroadwayDecoder extends Decoder {
    protected TAG: string = 'BroadwayDecoder';
    private avc?: Avc;
    private canvas?: Canvas;
    private framesList: Uint8Array[] = [];
    private running: boolean = false;

    constructor(protected tag: HTMLCanvasElement, private canvastype: string) {
        super(tag);
        this.avc = new Avc();
    }

    private static isIFrame(frame: Uint8Array): boolean {
        return frame && frame.length > 4 && frame[4] === 0x65;
    }

    protected initCanvas(width: number, height: number): void {
        const canvasFactory = this.canvastype === 'webgl' || this.canvastype === 'YUVWebGLCanvas'
            ? YUVWebGLCanvas
            : YUVCanvas;
        if (this.canvas) {
            const parent = this.tag.parentNode;
            if (parent) {
                const id = this.tag.id;
                const tag = document.createElement('canvas');
                tag.classList.value = this.tag.classList.value;
                tag.id = id;
                parent.replaceChild(tag, this.tag);
                this.tag = tag;
            }
        }
        this.canvas = new canvasFactory(this.tag, new Size(width, height));
        this.avc = new Avc();
        this.avc.onPictureDecoded = this.canvas.decode.bind(this.canvas);
        this.tag.width = width;
        this.tag.height = height;
    }

    private shiftFrame(): void {
        if (!this.running) {
            return;
        }

        const frame = this.framesList.shift();

        if (frame) {
            this.decode(frame);
        }

        requestAnimationFrame(this.shiftFrame.bind(this));
    }

    public decode(data: Uint8Array): void {
        // let naltype = 'invalid frame';
        //
        // if (data.length > 4) {
        //     if (data[4] == 0x65) {
        //         naltype = 'I frame';
        //     } else if (data[4] == 0x41) {
        //         naltype = 'P frame';
        //     } else if (data[4] == 0x67) {
        //         naltype = 'SPS';
        //     } else if (data[4] == 0x68) {
        //         naltype = 'PPS';
        //     }
        // }
        // log('Passed ' + naltype + ' to decoder');
        this.avc.decode(data);
    }

    public pause(): void {
        this.running = false;
    }

    public play(): void {
        if (!this.streamInfo) {
            return;
        }
        if (!this.canvas) {
            this.initCanvas(this.streamInfo.width, this.streamInfo.height);
        }
        this.running = true;
        requestAnimationFrame(this.shiftFrame.bind(this));
    }

    public setStreamInfo(streamInfo: StreamInfo): void {
        super.setStreamInfo(streamInfo);
        this.pause();
        this.framesList = [];
        this.initCanvas(streamInfo.width, streamInfo.height);
    }

    public pushFrame(frame: Uint8Array): void {
        if (BroadwayDecoder.isIFrame(frame)) {
            if (this.streamInfo) {
                if (this.framesList.length > this.streamInfo.frameRate / 2) {
                    console.log('Dropping frames', this.framesList.length);
                    this.framesList = [];
                }
            }
        }
        this.framesList.push(frame);
    }
}

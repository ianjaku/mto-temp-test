import { FfprobeData, ffprobe } from "fluent-ffmpeg";
import { SupportedAudioCodec, SupportedVideoCodec, SupportedVideoContainer } from "./api/model";
import {
    UnsupportedAudioCodec,
    UnsupportedVideoCodec
} from  "@binders/client/lib/clients/imageservice/v1/visuals";
import { VideoMetadata, VisualMetadata } from "./visualhandlers/contract";
import sharp from "sharp";

export const getImageMetadata = async (localFilePath: string): Promise<VisualMetadata> => {
    const sharpMetadata = await sharp(localFilePath).metadata();
    // Use exif orientation to see if image is rotated
    // http://jpegclub.org/exif_orientation.html
    // http://www.daveperrett.com/articles/2012/07/28/exif-orientation-handling-is-a-ghetto/
    const isRotated = (sharpMetadata.orientation > 4);
    return {
        kind: "image",
        height: isRotated ? sharpMetadata.width : sharpMetadata.height,
        width: isRotated ? sharpMetadata.height : sharpMetadata.width,
        size: sharpMetadata.size,
        orientation: sharpMetadata.orientation,
        isProgressive: sharpMetadata.isProgressive,
    };
}

export const getVideoMetadata = async (localFilePath: string): Promise<VideoMetadata> => {
    return new Promise((resolve, reject) => {
        return ffprobe(localFilePath, function (err, ffmpegMetadata) {
            if (err) {
                reject(err);
            }
            else {
                try {
                    const meta = buildVideoMetadata(ffmpegMetadata);
                    resolve(meta);
                } catch (err) {
                    reject(err);
                }
            }
        });
    });
}

const toSupportedVideoCodec = (videoCodec: string): SupportedVideoCodec => {
    switch (videoCodec) {
        case "h263":
            return SupportedVideoCodec.H263;
        case "h264":
            return SupportedVideoCodec.H264;
        case "mjpeg":
            return SupportedVideoCodec.MJPEG;
        case "hevc":
            return SupportedVideoCodec.HEVC;
        case "vp6f":
            return SupportedVideoCodec.VP6F;
        case "flv1":
            return SupportedVideoCodec.FLV1;
        case "wmv1":
        case "wmv3":
            return SupportedVideoCodec.WMV1;
        case "mpeg1video":
        case "mpeg2video":
        case "mpeg4":
            return SupportedVideoCodec.MPEG;
        case "vp8":
            return SupportedVideoCodec.VP8;
        case "vp9":
            return SupportedVideoCodec.VP9;
        case "msvideo1":
            return SupportedVideoCodec.MSV1;
        default:
            throw new UnsupportedVideoCodec(videoCodec);
    }
}

const buildVideoMetadata = (ffmpegData: FfprobeData): VideoMetadata => {
    const audioStream = ffmpegData.streams.find(stream => stream.codec_type === "audio");
    const videoStream = ffmpegData.streams.find(stream => stream.codec_type === "video");
    let rotated = false;
    if (["90", "-90", "270", "-270"].includes(`${videoStream.rotation}`)) {
        rotated = true;
    }
    const containerFormat = ffmpegData.format.tags?.major_brand as string ?? ffmpegData.format.format_name;
    const durationInMs = !isNaN(ffmpegData.format.duration) ? Math.floor(ffmpegData.format.duration * 1000) : undefined;
    const audioCodec = toSupportedAudioCodec(audioStream?.codec_name);
    return {
        kind: "video",
        height: rotated ? videoStream.width : videoStream.height,
        width: rotated ? videoStream.height : videoStream.width,
        size: ffmpegData.format.size,
        hasAudio: audioCodec !== SupportedAudioCodec.NO_AUDIO,
        type: containerFormatToEnum(containerFormat),
        audioCodec,
        videoCodec: toSupportedVideoCodec(videoStream.codec_name),
        durationInMs
    };
}

const containerFormatToEnum = (containerFormat: string): SupportedVideoContainer => {
    const cleanedContainerFormat = containerFormat.trim().toLowerCase();
    switch (cleanedContainerFormat) {
        case "mp41":
        case "mp42":
        case "mpeg":
        case "m4v":
        case "isom":
        case "3gp5":
        case "xavc":
        case "nvr1":
        case "mp4v":
        case "3gp6":
            return SupportedVideoContainer.MP4;
        case "qt":
            return SupportedVideoContainer.QUICKTIME;
        case "avi":
            return SupportedVideoContainer.AVI;
        case "flv":
            return SupportedVideoContainer.FLV;
        case "asf":
            return SupportedVideoContainer.WMV;
        case "matroska,webm":
            return SupportedVideoContainer.WEBM;
        case "avc1":
            return SupportedVideoContainer.AVC1;
        default:
            throw new UnsupportedVideoCodec(cleanedContainerFormat);
    }
}

const toSupportedAudioCodec = (audioCodec: string): SupportedAudioCodec => {
    switch (audioCodec) {
        case undefined:
            return SupportedAudioCodec.NO_AUDIO;
        case "ac3":
            return SupportedAudioCodec.AC3;
        case "aac":
            return SupportedAudioCodec.AAC;
        case "pcm_s16le":
            return SupportedAudioCodec.PCM_S16LE;
        case "mp3":
            return SupportedAudioCodec.MP3;
        case "wmav2":
            return SupportedAudioCodec.WMAV2;
        case "pcm_s16be":
            return SupportedAudioCodec.PCM_S16BE;
        case "opus":
            return SupportedAudioCodec.OPUS;
        default:
            throw new UnsupportedAudioCodec(audioCodec);
    }
}
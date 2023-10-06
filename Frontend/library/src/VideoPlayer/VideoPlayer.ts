// Copyright Epic Games, Inc. All Rights Reserved.

import { Config, Flags, NumericParameters } from '../Config/Config';
import { Logger } from '../Logger/Logger';

/**
 * Extra types for the HTMLElement
 */
declare global {
    interface HTMLElement {
        mozRequestPointerLock?(): void;
    }
}

/**
 * The video player html element
 */
export class VideoPlayer {
    private config: Config;
    private videoElement: HTMLVideoElement;
    private audioElement?: HTMLAudioElement;
    private orientationChangeTimeout: number;
    private lastTimeResized = new Date().getTime();

    onMatchViewportResolutionCallback: (width: number, height: number) => void;
    onResizePlayerCallback: () => void;
    resizeTimeoutHandle: number;

    /**
     * @param videoElementParent the html div the the video player will be injected into
     * @param config the applications configuration. We're interested in the startVideoMuted flag
     */
    constructor(videoElementParent: HTMLElement, config: Config) {
        this.videoElement = document.createElement('video');
        this.config = config;
        this.videoElement.id = 'streamingVideo';
        this.videoElement.disablePictureInPicture = true;
        this.videoElement.playsInline = true;
        this.videoElement.style.width = '100%';
        this.videoElement.style.height = '100%';
        this.videoElement.style.position = 'absolute';
        this.videoElement.style.pointerEvents = 'all';
        videoElementParent.appendChild(this.videoElement);

        this.onResizePlayerCallback = () => {
            console.log(
                'Resolution changed, restyling player, did you forget to override this function?'
            );
        };
        this.onMatchViewportResolutionCallback = () => {
            console.log(
                'Resolution changed and match viewport resolution is turned on, did you forget to override this function?'
            );
        };

        // set play for video (and audio)
        this.videoElement.onclick = () => {
            if (this.audioElement != undefined && this.audioElement.paused) {
                Logger.Log(
                    Logger.GetStackTrace(),
                    'Video clicked, unmuting audio',
                    6
                );
                this.audioElement.play();
            }
            if (this.videoElement.paused) {
                this.videoElement.play();
            }
        };

        this.videoElement.onloadedmetadata = () => {
            this.onVideoInitialized();
        };

        // set resize events to the windows if it is resized or its orientation is changed
        window.addEventListener('resize', () => this.resizePlayerStyle(), true);
        window.addEventListener('orientationchange', () =>
            this.onOrientationChange()
        );
    }

    public setAudioElement(audioElement: HTMLAudioElement) : void {
        this.audioElement = audioElement;
    }

    /**
     * Sets up the video element with any application config and plays the video element.
     * @returns A promise for if playing the video was successful or not.
     */
    play(): Promise<void> {
        this.videoElement.muted = this.config.isFlagEnabled(
            Flags.StartVideoMuted
        );
        this.videoElement.autoplay = this.config.isFlagEnabled(
            Flags.AutoPlayVideo
        );
        return this.videoElement.play();
    }

    /**
     * @returns True if the video element is paused.
     */
    isPaused(): boolean {
        return this.videoElement.paused;
    }

    /**
     * @returns - whether the video element is playing.
     */
    isVideoReady(): boolean {
        return (
            this.videoElement.readyState !== undefined &&
            this.videoElement.readyState > 0
        );
    }

    /**
     * @returns True if the video element has a valid video source (srcObject).
     */
    hasVideoSource(): boolean {
        return (
            this.videoElement.srcObject !== undefined &&
            this.videoElement.srcObject !== null
        );
    }

    /**
     * Get the current context of the html video element
     * @returns - the current context of the video element
     */
    getVideoElement(): HTMLVideoElement {
        return this.videoElement;
    }

    /**
     * Get the current context of the html video elements parent
     * @returns - the current context of the video elements parent
     */
    getVideoParentElement(): HTMLElement {
        return this.videoElement.parentElement;
    }

    /**
     * Set the Video Elements src object tracks to enable
     * @param enabled - Enable Tracks on the Src Object
     */
    setVideoEnabled(enabled: boolean) {
        // this is a temporary hack until type scripts video element is updated to reflect the need for tracks on a html video element
        const videoElement = this.videoElement;
        (<MediaStream>videoElement.srcObject)
            .getTracks()
            .forEach((track: MediaStreamTrack) => (track.enabled = enabled));
    }

    /**
     * An override for when the video has been initialized with a srcObject
     */
    onVideoInitialized() {
        // Default Functionality: Do Nothing
    }

    /**
     * On the orientation change of a window clear the timeout
     */
    onOrientationChange() {
        clearTimeout(this.orientationChangeTimeout);
        this.orientationChangeTimeout = window.setTimeout(() => {
            this.resizePlayerStyle();
        }, 500);
    }

    /**
     * Resizes the player style based on the window height and width
     * @returns - nil if requirements are satisfied
     */
    resizePlayerStyle() {
        const videoElementParent = this.getVideoParentElement();

        if (!videoElementParent) {
            return;
        }

        this.updateVideoStreamSize();

        if (videoElementParent.classList.contains('fixed-size')) {
            this.onResizePlayerCallback();
            return;
        }

        // controls for resizing the player
        this.resizePlayerStyleToFillParentElement();
        this.onResizePlayerCallback();
    }

    /**
     * Resizes the player element to fill the parent element
     */
    resizePlayerStyleToFillParentElement() {
        const videoElementParent = this.getVideoParentElement();

        //Video is not initialized yet so set videoElementParent to size of parent element
        const styleWidth = '100%';
        const styleHeight = '100%';
        const styleTop = 0;
        const styleLeft = 0;
        videoElementParent.setAttribute(
            'style',
            'top: ' +
                styleTop +
                'px; left: ' +
                styleLeft +
                'px; width: ' +
                styleWidth +
                '; height: ' +
                styleHeight +
                '; cursor: default;'
        );
    }

    updateVideoStreamSize() {
        if (!this.config.isFlagEnabled(Flags.MatchViewportResolution)) {
            return;
        }

        const now = new Date().getTime();
        if (now - this.lastTimeResized > 300) {
            const videoElementParent = this.getVideoParentElement();
            if (!videoElementParent) {
                return;
            }

            const devicePixelRatio = (() => {
              if (!this.config.isFlagEnabled(Flags.UseNativeResolution)) return 1;
              if (window.devicePixelRatio === undefined && window.devicePixelRatio === null) return 1;
              Logger.Log(
                  Logger.GetStackTrace(),
                  `Using native device pixel ratio ${window.devicePixelRatio}`,
                  6
              );
              return window.devicePixelRatio;
            })();

            const resolution = (() => {
                const maxResolutionX = (() => {
                  try {
                    return this.config.getNumericSettingValue(NumericParameters.MaxResolutionX);
                  } catch (e) {
                    return undefined;
                  }
                })();
                const maxResolutionY = (() => {
                  try {
                    return this.config.getNumericSettingValue(NumericParameters.MaxResolutionY);
                  } catch (e) {
                    return undefined;
                  }
                })();

                // Scales both x & y resolutions down using the ratio of whichever exceeds its maximum resolution the most.
                // E.g. If MaxResolutionX = 1920 and maxResolutionY = 1080
                // And the given resolution is 2048x1100
                // The x value exceeds its maximum by more, and the ration required to bring it down to the maximum is 0.9375
                // Therefore the resolution used is (2048 * 0.9375)x(1100 * 0.9375) == 1920x1031 (rounded down from 1920x1031.25)
                const x = videoElementParent.clientWidth * devicePixelRatio;
                const y = videoElementParent.clientHeight * devicePixelRatio;
                const xAdjustmentRatio = maxResolutionX == undefined ? 1 : (maxResolutionX / x) > 1 ? 1 : maxResolutionX / x;
                const yAdjustmentRatio = maxResolutionY == undefined ? 1 : (maxResolutionY / y) > 1 ? 1 : maxResolutionY / y;
                const adjusted = (() => {
                  if (xAdjustmentRatio < yAdjustmentRatio) {
                    return {x: x * xAdjustmentRatio, y: y * xAdjustmentRatio};
                  } else {
                    return {x: x * yAdjustmentRatio, y: y * yAdjustmentRatio};
                  }
                })();
                return {x: Math.round(adjusted.x), y: Math.round(adjusted.y)};
            })();

            Logger.Log(
                Logger.GetStackTrace(),
                `Setting resolution to ${resolution.x}x${resolution.y}`,
                6
            );

            this.onMatchViewportResolutionCallback(
              resolution.x,
              resolution.y,
            );

            this.lastTimeResized = new Date().getTime();
        } else {
            Logger.Log(
                Logger.GetStackTrace(),
                'Resizing too often - skipping',
                6
            );
            clearTimeout(this.resizeTimeoutHandle);
            this.resizeTimeoutHandle = window.setTimeout(
                () => this.updateVideoStreamSize(),
                100
            );
        }
    }
}

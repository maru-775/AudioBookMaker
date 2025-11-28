"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoiceRecorderProps {
    onRecordingComplete: (audioFile: File) => void;
    maxDuration?: number; // in seconds
}

export function VoiceRecorder({ onRecordingComplete, maxDuration = 10 }: VoiceRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        return () => {
            // Cleanup on unmount
            if (timerRef.current) clearInterval(timerRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    const startRecording = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
            });

            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setRecordedBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);

                // Stop all tracks
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => {
                    const newTime = prev + 1;

                    // Allow the timer to reach maxDuration, then stop on the next tick
                    if (newTime > maxDuration) {
                        // Clear interval immediately
                        if (timerRef.current) {
                            clearInterval(timerRef.current);
                            timerRef.current = null;
                        }

                        // Stop the media recorder
                        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                            mediaRecorderRef.current.stop();
                            setIsRecording(false);
                        }

                        return maxDuration; // Cap at maxDuration
                    }

                    return newTime;
                });
            }, 1000);

        } catch (err) {
            console.error("Error accessing microphone:", err);
            setError("Could not access microphone. Please check permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    const deleteRecording = () => {
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
        setRecordedBlob(null);
        setAudioUrl(null);
        setRecordingTime(0);
    };

    const confirmRecording = () => {
        if (recordedBlob) {
            // Convert blob to File
            const file = new File([recordedBlob], `voice-sample-${Date.now()}.webm`, {
                type: recordedBlob.type,
            });
            onRecordingComplete(file);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-4">
            {error && (
                <div className="border-4 border-red-500 bg-red-50 dark:bg-red-900/20 p-3 text-sm font-bold text-red-700 dark:text-red-300">
                    {error}
                </div>
            )}

            {!recordedBlob ? (
                <div className="space-y-3">
                    {/* Recording Controls */}
                    <div className="border-4 border-border bg-background p-6 flex flex-col items-center space-y-4">
                        {isRecording ? (
                            <>
                                <div className="relative">
                                    <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
                                    <div className="relative bg-red-500 p-6 rounded-full border-4 border-border">
                                        <Mic className="w-8 h-8 text-white" />
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-black font-mono tabular-nums">
                                        {formatTime(recordingTime)} / {formatTime(maxDuration)}
                                    </div>
                                    <div className="text-sm font-bold text-muted-foreground uppercase mt-1">
                                        Recording...
                                    </div>
                                </div>
                                <Button
                                    onClick={stopRecording}
                                    className="h-12 px-8 font-black uppercase border-4 border-border rounded-none neo-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--color-border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all bg-red-500 hover:bg-red-400 text-white"
                                >
                                    <Square className="mr-2 h-5 w-5" />
                                    Stop Recording
                                </Button>
                            </>
                        ) : (
                            <>
                                <div className="bg-muted p-6 rounded-full border-4 border-border">
                                    <Mic className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <div className="text-center">
                                    <div className="font-black uppercase text-lg">Record Voice Sample</div>
                                    <div className="text-sm font-bold text-muted-foreground mt-1">
                                        Up to {maxDuration} seconds
                                    </div>
                                </div>
                                <Button
                                    onClick={startRecording}
                                    className="h-12 px-8 font-black uppercase border-4 border-border rounded-none neo-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--color-border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                                >
                                    <Mic className="mr-2 h-5 w-5" />
                                    Start Recording
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Playback and Confirmation */}
                    <div className="border-4 border-primary bg-primary/5 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="font-black uppercase text-sm">
                                Recording Complete ({formatTime(recordingTime)})
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={deleteRecording}
                                className="h-8 w-8 rounded-none border-2 border-transparent hover:border-border hover:bg-destructive/10"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>

                        {audioUrl && (
                            <div className="border-4 border-border p-2 bg-background mb-3">
                                <audio controls className="w-full h-10" src={audioUrl}>
                                    Your browser does not support the audio element.
                                </audio>
                            </div>
                        )}

                        <Button
                            onClick={confirmRecording}
                            className="w-full h-12 font-black uppercase border-4 border-border rounded-none neo-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--color-border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all bg-green-500 hover:bg-green-400 text-black"
                        >
                            <Check className="mr-2 h-5 w-5" />
                            Use This Recording
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

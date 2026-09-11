package com.unmute1ai.u1field;
public final class WhisperBridge {
    static { System.loadLibrary("u1whisper"); }
    private WhisperBridge() {}
    public static native long initModel(String path);
    public static native String transcribe(long handle, short[] pcm, int sampleCount, String language, boolean translate);
    public static native void releaseModel(long handle);
}

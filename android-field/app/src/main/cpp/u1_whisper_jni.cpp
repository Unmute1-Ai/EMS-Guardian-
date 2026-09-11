#include <jni.h>
#include <whisper.h>
#include <algorithm>
#include <cctype>
#include <string>
#include <thread>
#include <vector>

static std::string run_whisper(whisper_context *ctx, const int16_t *pcm, int count, const char *language, bool translate) {
    if (!ctx || !pcm || count <= 0 || !language) return {};
    std::vector<float> samples(static_cast<size_t>(count));
    for (int i = 0; i < count; ++i) samples[static_cast<size_t>(i)] = static_cast<float>(pcm[i]) / 32768.0f;
    whisper_full_params p = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    p.print_realtime = false; p.print_progress = false; p.print_timestamps = false; p.print_special = false;
    p.translate = translate; p.language = language; p.no_context = true; p.single_segment = false;
    p.suppress_blank = true; p.temperature = 0.0f;
    p.n_threads = std::max(1, std::min(6, static_cast<int>(std::thread::hardware_concurrency())));
    int rc = whisper_full(ctx, p, samples.data(), static_cast<int>(samples.size()));
    std::fill(samples.begin(), samples.end(), 0.0f);
    if (rc != 0) return {};
    std::string out;
    for (int i = 0, n = whisper_full_n_segments(ctx); i < n; ++i) { const char *s = whisper_full_get_segment_text(ctx, i); if (s) out += s; }
    auto ns=[](unsigned char c){return !std::isspace(c);};
    out.erase(out.begin(), std::find_if(out.begin(), out.end(), ns));
    out.erase(std::find_if(out.rbegin(), out.rend(), ns).base(), out.end());
    return out;
}

extern "C" JNIEXPORT jlong JNICALL Java_com_unmute1ai_u1field_WhisperBridge_initModel(JNIEnv *env, jclass, jstring path) {
    const char *p = env->GetStringUTFChars(path, nullptr); if (!p) return 0;
    whisper_context *ctx = whisper_init_from_file(p); env->ReleaseStringUTFChars(path, p); return reinterpret_cast<jlong>(ctx);
}
extern "C" JNIEXPORT jstring JNICALL Java_com_unmute1ai_u1field_WhisperBridge_transcribe(JNIEnv *env, jclass, jlong h, jshortArray arr, jint sampleCount, jstring lang, jboolean translate) {
    auto *ctx = reinterpret_cast<whisper_context *>(h); if (!ctx || !arr || !lang || sampleCount <= 0) return env->NewStringUTF("");
    const char *lc = env->GetStringUTFChars(lang, nullptr); jshort *pcm = env->GetShortArrayElements(arr, nullptr);
    if (!lc || !pcm) { if (lc) env->ReleaseStringUTFChars(lang, lc); if (pcm) env->ReleaseShortArrayElements(arr, pcm, JNI_ABORT); return env->NewStringUTF(""); }
    int count = std::min<int>(sampleCount, env->GetArrayLength(arr)); std::string out = run_whisper(ctx, reinterpret_cast<int16_t *>(pcm), count, lc, translate == JNI_TRUE);
    env->ReleaseShortArrayElements(arr, pcm, JNI_ABORT); env->ReleaseStringUTFChars(lang, lc); return env->NewStringUTF(out.c_str());
}
extern "C" JNIEXPORT void JNICALL Java_com_unmute1ai_u1field_WhisperBridge_releaseModel(JNIEnv *, jclass, jlong h) { auto *ctx = reinterpret_cast<whisper_context *>(h); if (ctx) whisper_free(ctx); }

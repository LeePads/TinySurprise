package com.tinysurprise.app;

import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.media3.common.Effect;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.effect.Crop;
import androidx.media3.effect.ScaleAndRotateTransformation;
import androidx.media3.transformer.EditedMediaItem;
import androidx.media3.transformer.Effects;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.ProgressHolder;
import androidx.media3.transformer.Transformer;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.collect.ImmutableList;
import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "VideoTransformer")
public class VideoTransformerPlugin extends Plugin {
    private static final String TAG = "VideoTransformer";
    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();
    private final android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    private volatile Transformer activeTransformer;
    private volatile String activeJobId;
    private volatile String cancelledJobId;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        cleanupStaleFiles();
        JSObject result = new JSObject();
        result.put("available", true);
        call.resolve(result);
    }

    @PluginMethod
    public void transform(PluginCall call) {
        if (activeJobId != null) {
            call.reject("A video edit is already in progress.", "VIDEO_BUSY");
            return;
        }
        String jobId = call.getString("jobId");
        String inputUri = call.getString("inputUri");
        if (jobId == null || inputUri == null) {
            call.reject("A video source is required.", "VIDEO_SOURCE_REQUIRED");
            return;
        }
        String fileName = call.getString("fileName", "video.mp4");
        JSObject request = call.getObject("request");
        long trimStartMs = request == null ? 0 : Math.max(0, request.optLong("trimStartMs", 0L));
        Long trimEndMs = request == null || !request.has("trimEndMs") ? null : request.optLong("trimEndMs", 0L);
        String quality = request == null ? "balanced" : request.optString("quality", "balanced");
        String framing = request == null ? "original" : request.optString("framing", "original");
        activeJobId = jobId;
        cancelledJobId = null;
        ioExecutor.execute(() -> {
            try {
                if (isCancelled(jobId)) {
                    resolveCancelled(call, jobId);
                    return;
                }
                Uri source = parseUri(inputUri);
                VideoMetadata metadata = readMetadata(source);
                if (metadata.width <= 0 || metadata.height <= 0 || metadata.durationMs <= 0) {
                    throw new IllegalArgumentException("VIDEO_METADATA_UNAVAILABLE");
                }
                JSObject crop = request == null ? null : request.getJSObject("crop");
                if (crop == null && "fill".equals(framing)) crop = fillCrop(metadata);
                VideoMetadata finalMetadata = metadata;
                JSObject finalCrop = crop;
                getActivity().runOnUiThread(() -> {
                    if (isCancelled(jobId)) {
                        resolveCancelled(call, jobId);
                        return;
                    }
                    File output = new File(getContext().getCacheDir(), "tiny-video-output-" + safeToken(jobId) + ".mp4");
                    startTransform(call, jobId, source, output, fileName, trimStartMs, trimEndMs, quality, finalCrop, finalMetadata);
                });
            } catch (Exception error) {
                Log.e(TAG, "Failed to stage video for job " + jobId, error);
                clearActive(jobId);
                String code = "VIDEO_METADATA_UNAVAILABLE".equals(error.getMessage())
                    ? "VIDEO_METADATA_UNAVAILABLE"
                    : "VIDEO_STAGE_FAILED";
                call.reject("The video could not be staged locally.", code, error);
            }
        });
    }

    private void startTransform(
        PluginCall call,
        String jobId,
        Uri source,
        File output,
        String fileName,
        long trimStartMs,
        @Nullable Long trimEndMs,
        String quality,
        @Nullable JSObject crop,
        VideoMetadata metadata
    ) {
        try {
            File parent = output.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) {
                throw new IllegalStateException("VIDEO_OUTPUT_DIRECTORY_UNAVAILABLE");
            }
            delete(output);
            MediaItem.Builder mediaBuilder = new MediaItem.Builder().setUri(source);
            if (trimEndMs != null && trimEndMs > trimStartMs) {
                mediaBuilder.setClippingConfiguration(new MediaItem.ClippingConfiguration.Builder()
                    .setStartPositionMs(trimStartMs)
                    .setEndPositionMs(trimEndMs)
                    .build());
            }
            ImmutableList.Builder<Effect> effectsBuilder = new ImmutableList.Builder<>();
            if (crop != null) {
                float left = -1f + 2f * (float) crop.optDouble("left", 0d);
                float right = -1f + 2f * (float) crop.optDouble("right", 1d);
                float top = 1f - 2f * (float) crop.optDouble("top", 0d);
                float bottom = 1f - 2f * (float) crop.optDouble("bottom", 1d);
                effectsBuilder.add(new Crop(left, right, bottom, top));
            }
            float scale = outputScale(quality, metadata, crop);
            if (scale < 0.999f) {
                effectsBuilder.add(new ScaleAndRotateTransformation.Builder().setScale(scale, scale).build());
            }
            ImmutableList<Effect> effects = effectsBuilder.build();
            Transformer.Listener listener = new Transformer.Listener() {
                @Override
                public void onCompleted(androidx.media3.transformer.Composition composition, ExportResult result) {
                    stopProgressPolling();
                    if (isCancelled(jobId)) {
                        delete(output);
                        resolveCancelled(call, jobId);
                        return;
                    }
                    if (!output.isFile() || output.length() <= 0) {
                        clearActive(jobId);
                        Log.e(TAG, "Media3 completed without a readable output for job " + jobId);
                        call.reject("The video output was empty on this device.", "VIDEO_OUTPUT_EMPTY");
                        return;
                    }
                    JSObject payload = new JSObject();
                    payload.put("jobId", jobId);
                    payload.put("success", true);
                    payload.put("path", output.getAbsolutePath());
                    payload.put("name", safeOutputName(fileName));
                    payload.put("mimeType", MimeTypes.VIDEO_MP4);
                    payload.put("size", output.length());
                    VideoMetadata outputMetadata = readMetadata(Uri.fromFile(output));
                    payload.put("width", outputMetadata.width);
                    payload.put("height", outputMetadata.height);
                    payload.put("durationMs", outputMetadata.durationMs);
                    clearActive(jobId);
                    call.resolve(payload);
                }

                @Override
                public void onError(androidx.media3.transformer.Composition composition, ExportResult result, ExportException exception) {
                    stopProgressPolling();
                    delete(output);
                    if (isCancelled(jobId)) resolveCancelled(call, jobId);
                    else {
                        Log.e(TAG, "Media3 transform failed for job " + jobId, exception);
                        clearActive(jobId);
                        call.reject("The video could not be prepared on this device.", "VIDEO_TRANSFORM_FAILED", exception);
                    }
                }
            };
            Transformer.Builder builder = new Transformer.Builder(getContext())
                .setVideoMimeType(MimeTypes.VIDEO_H264)
                .setAudioMimeType(MimeTypes.AUDIO_AAC)
                .addListener(listener);
            EditedMediaItem.Builder editedBuilder = new EditedMediaItem.Builder(mediaBuilder.build());
            if (!effects.isEmpty()) editedBuilder.setEffects(new Effects(ImmutableList.of(), effects));
            activeTransformer = builder.build();
            activeTransformer.start(editedBuilder.build(), output.getAbsolutePath());
            pollProgress(jobId);
        } catch (Exception error) {
            Log.e(TAG, "Could not start Media3 transform for job " + jobId, error);
            delete(output);
            clearActive(jobId);
            String code = "VIDEO_OUTPUT_DIRECTORY_UNAVAILABLE".equals(error.getMessage())
                ? "VIDEO_STORAGE_UNAVAILABLE"
                : "VIDEO_TRANSFORM_FAILED";
            call.reject("The video could not be prepared on this device.", code, error);
        }
    }

    private float outputScale(String quality, VideoMetadata metadata, @Nullable JSObject crop) {
        if ("original".equals(quality) || metadata.width <= 0 || metadata.height <= 0) return 1f;
        float width = metadata.width;
        float height = metadata.height;
        if (crop != null) {
            width *= Math.max(0.1f, (float) crop.optDouble("right", 1d) - (float) crop.optDouble("left", 0d));
            height *= Math.max(0.1f, (float) crop.optDouble("bottom", 1d) - (float) crop.optDouble("top", 0d));
        }
        float target = "smaller".equals(quality) ? 960f : 1280f;
        return Math.min(1f, target / Math.max(width, height));
    }

    private void pollProgress(String jobId) {
        mainHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (activeTransformer == null || !jobId.equals(activeJobId)) return;
                ProgressHolder holder = new ProgressHolder();
                int state = activeTransformer.getProgress(holder);
                if (state == Transformer.PROGRESS_STATE_AVAILABLE) {
                    JSObject progress = new JSObject();
                    progress.put("jobId", jobId);
                    progress.put("progress", holder.progress);
                    notifyListeners("progress", progress);
                }
                mainHandler.postDelayed(this, 500);
            }
        }, 500);
    }

    private void stopProgressPolling() {
        // The runnable exits as soon as activeTransformer is cleared.
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String requestedJobId = call.getString("jobId");
        getActivity().runOnUiThread(() -> {
            if (activeJobId != null && (requestedJobId == null || requestedJobId.equals(activeJobId))) {
                cancelledJobId = activeJobId;
                if (activeTransformer != null) activeTransformer.cancel();
                else activeJobId = null;
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void cleanup(PluginCall call) {
        String path = call.getString("path");
        if (path != null) {
            File file = new File(path);
            if (file.getParentFile() != null && file.getParentFile().equals(getContext().getCacheDir())) delete(file);
        }
        call.resolve();
    }

    private boolean isCancelled(String jobId) {
        return jobId.equals(cancelledJobId);
    }

    private void resolveCancelled(PluginCall call, String jobId) {
        clearActive(jobId);
        JSObject result = new JSObject();
        result.put("cancelled", true);
        call.resolve(result);
    }

    private void clearActive(String jobId) {
        if (jobId.equals(activeJobId)) {
            activeTransformer = null;
            activeJobId = null;
            cancelledJobId = null;
        }
    }

    private Uri parseUri(String value) {
        Uri parsed = Uri.parse(value);
        return parsed.getScheme() == null ? Uri.fromFile(new File(value)) : parsed;
    }

    private VideoMetadata readMetadata(Uri uri) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            if ("file".equals(uri.getScheme())) retriever.setDataSource(uri.getPath());
            else retriever.setDataSource(getContext(), uri);
            int width = parseInt(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH));
            int height = parseInt(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT));
            int rotation = parseInt(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION));
            long duration = parseLong(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));
            if (rotation == 90 || rotation == 270) {
                int swapped = width;
                width = height;
                height = swapped;
            }
            return new VideoMetadata(width, height, duration);
        } catch (Exception error) {
            Log.w(TAG, "Could not read metadata for " + uri, error);
            return new VideoMetadata(0, 0, 0);
        } finally {
            try { retriever.release(); }
            catch (Exception ignored) { }
        }
    }

    @Nullable
    private JSObject fillCrop(VideoMetadata metadata) {
        if (metadata.width <= 0 || metadata.height <= 0) return null;
        double sourceAspect = (double) metadata.width / (double) metadata.height;
        double targetAspect = 4d / 3d;
        JSObject crop = new JSObject();
        if (sourceAspect > targetAspect) {
            double width = targetAspect / sourceAspect;
            double inset = (1d - width) / 2d;
            crop.put("left", inset);
            crop.put("right", 1d - inset);
            crop.put("top", 0d);
            crop.put("bottom", 1d);
        } else {
            double height = sourceAspect / targetAspect;
            double inset = (1d - height) / 2d;
            double top = (1d - height) / 2d;
            crop.put("left", 0d);
            crop.put("right", 1d);
            crop.put("top", top);
            crop.put("bottom", 1d - inset);
        }
        return crop;
    }

    private static int parseInt(String value) {
        try { return value == null ? 0 : Integer.parseInt(value); }
        catch (NumberFormatException ignored) { return 0; }
    }

    private static long parseLong(String value) {
        try { return value == null ? 0 : Long.parseLong(value); }
        catch (NumberFormatException ignored) { return 0; }
    }

    private static String safeToken(String value) {
        return value == null ? "job" : value.replaceAll("[^A-Za-z0-9_-]", "_");
    }

    private static String safeOutputName(String name) {
        String base = name == null ? "video" : name.replaceAll("[^A-Za-z0-9._-]", "_");
        int extension = base.lastIndexOf('.');
        String stem = extension > 0 ? base.substring(0, extension) : base;
        return stem + "-edited.mp4";
    }

    private static void delete(File file) {
        if (file != null && file.exists()) file.delete();
    }

    private void cleanupStaleFiles() {
        File[] files = getContext().getCacheDir().listFiles();
        if (files == null) return;
        for (File file : files) {
            String name = file.getName();
            if (name.startsWith("tiny-surprise-video-") || name.startsWith("tiny-video-output-")) delete(file);
        }
    }

    private static final class VideoMetadata {
        final int width;
        final int height;
        final long durationMs;

        VideoMetadata(int width, int height, long durationMs) {
            this.width = width;
            this.height = height;
            this.durationMs = durationMs;
        }
    }
}

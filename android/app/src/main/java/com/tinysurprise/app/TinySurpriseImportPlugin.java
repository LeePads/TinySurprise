package com.tinysurprise.app;

import android.content.Intent;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Comparator;
import java.util.UUID;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Bridges Android VIEW/SEND intents carrying a .tinysurprise file to the web
 * layer. Cold starts are read via getPendingImport(); intents delivered
 * while the app is already running (singleTask -> onNewIntent) are pushed
 * through the "importReceived" event instead, since JS listeners are already
 * attached by then.
 *
 * All file reads run on a single-thread executor: onNewIntent() is called on
 * the main/UI thread by Android, and a multi-megabyte content:// read there
 * would jank the UI. The single thread also naturally serializes rapid
 * back-to-back intents instead of racing.
 */
@CapacitorPlugin(name = "TinySurpriseImport")
public class TinySurpriseImportPlugin extends Plugin {

    // Matches MAX_PACKAGE_BYTES in lib/export/tinysurprise-package.ts — keep in sync so a
    // package the JS side would accept is never rejected earlier by the native read.
    private static final long MAX_BYTES = 30L * 1024 * 1024;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final String INTENT_TOKEN = "com.tinysurprise.importToken";

    private SharedPreferences receipts() {
        return getContext().getSharedPreferences("tiny-surprise-import-receipts", Context.MODE_PRIVATE);
    }

    private File inbox() {
        return new File(getContext().getFilesDir(), "tiny-surprise-inbox");
    }

    private File[] pendingFiles() {
        File[] leftovers = inbox().listFiles(file -> file.isDirectory()
            && (file.getName().matches("\\.dismissed-[0-9a-f-]{36}")
                || (file.getName().matches("\\.staging-[0-9a-f-]{36}")
                    && System.currentTimeMillis() - file.lastModified() > 24L * 60 * 60 * 1000)));
        if (leftovers != null) for (File folder : leftovers) removeOwnedFolder(folder);
        File[] files = inbox().listFiles(file -> file.isDirectory()
            && file.getName().matches("[0-9a-f-]{36}")
            && new File(file, "payload").isFile() && new File(file, "name").isFile());
        if (files == null) return new File[0];
        Arrays.sort(files, Comparator.comparingLong(File::lastModified).thenComparing(File::getName));
        return files;
    }

    private JSObject payloadFor(File folder) throws Exception {
        JSObject payload = new JSObject();
        payload.put("id", folder.getName());
        payload.put("path", new File(folder, "payload").toURI().toString());
        payload.put("name", readInboxString(new File(folder, "name"), 4096));
        return payload;
    }

    private String readInboxString(File file, int limit) throws Exception {
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] bytes = new byte[limit];
            int length = 0;
            int read;
            while (length < bytes.length && (read = input.read(bytes, length, bytes.length - length)) > 0) length += read;
            if (input.read() != -1) throw new java.io.IOException("Invalid inbox filename");
            return new String(bytes, 0, length, StandardCharsets.UTF_8);
        }
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
    }

    /** Called from MainActivity.onNewIntent() — must not block the calling (UI) thread. */
    public void handleIntent(Intent intent) {
        executor.execute(() -> {
            JSObject payload = extractPayload(intent);
            if (payload != null) notifyListeners("importReceived", payload, true);
        });
    }

    @PluginMethod
    public void getPendingImport(PluginCall call) {
        executor.execute(() -> {
            JSObject payload = extractPayload(getActivity().getIntent());
            if (payload == null) {
                try {
                    File[] files = pendingFiles();
                    if (files.length > 0) payload = payloadFor(files[0]);
                } catch (Exception error) {
                    call.reject("The received file could not be reopened.");
                    return;
                }
            }
            call.resolve(payload != null ? payload : new JSObject());
        });
    }

    @PluginMethod
    public void getPendingImports(PluginCall call) {
        executor.execute(() -> {
            try {
                JSObject incoming = extractPayload(getActivity().getIntent());
                JSArray payloads = new JSArray();
                for (File folder : pendingFiles()) payloads.put(payloadFor(folder));
                if (incoming != null && incoming.has("error")) payloads.put(incoming);
                JSObject result = new JSObject();
                result.put("imports", payloads);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Received files could not be reopened. They remain on this device.");
            }
        });
    }

    /** Only an explicit Save/Discard releases an inbox item. Arbitrary paths are never accepted. */
    @PluginMethod
    public void acknowledgeImport(PluginCall call) {
        executor.execute(() -> {
            String id = call.getString("id");
            if (id != null) {
                if (!id.matches("[0-9a-f-]{36}")) { call.reject("Invalid import identity."); return; }
                File folder = new File(inbox(), id);
                File dismissed = new File(inbox(), ".dismissed-" + id);
                if (folder.exists()) {
                    try {
                        String source = readInboxString(new File(folder, "source"), 8192);
                        Set<String> acknowledged = new LinkedHashSet<>(receipts().getStringSet("acknowledged", new LinkedHashSet<>()));
                        // The active FIFO is capped at three; keep a bounded recent receipt set.
                        if (acknowledged.size() >= 32) acknowledged.remove(acknowledged.iterator().next());
                        acknowledged.add(source);
                        if (!receipts().edit().putStringSet("acknowledged", acknowledged).commit()) {
                            call.reject("This import could not be released. Try again."); return;
                        }
                    } catch (Exception error) { call.reject("This import could not be released. Try again."); return; }
                }
                if (folder.exists() && !folder.renameTo(dismissed)) {
                    call.reject("This import could not be released. Try again."); return;
                }
                removeOwnedFolder(dismissed);
            }
            String token = call.getString("intentToken");
            Intent current = getActivity().getIntent();
            if (token != null && current != null && token.equals(current.getStringExtra(INTENT_TOKEN))) consumeIntent(current);
            call.resolve();
        });
    }

    private void consumeIntent(Intent intent) {
        intent.setAction(null);
        intent.setData(null);
        intent.removeExtra(Intent.EXTRA_STREAM);
        intent.removeExtra(INTENT_TOKEN);
        if (getActivity() instanceof MainActivity) ((MainActivity) getActivity()).importIntentConsumed();
    }

    private void removeOwnedFolder(File folder) {
        // These fixed children are created only by this plugin. Never recursively sweep user storage.
        new File(folder, "payload").delete();
        new File(folder, "name").delete();
        new File(folder, "source").delete();
        folder.delete();
    }

    /** Returns null only when there was nothing to import (no file intent pending). */
    private JSObject extractPayload(Intent intent) {
        if (intent == null) return null;
        String action = intent.getAction();
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(action)) {
            uri = intent.getData();
        } else if (Intent.ACTION_SEND.equals(action)) {
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        }
        if (uri == null) return null;
        // Android can restore the original VIEW/SEND intent after process death.
        // Fresh onNewIntent deliveries still read the source, even for the same URI.
        if (getActivity() instanceof MainActivity && ((MainActivity) getActivity()).isRestoringImportIntent()) {
            try {
                String source = uri.toString();
                if (receipts().getStringSet("acknowledged", new LinkedHashSet<>()).contains(source)) {
                    consumeIntent(intent); return null;
                }
                for (File folder : pendingFiles()) {
                    if (source.equals(readInboxString(new File(folder, "source"), 8192))) {
                        JSObject payload = payloadFor(folder);
                        consumeIntent(intent); return payload;
                    }
                }
            } catch (Exception error) {
                JSObject failure = new JSObject();
                failure.put("error", "This received file could not be reopened. It remains on this device.");
                return failure;
            }
        }
        String token = intent.getStringExtra(INTENT_TOKEN);
        if (token == null) { token = UUID.randomUUID().toString(); intent.putExtra(INTENT_TOKEN, token); }
        JSObject payload = readUri(uri);
        if (payload.has("id")) consumeIntent(intent);
        else payload.put("intentToken", token);
        return payload;
    }

    private JSObject readUri(Uri uri) {
        JSObject result = new JSObject();
        File staging = null;
        try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            if (input == null) {
                result.put("error", "This file could not be opened.");
                return result;
            }
            if (pendingFiles().length >= 3) {
                result.put("error", "Finish or discard an open surprise before importing another file.");
                return result;
            }
            long declaredSize = queryDeclaredSize(uri);
            if (declaredSize > MAX_BYTES) {
                result.put("error", "This file is too large to open."); return result;
            }
            String id = UUID.randomUUID().toString();
            if (!inbox().isDirectory() && !inbox().mkdirs()) throw new java.io.IOException("Inbox unavailable");
            staging = new File(inbox(), ".staging-" + id);
            if (!staging.mkdir()) throw new java.io.IOException("Inbox unavailable");
            byte[] chunk = new byte[8192];
            int read;
            long total = 0;
            try (FileOutputStream output = new FileOutputStream(new File(staging, "payload"))) {
                while ((read = input.read(chunk)) != -1) {
                    total += read;
                    if (total > MAX_BYTES) {
                        result.put("error", "This file is too large to open."); return result;
                    }
                    output.write(chunk, 0, read);
                }
                output.getFD().sync();
            }
            String name = queryDisplayName(uri);
            if (name == null) name = "import.tinysurprise";
            if (name.getBytes(StandardCharsets.UTF_8).length > 4096) throw new java.io.IOException("Invalid filename");
            try (FileOutputStream output = new FileOutputStream(new File(staging, "name"))) {
                output.write(name.getBytes(StandardCharsets.UTF_8));
                output.getFD().sync();
            }
            byte[] source = uri.toString().getBytes(StandardCharsets.UTF_8);
            if (source.length > 8192) throw new java.io.IOException("Invalid source URI");
            try (FileOutputStream output = new FileOutputStream(new File(staging, "source"))) {
                output.write(source);
                output.getFD().sync();
            }
            File committed = new File(inbox(), id);
            if (!staging.renameTo(committed)) throw new java.io.IOException("Inbox unavailable");
            staging = null;
            return payloadFor(committed);
        } catch (SecurityException e) {
            result.put("error", "TinySurprise was not given permission to read this file.");
            return result;
        } catch (Exception e) {
            result.put("error", "This file could not be read.");
            return result;
        } finally {
            if (staging != null) removeOwnedFolder(staging);
        }
    }

    private String queryDisplayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) return cursor.getString(idx);
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private long queryDeclaredSize(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int idx = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (idx >= 0 && !cursor.isNull(idx)) return cursor.getLong(idx);
            }
        } catch (Exception ignored) {
        }
        return -1;
    }
}

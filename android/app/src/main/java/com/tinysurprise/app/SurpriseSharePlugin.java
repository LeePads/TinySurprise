package com.tinysurprise.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.IOException;

/**
 * Shares a Tiny Surprise HTML export as a generic attachment
 * (application/octet-stream) instead of text/html. @capacitor/share's
 * Android implementation always derives its Intent MIME type from the
 * shared file's extension (MimeTypeMap.getMimeTypeFromExtension), with no
 * way to override it, so a .html file it shares is always typed text/html —
 * and some chat apps (Messenger among them) never register an ACTION_SEND
 * intent-filter for text/html, so they never appear in the Sharesheet for
 * it. octet-stream is a much broader ACTION_SEND allowlist match. The file
 * itself is never renamed, wrapped, or modified: FileProvider still serves
 * the real bytes under the real .html filename, so whichever app or browser
 * eventually opens it resolves its actual type from the content, not from
 * this Intent's declared type.
 *
 * Deliberately scoped to files this app already wrote to its own export
 * directory (Directory.Documents from @capacitor/filesystem, i.e. Android's
 * public Documents folder) via {@link #resolveApprovedFile}. This is not a
 * general-purpose "share any path" bridge.
 */
@CapacitorPlugin(name = "SurpriseShare")
public class SurpriseSharePlugin extends Plugin {

    // Mirrors @capacitor/share's SharePlugin: once a share target has taken
    // the foreground, Android calls handleOnStop() even though the chooser
    // Activity itself later reports RESULT_CANCELED back to us (it never
    // gets a real result from whatever the user picked). So "cancelled" only
    // means the user backed out of the chooser without the app ever losing
    // the foreground -- not that a message was confirmed delivered.
    private boolean stopped = false;
    private boolean isPresenting = false;

    @Override
    protected void handleOnStop() {
        super.handleOnStop();
        stopped = true;
    }

    @PluginMethod
    public void shareFile(PluginCall call) {
        if (isPresenting) {
            call.reject("A share is already in progress.");
            return;
        }
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("No file was provided to share.");
            return;
        }

        File file;
        try {
            file = resolveApprovedFile(path);
        } catch (SecurityException | IOException e) {
            call.reject("This file could not be shared.");
            return;
        }
        if (!file.isFile()) {
            call.reject("This file no longer exists on the device.");
            return;
        }

        Uri contentUri;
        try {
            contentUri = FileProvider.getUriForFile(
                getActivity(),
                getContext().getPackageName() + ".fileprovider",
                file
            );
        } catch (Exception e) {
            call.reject("This file could not be prepared for sharing.");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("application/octet-stream");
        intent.putExtra(Intent.EXTRA_STREAM, contentUri);
        String text = call.getString("text");
        if (text != null) intent.putExtra(Intent.EXTRA_TEXT, text);
        String title = call.getString("title");
        if (title != null) {
            intent.putExtra(Intent.EXTRA_SUBJECT, title);
            intent.putExtra(Intent.EXTRA_TITLE, title);
        }
        intent.setClipData(ClipData.newRawUri("", contentUri));
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        String dialogTitle = call.getString("dialogTitle", "Share");
        Intent chooser = Intent.createChooser(intent, dialogTitle);
        chooser.addCategory(Intent.CATEGORY_DEFAULT);

        stopped = false;
        isPresenting = true;
        try {
            startActivityForResult(call, chooser, "shareResult");
        } catch (Exception error) {
            isPresenting = false;
            call.reject("The share sheet could not be opened. Your exported file is still saved.");
        }
    }

    @ActivityCallback
    private void shareResult(PluginCall call, ActivityResult result) {
        isPresenting = false;
        if (call == null) return;
        boolean cancelled = result.getResultCode() == Activity.RESULT_CANCELED && !stopped;
        JSObject output = new JSObject();
        output.put("cancelled", cancelled);
        call.resolve(output);
    }

    /**
     * Resolves `path` (expected to be the file:// URI this app itself wrote
     * via @capacitor/filesystem's Directory.Documents, i.e.
     * Environment.getExternalStoragePublicDirectory(DIRECTORY_DOCUMENTS))
     * to a File, rejecting anything outside that directory -- including
     * traversal via "..".
     */
    private File resolveApprovedFile(String path) throws IOException {
        Uri uri = Uri.parse(path);
        if (!"file".equals(uri.getScheme()) || uri.getPath() == null) {
            throw new SecurityException("Only files this app exported can be shared this way.");
        }
        File requested = new File(uri.getPath()).getCanonicalFile();
        File approvedRoot = Environment
            .getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS)
            .getCanonicalFile();
        String rootPath = approvedRoot.getPath() + File.separator;
        if (!requested.getPath().startsWith(rootPath)) {
            throw new SecurityException("Only files this app exported can be shared this way.");
        }
        return requested;
    }
}

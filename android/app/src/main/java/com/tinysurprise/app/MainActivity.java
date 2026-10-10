package com.tinysurprise.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {
    private volatile boolean restoringImportIntent;

    boolean isRestoringImportIntent() { return restoringImportIntent; }
    void importIntentConsumed() { restoringImportIntent = false; }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        restoringImportIntent = savedInstanceState != null ||
            (getIntent().getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0;
        registerPlugin(TinySurpriseImportPlugin.class);
        registerPlugin(ImmersiveModePlugin.class);
        registerPlugin(SurpriseSharePlugin.class);
        registerPlugin(VideoTransformerPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        restoringImportIntent = false;
        PluginHandle handle = getBridge().getPlugin("TinySurpriseImport");
        if (handle != null) {
            ((TinySurpriseImportPlugin) handle.getInstance()).handleIntent(intent);
        }
    }
}

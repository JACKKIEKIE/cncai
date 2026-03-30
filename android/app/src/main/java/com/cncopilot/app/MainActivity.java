package com.cncopilot.app;

import android.Manifest;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebStorage;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int INITIAL_PERMISSION_REQUEST_CODE = 1001;
    private static final String APP_PREFS = "linguacnc_app_state";
    private static final String KEY_INITIAL_PERMISSION_REQUESTED = "initial_permission_requested";
    private static final String KEY_LAST_CACHE_RESET_VERSION = "last_cache_reset_version";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        clearStaleWebRuntimeIfNeeded();
        requestInitialPermissionsIfNeeded();
    }

    private void clearStaleWebRuntimeIfNeeded() {
        SharedPreferences preferences = getSharedPreferences(APP_PREFS, MODE_PRIVATE);
        String currentVersion = getCurrentVersionName();
        String lastResetVersion = preferences.getString(KEY_LAST_CACHE_RESET_VERSION, "");

        if (currentVersion.equals(lastResetVersion)) {
            return;
        }

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            webView.clearCache(true);
            webView.clearHistory();
            webView.clearFormData();
            webView.clearSslPreferences();
        }

        WebStorage.getInstance().deleteAllData();

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.removeAllCookies(null);
        cookieManager.flush();

        preferences.edit().putString(KEY_LAST_CACHE_RESET_VERSION, currentVersion).apply();
    }

    private String getCurrentVersionName() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                return getPackageManager().getPackageInfo(getPackageName(), PackageManager.PackageInfoFlags.of(0)).versionName;
            }
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (PackageManager.NameNotFoundException exception) {
            return "";
        }
    }

    private void requestInitialPermissionsIfNeeded() {
        SharedPreferences preferences = getSharedPreferences(APP_PREFS, MODE_PRIVATE);
        if (preferences.getBoolean(KEY_INITIAL_PERMISSION_REQUESTED, false)) {
            return;
        }

        List<String> permissions = new ArrayList<>();
        addPermissionIfMissing(permissions, Manifest.permission.CAMERA);
        addPermissionIfMissing(permissions, Manifest.permission.RECORD_AUDIO);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            addPermissionIfMissing(permissions, Manifest.permission.READ_MEDIA_IMAGES);
            addPermissionIfMissing(permissions, Manifest.permission.READ_MEDIA_VIDEO);
            addPermissionIfMissing(permissions, Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            addPermissionIfMissing(permissions, Manifest.permission.READ_MEDIA_IMAGES);
            addPermissionIfMissing(permissions, Manifest.permission.READ_MEDIA_VIDEO);
        } else {
            addPermissionIfMissing(permissions, Manifest.permission.READ_EXTERNAL_STORAGE);
            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
                addPermissionIfMissing(permissions, Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
        }

        preferences.edit().putBoolean(KEY_INITIAL_PERMISSION_REQUESTED, true).apply();

        if (!permissions.isEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                permissions.toArray(new String[0]),
                INITIAL_PERMISSION_REQUEST_CODE
            );
        }
    }

    private void addPermissionIfMissing(List<String> permissions, String permission) {
        if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(permission);
        }
    }
}

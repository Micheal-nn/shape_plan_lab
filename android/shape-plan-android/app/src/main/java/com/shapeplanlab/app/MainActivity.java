package com.shapeplanlab.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    @SuppressLint("SetJavaScriptEnabled")
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        webView.addJavascriptInterface(new SaveBridge(), "ShapePlanAndroid");
        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("file:///android_asset/index.html");
        setContentView(webView);
    }

    public class SaveBridge {
        @JavascriptInterface
        public void saveSvg(String svg, String fileName) {
            runOnUiThread(() -> {
                try {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                    values.put(MediaStore.Downloads.MIME_TYPE, "image/svg+xml");
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    android.net.Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new IllegalStateException("Downloads provider unavailable");
                    try (OutputStream stream = getContentResolver().openOutputStream(uri)) {
                        if (stream == null) throw new IllegalStateException("Output stream unavailable");
                        stream.write(svg.getBytes(StandardCharsets.UTF_8));
                    }
                    Toast.makeText(MainActivity.this, "长图已保存到下载目录", Toast.LENGTH_LONG).show();
                } catch (Exception error) {
                    Toast.makeText(MainActivity.this, "保存失败，请稍后重试", Toast.LENGTH_LONG).show();
                }
            });
        }
    }

    @Override
    public void onBackPressed() {
        WebView webView = (WebView) ((android.view.ViewGroup) findViewById(android.R.id.content)).getChildAt(0);
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}

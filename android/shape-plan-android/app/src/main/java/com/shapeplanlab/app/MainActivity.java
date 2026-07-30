package com.shapeplanlab.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import java.io.OutputStream;

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
        public void saveImage(String dataUrl, String fileName) {
            runOnUiThread(() -> {
                try {
                    int comma = dataUrl.indexOf(',');
                    String payload = comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl;
                    byte[] png = Base64.decode(payload, Base64.DEFAULT);
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                    values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                    values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/ShapePlanLab");
                    values.put(MediaStore.Images.Media.IS_PENDING, 1);
                    android.net.Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new IllegalStateException("Images provider unavailable");
                    try (OutputStream stream = getContentResolver().openOutputStream(uri)) {
                        if (stream == null) throw new IllegalStateException("Output stream unavailable");
                        stream.write(png);
                    }
                    ContentValues done = new ContentValues();
                    done.put(MediaStore.Images.Media.IS_PENDING, 0);
                    getContentResolver().update(uri, done, null, null);
                    Toast.makeText(MainActivity.this, "长图已保存到图库", Toast.LENGTH_LONG).show();
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

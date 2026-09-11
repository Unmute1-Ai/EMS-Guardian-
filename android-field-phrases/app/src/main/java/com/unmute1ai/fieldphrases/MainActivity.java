package com.unmute1ai.fieldphrases;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;

public final class MainActivity extends Activity {
  private final List<Language> languages = new ArrayList<>();
  private final List<String> english = new ArrayList<>();
  private LinearLayout phraseList;
  private TextView translated;
  private TextView status;
  private MediaPlayer player;

  @Override public void onCreate(Bundle b) {
    super.onCreate(b);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
    if (Build.VERSION.SDK_INT >= 33) setRecentsScreenshotEnabled(false);
    loadData();
    setContentView(buildUi());
  }

  private View buildUi() {
    int pad = dp(18);
    LinearLayout body = new LinearLayout(this);
    body.setOrientation(LinearLayout.VERTICAL);
    body.setPadding(pad, pad, pad, pad);
    body.setBackgroundColor(Color.rgb(7, 17, 23));

    body.addView(text("UNMUTE1AI // U1 FIELD", 13, Color.rgb(94,230,208), Typeface.BOLD));
    body.addView(text("EMS phrase translation", 29, Color.WHITE, Typeface.BOLD));
    body.addView(text("Medic → patient. Fixed phrases. ElevenLabs voice bundled into the APK. No network, microphone, account, analytics, or patient data.", 14, Color.rgb(180,199,207), Typeface.NORMAL), margin(0,6,0,14));

    TextView banner = text("SHADOW PILOT · TRANSLATIONS REQUIRE BILINGUAL CLINICAL VALIDATION", 12, Color.rgb(253,230,138), Typeface.BOLD);
    banner.setPadding(dp(10), dp(9), dp(10), dp(9));
    banner.setBackgroundColor(Color.rgb(55,44,12));
    body.addView(banner, margin(0,0,0,14));

    body.addView(text("PATIENT LANGUAGE", 12, Color.rgb(94,230,208), Typeface.BOLD));
    Spinner spinner = new Spinner(this);
    String[] names = new String[languages.size()];
    for (int i=0;i<names.length;i++) names[i]=languages.get(i).name;
    spinner.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, names));
    body.addView(spinner, margin(0,5,0,14));

    status = text("OFFLINE READY · ZERO APP PERMISSIONS", 12, Color.rgb(134,239,172), Typeface.BOLD);
    status.setPadding(dp(10), dp(8), dp(10), dp(8));
    status.setBackgroundColor(Color.rgb(12,43,37));
    body.addView(status, margin(0,0,0,14));

    phraseList = new LinearLayout(this);
    phraseList.setOrientation(LinearLayout.VERTICAL);
    body.addView(phraseList);

    body.addView(text("TRANSLATION", 12, Color.rgb(94,230,208), Typeface.BOLD), margin(0,12,0,5));
    translated = text("Tap a phrase.", 24, Color.WHITE, Typeface.NORMAL);
    translated.setPadding(dp(14), dp(14), dp(14), dp(14));
    translated.setBackgroundColor(Color.rgb(12,28,36));
    body.addView(translated, margin(0,0,0,16));

    body.addView(text("Communication aid only. Do not use as the sole basis for diagnosis, consent, medication, or other critical clinical decisions. Use a qualified interpreter whenever available.", 12, Color.rgb(140,159,168), Typeface.NORMAL));

    spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
      public void onItemSelected(AdapterView<?> parent, View view, int position, long id) { render(position); }
      public void onNothingSelected(AdapterView<?> parent) {}
    });
    render(0);

    ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    scroll.addView(body);
    return scroll;
  }

  private void render(int languageIndex) {
    phraseList.removeAllViews();
    for (int i=0;i<english.size();i++) {
      final int phraseIndex = i;
      Button button = new Button(this);
      button.setAllCaps(false);
      button.setText(english.get(i));
      button.setTextSize(16);
      button.setMinHeight(dp(58));
      button.setOnClickListener(v -> {
        Language lang = languages.get(languageIndex);
        translated.setText(lang.phrases.get(phraseIndex));
        play(lang.id, phraseIndex);
      });
      phraseList.addView(button, margin(0,0,0,7));
    }
  }

  private void play(String lang, int phraseIndex) {
    stopPlayer();
    String asset = "voice/" + lang + "/p" + String.format("%02d", phraseIndex + 1) + ".mp3";
    try {
      android.content.res.AssetFileDescriptor afd = getAssets().openFd(asset);
      player = new MediaPlayer();
      player.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
      afd.close();
      player.setOnPreparedListener(MediaPlayer::start);
      player.setOnCompletionListener(mp -> { stopPlayer(); status.setText("OFFLINE READY · NOTHING STORED"); });
      player.prepareAsync();
      status.setText("PLAYING BUNDLED ELEVENLABS VOICE");
    } catch (Exception e) {
      status.setText("VOICE ASSET MISSING · REBUILD WITH ELEVENLABS");
    }
  }

  private void stopPlayer() {
    if (player != null) {
      try { player.stop(); } catch (Exception ignored) {}
      player.release();
      player = null;
    }
  }

  private void loadData() {
    try {
      BufferedReader reader = new BufferedReader(new InputStreamReader(getAssets().open("phrases.json")));
      StringBuilder raw = new StringBuilder();
      String line;
      while ((line = reader.readLine()) != null) raw.append(line);
      JSONObject root = new JSONObject(raw.toString());
      JSONArray en = root.getJSONArray("english");
      for (int i=0;i<en.length();i++) english.add(en.getString(i));
      JSONArray langs = root.getJSONArray("languages");
      for (int i=0;i<langs.length();i++) {
        JSONObject o = langs.getJSONObject(i);
        JSONArray a = o.getJSONArray("phrases");
        List<String> p = new ArrayList<>();
        for (int j=0;j<a.length();j++) p.add(a.getString(j));
        languages.add(new Language(o.getString("id"), o.getString("name"), p));
      }
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  @Override protected void onStop() {
    stopPlayer();
    if (translated != null) translated.setText("Tap a phrase.");
    super.onStop();
  }

  private TextView text(String s, float size, int color, int style) {
    TextView v = new TextView(this);
    v.setText(s); v.setTextSize(size); v.setTextColor(color); v.setTypeface(Typeface.DEFAULT, style); v.setLineSpacing(0,1.12f);
    return v;
  }
  private LinearLayout.LayoutParams margin(int l,int t,int r,int b) {
    LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1,-2);
    p.setMargins(dp(l),dp(t),dp(r),dp(b));
    return p;
  }
  private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
  private record Language(String id, String name, List<String> phrases) {}
}

package com.unmute1ai.u1field;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public final class MainActivity extends Activity {
    private static final int REQ_MIC=101, RATE=16000, MAX_SECONDS=20, MAX_SAMPLES=RATE*MAX_SECONDS;
    private static final String MODEL_ASSET="models/ggml-base.bin";
    private static final String[] LANGUAGE_NAMES={"Spanish","Chinese","Russian","Bengali","Haitian Creole","Korean","Arabic","Urdu","French","Polish"};
    private static final String[] LANGUAGE_CODES={"es","zh","ru","bn","ht","ko","ar","ur","fr","pl"};
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final Handler main=new Handler(Looper.getMainLooper());
    private final AtomicBoolean recording=new AtomicBoolean(false);
    private short[] capture=new short[MAX_SAMPLES];
    private volatile int sampleCount=0;
    private volatile boolean foreground=false;
    private long modelHandle=0;
    private AudioRecord recorder;
    private TextView status, original, english;
    private Button listen;
    private Spinner language;

    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        if(Build.VERSION.SDK_INT>=33) setRecentsScreenshotEnabled(false);
        setContentView(buildUi());
        listen.setEnabled(false); status.setText("LOCAL ENGINE · INITIALIZING"); worker.execute(this::prepareModel);
    }
    @Override protected void onStart(){ super.onStart(); foreground=true; }

    private View buildUi(){
        LinearLayout body=new LinearLayout(this); body.setOrientation(LinearLayout.VERTICAL); body.setPadding(dp(20),dp(20),dp(20),dp(20)); body.setBackgroundColor(Color.rgb(7,17,23));
        body.addView(text("UNMUTE1AI // U1 FIELD",13,Color.rgb(94,230,208),Typeface.BOLD));
        body.addView(text("Patient → English",30,Color.WHITE,Typeface.BOLD),lp(-1,-2,0,8,0,4));
        body.addView(text("One-way EMS phrase transcription + translation. Entirely on device. No cloud. No account. No retained conversation.",15,Color.rgb(180,199,207),Typeface.NORMAL),lp(-1,-2,0,0,0,16));
        status=text("STARTING",12,Color.rgb(134,239,172),Typeface.BOLD); status.setPadding(dp(12),dp(10),dp(12),dp(10)); status.setBackgroundColor(Color.rgb(12,43,37)); body.addView(status,lp(-1,-2,0,0,0,14));
        body.addView(label("PATIENT LANGUAGE"));
        language=new Spinner(this); ArrayAdapter<String> a=new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,LANGUAGE_NAMES); language.setAdapter(a); body.addView(language,lp(-1,dp(56),0,5,0,14));
        listen=new Button(this); listen.setText("START LISTENING"); listen.setTextSize(19); listen.setAllCaps(false); listen.setTypeface(Typeface.DEFAULT,Typeface.BOLD); listen.setMinHeight(dp(72)); listen.setOnClickListener(v->toggle()); body.addView(listen,lp(-1,dp(72),0,0,0,18));
        body.addView(label("ORIGINAL TRANSCRIPT")); original=resultBox("Nothing captured."); body.addView(original,lp(-1,-2,0,6,0,18));
        body.addView(label("ENGLISH")); english=resultBox("Nothing translated."); body.addView(english,lp(-1,-2,0,6,0,18));
        Button clear=new Button(this); clear.setText("Clear now"); clear.setAllCaps(false); clear.setOnClickListener(v->clearUi()); body.addView(clear,lp(-1,dp(52),0,0,0,16));
        body.addView(text("Communication aid only. Confirm critical clinical information directly with the patient. Audio and transcript content are not written to app storage and are cleared when the app leaves the foreground.",12,Color.rgb(140,159,168),Typeface.NORMAL));
        ScrollView scroll=new ScrollView(this); scroll.setFillViewport(true); scroll.addView(body); return scroll;
    }

    private void prepareModel(){
        try{
            File dir=new File(getNoBackupFilesDir(),"model"); if(!dir.exists()&&!dir.mkdirs()) throw new IllegalStateException(); File model=new File(dir,"ggml-base.bin");
            if(!model.exists()||model.length()<140_000_000L){ try(InputStream in=getAssets().open(MODEL_ASSET); FileOutputStream out=new FileOutputStream(model,false)){ byte[] buf=new byte[1024*1024]; int n; while((n=in.read(buf))>0) out.write(buf,0,n); Arrays.fill(buf,(byte)0); out.getFD().sync(); } }
            modelHandle=WhisperBridge.initModel(model.getAbsolutePath()); if(modelHandle==0) throw new IllegalStateException();
            main.post(()->{status.setText("OFFLINE READY · NETWORK PERMISSION ABSENT");listen.setEnabled(true);});
        }catch(Throwable t){main.post(()->status.setText("MODEL ERROR · REINSTALL BUILD"));}
    }

    private void toggle(){ if(recording.get()) stopAndTranslate(); else ensureMicAndStart(); }
    private void ensureMicAndStart(){ if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},REQ_MIC);return;} startRecording(); }
    @Override public void onRequestPermissionsResult(int requestCode,String[] p,int[] g){super.onRequestPermissionsResult(requestCode,p,g);if(requestCode==REQ_MIC&&g.length>0&&g[0]==PackageManager.PERMISSION_GRANTED)startRecording();else status.setText("MICROPHONE PERMISSION REQUIRED");}

    private void startRecording(){
        if(modelHandle==0||recording.get())return; clearUi(); sampleCount=0; Arrays.fill(capture,(short)0);
        int min=AudioRecord.getMinBufferSize(RATE,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT); int bytes=Math.max(min,4096);
        recorder=new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION,RATE,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,bytes*2);
        if(recorder.getState()!=AudioRecord.STATE_INITIALIZED){recorder.release();recorder=null;status.setText("MICROPHONE UNAVAILABLE");return;}
        recording.set(true); listen.setText("STOP & TRANSLATE"); status.setText("LISTENING · AUDIO ONLY IN RAM"); recorder.startRecording();
        worker.submit(()->{short[] buf=new short[bytes/2];try{while(recording.get()&&sampleCount<MAX_SAMPLES){int r=recorder.read(buf,0,Math.min(buf.length,MAX_SAMPLES-sampleCount));if(r>0){System.arraycopy(buf,0,capture,sampleCount,r);sampleCount+=r;}}}finally{Arrays.fill(buf,(short)0);if(sampleCount>=MAX_SAMPLES)main.post(this::stopAndTranslate);}});
    }

    private void stopAndTranslate(){
        if(!recording.getAndSet(false))return; listen.setEnabled(false);listen.setText("PROCESSING LOCALLY…");status.setText("TRANSCRIBING ON DEVICE");
        try{if(recorder!=null)recorder.stop();}catch(Throwable ignored){} try{if(recorder!=null)recorder.release();}catch(Throwable ignored){} recorder=null;
        final int n=sampleCount; final String code=LANGUAGE_CODES[Math.max(0,language.getSelectedItemPosition())];
        if(n<RATE/2){Arrays.fill(capture,0,n,(short)0);sampleCount=0;status.setText("TOO SHORT · TRY AGAIN");listen.setText("START LISTENING");listen.setEnabled(true);return;}
        worker.submit(()->{String src=WhisperBridge.transcribe(modelHandle,capture,n,code,false);String en=WhisperBridge.transcribe(modelHandle,capture,n,code,true);Arrays.fill(capture,0,n,(short)0);sampleCount=0;main.post(()->{if(foreground){original.setText(src.isBlank()?"No speech recognized.":src);english.setText(en.isBlank()?"No translation produced.":en);status.setText("DONE · NOTHING SAVED");listen.setText("START LISTENING");listen.setEnabled(true);}});});
    }

    private void clearUi(){if(original!=null)original.setText("Nothing captured.");if(english!=null)english.setText("Nothing translated.");}
    @Override protected void onStop(){foreground=false;super.onStop();if(recording.getAndSet(false)){try{if(recorder!=null)recorder.stop();}catch(Throwable ignored){}try{if(recorder!=null)recorder.release();}catch(Throwable ignored){}recorder=null;}Arrays.fill(capture,(short)0);sampleCount=0;clearUi();}
    @Override protected void onDestroy(){recording.set(false);long h=modelHandle;modelHandle=0;if(h!=0)try{worker.execute(()->WhisperBridge.releaseModel(h));}catch(Throwable ignored){}worker.shutdown();Arrays.fill(capture,(short)0);super.onDestroy();}
    private TextView label(String s){return text(s,12,Color.rgb(94,230,208),Typeface.BOLD);} private TextView resultBox(String s){TextView v=text(s,20,Color.WHITE,Typeface.NORMAL);v.setPadding(dp(14),dp(14),dp(14),dp(14));v.setBackgroundColor(Color.rgb(12,28,36));v.setMinHeight(dp(100));return v;}
    private TextView text(String s,float sp,int color,int style){TextView v=new TextView(this);v.setText(s);v.setTextSize(sp);v.setTextColor(color);v.setTypeface(Typeface.DEFAULT,style);v.setLineSpacing(0,1.12f);return v;}
    private LinearLayout.LayoutParams lp(int w,int h,int l,int t,int r,int b){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(w,h);p.setMargins(dp(l),dp(t),dp(r),dp(b));return p;} private int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);}
}

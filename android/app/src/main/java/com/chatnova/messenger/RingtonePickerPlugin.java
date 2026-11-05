package com.chatnova.messenger;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RingtonePicker")
public class RingtonePickerPlugin extends Plugin {

    private static final String PREFS = "chatnova_ringtone";
    private static final String KEY_URI = "selected_ringtone_uri";

    @PluginMethod
    public void openPicker(PluginCall call) {
        SharedPreferences prefs = getContext()
                .getSharedPreferences(PREFS, Activity.MODE_PRIVATE);

        String savedUri = prefs.getString(KEY_URI, null);

        Intent intent = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
        intent.putExtra(
                RingtoneManager.EXTRA_RINGTONE_TYPE,
                RingtoneManager.TYPE_RINGTONE
        );
        intent.putExtra(
                RingtoneManager.EXTRA_RINGTONE_TITLE,
                "Choose ChatNova Ringtone"
        );
        intent.putExtra(
                RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT,
                false
        );

        Uri existingUri = savedUri != null
                ? Uri.parse(savedUri)
                : Settings.System.DEFAULT_RINGTONE_URI;

        intent.putExtra(
                RingtoneManager.EXTRA_RINGTONE_EXISTING_URI,
                existingUri
        );

        startActivityForResult(
                call,
                intent,
                "handleRingtonePickerResult"
        );
    }

    @ActivityCallback
    private void handleRingtonePickerResult(
            PluginCall call,
            ActivityResult result
    ) {
        if (call == null) return;

        if (result.getResultCode() != Activity.RESULT_OK
                || result.getData() == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }

        Uri selectedUri = result.getData().getParcelableExtra(
                RingtoneManager.EXTRA_RINGTONE_PICKED_URI
        );

        if (selectedUri == null) {
            call.reject("No ringtone was selected.");
            return;
        }

        getContext()
                .getSharedPreferences(PREFS, Activity.MODE_PRIVATE)
                .edit()
                .putString(KEY_URI, selectedUri.toString())
                .apply();

        Ringtone ringtone = RingtoneManager.getRingtone(
                getContext(),
                selectedUri
        );

        String title = ringtone != null
                ? ringtone.getTitle(getContext())
                : "Selected Ringtone";

        JSObject response = new JSObject();
        response.put("cancelled", false);
        response.put("uri", selectedUri.toString());
        response.put("title", title);

        call.resolve(response);
    }

    @PluginMethod
    public void getSelectedRingtone(PluginCall call) {
        SharedPreferences prefs = getContext()
                .getSharedPreferences(PREFS, Activity.MODE_PRIVATE);

        String savedUri = prefs.getString(KEY_URI, null);

        JSObject response = new JSObject();
        response.put("uri", savedUri);
        response.put(
                "title",
                savedUri == null ? "Default Ringtone" : "Selected Ringtone"
        );

        call.resolve(response);
    }
}

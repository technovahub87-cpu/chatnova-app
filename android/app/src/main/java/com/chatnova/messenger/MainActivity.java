package com.chatnova.messenger;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(RingtonePickerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

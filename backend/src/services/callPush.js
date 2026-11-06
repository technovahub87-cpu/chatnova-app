
const PushToken = require('../models/PushToken');
const { sendPushNotification } = require('./firebasePush');

const sendIncomingCallPush = async ({
  userId,
  callId,
  conversationId,
  callType,
  caller
}) => {
  try {
    if (!userId || !callId || !conversationId || !caller) {
      console.error('[Call Push] Missing required call information.');
      return { success: false, sent: 0 };
    }

    const devices = await PushToken.find({
      user: userId,
      platform: 'android'
    })
      .select('token')
      .lean();

    if (!devices.length) {
      console.log('[Call Push] No registered Android device for user:', userId);
      return { success: false, sent: 0 };
    }

    const title =
      caller.displayName ||
      caller.customId ||
      'ChatNova Contact';

    const body =
      callType === 'video'
        ? 'Incoming video call'
        : 'Incoming voice call';

    const data = {
      notificationType: 'call',
      callAction: 'incoming',
      callId: String(callId),
      conversationId: String(conversationId),
      callType: callType === 'video' ? 'video' : 'voice',
      callerId: String(caller.id || ''),
      callerName: String(title),
      callerCustomId: String(caller.customId || '')
    };

    const results = await Promise.all(
      devices.map(async (device) => {
        const result = await sendPushNotification({
          deviceToken: device.token,
          title,
          body,
          data
        });

        if (!result.success && result.invalidToken) {
          await PushToken.deleteOne({ token: device.token });
        }

        return result;
      })
    );

    const sent = results.filter((result) => result.success).length;

    console.log(
      `[Call Push] Sent ${sent}/${devices.length} notification(s) for call ${callId}.`
    );

    return {
      success: sent > 0,
      sent,
      total: devices.length
    };
  } catch (error) {
    console.error('[Call Push Error]:', error.message);

    return {
      success: false,
      sent: 0,
      reason: error.message
    };
  }
};

module.exports = {
  sendIncomingCallPush
};

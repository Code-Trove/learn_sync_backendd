chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "auth") {
    console.log("OAuth Token Received:", message.session);

    const params = new URLSearchParams(message.session);
    const oauthToken = params.get("oauth_token");
    const oauthVerifier = params.get("oauth_verifier");

    if (oauthToken && oauthVerifier) {
      chrome.storage.local.set({ oauthToken, oauthVerifier }, () => {
        console.log("Tokens stored successfully!");
        sendResponse({ success: true });
      });
    } else {
      console.error("Tokens not received properly.");
      sendResponse({ success: false });
    }
  }
  return true; // Required to use async sendResponse
});

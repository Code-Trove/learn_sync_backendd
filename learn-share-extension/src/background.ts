chrome.runtime.onMessage.addListener(
  (
    message: { type: string; session?: string; token?: string },
    sender,
    sendResponse
  ) => {
    if (message.type === "GET_TOKEN") {
      // Retrieve token from Chrome's local storage
      chrome.storage.local.get("authToken", (result) => {
        sendResponse({ token: result.authToken });
      });
      return true; // Keeps the message channel open for async response
    }

    if (message.type === "SET_TOKEN" && message.token) {
      // Store token in Chrome's local storage
      chrome.storage.local.set({ authToken: message.token }, () => {
        sendResponse({ status: "success" });
      });
      return true; // Keeps the message channel open for async response
    }

    if (message.type === "auth") {
      console.log("OAuth Token Received:", message.session);

      // Ensure session starts with "?" for URLSearchParams to work
      const sessionString = message.session?.startsWith("?")
        ? message.session
        : `?${message.session}`;
      const params = new URLSearchParams(sessionString || "");

      // Extract tokens
      const oauthToken = params.get("oauth_token");
      const oauthVerifier = params.get("oauth_verifier");

      if (oauthToken && oauthVerifier) {
        // Store tokens in Chrome's local storage
        chrome.storage.local.set({ oauthToken, oauthVerifier }, () => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error storing tokens:",
              chrome.runtime.lastError.message
            );
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
            });
          } else {
            console.log("Tokens stored successfully!");
            sendResponse({ success: true });
          }
        });
      } else {
        // Log the actual session string for debugging
        console.error(
          "Tokens not received properly. Missing values in session string:",
          sessionString
        );
        sendResponse({
          success: false,
          error: "Missing oauth_token or oauth_verifier.",
          session: sessionString,
        });
      }
      return true; // Required to use async sendResponse
    }

    console.warn("Unknown message type:", message.type);
    sendResponse({ success: false, error: "Unknown message type." });
    return true; // Keeps the message channel open for async response
  }
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "oauth-twitter") {
    const oauthUrl = `https://api.twitter.com/oauth/authenticate?oauth_token=${message.oauthToken}`;

    // Launch WebAuthFlow to handle the OAuth process
    chrome.identity.launchWebAuthFlow(
      {
        url: oauthUrl,
        interactive: true, // This ensures the user gets prompted to log in if necessary
      },
      (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          console.error("OAuth failed:", chrome.runtime.lastError);
          sendResponse({
            success: false,
            error: chrome.runtime.lastError?.message || "OAuth failed",
          });
          return;
        }

        try {
          // Extract oauth_verifier from the redirect URL
          const urlParams = new URLSearchParams(new URL(redirectUrl).search);
          const oauthVerifier = urlParams.get("oauth_verifier");

          if (!oauthVerifier) {
            console.error(
              "OAuth verifier not found in redirect URL:",
              redirectUrl
            );
            sendResponse({ success: false, error: "OAuth verifier missing" });
            return;
          }

          // Successfully retrieved the oauth_verifier
          console.log("OAuth successful. Verifier:", oauthVerifier);
          sendResponse({ success: true, oauthVerifier });
        } catch (error) {
          console.error("Error processing redirect URL:", error);
          sendResponse({
            success: false,
            error: "Error processing redirect URL",
          });
        }
      }
    );

    // Return true to indicate that the response will be sent asynchronously
    return true;
  }
});

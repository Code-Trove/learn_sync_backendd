// Content script to handle OAuth callback
if (window.location.pathname.includes("oauth_callback")) {
  const params = new URLSearchParams(window.location.search);
  const oauthToken = params.get("oauth_token");
  const oauthVerifier = params.get("oauth_verifier");

  if (oauthToken && oauthVerifier) {
    chrome.runtime.sendMessage(
      {
        type: "twitter-oauth-callback",
        oauthToken,
        oauthVerifier,
      },
      () => {
        window.close();
      }
    );
  }
}

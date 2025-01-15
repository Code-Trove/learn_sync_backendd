// Injected script that runs on the callback URL
window.onload = function () {
  const queryString = window.location.search;
  chrome.runtime.sendMessage(
    { type: "auth", session: queryString },
    (response) => {
      console.log("OAuth Callback processed:", response);
      window.close();
    }
  );
};

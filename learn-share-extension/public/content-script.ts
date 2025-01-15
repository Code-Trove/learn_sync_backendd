// src/content-script.ts
chrome.runtime.sendMessage(
  { type: "auth", session: window.location.search.substr(1) },
  (response) => {
    window.open("", "_self", ""); // Close the tab
    window.close();
  }
);

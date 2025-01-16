const callbackUrl = "https://solor-system-rho.vercel.app/callback"; // Replace with your actual callback URL

if (window.location.href !== callbackUrl) {
  // Floating toolbar logic using an arrow function
  const handleSelection = () => {
    const selectedText = window.getSelection()?.toString().trim();
    if (selectedText) {
      // Show the floating toolbar for text selection
      console.log("Selected text: ", selectedText);
      // Optionally, you can add your toolbar rendering logic here
    }
  };

  document.addEventListener("mouseup", handleSelection);
  document.addEventListener("selectionchange", handleSelection);
} else {
  // OAuth flow: Handle the session response
  chrome.runtime.sendMessage(
    { type: "auth", session: window.location.search.substr(1) },
    (response) => {
      window.open("", "_self", "");
      window.close();
    }
  );
}

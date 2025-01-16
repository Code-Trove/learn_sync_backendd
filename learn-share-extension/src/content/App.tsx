import React, { useState, useEffect } from "react";
import SelectionPopup from "../components/SelectionPopup";
import Sidebar from "../components/Sidebar";
import { AuthProvider } from "../context/AuthContext";

const App = () => {
  const [selection, setSelection] = useState<{
    text: string;
    position: { x: number; y: number };
  } | null>(null);

  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedText, setSelectedText] = useState<string>(""); // Track the selected text for the slider

  useEffect(() => {
    const handleSelection = () => {
      const selectedText = window.getSelection()?.toString().trim();

      if (!selectedText) {
        setSelection(null);
        return;
      }

      const range = window.getSelection()?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();

      if (rect) {
        setSelection({
          text: selectedText,
          position: {
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY - 40,
          },
        });
      }
    };

    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("selectionchange", handleSelection);

    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("selectionchange", handleSelection);
    };
  }, []);

  const handleExploreClick = () => {
    if (selection) {
      setSelectedText(selection.text); // Save the currently selected text for the slider
      setShowSidebar(true); // Show the slider
      setSelection(null); // Hide the popup
    }
  };
  const handleShare = () => {
    if (selection) {
      setSelectedText(selection.text); // Save the currently selected text for the slider
      setShowSidebar(true); // Show the slider
      setSelection(null); // Hide the popup
    }
  };

  return (
    <>
      <AuthProvider>
        {/* Show Popup */}
        {selection && !showSidebar && (
          <SelectionPopup
            text={selection.text}
            position={selection.position}
            onClose={() => setSelection(null)}
            onExplore={handleExploreClick}
            onShare={handleShare}
          />
        )}

        {/* Show Sidebar */}
        {showSidebar && (
          <Sidebar
            text={selectedText} // Pass the selected text to the sidebar
            onClose={() => {
              setShowSidebar(false); // Close the slider
            }}
          />
        )}
      </AuthProvider>
    </>
  );
};

export default App;

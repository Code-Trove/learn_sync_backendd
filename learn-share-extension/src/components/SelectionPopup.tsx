import React, { useState, useEffect } from "react";
import Cookies from "js-cookie";
import { useAuth } from "../context/AuthContext";
interface Props {
  text: string;
  position: { x: number; y: number };
  onClose: () => void;
  onExplore: () => void;
  onShare: (text: string) => void; // Add onShare prop
}

interface SaveContentRequest {
  type: "TEXT";
  title: string;
  tags: string[];
  link: string;
  extractedText: string;
}

const SelectionPopup: React.FC<Props> = ({
  text,
  position,
  onClose,
  onExplore,
  onShare,
}) => {
  const { token } = useAuth(); // Destructure token from the auth context

  const handleSave = async () => {
    if (!token) {
      alert("You need to be logged in to save content.");
      return;
    }

    try {
      // Get current URL
      const currentUrl = window.location.href;

      // Generate title from the first few words of the selected text
      const title = text.split(" ").slice(0, 5).join(" ") + "...";

      // Extract keywords for tags
      const tags = text
        .split(" ")
        .filter((word) => word.length > 4)
        .slice(0, 3)
        .map((word) => word.toLowerCase());

      const saveRequest = {
        type: "TEXT",
        title,
        tags, // Send tags directly
        link: currentUrl,
        extractedText: text,
      };
      console.log("Save request:", saveRequest);

      const response = await fetch(
        "http://localhost:3125/api/v1/content/addContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(saveRequest),
        }
      );

      const data = await response.json();

      if (data.success) {
        alert("Content saved successfully!");
        onClose();
      } else {
        alert("Failed to save content.");
      }
    } catch (error) {
      console.error("Error saving content:", error);
      alert("Error saving content.");
    }
  };

  const handleShare = () => {
    onShare(text); // Pass the selected text to the Sidebar
  };

  // Log the token whenever it changes
  useEffect(() => {
    console.log("Token from context:", token);
  }, [token]);

  return (
    <div
      className="selection-popup animate-fade-in"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <button
        onClick={handleSave}
        className="px-3 py-1.5 bg-purple-500 text-white rounded-md hover:bg-purple-600"
      >
        🤖 Save
      </button>

      <button
        onClick={() => {
          console.log("Explore clicked");
          onExplore();
        }}
        className="px-3 py-1.5 bg-purple-500 text-white rounded-md hover:bg-purple-600"
      >
        🤖 Explore
      </button>

      <button
        onClick={handleShare}
        className="px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600"
      >
        🚀 Share
      </button>
    </div>
  );
};

export default SelectionPopup;

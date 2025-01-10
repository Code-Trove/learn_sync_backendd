import React, { useState } from "react";

interface Props {
  text: string; // The type of 'text' is a string
  onClose: () => void; // The type of 'onClose' is a function that returns void
}

const CraftPost: React.FC<Props> = ({ text, onClose }) => {
  const [postContent, setPostContent] = useState(text); // Start with the selected text
  const [platform, setPlatform] = useState("Facebook"); // Default platform
  const [customInput, setCustomInput] = useState(""); // Custom input for the post

  const handlePostCraft = () => {
    const craftedPost = `${postContent} ${
      customInput ? `\n\nAdditional Input: ${customInput}` : ""
    }`;
    alert(`Crafted Post for ${platform}: \n\n${craftedPost}`);
    // You can add further functionality to submit the crafted post for a specific platform.
  };

  return (
    <div className="fixed right-0 top-0 w-1/3 h-full bg-white shadow-lg p-4 overflow-y-auto">
      <button onClick={onClose} className="text-red-500">
        Close
      </button>
      <h2 className="text-xl font-bold mb-4">Craft Post</h2>

      {/* Display the selected text */}
      <div className="mb-4">
        <h3 className="font-bold">Selected Text:</h3>
        <p className="bg-gray-100 p-2 rounded">{text}</p>
      </div>

      {/* Platform selection */}
      <div className="mb-4">
        <h3 className="font-bold">Select Platform:</h3>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="w-full border p-2"
        >
          <option value="Facebook">Facebook</option>
          <option value="Twitter">Twitter</option>
          <option value="LinkedIn">LinkedIn</option>
          <option value="Instagram">Instagram</option>
        </select>
      </div>

      {/* Custom Input */}
      <div className="mb-4">
        <h3 className="font-bold">Additional Input:</h3>
        <textarea
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          className="w-full h-20 border p-2"
          placeholder="Add any additional details..."
        />
      </div>

      {/* Button to Craft Post */}
      <button
        onClick={handlePostCraft}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Craft Post
      </button>
    </div>
  );
};

export default CraftPost;

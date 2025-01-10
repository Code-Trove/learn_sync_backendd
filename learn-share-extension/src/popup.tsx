import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { FaTwitter, FaLinkedin, FaFacebook, FaInstagram } from "react-icons/fa";
import {
  TwitterShareButton,
  LinkedinShareButton,
  FacebookShareButton,
  InstapaperShareButton,
} from "react-share";

const Popup = () => {
  const [thought, setThought] = useState("");
  const [craftedThoughts, setCraftedThoughts] = useState({
    twitter: "",
    linkedin: "",
    facebook: "",
    instagram: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const handleCraftThought = async () => {
    try {
      const response = await fetch(
        "http://localhost:3125/api/v1/content/craft-thought",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thought }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setCraftedThoughts({
          twitter: data.twitter || "",
          linkedin: data.linkedin || "",
          facebook: data.facebook || "",
          instagram: data.instagram || "",
        });
        alert("Thought crafted successfully!");
      } else {
        alert("Failed to craft thought.");
      }
    } catch (error) {
      console.error("Error crafting thought:", error);
      alert("Error crafting thought.");
    }
  };

  const handleSearch = async () => {
    try {
      const response = await fetch(
        `http://localhost:3125/api/v1/content/search?query=${searchQuery}`
      );
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.results);
      } else {
        alert("Failed to search content.");
      }
    } catch (error) {
      console.error("Error searching content:", error);
      alert("Error searching content.");
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Learn Sync</h1>

      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2">Write Your Thought</h2>
        <textarea
          value={thought}
          onChange={(e) => setThought(e.target.value)}
          className="w-full p-2 border rounded mb-2"
          rows={4}
          placeholder="Write your thought here..."
        />
        <div className="flex gap-2">
          <button
            onClick={handleCraftThought}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Craft Thought
          </button>
          <button
            onClick={() => alert("Share directly")}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Share Directly
          </button>
        </div>
      </div>

      {craftedThoughts.twitter && (
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">Crafted Thoughts</h2>

          {/* Twitter Thought */}
          <div className="mb-4 p-4 border rounded">
            <div className="flex items-center gap-2">
              <FaTwitter className="text-[#1DA1F2] text-xl" />
              <h4 className="font-bold">Twitter Thought</h4>
            </div>
            <p className="my-2">{craftedThoughts.twitter}</p>
            <TwitterShareButton
              url={"https://yourwebsite.com"}
              title={craftedThoughts.twitter}
            >
              <button className="bg-[#1DA1F2] text-white px-4 py-2 rounded flex items-center gap-2">
                <FaTwitter />
                Share on Twitter
              </button>
            </TwitterShareButton>
          </div>

          {/* LinkedIn Thought */}
          <div className="mb-4 p-4 border rounded">
            <div className="flex items-center gap-2">
              <FaLinkedin className="text-[#0A66C2] text-xl" />
              <h4 className="font-bold">LinkedIn Thought</h4>
            </div>
            <p className="my-2">{craftedThoughts.linkedin}</p>
            <LinkedinShareButton
              url={"https://yourwebsite.com"}
              summary={craftedThoughts.linkedin}
            >
              <button className="bg-[#0A66C2] text-white px-4 py-2 rounded flex items-center gap-2">
                <FaLinkedin />
                Share on LinkedIn
              </button>
            </LinkedinShareButton>
          </div>

          {/* Facebook Thought */}
          <div className="mb-4 p-4 border rounded">
            <div className="flex items-center gap-2">
              <FaFacebook className="text-blue-600 text-xl" />
              <h4 className="font-bold">Facebook Thought</h4>
            </div>
            <p className="my-2">{craftedThoughts.facebook}</p>
            <FacebookShareButton
              url={"https://yourwebsite.com"}
              title={craftedThoughts.facebook}
            >
              <button className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2">
                <FaFacebook />
                Share on Facebook
              </button>
            </FacebookShareButton>
          </div>

          {/* Instagram Thought */}
          <div className="mb-4 p-4 border rounded">
            <div className="flex items-center gap-2">
              <FaInstagram className="text-pink-500 text-xl" />
              <h4 className="font-bold">Instagram Thought</h4>
            </div>
            <p className="my-2">{craftedThoughts.instagram}</p>
            <InstapaperShareButton
              url={"https://yourwebsite.com"}
              title={craftedThoughts.instagram}
            >
              <button className="bg-pink-500 text-white px-4 py-2 rounded flex items-center gap-2">
                <FaInstagram />
                Share on Instagram
              </button>
            </InstapaperShareButton>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2">Search Saved Content</h2>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 border rounded mb-2"
          placeholder="Search saved content..."
        />
        <button
          onClick={handleSearch}
          className="bg-purple-500 text-white px-4 py-2 rounded"
        >
          Search
        </button>
      </div>

      {searchResults.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xl font-bold mb-2">Search Results</h2>
          <ul className="list-disc pl-5">
            {searchResults.map((result, index) => (
              <li key={index} className="mb-2">
                <p className="bg-gray-100 p-2 rounded">{result}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<Popup />);

import React, { useState } from "react";
import { FaTwitter, FaLinkedin, FaFacebook, FaInstagram } from "react-icons/fa";
import {
  TwitterShareButton,
  LinkedinShareButton,
  FacebookShareButton,
  InstapaperShareButton,
} from "react-share";

interface Props {
  text: string;
  onClose: () => void;
}

const Sidebar: React.FC<Props> = ({ text, onClose }) => {
  const [conversation, setConversation] = useState("");
  const [allMessages, setAllMessages] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [isSummaryGenerated, setIsSummaryGenerated] = useState(false);
  const [isCraftingPost, setIsCraftingPost] = useState(false);
  const [posts, setPosts] = useState({
    twitter: "",
    instagram: "",
    linkedin: "",
    facebook: "",
  });
  const [isSharing, setIsSharing] = useState(false);
  const [isExploring, setIsExploring] = useState(false);
  const [shareText, setShareText] = useState(text);
  const [discussion, setDiscussion] = useState<string[]>([]);

  const handleChat = async () => {
    const userMessage = conversation.trim();
    if (!userMessage) return;

    // Extract full page context
    const pageContext = document.body.innerText;

    try {
      const response = await fetch(
        "http://localhost:3125/api/v1/content/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: text,
            question: userMessage,
            pageContext: pageContext,
            sourceUrl: window.location.href,
          }),
        }
      );

      const data = await response.json();
      const botResponse = data.response;

      setAllMessages((prev) => [
        ...prev,
        `You: ${userMessage}`,
        `Bot: ${botResponse}`,
      ]);
      setDiscussion((prev) => [
        ...prev,
        `User: ${userMessage}`,
        `Bot: ${botResponse}`,
      ]);
      setConversation("");
    } catch (error) {
      console.error("Error during chat:", error);
    }
  };

  const handleGenerateSummary = async () => {
    try {
      const response = await fetch(
        "http://localhost:3125/api/v1/content/summary",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text, discussion }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setSummary(data.summary);
        setIsSummaryGenerated(true);
      } else {
        alert("Failed to generate summary.");
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      alert("Error generating summary.");
    }
  };

  const handleCraftPost = async () => {
    try {
      const response = await fetch(
        "http://localhost:3125/api/v1/content/craft-posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: shareText,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        alert("Post crafted successfully!");
        setIsCraftingPost(true);
        setPosts({
          twitter: data.twitter || "",
          linkedin: data.linkedin || "",
          facebook: data.facebook || "",
          instagram: data.instagram || "",
        });
      } else {
        alert("Failed to craft post.");
      }
    } catch (error) {
      console.error("Error crafting post:", error);
      alert("Error crafting post.");
    }
  };

  const handleExplore = () => {
    setIsExploring(true);
    setIsSharing(false);
  };

  const handleShare = () => {
    setIsSharing(true);
    setIsExploring(false);
  };

  return (
    <div className="fixed right-0 top-0 w-1/3 h-full bg-white shadow-lg p-4 overflow-y-auto">
      <button onClick={onClose} className="text-red-500">
        Close
      </button>
      <h2 className="text-xl font-bold mb-4">Explore</h2>

      <div className="mb-4">
        <h3 className="font-bold">Selected Text:</h3>
        <p className="bg-gray-100 p-2 rounded">{text}</p>
      </div>

      <button
        onClick={handleExplore}
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

      {isExploring && (
        <div className="mt-4">
          <h3 className="font-bold">Interact with Chatbot:</h3>
          <textarea
            value={conversation}
            onChange={(e) => setConversation(e.target.value)}
            className="w-full mt-2 h-20 border p-2"
            placeholder="Type your question here..."
          />
          <button
            onClick={handleChat}
            className="mt-2 bg-blue-500 text-white px-4 py-2 rounded"
          >
            Send
          </button>
          <div className="mt-4">
            <h3 className="font-bold">Chat Messages:</h3>
            <div className="bg-gray-100 p-2 rounded h-40 overflow-y-auto">
              {allMessages.map((msg, index) => (
                <p key={index} className="mb-2">
                  {msg}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {isSharing && (
        <div className="mt-4">
          <textarea
            value={shareText}
            onChange={(e) => setShareText(e.target.value)}
            className="w-full p-2 border rounded"
            rows={4}
          />
          <button
            onClick={handleCraftPost}
            className="mt-2 bg-blue-500 text-white px-4 py-2 rounded"
          >
            Craft Post
          </button>
        </div>
      )}

      {discussion.length > 0 && (
        <div className="mt-4">
          <button
            onClick={handleGenerateSummary}
            className="bg-yellow-500 text-white px-4 py-2 rounded"
          >
            Generate Summary
          </button>
          {isSummaryGenerated && (
            <div className="mt-4">
              <h3 className="font-bold">Summary:</h3>
              <p className="bg-gray-100 p-2 rounded">{summary}</p>
            </div>
          )}
        </div>
      )}

      {isCraftingPost && (
        <div className="mt-4">
          <h3 className="font-bold">Crafted Posts:</h3>

          {/* Twitter Post */}
          <div className="mb-4 p-4 border rounded">
            <div className="flex items-center gap-2">
              <FaTwitter className="text-[#1DA1F2] text-xl" />
              <h4 className="font-bold">Twitter Post</h4>
            </div>
            <p className="my-2">{posts.twitter}</p>
            <TwitterShareButton
              url={"https://yourwebsite.com"}
              title={posts.twitter}
            >
              <button className="bg-[#1DA1F2] text-white px-4 py-2 rounded flex items-center gap-2">
                <FaTwitter />
                Share on Twitter
              </button>
            </TwitterShareButton>
          </div>

          {/* LinkedIn Post */}
          <div className="mb-4 p-4 border rounded">
            <div className="flex items-center gap-2">
              <FaLinkedin className="text-[#0A66C2] text-xl" />
              <h4 className="font-bold">LinkedIn Post</h4>
            </div>
            <p className="my-2">{posts.linkedin}</p>
            <LinkedinShareButton
              url={"https://yourwebsite.com"}
              summary={posts.linkedin}
            >
              <button className="bg-[#0A66C2] text-white px-4 py-2 rounded flex items-center gap-2">
                <FaLinkedin />
                Share on LinkedIn
              </button>
            </LinkedinShareButton>
          </div>

          {/* Facebook Post */}
          <div className="mb-4 p-4 border rounded">
            <div className="flex items-center gap-2">
              <FaFacebook className="text-blue-600 text-xl" />
              <h4 className="font-bold">Facebook Post</h4>
            </div>
            <p className="my-2">{posts.facebook}</p>
            <FacebookShareButton
              url={"https://yourwebsite.com"}
              hashtag={"#" + posts.facebook.split(" ")[0]}
            >
              <button className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2">
                <FaFacebook />
                Share on Facebook
              </button>
            </FacebookShareButton>
          </div>

          {/* Instagram Post */}
          <div className="mb-4 p-4 border rounded">
            <div className="flex items-center gap-2">
              <FaInstagram className="text-pink-500 text-xl" />
              <h4 className="font-bold">Instagram Post</h4>
            </div>
            <p className="my-2">{posts.instagram}</p>
            <InstapaperShareButton
              url={"https://yourwebsite.com"}
              title={posts.instagram}
            >
              <button className="bg-pink-500 text-white px-4 py-2 rounded flex items-center gap-2">
                <FaInstagram />
                Share on Instagram
              </button>
            </InstapaperShareButton>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;

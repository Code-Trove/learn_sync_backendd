import React, { useState, useEffect } from "react";

import { createRoot } from "react-dom/client";
import Cookies from "js-cookie";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaTwitter, FaLinkedin, FaFacebook, FaInstagram } from "react-icons/fa";
import {
  TwitterShareButton,
  LinkedinShareButton,
  FacebookShareButton,
  InstapaperShareButton,
} from "react-share";

interface LoginProps {
  onLogin: () => void;
  onSwitchToRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onSwitchToRegister }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const response = await fetch("http://localhost:3125/api/v1/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (data.success) {
        const token = data.token;

        // Store the token in cookies
        Cookies.set("token", token);

        // Store the token in Chrome runtime storage
        if (chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage(
            { type: "SET_TOKEN", token },
            (response) => {
              if (response.status !== "success") {
                console.error(
                  "Error saving token in chrome runtime:",
                  response.error
                );
              }
            }
          );
        }

        // Trigger onLogin callback
        onLogin();
      } else {
        alert("Login failed.");
      }
    } catch (error) {
      console.error("Error logging in:", error);
      alert("Error logging in.");
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2 border rounded mb-2"
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2 border rounded mb-2"
        placeholder="Password"
      />
      <button
        onClick={handleLogin}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Login
      </button>
      <button
        onClick={onSwitchToRegister}
        className="mt-2 text-blue-500 underline"
      >
        Register
      </button>
    </div>
  );
};

interface RegisterProps {
  onRegister: () => void;
  onSwitchToLogin: () => void;
}

const Register: React.FC<RegisterProps> = ({ onRegister, onSwitchToLogin }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    try {
      const response = await fetch("http://localhost:3125/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      if (data.success) {
        alert("Registration successful. Please log in.");
        onSwitchToLogin();
      } else {
        alert("Registration failed.");
      }
    } catch (error) {
      console.error("Error registering:", error);
      alert("Error registering.");
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Register</h1>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full p-2 border rounded mb-2"
        placeholder="Name"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2 border rounded mb-2"
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2 border rounded mb-2"
        placeholder="Password"
      />
      <button
        onClick={handleRegister}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Register
      </button>
      <button
        onClick={onSwitchToLogin}
        className="mt-2 text-blue-500 underline"
      >
        Login
      </button>
    </div>
  );
};

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
  const [isTwitterConnected, setIsTwitterConnected] = useState(false);
  const [twitterScreenName, setTwitterScreenName] = useState<string | null>(
    null
  );
  const [scheduledTime, setScheduledTime] = useState(new Date());

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
  // First, let's define our message types
  interface TwitterOAuthMessage {
    type: "oauth_tokens_ready";
    data: {
      oauthVerifier: string;
      oauthToken: string;
    };
  }

  const handleConnectTwitter = async () => {
    try {
      const token = Cookies.get("token");
      if (!token) {
        alert("User token is missing. Please log in first.");
        return;
      }

      const response = await fetch(
        "http://localhost:3125/api/v1/auth/twitter/request-token",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        }
      );

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to initiate Twitter connection");
      }

      const { authUrl, state, oauthToken } = data;

      await chrome.storage.local.set({
        twitter_oauth_state: state,
        twitter_oauth_token: oauthToken,
      });

      chrome.windows.create(
        {
          url: authUrl,
          type: "popup",
          width: 600,
          height: 800,
        },
        (createdWindow) => {
          if (!createdWindow?.id)
            throw new Error("Failed to create popup window");

          chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
            if (
              tab.windowId === createdWindow.id &&
              changeInfo.url?.includes("oauth_verifier")
            ) {
              try {
                const urlParams = new URLSearchParams(
                  new URL(changeInfo.url).search
                );
                const oauthVerifier = urlParams.get("oauth_verifier");
                const returnedOauthToken = urlParams.get("oauth_token");

                if (returnedOauthToken !== oauthToken) {
                  throw new Error("OAuth token mismatch");
                }

                const finalResponse = await fetch(
                  "http://localhost:3125/api/v1/auth/twitter/access-token",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      oauthToken: returnedOauthToken,
                      oauthVerifier,
                      state,
                    }),
                    credentials: "include",
                  }
                );

                const finalData = await finalResponse.json();
                if (!finalResponse.ok || !finalData.success) {
                  throw new Error(
                    finalData.error || "Failed to verify Twitter account"
                  );
                }

                // ✅ Store the connected state in local storage
                localStorage.setItem(
                  "twitterConnection",
                  JSON.stringify({
                    isConnected: true,
                    screenName: finalData.screenName,
                  })
                );

                alert(
                  `Successfully connected to Twitter as @${finalData.screenName}`
                );
                setIsTwitterConnected(true); // Update the React state
                chrome.windows.remove(createdWindow.id);
                globalThis.window.location.reload();
              } catch (error) {
                console.error("Error during OAuth exchange:", error);
                chrome.windows.remove(createdWindow.id);
                alert(error instanceof Error ? error.message : "OAuth failed");
              }
            }
          });
        }
      );
    } catch (error) {
      console.error("Error initiating Twitter connection:", error);
      alert(
        error instanceof Error
          ? `Error connecting: ${error.message}`
          : "An unexpected error occurred"
      );
    }
  };
  const handlePostToTwitter = async () => {
    try {
      const token = Cookies.get("token"); // User's session token
      const response = await fetch(
        "http://localhost:3125/api/v1/post/twitter",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: craftedThoughts.twitter }),
        }
      );

      const data = await response.json();
      if (data.success) {
        alert("Tweet posted successfully!");
      } else {
        alert(`Failed to post tweet: ${data.error}`);
      }
    } catch (error) {
      console.error("Error posting to Twitter:", error);
      alert("An unexpected error occurred.");
    }
  };

  useEffect(() => {
    const connectionData = localStorage.getItem("twitterConnection");
    if (connectionData) {
      const { isConnected, screenName } = JSON.parse(connectionData);
      setIsTwitterConnected(isConnected);
      setTwitterScreenName(screenName);
    }
  }, []);
  const handleDisconnectTwitter = () => {
    localStorage.removeItem("twitterConnection");
    setIsTwitterConnected(false);
    setTwitterScreenName(null);
    alert("Disconnected from Twitter.");
  };
  const handleScheduledPost = async () => {
    try {
      const token = Cookies.get("token");

      if (!scheduledTime || !craftedThoughts.twitter) {
        alert("Please enter the content and select a date!");
        return;
      }

      const response = await fetch(
        "http://localhost:3125/api/v1/schedule/twitter",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: craftedThoughts.twitter,
            scheduledTime: scheduledTime.toISOString(), // ISO format for Prisma compatibility
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        alert("Tweet scheduled successfully!");
      } else {
        alert(`Failed to schedule tweet: ${data.error}`);
      }
    } catch (error) {
      console.error("Error scheduling tweet:", error);
      alert("An unexpected error occurred.");
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
            {isTwitterConnected ? (
              <div className="flex gap-2">
                <button
                  onClick={handlePostToTwitter}
                  className="bg-[#1DA1F2] text-white px-4 py-2 rounded flex items-center gap-2"
                >
                  <FaTwitter />
                  Post to Twitter
                </button>
                <div className="space-y-4">
                  <DatePicker
                    selected={scheduledTime}
                    onChange={(date) => setScheduledTime(date!)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    dateFormat="Pp" // Displays date and time together
                    minDate={new Date()} // Prevent selecting past dates
                    className="border p-2 rounded"
                  />
                  <button
                    onClick={handleScheduledPost}
                    className="bg-[#1DA1F2] text-white px-4 py-2 rounded flex items-center gap-2"
                  >
                    Schedule Post
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button
                  onClick={handleConnectTwitter}
                  className="bg-[#1DA1F2] text-white px-4 py-2 rounded flex items-center gap-2"
                >
                  <FaTwitter />
                  Connect with Twitter
                </button>
              </div>
            )}
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
          <div>
            <p>Connected to Twitter as @{twitterScreenName}</p>
            <button onClick={handleDisconnectTwitter}>
              Disconnect Twitter
            </button>
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

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    const token = Cookies.get("token");
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  return isLoggedIn ? (
    <Popup />
  ) : isRegistering ? (
    <Register
      onRegister={() => setIsRegistering(false)}
      onSwitchToLogin={() => setIsRegistering(false)}
    />
  ) : (
    <Login
      onLogin={() => setIsLoggedIn(true)}
      onSwitchToRegister={() => setIsRegistering(true)}
    />
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  context: path.resolve(__dirname),
  entry: {
    popup: "./src/popup.tsx",
    background: "./src/background.ts",
    oauth_content: "./src/oauth_content.ts",
    index: "./src/content/index.tsx",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js", // Generate unique filenames for each entry (e.g., popup.js, background.js)
  },

  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader", "postcss-loader"],
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./public/popup.html",
      filename: "popup.html",
      chunks: ["popup"], // Include only the "popup" entry chunk
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "./public/manifest.json" },
        { from: "./src/styles/tailwind.css", to: "styles.css" },
      ],
    }),
  ],
};
